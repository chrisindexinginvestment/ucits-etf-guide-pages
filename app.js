const ETFS_URL = "./data/etfs.json";
const QUOTES_URL = "./data/market-data.json";
const LOW_LIQUIDITY_THRESHOLD_USD = 10_000;

const rowsElement = document.querySelector("#etf-rows");
const searchElement = document.querySelector("#search");
const emptyStateElement = document.querySelector("#empty-state");
const quoteStatusElement = document.querySelector("#quote-status");
const quoteUpdatedElement = document.querySelector("#quote-updated");
const quoteSnapshotDateElement = document.querySelector("#quote-snapshot-date");
const dataDateElement = document.querySelector("#data-date");
const sourceLinksElement = document.querySelector("#source-links");
const categoryFilter = document.querySelector("#category-filter");
const marketFilter = document.querySelector("#market-filter");
const replicationFilter = document.querySelector("#replication-filter");
const factorFilter = document.querySelector("#factor-filter");
const filterCountElement = document.querySelector("#filter-count");

const FACTOR_LABELS = {
  size: "規模（SMB）",
  value: "價值（HML）",
  profitability: "盈利能力（RMW）",
  investment: "投資（CMA）",
  momentum: "動能（Carhart UMD）",
  "low-volatility": "低波動（非 FF3/5）",
};

const formatMoney = (value, currency = "USD", maximumFractionDigits = 0) => {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: maximumFractionDigits > 0 ? Math.min(2, maximumFractionDigits) : 0,
    maximumFractionDigits,
  }).format(value);
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Hong_Kong",
  }).format(date);
};

const formatQuoteTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Hong_Kong",
  }).format(date);
};

const displayValue = (value, label = "待更新") =>
  value === null || value === undefined || value === "" ? `<span class="pending">${label}</span>` : value;

const criterionCheck = (label) =>
  `<span class="criterion-check" role="img" aria-label="${label}" title="${label}">✓</span>`;

const incomeTreatmentMarkup = (etf) => {
  const incomeTreatment = etf.incomeTreatment || "";
  if (/(?:\bacc\b|accumulat(?:ion|ing)|capitalisation|\b1c\b)/i.test(incomeTreatment)) {
    return `<span class="data-main">累積型</span>`;
  }
  if (/(?:\bdist\b|distributing|distribution|\b1d\b)/i.test(incomeTreatment)) {
    return `<span class="data-main">派息型</span>`;
  }
  return `<span class="pending">待核實</span>`;
};

const factorMarkup = (etf) => {
  const factors = (etf.factorTags || []).map((factor) =>
    `<span class="factor-pill">${FACTOR_LABELS[factor] || factor}</span>`,
  ).join("");
  const note = etf.factorNote ? `<span class="data-sub">${etf.factorNote}</span>` : "";
  return factors || note ? `${factors}${note}` : `<span class="pending">不適用</span>`;
};

const quoteMarkup = (quote, fallbackUpdatedAt) => {
  if (!quote || quote.bidUsd === null || quote.bidUsd === undefined || quote.askUsd === null || quote.askUsd === undefined) {
    const message = quote && quote.currency !== "USD" ? "等待 FX 換算" : "未有快照";
    return `<span class="pending">${message}</span>`;
  }
  const bid = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(quote.bidUsd);
  const ask = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(quote.askUsd);
  const spread = quote.spreadPct === null || quote.spreadPct === undefined || quote.spreadUsd === null
    ? ""
    : `<span class="spread-pill">差 ${formatMoney(quote.spreadUsd, "USD", 4)} · ${Number.isFinite(quote.spreadBps) ? quote.spreadBps.toFixed(1) : "—"} bps · ${quote.spreadPct.toFixed(3)}%${Number.isFinite(quote.spreadBps) && quote.spreadBps <= 5 ? criterionCheck("買賣差價不高於 5 bps") : ""}</span>`;
  const quoteTimestamp = formatQuoteTime(quote.updatedAt || fallbackUpdatedAt);
  const quoteDate = quoteTimestamp ? `<span class="data-sub">報價：${quoteTimestamp}（香港時間）</span>` : "";
  const liquidity = quote.liquidityStatus === "low"
    ? `<span class="liquidity-warning" title="IB 頂層 bid/ask 較小一側掛單金額低於 US$${LOW_LIQUIDITY_THRESHOLD_USD.toLocaleString()} 門檻"><span aria-hidden="true">⚠</span> IB 流動性偏低</span>`
    : quote.liquidityCheckedAt && quote.liquidityStatus !== "adequate"
      ? `<span class="liquidity-unknown">IB 未提供完整 size，流動性待核實 <span class="data-sub">size 檢查 ${formatQuoteTime(quote.liquidityCheckedAt)}（香港時間）</span></span>`
      : "";
  return `<span class="quote-values"><span>B ${bid}</span><span>A ${ask}</span></span>${spread}${liquidity}${quoteDate}`;
};

