const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const etfs = JSON.parse(fs.readFileSync(path.join(root, "data", "etfs.json"), "utf8"));
const marketData = JSON.parse(fs.readFileSync(path.join(root, "data", "market-data.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app.js"), "utf8");
const byTicker = (ticker) => etfs.find((etf) => etf.ticker === ticker);

const createApp = async () => {
  const elements = new Map();
  const errors = [];
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, {
          value: selector.endsWith("-filter") ? "all" : "",
          innerHTML: "",
          textContent: "",
          hidden: false,
          handlers: {},
          classList: { toggle() {} },
          addEventListener(event, handler) { this.handlers[event] = handler; },
        });
      }
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document,
    Intl,
    console: { error: (...args) => errors.push(args) },
    fetch: async (url) => ({
      ok: true,
      json: async () => structuredClone(url.includes("etfs.json") ? etfs : marketData),
    }),
  });
  vm.runInContext(script.replace(/load\(\);\s*$/, "globalThis.ready = load();"), context);
  vm.runInContext("globalThis.api = { renderRows, renderSources, incomeTreatmentMarkup };", context);
  await context.ready;
  assert.deepEqual(errors, []);
  return { document, api: context.api };
};

test("all 46 listing records have official factsheet provenance and verified core fields", () => {
  assert.equal(etfs.length, 46);
  assert.equal(new Set(etfs.map((etf) => etf.ticker)).size, 46);
  const hosts = new Set([
    "fund-docs.vanguard.com", "www.ishares.com", "www.ssga.com", "etf.dws.com",
    "www.invesco.com", "www.amundietf.com", "www.amundietf.co.uk",
    "res.avantisinvestors.com", "docfinder.bnpparibas-am.com", "jp.techrules.com",
  ]);
  for (const etf of etfs) {
    assert.match(etf.isin, /^[A-Z]{2}[A-Z0-9]{10}$/, etf.ticker);
    assert.equal(etf.verifiedAt, "2026-10-21", etf.ticker);
    assert.equal(etf.sourceUrl, etf.factsheetUrl, etf.ticker);
    assert.ok(hosts.has(new URL(etf.factsheetUrl).hostname), etf.ticker);
    assert.ok(Number.isFinite(etf.aumReportedM) && etf.aumReportedM > 0, etf.ticker);
    assert.ok(Number.isFinite(etf.ter) && etf.ter >= 0, etf.ticker);
    for (const field of ["aumAsOf", "factsheetAsOf", "terAsOf", "inceptionDate"]) {
      assert.match(etf[field], /^\d{4}-\d{2}-\d{2}$/, `${etf.ticker}: ${field}`);
    }
    assert.ok(etf.terLabel && etf.incomeTreatment, etf.ticker);
    assert.ok(etf.listingDate || etf.listingDateNote, etf.ticker);
    assert.ok(etf.trackingError !== null || etf.trackingErrorNote, etf.ticker);
    if (etf.trackingError !== null) {
      assert.ok(Number.isFinite(etf.trackingError) && etf.trackingError >= 0, etf.ticker);
      assert.ok(etf.trackingErrorPeriod, etf.ticker);
    }
  }
});

test("missing disclosures and the older LVWC factsheet remain explicit", () => {
  assert.equal(etfs.filter((etf) => etf.factsheetAsOf === "2026-09-30").length, 45);
  const lvwc = byTicker("LVWC");
  assert.equal(lvwc.factsheetAsOf, "2025-11-30");
  assert.equal(lvwc.aumAsOf, "2025-11-28");
  assert.match(lvwc.verificationNote, /未能確認/);
  assert.equal(byTicker("ESAN").trackingError, null);
  assert.match(byTicker("ESAN").trackingErrorNote, /單位/);
  assert.equal(byTicker("SPYL").trackingError, null);
  assert.equal(byTicker("AVGS").trackingError, null);
});

test("verified fund assets do not get confused with share-class assets", () => {
  assert.equal(byTicker("SPYL").aumReportedM, 43773.94);
  assert.equal(byTicker("VWRA").aumReportedM, 87295);
  assert.equal(byTicker("VWRA").aumReportedM, byTicker("VWRD").aumReportedM);
  assert.equal(byTicker("SWDA").aumReportedM, byTicker("IWDA").aumReportedM);
  assert.equal(byTicker("AGAC").aumReportedM, byTicker("AGGU").aumReportedM);
  assert.equal(byTicker("EXUS").aumReportedM, 8110);
  assert.match(byTicker("AVGS").aumNote, /\$1\.7B/);
});

test("average duration is never stored as effective duration", () => {
  for (const ticker of ["VAGU", "VDTA", "VDST", "BB3M"]) {
    const etf = byTicker(ticker);
    assert.equal(etf.effectiveDurationYears, null, ticker);
    assert.ok(Number.isFinite(etf.reportedDurationYears), ticker);
    assert.match(etf.reportedDurationLabel, /Average duration/, ticker);
  }
  assert.equal(byTicker("CBU0").effectiveDurationYears, 6.86);
  assert.equal(byTicker("CBU7").effectiveDurationYears, 4.26);
  assert.equal(byTicker("CBU0").durationAsOf, "2026-10-05");
});

