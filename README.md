# 全球 UCITS ETF 指南 — Pages 網站

這個公開 repository 只包含 GitHub Pages 所需的靜態網站檔案。它與私有的開發 repository 分開；本機 IB Gateway 更新腳本不會放在此處。

## GitHub Pages

Repository 設定為由 `main` branch 的根目錄發佈。網站可公開瀏覽，網站內容及靜態資料亦會公開。

## 資料說明

- `data/etfs.json` 原有 46 個上市代號已於 2026-10-21 逐項對照官方 factsheet，另加入 AVEM.L、AVGC 及 DTLA。`factsheetUrl` / `sourceUrl` 為文件連結，`factsheetAsOf` 為文件日期，`verifiedAt` / `dataAsOf` 為本次核對日期，並不表示所有數據截至同一天。多數原有文件截至 2026-09-30；LVWC 官網連結仍提供 2025-11-30 文件（AUM 截至 2025-11-28），`verificationNote` 明確標示未能確認更新版本。新增基金尚未核實的資產規模或文件日期會留空並註明。
- 比較表的 ISIN 欄逐列顯示 `data/etfs.json` 中該上市代號的 ISIN，方便核對基金識別；ISIN 與 ticker 是不同欄位。
- 資產規模使用 `aumReportedM`（百萬原幣）、`aumReportedCurrency`、`aumAsOf` 及 `aumScope`。優先採用整隻基金資產（`fund`）；Amundi 文件只列 AUM，使用 `factsheet-aum` 而不推斷份額類別範圍。文件只給四捨五入數值時，`aumNote` 保留原始精度說明。相同基金的不同份額類別或上市代號可有相同基金規模，不可相加當作獨立資產。
- `incomeTreatment` 只使用已核對的收益處理，不從基金名稱猜測。`ter` 保留原百分比數值（例如 `0.20` 代表 `0.20%`），`terLabel` 及 `terAsOf` 保留官方費用名稱和日期；TER、OCF、All-in fee、經常性費用並非所有成本的總和。
- 表格日期欄名為「份額類別成立日期」，顯示 `inceptionDate` 的官方成立／launch date，並以 `inceptionDateLabel` 註明口徑。`listingDate` / `listingDateNote` 保留作來源紀錄，不再用於表格日期欄。AVGS 顯示 2024-09-25 成立日期，而非其 LSE USD 上市日期 2024-12-04。
- `trackingError` 只填有明確期間及百分比口徑的歷史數值，附 `trackingErrorPeriod`；不以 tracking difference、預期上限或波動率代替。未披露者留 `null` 並附 `trackingErrorNote`。ESAN 文件列出 since-inception ex-post tracking error `0.04`，但未明確標示單位，所以未填入百分比欄。
- `data/market-data.json` 是某一時間點的 IB Gateway 快照，不是即時串流。請查看頁面上的完整快照日期、各列報價時間及報價類型；部分更新只刷新指定標的，其餘標的沿用之前快照。目前可用的報價可能為延遲報價。
- `data/performance.json` 保存 1、3、5 年年化回報，按 Yahoo Finance 調整後收市價計算幾何年化回報；每項均連結其歷史價格來源並標明資料日期。回溯期間不足或來源沒有可用價格時顯示 `—`，不補算或以指數回報代替。此口徑是歷史市場價格回報，未必與基金 factsheet 按 NAV 計算的數字完全一致。
- ETF 清單新增 AVEM.L、AVGC 及 DTLA。現時未核實的基金規模、factsheet 日期或報價會明確留空／標示待核實；新增基金不會沿用其他代號的 IB 報價。
- `ibSearchTickers` 記錄用於 IB 搜尋的別名：CBU0 → CSBGU0、CBU3 → CSBGU3、CBU7 → CSBGU7。別名顯示於基金名稱下方，亦可用於網站搜尋；主要上市代號及報價快照對應仍使用 CBU0／CBU3／CBU7，不新增基金或更新 IB 報價。
- 債券 ETF 顯示優先使用 `effectiveDurationYears` 及 `durationAsOf`；未有有效存續期時，以明確標為 Average duration 的 `reportedDurationYears` 及 `reportedDurationAsOf` 顯示，數字加 `*` 並註明「平均存續期」。目前 VAGU、VDTA、VDST 和 BB3M 使用此顯示方式；原始平均存續期仍獨立儲存，不填入有效存續期欄位。兩者皆無數值時顯示待核實；指數到期範圍只作補充。iShares 文件註明其他資料截至 2026-10-05，故費用及有效存續期日期與月末 AUM 日期不同。
- 比較表下方設有兩個教育用途的配置範例：VALL / CBU0 為 80 / 20；VALL / AVGS / CBU0 為 60 / 20 / 20。後者的股票部分為 75% 市值加權及 25% small-cap value tilt，分母為股票佔組合的 80%，不是整體組合；不涉及回測或回報保證。

基金資料與報價只供教育及研究用途，不構成投資建議。

## 本機驗證

使用 Node.js 內建測試工具，無須安裝額外套件：

```powershell
node --test .\tests\app.test.cjs
```