const renderRows = (etfs, marketData) => {
  const query = searchElement.value.trim().toLocaleLowerCase();
  const quotes = marketData.quotes || {};
  const fxRates = marketData.fxRates || {};
  const visibleEtfs = etfs.filter((etf) =>
    `${etf.ticker} ${(etf.ibSearchTickers || []).join(" ")} ${etf.name} ${etf.index} ${etf.issuer} ${etf.marketScope} ${etf.weighting} ${etf.factorTags || []}`.toLocaleLowerCase().includes(query)
      && (categoryFilter.value === "all" || etf.category === categoryFilter.value)
      && (marketFilter.value === "all" || (etf.marketTags || []).includes(marketFilter.value))
      && (replicationFilter.value === "all" || etf.replicationType === replicationFilter.value)
      && (factorFilter.value === "all" || (etf.factorTags || []).includes(factorFilter.value)),
  );

  rowsElement.innerHTML = visibleEtfs.map((etf) => {
    const quote = quotes[etf.ticker];
    const aumFx = etf.aumReportedCurrency === "USD"
      ? 1
      : fxRates[`${etf.aumReportedCurrency}USD`]?.mid;
    const aumUsdM = etf.aumReportedM === null || etf.aumReportedM === undefined || !aumFx
      ? null
      : etf.aumReportedM * aumFx;
    const aum = aumUsdM === null
      ? null
      : `$${(aumUsdM / 1000).toFixed(2)}bn${etf.aumReportedCurrency !== "USD" ? ` <span class="data-sub">按 ${etf.aumReportedCurrency}/USD ${aumFx.toFixed(4)} 換算</span>` : ""}`;
    const aumCheck = aumUsdM > 1000 ? criterionCheck("資產規模超過 US$1bn") : "";
    const aumScope = etf.aumScope === "fund" ? "整隻基金" : "文件 AUM（未分份額類別）";
    const inception = formatDate(etf.inceptionDate);
    const useAverageDuration = !Number.isFinite(etf.effectiveDurationYears)
      && Number.isFinite(etf.reportedDurationYears)
      && etf.reportedDurationLabel?.startsWith("Average duration");
    const durationYears = useAverageDuration ? etf.reportedDurationYears : etf.effectiveDurationYears;
    const durationAsOf = useAverageDuration ? etf.reportedDurationAsOf : etf.durationAsOf;
    const duration = etf.category !== "bond"
      ? `<span class="pending">—</span>`
      : !Number.isFinite(durationYears)
        ? `<span class="pending">待核實</span>${etf.maturityRange ? `<span class="data-sub">指數到期範圍：${etf.maturityRange}</span>` : ""}`
        : `<span class="data-main">${durationYears.toFixed(2)} 年${useAverageDuration ? `<span aria-label="平均存續期，非有效存續期" title="平均存續期，非有效存續期">*</span>` : ""}</span>${useAverageDuration ? `<span class="data-sub">* 平均存續期（Average duration）</span>` : ""}${durationAsOf ? `<span class="data-sub">截至 ${formatDate(durationAsOf)}</span>` : ""}`;
    const trackingError = etf.trackingError === null || etf.trackingError === undefined
      ? null
      : `${etf.trackingError.toFixed(2)}% <span class="data-sub">${etf.trackingErrorPeriod || ""}</span>`;
    const currencyDescription = etf.shareClassCurrency
      ? `${etf.shareClassCurrency} 基金貨幣`
      : "基金貨幣待核實";
    const listingCurrencyDescription = `${etf.quoteCurrency || "貨幣待核實"} 上市報價${etf.quoteUnitLabel ? `（${etf.quoteUnitLabel}）` : ""}`;
    const fundName = etf.listingGroup
      ? `${etf.name}<span class="fund-meta">同一 ISIN 的另一上市代號；非另一隻基金</span>`
      : etf.name;
    const ibSearchTickers = etf.ibSearchTickers?.length
      ? `<span class="fund-meta">IB 搜尋代號：${etf.ibSearchTickers.join(" / ")}</span>`
      : "";
    const warning = etf.leverageWarning
      ? `<span class="warning-pill" title="${etf.leverageWarning}">⚠ 2× 每日槓桿</span>`
      : "";
    const swapBadge = etf.replicationType === "swap"
      ? `<span class="warning-pill">SWAP 式</span>`
      : "";
    const replication = etf.replicationLabel || (etf.replicationType === "unknown" ? "待核實" : "實物複製");
    const incomeTreatment = incomeTreatmentMarkup(etf);
    const ter = etf.ter === null || etf.ter === undefined ? null : `${etf.ter.toFixed(2)}%`;
    const terCheck = etf.ter !== null && etf.ter !== undefined && etf.ter < 0.2
      ? criterionCheck("TER 低於 0.20%")
      : "";

    return `<tr>
      <td class="fund-cell">
        <div class="fund-name">
          <span class="ticker-badge">${etf.ticker}</span>
          <span><strong>${fundName}</strong>${ibSearchTickers}<span class="fund-meta">${etf.index}</span><a class="fund-meta" href="${etf.factsheetUrl || etf.sourceUrl}" target="_blank" rel="noreferrer">官方 factsheet · ${etf.factsheetAsOf || "日期待核實"} ↗</a>${etf.verificationNote ? `<span class="fund-meta verification-warning">${etf.verificationNote}</span>` : ""}</span>
        </div>
      </td>
      <td>${incomeTreatment}</td>
      <td class="aum-cell"><span class="data-main">${displayValue(aum, etf.aumReportedM === null ? "待核實" : "等待 FX 換算")}${aumCheck}</span>${aum ? `<span class="data-sub">${aumScope} · 截至 ${etf.aumAsOf || "日期待核實"}</span>` : ""}${etf.aumNote ? `<span class="data-sub">${etf.aumNote}</span>` : ""}</td>
      <td>${quoteMarkup(quote, marketData.updatedAt)}</td>
      <td><span class="data-main">${currencyDescription}</span><span class="data-sub">${listingCurrencyDescription}</span></td>
      <td><span class="market-main">${etf.marketScope}</span></td>
      <td class="duration-cell">${duration}</td>
      <td><span class="data-main">${etf.weighting}</span>${warning}</td>
      <td><span class="data-main">${replication}</span>${swapBadge}</td>
      <td class="factor-cell">${factorMarkup(etf)}</td>
      <td class="cost-cell"><span class="data-main">${displayValue(ter, "待核實")}${terCheck}</span><span class="data-sub">${etf.terLabel || "TER"}${etf.terAsOf ? ` · ${etf.terAsOf}` : ""}</span></td>
      <td class="date-cell"><span class="data-main">${displayValue(inception, "待核實")}</span>${etf.inceptionDateLabel ? `<span class="data-sub">${etf.inceptionDateLabel}</span>` : ""}</td>
      <td class="tracking-cell"><span class="data-main">${displayValue(trackingError, etf.trackingErrorNote ? "未提供可核實百分比" : "待核實")}</span>${etf.trackingErrorNote ? `<span class="data-sub">${etf.trackingErrorNote}</span>` : ""}</td>
    </tr>`;
  }).join("");

  emptyStateElement.hidden = visibleEtfs.length > 0;
  filterCountElement.textContent = `顯示 ${visibleEtfs.length} / ${etfs.length} 隻`;
};

