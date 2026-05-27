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
