# 全球 UCITS ETF 指南 — Pages 網站

這個公開 repository 只包含 GitHub Pages 所需的靜態網站檔案。它與私有的開發 repository 分開；本機 IB Gateway 更新腳本不會放在此處。

## GitHub Pages

Repository 設定為由 `main` branch 的根目錄發佈。網站可公開瀏覽，網站內容及靜態資料亦會公開。

## 資料說明

- `data/etfs.json` 是 ETF 基本資料；未核實的 ISIN、TER、資產規模及有效存續期會留空或標示待核實。
- `data/market-data.json` 是某一時間點的 IB Gateway 快照，不是即時串流。請查看頁面上的快照日期、時間及報價類型；目前可用的報價可能為延遲報價。
- 債券 ETF 欄位使用有效存續期（effective duration）。已知的指數到期年期範圍只作補充，不能代替有效存續期。
- 網頁評分保存在瀏覽器 local storage，不會自動上傳。

基金資料與報價只供教育及研究用途，不構成投資建議。