const renderSources = (etfs) => {
  const groups = [
    { label: "市值加權", funds: etfs.filter((etf) => etf.category !== "bond" && !(etf.factorTags || []).length) },
    { label: "因子", funds: etfs.filter((etf) => etf.category !== "bond" && (etf.factorTags || []).length > 0) },
    { label: "債券", funds: etfs.filter((etf) => etf.category === "bond") },
  ];
  sourceLinksElement.innerHTML = groups.map(({ label, funds }) =>
    `<section class="source-group"><h3>${label}</h3><div class="source-group-links">${funds.map((etf) =>
      `<a href="${etf.factsheetUrl || etf.sourceUrl}" target="_blank" rel="noreferrer">${etf.ticker} factsheet · ${etf.factsheetAsOf || "日期待核實"} ↗</a>`,
    ).join("")}</div></section>`,
  ).join("");
};

const renderQuoteStatus = (marketData) => {
  const timestamp = formatQuoteTime(marketData.updatedAt);
  const snapshotDateValue = marketData.updatedAt ? new Date(marketData.updatedAt) : null;
  const snapshotDate = snapshotDateValue && !Number.isNaN(snapshotDateValue.getTime())
    ? new Intl.DateTimeFormat("zh-HK", { dateStyle: "long", timeZone: "Asia/Hong_Kong" }).format(snapshotDateValue)
    : null;
  quoteSnapshotDateElement.textContent = snapshotDate || "尚未匯入 IB 報價";
  if (!timestamp) {
    quoteStatusElement.textContent = "尚未匯入 IB Gateway 報價";
    quoteUpdatedElement.textContent = "尚未匯入 IB 報價";
  } else {
    const failureCount = Object.keys(marketData.errors || {}).length + Object.keys(marketData.fxErrors || {}).length;
    const quoteCount = Object.keys(marketData.quotes || {}).length;
    quoteUpdatedElement.textContent = `${timestamp}（香港時間）`;
    document.querySelector(".live-indicator").classList.toggle("is-live", !failureCount && marketData.marketDataType === 1);
    if (marketData.partialUpdatedAt) {
      const partialTime = formatQuoteTime(marketData.partialUpdatedAt);
      const updatedTickers = (marketData.partialTickers || []).join("、");
      const dataType = marketData.partialMarketDataTypeLabel || marketData.marketDataTypeLabel || "IB 快照";
      quoteStatusElement.textContent = `${dataType} · ${updatedTickers} 已更新（${partialTime}，香港時間）；其他標的沿用原快照${failureCount ? ` · ${failureCount} 項報價未成功` : ""}`;
    } else {
      const dataType = marketData.marketDataTypeLabel || "IB 快照";
      quoteStatusElement.textContent = `${dataType} · ${failureCount ? `${failureCount} 項未成功` : `${quoteCount} 個報價已更新`}`;
    }
  }
  const fxTimestamp = formatQuoteTime(marketData.fxUpdatedAt || marketData.updatedAt);
  const fxDateElement = document.querySelector("#fx-updated");
  if (fxDateElement) fxDateElement.textContent = fxTimestamp ? `${fxTimestamp}（香港時間）` : "尚未更新";
  const fxSourceElement = document.querySelector("#fx-source");
  if (fxSourceElement) fxSourceElement.textContent = marketData.fxRateSource || "來源未標示";
};

