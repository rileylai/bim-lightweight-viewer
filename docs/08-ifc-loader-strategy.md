# 08 - IFC Loader Strategy Spike

## Step 4A 結論（2026-05-27）

- Step 5 的正式整合路徑採用 `@thatopen/components` + `@thatopen/fragments` + `web-ifc`。
- `web-ifc-three` 不採用於本專案主流程。
- IFC 物件識別在 MVP 階段先以 `modelId + localId` 為主；`expressID` 對應精度在 Step 8 做專門調查與驗證。

## Spike 範圍

本次 spike 聚焦四件事：

1. IFC loader 套件選型（可維護性、相容性、活躍度）。
2. 載入 API 與資料流是否可銜接現有 React + R3F 架構。
3. object identity 是否可支持後續 selection / transform / save-restore。
4. 效能風險與 fallback demo 路徑是否可提前定義。

## 選型比較

### Option A：`web-ifc` + `web-ifc-three`

- 優點：
  - 三方範例與舊教學多。
  - 直接面向 Three.js mesh 管線。
- 缺點：
  - 官方 `ThatOpen/web-ifc-three` README 已標示 deprecated，導向 components 生態。
  - npm `web-ifc-three` 的 `peerDependencies.three` 為 `^0.149.0`，與目前專案 `three@^0.184.0` 代差明顯。
  - 專案近期維護節奏偏慢（`time.modified` 落在 2024）。
- 結論：
  - 不作為本專案主線，避免後續 selection / transform / persistence 階段承擔相容性債務。

### Option B：`@thatopen/components` + `@thatopen/fragments` + `web-ifc`

- 優點：
  - 套件更新活躍（2026 年仍有發布）。
  - `peerDependencies` 直接支持較新的 `three` 版本區間（`>=0.182.0`）。
  - `IfcLoader.load()` 支援 `progressCallback`，可直接支撐 Step 6。
  - Fragments 管線提供 `modelId + localId`、`guid`、`getItemsData()` 等後續擴充入口。
- 缺點：
  - 主要心智模型是 Fragments，不是「直接把 IFC 轉成一般 Three mesh tree」。
  - 與現有 R3F state 邊界要先訂清楚，避免把 loader runtime 細節洩漏到 UI。
- 結論：
  - 採用。此路徑最符合本專案「MVP 可 demo + 後續可維護」目標。

### Option C：純 `web-ifc` 自行組裝 geometry pipeline

- 優點：
  - 控制權最高。
- 缺點：
  - 開發成本與風險過高，不符合本輪 MVP 時程。
  - 需要自行處理大量 geometry / metadata 對齊細節。
- 結論：
  - 不採用。

## Step 5 可執行整合策略

### 依賴策略

- Step 5 新增依賴：`@thatopen/components`、`@thatopen/fragments`、`web-ifc`。
- WASM 採固定版本路徑（例如 `https://unpkg.com/web-ifc@0.0.77/`），避免使用浮動 tag 造成不可重現行為。

### 載入資料流

1. 使用者在 Step 4 UI 選擇 `.ifc` 檔案。
2. App 透過 Browser File API 讀取為 `ArrayBuffer`，轉成 `Uint8Array`。
3. 初始化 `FragmentsManager` worker 與 `IfcLoader.setup(...)`（僅初始化一次，避免重複建置）。
4. 呼叫 `ifcLoader.load(bytes, true, modelId, { processData: { progressCallback } })`。
5. 取得 `FragmentsModel` 後，把 `model.object` 掛入目前 scene（先確保舊模型可安全替換）。
6. 更新 loaded model state（檔名、modelId、載入狀態、錯誤訊息）。

### State 邊界

- `src/components/`：
  - 只負責 UI 事件與狀態顯示，不持有 loader instance。
- `src/lib/`：
  - 新增 IFC runtime loader utility，包裝 setup / load / dispose。
  - 封裝 progress 與錯誤轉譯，避免 App component 過度膨脹。
- `src/types/`：
  - 補齊 IFC runtime model reference type（`modelId`、`fileName`、`sourceType`、`loadStatus`）。

## expressID / identity 策略

- 現階段決策：
  - MVP 的「可持久化 object identity」先採 `modelId + localId`。
  - `localId` 由 Fragments 提供，作為 IFC 檔案內穩定 item 識別碼使用。
- `expressID` 處理：
  - 在 Step 5 不阻塞於「一定要拿到 expressID」。
  - Step 8 專做 investigation，驗證 `localId` 與 `expressID` 映射關係、raycast 精度與 metadata 可得性。
- fallback：
  - 若 element-level identity 不穩定，先採 model-level 或 fragment-level selection（見 `docs/06` fallback）。

## 效能風險與控制

- 風險 1：IFC 轉換時間長，主執行緒卡頓
  - 對策：Step 6 一定要有 progress / loading 狀態，並保留 cancel/retry UX 空間。
- 風險 2：大型模型記憶體壓力
  - 對策：MVP 先限定 demo 檔案，超大檔案列為已知限制。
- 風險 3：WASM 或 worker 初始化失敗
  - 對策：明確錯誤訊息（WASM path、網路、初始化失敗）與可重試入口。

## Step 4A 輸出到後續步驟

- Step 5：依本策略完成 IFC 載入與顯示。
- Step 6：接上 `progressCallback` 顯示 loading/progress/error。
- Step 8：針對 `localId` / `expressID` / raycast metadata 做精度調查，決定 selection level（L1/L2/L3）。
