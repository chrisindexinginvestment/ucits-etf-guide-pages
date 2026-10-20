const ETFS_URL = "./data/etfs.json";
const QUOTES_URL = "./data/market-data.json";
const RATINGS_KEY = "ucits-etf-guide-ratings-v1";

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

const readRatings = () => {
  try {
    const saved = localStorage.getItem(RATINGS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("Unable to read ETF ratings from this browser.", error);
    return {};
  }
};

const saveRating = (ticker, rating) => {
  const ratings = readRatings();
  if (rating === 0) {
    delete ratings[ticker];
  } else {
    ratings[ticker] = rating;
  }
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  } catch (error) {
    console.error("Unable to save ETF rating in this browser.", error);
  }
};

const displayValue = (value, label = "待更新") =>
  value === null || value === undefined || value === "" ? `<span class="pending">${label}</span>` : value;

const getRating = (etf, ratings) => {
  const rating = ratings[etf.ticker] ?? etf.rating;
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
};

const ratingMarkup = (etf, rating) => {
  const stars = Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const selected = value <= rating;
    return `<button class="star-button" type="button" data-ticker="${etf.ticker}" data-rating="${value}" aria-label="評 ${etf.ticker} ${value} 星" aria-pressed="${selected}">${selected ? "★" : "☆"}</button>`;
  }).join("");
  const valueLabel = rating ? `${rating} / 5` : "待評分";
  return `<div class="rating" aria-label="${etf.ticker} 個人評分">${stars}<span class="rating-value">${valueLabel}</span></div>`;
};

const incomeTreatmentMarkup = (etf) => {
  const incomeTreatment = etf.incomeTreatment || etf.name;
  if (/(?:\bacc\b|accumulation|capitalisation|\b1c\b)/i.test(incomeTreatment)) {
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
    : `<span class="spread-pill">差 ${formatMoney(quote.spreadUsd, "USD", 4)} · ${quote.spreadBps.toFixed(1)} bps · ${quote.spreadPct.toFixed(3)}%</span>`;
  const quoteTimestamp = formatQuoteTime(quote.updatedAt || fallbackUpdatedAt);
  const quoteDate = quoteTimestamp ? `<span class="data-sub">報價：${quoteTimestamp}（香港時間）</span>` : "";
  return `<span class="quote-values"><span>B ${bid}</span><span>A ${ask}</span></span>${spread}${quoteDate}`;
};

const renderRows = (etfs, marketData) => {
  const query = searchElement.value.trim().toLocaleLowerCase();
  const ratings = readRatings();
  const quotes = marketData.quotes || {};
  const fxRates = marketData.fxRates || {};
  const visibleEtfs = etfs.filter((etf) =>
    `${etf.ticker} ${etf.name} ${etf.index} ${etf.issuer} ${etf.marketScope} ${etf.weighting} ${etf.factorTags || []}`.toLocaleLowerCase().includes(query)
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
      : `$${(aumUsdM / 1000).toFixed(2)}bn <span class="data-sub">按 EUR/USD ${aumFx.toFixed(4)} 換算</span>`;
    const inception = formatDate(etf.inceptionDate);
    const duration = etf.category !== "bond"
      ? `<span class="pending">—</span>`
      : etf.effectiveDurationYears === null || etf.effectiveDurationYears === undefined
        ? `<span class="pending">待核實</span>${etf.maturityRange ? `<span class="data-sub">指數到期範圍：${etf.maturityRange}</span>` : ""}`
        : `<span class="data-main">${etf.effectiveDurationYears.toFixed(2)} 年</span>${etf.durationAsOf ? `<span class="data-sub">截至 ${formatDate(etf.durationAsOf)}</span>` : ""}`;
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
    const warning = etf.leverageWarning
      ? `<span class="warning-pill" title="${etf.leverageWarning}">⚠ 2× 每日槓桿</span>`
      : "";
    const swapBadge = etf.replicationType === "swap"
      ? `<span class="warning-pill">SWAP 式</span>`
      : "";
    const replication = etf.replicationLabel || (etf.replicationType === "unknown" ? "待核實" : "實物複製");
    const incomeTreatment = incomeTreatmentMarkup(etf);

    return `<tr>
      <td class="fund-cell">
        <div class="fund-name">
          <span class="ticker-badge">${etf.ticker}</span>
          <span><strong>${fundName}</strong><span class="fund-meta">${etf.index}</span></span>
        </div>
      </td>
      <td>${incomeTreatment}</td>
      <td><span class="data-main">${displayValue(aum, etf.aumReportedM === null ? "待核實" : "等待 FX 換算")}</span><span class="data-sub">${aum ? `資料：${etf.aumAsOf || "日期未有標示"}` : ""}</span></td>
      <td>${quoteMarkup(quote, marketData.updatedAt)}</td>
      <td><span class="data-main">${currencyDescription}</span><span class="data-sub">${listingCurrencyDescription}</span></td>
      <td><span class="market-main">${etf.marketScope}</span></td>
      <td class="duration-cell">${duration}</td>
      <td><span class="data-main">${etf.weighting}</span>${warning}</td>
      <td><span class="data-main">${replication}</span>${swapBadge}</td>
      <td class="factor-cell">${factorMarkup(etf)}</td>
      <td><span class="data-main">${displayValue(etf.ter === null ? null : `${etf.ter.toFixed(2)}%`)}</span></td>
      <td><span class="data-main">${displayValue(inception)}</span>${etf.inceptionDateLabel ? `<span class="data-sub">${etf.inceptionDateLabel}</span>` : ""}</td>
      <td><span class="data-main">${displayValue(trackingError, "待核實")}</span></td>
      <td>${ratingMarkup(etf, getRating(etf, ratings))}</td>
    </tr>`;
  }).join("");

  emptyStateElement.hidden = visibleEtfs.length > 0;
  filterCountElement.textContent = `顯示 ${visibleEtfs.length} / ${etfs.length} 隻`;
};

const renderSources = (etfs) => {
  sourceLinksElement.innerHTML = etfs.map((etf) =>
    `<a href="${etf.sourceUrl}" target="_blank" rel="noreferrer">${etf.ticker} 基金資料 ↗</a>`,
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
    rowsElement.addEventListener("click", (event) => {
      const button = event.target.closest(".star-button");
      if (!button) return;
      const etf = etfs.find((item) => item.ticker === button.dataset.ticker);
      const rating = Number(button.dataset.rating);
      saveRating(button.dataset.ticker, etf && getRating(etf, readRatings()) === rating ? 0 : rating);
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
