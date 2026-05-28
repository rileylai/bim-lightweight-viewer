# 03 - Visual Test Checklist

## 使用方式

- 本檢查表提供「使用者人工驗證」使用。
- 每個 step 都包含「操作步驟」與「預期結果」。
- 只有使用者明確回覆通過，roadmap 對應 step 才能標記 `done`。
- 若驗證失敗，請記錄失敗點、重現步驟、畫面位置（或 console 訊息）並回填 `dev_state/DAILY_LOG.md`。

## 測試前準備

1. 安裝與啟動
1. 執行 `npm install`（首次）。
1. 執行 `npm run dev`。
1. 開啟瀏覽器到 Vite 顯示的本機網址（例如 `http://127.0.0.1:5173`）。
1. 開啟瀏覽器 DevTools Console。
1. 準備檔案
1. IFC 測試檔：`Building-Architecture.ifc`。
1. 錯誤檔案案例：任一非 `.ifc` 檔案，與一個刻意損壞 JSON（後續 Save/Restore 測試用）。
1. GLB/GLTF 測試檔（Step 16 之後使用）。

## 驗收紀錄建議格式

- Step：
- 日期時間：
- 操作環境（OS / Browser）：
- 結果：`pass` / `fail`
- 失敗重現步驟（若 fail）：
- 補充截圖或 console 關鍵訊息（若 fail）：

## Step-by-step Manual Checklist

### Step 1 - Project initialization and documentation skeleton

操作步驟：
1. 啟動專案並打開頁面。
1. 確認畫面可正常載入，沒有白屏。
1. 檢查 `AGENTS.md`、`README.md`、`docs/00-design-doc.md` 是否存在。

預期結果：
1. 首頁可正常顯示。
1. 文件骨架存在，且沒有明顯缺檔。

### Step 2 - Basic React layout and 3D canvas

操作步驟：
1. 打開頁面，觀察 toolbar、viewer、sidebar。
1. 確認 viewer 區域內有 WebGL canvas（不是靜態圖）。
1. 將視窗寬度縮到約 390px（手機寬度）再檢查一次。

預期結果：
1. 三區塊皆存在且排版不破版。
1. 行動寬度下文字可讀、按鈕不重疊。

### Step 3 - OrbitControls and scene helper setup

操作步驟：
1. 在 viewer 區左鍵拖曳。
1. 右鍵拖曳。
1. 滾輪縮放。
1. 觀察 grid/axes helper 是否仍可見。

預期結果：
1. 左鍵可 rotate、右鍵可 pan、滾輪可 zoom。
1. 操作後 scene helper 仍正常顯示。

### Step 4 - IFC file upload UI

操作步驟：
1. 點擊 upload，選擇 `Building-Architecture.ifc`。
1. 觀察 toolbar/sidebar 的檔名與狀態。
1. 再選擇一個非 `.ifc` 檔案。

預期結果：
1. 正確檔案會顯示檔名與待載入/載入中狀態。
1. 錯誤副檔名會顯示清楚的格式錯誤訊息。

### Step 4A - IFC loader strategy spike

操作步驟：
1. 打開 `docs/08-ifc-loader-strategy.md`。
1. 檢查是否清楚記錄選型、風險、fallback 與後續步驟銜接。
1. 確認目前程式仍可啟動，不因策略文件更新而破壞流程。

預期結果：
1. 策略文件內容可追溯，且與實作方向一致。
1. UI 基本流程不受影響。

### Step 5 - IFC loader integration

操作步驟：
1. 上傳 `Building-Architecture.ifc`。
1. 等待載入完成。
1. 查看 viewer 與 console。

預期結果：
1. 模型會出現在 scene。
1. 載入狀態會從 loading 轉為 loaded。
1. console 不應出現阻斷流程的錯誤。

### Step 6 - Loading state and progress display

操作步驟：
1. 上傳 IFC，觀察 progress/stage。
1. 以錯誤檔案或故意中斷流程（重新選檔）觸發錯誤路徑。

預期結果：
1. 載入中會顯示可理解的進度或階段資訊。
1. 成功時會切為完成；失敗時會切為 error 並顯示訊息。

### Step 7 - Camera fit to loaded model

操作步驟：
1. 載入 IFC 後觀察是否完整入鏡。
1. 進行 rotate/pan/zoom。
1. resize 視窗後再次觀察模型位置與可操作性。

預期結果：
1. 模型不應被裁切（尤其 roof 與邊緣）。
1. resize 後仍可正常操作。

### Step 8 - IFC object selection investigation

操作步驟：
1. 載入 IFC 後點擊 roof/wall/column/floor/background。
1. 觀察 sidebar 的 IFC probe 區塊與 console probe log。
1. 檢查 `localId/itemId/expressID` 候選是否有回傳。

預期結果：
1. 點擊 IFC 幾何可回報 hit；背景可回報 miss。
1. probe metadata 可用於後續 selection strategy 判斷。

### Step 8A - Shared scene object identity model

操作步驟：
1. 在 Step 8 probe 可 hit 的前提下，點擊不同 IFC 部位。
1. 觀察 `Shared Scene Object Identity` 區塊。
1. 刻意點空白背景，觀察 selected identity 是否清空。

預期結果：
1. `identityId/sourceType/sourceId/objectKey/selectionLevel` 會隨點擊更新。
1. hit 時 identity 與 metadata 對應合理；miss 時 selected identity 清空。

### Step 9 - Object selection and highlight

操作步驟：
1. 點擊 A 物件。
1. 點擊 B 物件。
1. 點空白區域。

