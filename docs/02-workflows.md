# 02 - 使用流程

## IFC Loading Workflow

1. 使用者選擇 `.ifc` 檔案。
2. 前端以 Browser File API 讀取檔案。
3. IFC loader 解析 geometry。
4. 顯示 loading / progress。
5. 模型加入 Three.js scene。
6. 計算 bounding box 並執行 camera fit。
7. 建立可供 selection 使用的 object metadata。

## Selection Workflow

1. 使用者點擊 canvas。
2. raycasting 找到候選物件。
3. 依物件類型判斷 IFC object 或 GLB object。
4. 更新 selected object state。
5. 套用高亮材質或 outline。

IFC selection 可能需要 expressID 或 loader 專用 API，不一定能和 GLB 使用完全相同邏輯。

## Transform Workflow

1. 使用者選取物件。
2. TransformControls attach 到選取目標。
3. 拖曳期間暫停 OrbitControls。
4. 拖曳結束後恢復 OrbitControls。
5. 更新物件 transform state。

## Save / Restore Workflow

儲存 project JSON 時只保存可還原狀態，不保存完整 geometry。

開啟 project JSON 時：

1. 讀取 JSON。
2. 驗證 version 與必要欄位。
3. 要求使用者重新載入對應 IFC / GLB 檔案，或套用到目前已載入模型。
4. 依 object id 還原 position / rotation / scale。

實際 UX 會在 Step 12 到 Step 15 逐步確定。

## Common Failure Handling

### 不支援檔案格式

- 症狀：使用者上傳非 `.ifc` / `.glb` / `.gltf`。
- 處理：阻止進入 loader，保留目前 scene，不改動既有 state，顯示明確格式提示。

### 讀檔失敗（Browser File API）

- 症狀：`FileReader` error、讀取被中斷、檔案權限問題。
- 處理：標記為 error state，提示使用者重試，避免進入半載入狀態。

### loader 解析失敗

- 症狀：IFC / GLTF loader throw error 或回傳空結果。
- 處理：顯示「解析失敗」訊息，保留既有模型與相機位置，提供 retry 入口。

### bounding box 無效

- 症狀：載入後 bbox 為空、尺寸為 0、包含 `NaN`。
- 處理：跳過 camera fit，保留預設 camera/controls target，記錄 warning 供除錯。

### raycast 無結果

- 症狀：點擊場景沒有命中任何可選物件。
- 處理：清除 selected state（或維持既有選取，依 UX 決策），顯示非阻斷提示。

### project JSON 缺欄位

- 症狀：缺少 version、source info、transform 必要欄位。
- 處理：restore 前先 validate，若不合法則拒絕還原並回報缺欄位清單。

### restore 找不到 object id

- 症狀：JSON 內 object id 在當前 scene 不存在。
- 處理：略過該物件並記錄 warning；其餘合法物件照常還原，最終回報 skipped items。