test("rendering preserves income, quotes, source links and the older-source warning", async () => {
  const { document } = await createApp();
  const rows = document.querySelector("#etf-rows").innerHTML;
  assert.equal((rows.match(/<tr>/g) || []).length, 46);
  assert.equal((rows.match(/官方 factsheet/g) || []).length, 46);
  assert.equal((rows.match(/>累積型</g) || []).length, 44);
  assert.equal((rows.match(/>派息型</g) || []).length, 2);
  assert.match(rows, /quote-values/);
  assert.match(rows, /verification-warning/);
  assert.match(rows, /2025-11-30/);
  assert.equal(document.querySelector("#data-date").textContent, "2026-10-21");
  const sourceLinks = document.querySelector("#source-links").innerHTML;
  assert.equal((sourceLinks.match(/<a /g) || []).length, 46);
  assert.deepEqual(
    [...sourceLinks.matchAll(/<section class="source-group"><h3>([^<]+)<\/h3>/g)].map((match) => match[1]),
    ["市值加權", "因子", "債券"],
  );
  for (const [label, funds] of [
    ["市值加權", etfs.filter((etf) => etf.category !== "bond" && !(etf.factorTags || []).length)],
    ["因子", etfs.filter((etf) => etf.category !== "bond" && (etf.factorTags || []).length > 0)],
    ["債券", etfs.filter((etf) => etf.category === "bond")],
  ]) {
    const groupStart = sourceLinks.indexOf(`<section class="source-group"><h3>${label}</h3>`);
    assert.notEqual(groupStart, -1, label);
    const groupEnd = sourceLinks.indexOf("</section>", groupStart);
    const group = sourceLinks.slice(groupStart, groupEnd);
    assert.equal((group.match(/<a /g) || []).length, funds.length, label);
    for (const etf of funds) assert.ok(group.includes(`${etf.ticker} factsheet`), `${label}: ${etf.ticker}`);
  }
});

test("USD AUM is not labelled as EUR conversion; EUR AUM uses the actual FX snapshot", async () => {
  const { document, api } = await createApp();
  api.renderRows([byTicker("SPYL")], marketData);
  let rows = document.querySelector("#etf-rows").innerHTML;
  assert.match(rows, /\$43\.77bn/);
  assert.doesNotMatch(rows, /按 EUR\/USD/);
  api.renderRows([byTicker("ZPRX")], marketData);
  rows = document.querySelector("#etf-rows").innerHTML;
  assert.match(rows, /按 EUR\/USD 1\.1226 換算/);
  assert.match(rows, /\$0\.94bn/);
  api.renderRows([byTicker("ZPRX")], { quotes: {}, fxRates: {} });
  assert.match(document.querySelector("#etf-rows").innerHTML, /等待 FX 換算/);
});

test("comparison table has 13 aligned columns and no personal rating column", async () => {
  const { document } = await createApp();
  const header = html.match(/<thead>[\s\S]*?<\/thead>/)[0];
  assert.equal((header.match(/<th scope="col">/g) || []).length, 13);
  assert.doesNotMatch(html, /我的評分|個人評分/);
  const rows = document.querySelector("#etf-rows").innerHTML;
  for (const row of rows.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    assert.equal((row[1].match(/<td(?:\s|>)/g) || []).length, 13);
  }
  assert.doesNotMatch(rows, /rating|待評分|個人評分/);
});

test("date column displays share-class inception instead of listing date", async () => {
  const { document, api } = await createApp();
  api.renderRows([byTicker("AVGS")], marketData);
  let rows = document.querySelector("#etf-rows").innerHTML;
  assert.doesNotMatch(rows, /2024年12月4日/);
  assert.match(rows, /2024年9月25日/);
  assert.match(html, /<th scope="col">份額類別成立日期<\/th>/);
  assert.doesNotMatch(html, /<th scope="col">上市日期<\/th>/);
  api.renderRows([{ ...byTicker("AVGS"), inceptionDate: null }], marketData);
  rows = document.querySelector("#etf-rows").innerHTML;
  assert.match(rows, /class="date-cell">.*待核實/);
  assert.doesNotMatch(rows, /2024年12月4日/);
});