預期結果：
1. A 會高亮。
1. 切到 B 時 A 取消高亮、B 高亮。
1. 點空白後高亮可清除（或維持既有選取，依最終 UX 規格，但需一致）。

### Step 10 - TransformControls integration

操作步驟：
1. 選取物件後啟用 TransformControls。
1. 拖曳 translate/rotate/scale 任一控制柄。
1. 拖曳過程中測試 OrbitControls 是否被抑制。

預期結果：
1. 物件可被 transform。
1. 拖曳期間 OrbitControls 不應干擾。
1. 拖曳結束後 OrbitControls 恢復。

### Step 11 - Transform mode toolbar

操作步驟：
1. 切換 Move / Rotate / Scale 按鈕。
1. 每個 mode 各拖曳一次。
1. 觀察 UI active 狀態。

預期結果：
1. mode 切換與實際行為一致。
1. toolbar active 樣式清楚可辨識。

### Step 12 - Project JSON schema design

操作步驟：
1. 打開 schema 或 type 定義檔。
1. 用 sidebar/debug 或範例 JSON 檢查欄位是否包含版本、source info、identity、transform。
1. 檢查是否沒有幾何本體欄位。

預期結果：
1. schema 能描述 IFC/GLB transform 還原所需最小欄位。
1. 不包含完整 geometry。

### Step 13 - Save project JSON

操作步驟：
1. 載入模型並做至少一次 transform（若該 step 前置已可用）。
1. 觸發 Save。
1. 打開下載 JSON 檔案檢查內容。

預期結果：
1. JSON 下載成功。
1. JSON 內有 version、model/source reference、object identity、transform。

### Step 14 - Open project JSON and restore IFC transforms

操作步驟：
1. 先改變物件 transform 並儲存一份 JSON。
1. 重新整理或重載模型。
1. 開啟剛保存的 JSON。

預期結果：
1. transform 能還原到保存時狀態。
1. 若缺欄位或 object 不存在，會有可理解訊息且不崩潰。

### Step 15 - Ctrl+S quick save

操作步驟：
1. 在頁面按 `Ctrl+S`（Windows）或 `Cmd+S`（macOS）。
1. 觀察是否觸發專案儲存。
1. 確認瀏覽器預設另存視窗未跳出。

預期結果：
1. 觸發的是 app 的 save 流程。
1. 不會出現瀏覽器原生儲存對話框。

### Step 16 - GLB / GLTF upload

操作步驟：
1. 上傳 `.glb` 或 `.gltf` 測試檔。
1. 觀察 scene 與 status。
1. 操作 orbit 確認互動正常。

預期結果：
1. GLB/GLTF 物件可顯示在 scene。
1. 狀態切換與錯誤提示行為合理。

### Step 17 - GLB object selection and transform

操作步驟：
1. 點擊 GLB 物件確認可選取。
1. 切換到 IFC 物件再切回 GLB。
1. 對 GLB 進行 transform。

預期結果：
1. GLB 與 IFC 都可被選取（依當前支援範圍）。
1. GLB transform 行為正確。

### Step 18 - GLB delete support

操作步驟：
1. 載入至少一個 GLB 物件並選取。
1. 觸發刪除操作。
1. 嘗試再次選取被刪除物件原位置。

預期結果：
1. GLB 物件會從畫面與 state 移除。
1. 被刪除物件不會再被選取與保存。

### Step 19 - Save / restore GLB objects

操作步驟：
1. 載入 GLB，做 transform，儲存 project JSON。
1. 重新開啟專案後執行 restore。
1. 檢查 GLB 的位置/旋轉/縮放與來源資訊。

預期結果：
1. GLB 相關狀態可被保存與還原。
1. 還原失敗項目會被清楚標示（如找不到檔案）。

### Step 20 - UI polish and user guidance

操作步驟：
1. 以桌面寬度與手機寬度各巡覽一次。
1. 走一次最小 demo 流程（上傳、操作、儲存）。
1. 確認各操作入口文字是否清楚。

預期結果：
1. 不破版、文字可讀、操作動線清楚。
1. 主要狀態提示可幫助使用者理解下一步。

### Step 21 - Error handling and edge cases

操作步驟：
1. 上傳錯誤副檔名。
1. 嘗試開啟壞掉 JSON。
1. 在沒有模型時觸發 save/transform/selection 相關操作。

預期結果：
1. 各錯誤都有可理解提示。
1. app 不崩潰，不進入不可恢復狀態。

### Step 22 - README completion

操作步驟：
1. 依 README 從零執行一次（安裝、啟動、基本操作）。
1. 對照實際功能與 README 的完成度描述。
1. 檢查已知限制是否誠實揭露。

預期結果：
1. README 可讓新讀者重現最小 demo。
1. 文件描述與實作現況一致，不誇大能力。

### Step 23 - AI-assisted development documentation

操作步驟：
1. 閱讀 `docs/04-ai-assisted-development.md`。
1. 對照 `dev_state/DAILY_LOG.md` 抽查數筆紀錄。
1. 檢查是否有具體 prompt/驗證/修正案例。

預期結果：
1. AI-assisted 文件內容可追溯、非空泛敘述。
1. 與實際開發歷程一致。

### Step 24 - Final manual testing and packaging checklist

操作步驟：
1. 從 Step 5 開始走完整 demo 流程（IFC -> selection/transform -> save/restore -> GLB）。
1. 同步檢查 README、known limitations、roadmap status 一致性。
1. 最後執行 `npm run build`、`npm run lint`、`git status --short`。

預期結果：
1. 全流程可重現且結果一致。
1. 文件、程式、狀態紀錄一致，符合交件標準。
