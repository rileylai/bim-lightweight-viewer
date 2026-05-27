# 03 - Visual Test Checklist

## 使用方式

- 本檢查表給「使用者人工驗證」使用。
- Codex 可以提供操作步驟與預期結果，但不能自行宣稱 visual validation 已最終通過。
- 每個 visual step 只有在使用者明確回覆通過後，roadmap status 才能標記 `done`。

## 通用檢查（General Checklist）

### 基礎頁面

- 頁面可正常載入。
- 主要區塊（toolbar / viewer / sidebar）不破版。
- 行動與桌面寬度下文字不重疊。

### IFC Loading

- 可選擇指定測試檔 `Building-Architecture.ifc`。
- 載入期間顯示狀態。
- 模型完成後出現在畫面中央。
- console 沒有重大錯誤。

### Camera

- 模型載入後完整進入視野。
- 小模型與大模型都不應過度貼近或太遠。
- resize 後畫面仍可用。

### Controls

- Orbit rotate 可用。
- Pan 可用。
- Zoom 可用。
- TransformControls 拖曳期間 OrbitControls 不干擾。

### Selection And Transform

- 點選物件後有明確高亮。
- 切換選取時前一個物件解除高亮。
- move / rotate / scale 都可操作。
- 操作後 project JSON 能保存 transform。

### Save / Restore

- Ctrl+S 會觸發儲存。
- 下載的 JSON 可再次開啟。
- 開啟後 transform 狀態正確還原。

### GLB / GLTF

- 可上傳 GLB / GLTF。
- GLB / GLTF 可選取、transform、刪除。
- 儲存與還原後 GLB / GLTF 狀態一致。

## Step-based Checklist

### Step 2 - Basic React layout and 3D canvas

- 開啟頁面後確認有 toolbar、viewer、sidebar 三區塊。
- viewer 中可看到 3D canvas（不是純靜態圖片）。
- 行動版（寬度約 390px）仍可閱讀文字，按鈕不重疊。

### Step 3 - OrbitControls and scene helper setup

- 在 viewer 內左鍵拖曳：畫面會 rotate。
- 右鍵拖曳：畫面會 pan。
- 滾輪縮放：畫面會 zoom，且相機不穿透地板。
- grid / axes helper 在操作後仍可見。

### Step 4 - IFC file upload UI

- 點擊 upload 入口可選擇 `.ifc` 檔案。
- 選擇 `Building-Architecture.ifc` 後 UI 顯示正確檔名。
- 狀態應顯示待載入（例如 pending / waiting for loader）。
- 選擇錯誤副檔名時，UI 顯示格式錯誤提示。

### Step 5 - IFC loader integration

- 用 `Building-Architecture.ifc` 載入後 scene 內可見模型。
- 載入完成前後狀態變化合理（不永遠停在 loading）。
- 載入完成後 console 無阻斷錯誤。

### Step 6 - Loading state and progress display

- 載入中可看到 loading（或 progress）提示。
- 載入成功後狀態切為完成。
- 人為造成失敗（例如壞檔）時，狀態會切到失敗且顯示訊息。

### Step 7 - Camera fit to loaded model

- 載入後相機能看到完整模型，不被切掉。
- 重新調整視窗大小後，模型仍在可操作範圍。
- 小型與大型模型都不應過近或過遠。

### Step 8 - IFC object selection investigation

- 點擊模型後可在 debug 資訊看到 raycast 命中結果。
- 可檢查是否有 expressID / object id / metadata。
- 若只有大 mesh，需確認 fallback 計畫已在文件記錄。