const load = async () => {
  try {
    const [etfsResponse, quotesResponse] = await Promise.all([
      fetch(ETFS_URL, { cache: "no-store" }),
      fetch(QUOTES_URL, { cache: "no-store" }),
    ]);
    if (!etfsResponse.ok) throw new Error(`ETF 資料載入失敗：HTTP ${etfsResponse.status}`);
    if (!quotesResponse.ok) throw new Error(`IB 報價檔載入失敗：HTTP ${quotesResponse.status}`);
    const [etfs, marketData] = await Promise.all([etfsResponse.json(), quotesResponse.json()]);
    const tickerOrder = ["VALL", "VWRA", "FWRA", "ISAC", "IMID", "ACWD", "SWRD", "SWDA", "LVWC", "VWRD", "IWDA", "EIMI", "SPYL", "CSPX", "VUAA", "MXUS", "SPXS", "EXUS", "XUSE", "WEXU", "ESAN", "AVGS", "ZPRX", "ZPRV", "MVOL", "JPGL", "IWMO", "XDEM", "WMSE", "IFSW", "WSML", "EMVL", "LEMA", "IWVL", "CBU0", "CBU3", "CBU7", "AGGU", "AGGG", "AGAC", "IGLA", "VAGU", "VDTA", "VDST", "IB01", "BB3M"];
    const orderIndex = new Map(tickerOrder.map((ticker, index) => [ticker, index]));
    etfs.sort((left, right) => (orderIndex.get(left.ticker) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.ticker) ?? Number.MAX_SAFE_INTEGER));
    const researchDate = etfs[0]?.dataAsOf;
    dataDateElement.textContent = researchDate || "待更新";
    renderRows(etfs, marketData);
    renderSources(etfs);
    renderQuoteStatus(marketData);
    const rerender = () => renderRows(etfs, marketData);
    searchElement.addEventListener("input", rerender);
    for (const filter of [categoryFilter, marketFilter, replicationFilter, factorFilter]) {
      filter.addEventListener("change", rerender);
    }
    document.querySelector("#reset-filters").addEventListener("click", () => {
      searchElement.value = "";
      categoryFilter.value = "all";
      marketFilter.value = "all";
      replicationFilter.value = "all";
      factorFilter.value = "all";
      rerender();
    });
  } catch (error) {
    console.error(error);
    quoteStatusElement.textContent = "資料載入失敗，請檢查 data/ 內的 JSON 檔案。";
    quoteUpdatedElement.textContent = "資料載入失敗";
    rowsElement.innerHTML = "";
    emptyStateElement.hidden = false;
    emptyStateElement.textContent = "暫時無法載入基金資料。請重新整理，或檢查網頁的 data/ 檔案。";
  }
};

load();
