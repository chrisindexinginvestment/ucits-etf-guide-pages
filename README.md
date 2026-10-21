# 全球 UCITS ETF 指南 — Pages 網站

這個公開 repository 只包含 GitHub Pages 所需的靜態網站檔案。它與私有的開發 repository 分開；本機 IB Gateway 更新腳本不會放在此處。

## GitHub Pages

Repository 設定為由 `main` branch 的根目錄發佈。網站可公開瀏覽，網站內容及靜態資料亦會公開。

## 資料說明

- `data/etfs.json` 的 46 個上市代號已於 2026-10-21 逐項對照官方 factsheet。`factsheetUrl` / `sourceUrl` 為文件連結，`factsheetAsOf` 為文件日期，`verifiedAt` / `dataAsOf` 為本次核對日期，並不表示所有數據截至同一天。多數文件截至 2026-09-30；LVWC 官網連結仍提供 2025-11-30 文件（AUM 截至 2025-11-28），`verificationNote` 明確標示未能確認更新版本。
- 資產規模使用 `aumReportedM`（百萬原幣）、`aumReportedCurrency`、`aumAsOf` 及 `aumScope`。優先採用整隻基金資產（`fund`）；Amundi 文件只列 AUM，使用 `factsheet-aum` 而不推斷份額類別範圍。文件只給四捨五入數值時，`aumNote` 保留原始精度說明。相同基金的不同份額類別或上市代號可有相同基金規模，不可相加當作獨立資產。
- `incomeTreatment` 只使用已核對的收益處理，不從基金名稱猜測。`ter` 保留原百分比數值（例如 `0.20` 代表 `0.20%`），`terLabel` 及 `terAsOf` 保留官方費用名稱和日期；TER、OCF、All-in fee、經常性費用並非所有成本的總和。
- `listingDate` 僅填指定代號及交易所的上市日期；未披露時留 `null`，並附 `listingDateNote`。`inceptionDate` 另列官方成立／launch date，不作上市日期；`inceptionDateLabel` 註明口徑。AVGS 的 LSE USD 上市日期為 2024-12-04，與其 2024-09-25 成立日期不同。
- `trackingError` 只填有明確期間及百分比口徑的歷史數值，附 `trackingErrorPeriod`；不以 tracking difference、預期上限或波動率代替。未披露者留 `null` 並附 `trackingErrorNote`。ESAN 文件列出 since-inception ex-post tracking error `0.04`，但未明確標示單位，所以未填入百分比欄。
- `data/market-data.json` 是某一時間點的 IB Gateway 快照，不是即時串流。請查看頁面上的完整快照日期、各列報價時間及報價類型；部分更新只刷新指定標的，其餘標的沿用之前快照。目前可用的報價可能為延遲報價。
- 債券 ETF 的 `effectiveDurationYears` 只填明確標為 effective duration 的數字，附 `durationAsOf`。VAGU、VDTA、VDST 和 BB3M 只披露 average duration，另存於 `reportedDurationYears` / `reportedDurationLabel` / `reportedDurationAsOf`，不冒充有效存續期。指數到期範圍亦只作補充。iShares 文件註明其他資料截至 2026-10-05，故費用及有效存續期日期與月末 AUM 日期不同。
- 比較表下方設有兩個教育用途的配置範例：VALL / CBU0 為 80 / 20；VALL / AVGS / CBU0 為 60 / 20 / 20。後者的股票部分為 75% 市值加權及 25% small-cap value tilt，分母為股票佔組合的 80%，不是整體組合；不涉及回測或回報保證。
- 網頁評分保存在瀏覽器 local storage，不會自動上傳。

基金資料與報價只供教育及研究用途，不構成投資建議。

## 本機驗證

使用 Node.js 內建測試工具，無須安裝額外套件：

```powershell
node --test .\tests\app.test.cjs
```
