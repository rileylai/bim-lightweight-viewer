# 03 - Visual Test Checklist

## 基礎頁面

- 頁面可正常載入。
- placeholder 不破版。
- 行動與桌面寬度下文字不重疊。

## IFC Loading

- 可選擇指定測試檔 `Building-Architecture.ifc`。
- 載入期間顯示狀態。
- 模型完成後出現在畫面中央。
- console 沒有重大錯誤。

## Camera

- 模型載入後完整進入視野。
- 小模型與大模型都不應過度貼近或太遠。
- resize 後畫面仍可用。

## Controls

- Orbit rotate 可用。
- Pan 可用。
- Zoom 可用。
- TransformControls 拖曳期間 OrbitControls 不干擾。

## Selection And Transform

- 點選物件後有明確高亮。
- 切換選取時前一個物件解除高亮。
- move / rotate / scale 都可操作。
- 操作後 project JSON 能保存 transform。

## Save / Restore

- Ctrl+S 會觸發儲存。
- 下載的 JSON 可再次開啟。
- 開啟後 transform 狀態正確還原。

## GLB / GLTF

- 可上傳 GLB / GLTF。
- GLB / GLTF 可選取、transform、刪除。
- 儲存與還原後 GLB / GLTF 狀態一致。