test("bond duration uses starred averages only when effective duration is unavailable", async () => {
  const { document, api } = await createApp();
  for (const ticker of ["VAGU", "VDTA", "VDST", "BB3M"]) {
    const etf = byTicker(ticker);
    api.renderRows([etf], marketData);
    const rows = document.querySelector("#etf-rows").innerHTML;
    assert.ok(rows.includes(`class="data-main">${etf.reportedDurationYears.toFixed(2)} 年<span`));
    assert.match(rows, />\*<\/span>/);
    assert.match(rows, /\* 平均存續期（Average duration）/);
    assert.match(rows, /截至 2026年9月30日/);
    assert.doesNotMatch(rows, /Factsheet 只列平均存續期/);
  }
  api.renderRows([{ ...byTicker("CBU0"), reportedDurationYears: 9, reportedDurationLabel: "Average duration" }], marketData);
  let rows = document.querySelector("#etf-rows").innerHTML;
  assert.match(rows, /class="data-main">6\.86 年<\/span>/);
  assert.doesNotMatch(rows, />\*<\/span>/);
  for (const invalidAverage of [
    { reportedDurationYears: null },
    { reportedDurationYears: 1, reportedDurationLabel: "Average maturity" },
  ]) {
    api.renderRows([{ ...byTicker("VAGU"), ...invalidAverage }], marketData);
    rows = document.querySelector("#etf-rows").innerHTML;
    assert.match(rows, /class="duration-cell"><span class="pending">待核實/);
    assert.doesNotMatch(rows, />\*<\/span>/);
  }
  api.renderRows([{ ...byTicker("VALL"), reportedDurationYears: 9, reportedDurationLabel: "Average duration" }], marketData);
  assert.match(document.querySelector("#etf-rows").innerHTML, /class="duration-cell"><span class="pending">—<\/span>/);
  assert.match(html, /\* 債券 ETF 未披露有效存續期時/);
});

test("unverified income is not inferred from a fund name", async () => {
  const { api } = await createApp();
  assert.match(api.incomeTreatmentMarkup({ name: "Example Acc" }), /待核實/);
  assert.match(api.incomeTreatmentMarkup({ incomeTreatment: "Accumulating" }), /累積型/);
});

test("filters, search, empty state and reset still work", async () => {
  const { document } = await createApp();
  const category = document.querySelector("#category-filter");
  category.value = "bond";
  category.handlers.change();
  assert.equal((document.querySelector("#etf-rows").innerHTML.match(/<tr>/g) || []).length, 12);
  const search = document.querySelector("#search");
  search.value = "NOT_A_REAL_TICKER";
  search.handlers.input();
  assert.equal(document.querySelector("#empty-state").hidden, false);
  document.querySelector("#reset-filters").handlers.click();
  assert.equal(category.value, "all");
  assert.equal(search.value, "");
  assert.equal((document.querySelector("#etf-rows").innerHTML.match(/<tr>/g) || []).length, 46);
});

test("IB search aliases are displayed and searchable without replacing primary tickers or quotes", async () => {
  const { document } = await createApp();
  const search = document.querySelector("#search");
  assert.equal(etfs.filter((etf) => etf.ibSearchTickers?.length).length, 3);
  for (const [ticker, alias] of [["CBU0", "CSBGU0"], ["CBU3", "CSBGU3"], ["CBU7", "CSBGU7"]]) {
    assert.deepEqual(byTicker(ticker).ibSearchTickers, [alias]);
    for (const query of [ticker, ` ${alias.toLowerCase()} `]) {
      search.value = query;
      search.handlers.input();
      const rows = document.querySelector("#etf-rows").innerHTML;
      assert.equal((rows.match(/<tr>/g) || []).length, 1);
      assert.ok(rows.includes(`<span class="ticker-badge">${ticker}</span>`));
      assert.ok(rows.includes(`IB 搜尋代號：${alias}`));
      assert.match(rows, /quote-values/);
      assert.equal(document.querySelector("#empty-state").hidden, true);
    }
  }
  document.querySelector("#category-filter").value = "equity";
  search.handlers.input();
  assert.equal(document.querySelector("#etf-rows").innerHTML, "");
  assert.equal(document.querySelector("#empty-state").hidden, false);
  document.querySelector("#reset-filters").handlers.click();
  assert.equal((document.querySelector("#etf-rows").innerHTML.match(/IB 搜尋代號：/g) || []).length, 3);
});

test("both portfolio examples have exact weights and distinguish the equity denominator", () => {
  assert.ok(html.indexOf('id="compare"') < html.indexOf('id="allocation"'));
  assert.ok(html.indexOf('id="allocation"') < html.indexOf('id="method"'));
  const allocation = html.slice(html.indexOf('<section class="allocation'), html.indexOf('<section class="method'));
  const weights = [...allocation.matchAll(/--allocation-weight: (\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(weights, [80, 20, 60, 20, 20]);
  assert.equal(weights[0] + weights[1], 100);
  assert.equal(weights.slice(2).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(60 / 80 * 100, 75);
  assert.equal(20 / 80 * 100, 25);
  assert.match(allocation, /75% market cap weighted/);
  assert.match(allocation, /25% 側重 small cap value tilt/);
  assert.match(allocation, /並非整體組合的 75%／25%/);
  assert.match(allocation, /不是個人化投資建議/);
});
