# 05 - 已知限制

## IFC object-level structure

IFC loader 可能不容易保留 object-level structure。最大風險是 IFC 模型載入後只變成一個大 mesh，導致很難選取單一牆、門或 BIM element。

設計時要優先確認 loader 是否能取得 object id、expressID 或可被 raycasting 選取的 mesh。

## IFC selection 與 GLB selection 差異

IFC object selection 可能和一般 GLB object selection 不一樣。selection logic 應設計成可擴充，最好能同時支援 IFC object 和 GLB object，但允許兩者有不同 metadata。

## TransformControls 與 OrbitControls 衝突

拖拉、旋轉、縮放物件時，應暫時 disable OrbitControls；操作結束後再 enable。

## Save / restore 不保存完整 geometry

project JSON 不應該存整個 IFC geometry。只保存可還原狀態，例如：

- IFC file name / model reference。
- object id。
- position。
- rotation。
- scale。
- GLB object source info。
- GLB object transform。
- version number。

## Camera fit

Camera fit 可能因為模型 bounding box 尺寸不同而失敗。應寫成獨立 utility，方便之後調整。

## Browser-only

所有操作應在現代瀏覽器內完成，不依賴後端 server 儲存狀態。

## 效能

大型 IFC 檔案可能造成效能問題。目前先針對指定測試檔與一般 demo 情境優化，不一開始支援超大型 BIM。

## IFC loader 套件生命週期風險

`web-ifc-three` 雖然歷史上常見，但其官方 README 已標示 deprecated，且 peer `three` 版本範圍落後於本專案目前版本。

因此本專案 Step 4A 起改採 `@thatopen/components` + `@thatopen/fragments` + `web-ifc`。這會帶來新限制：

- 主要操作對象會是 Fragments model，而非傳統獨立 Three mesh tree。
- object identity 優先是 `modelId + localId`，`expressID` 需要額外驗證映射精度。
- 若後續 selection 精度不足，必須回退到 roadmap 定義的 fallback level（L1/L2/L3）。

## Visual testing

這是 visual 3D application，不能只靠 unit test。每個 milestone 都要提供 manual browser validation checklist。

## 文件交件

README 和 docs 是交件重點，尤其要記錄 AI 工具使用、prompt 拆解、驗證方式、技術困難與 workaround。

## IFC selection fallback level

本專案會依實際 IFC loader 能力分成以下支援等級：

- Level 1：model-level selection，只能選取整體 IFC model。
- Level 2：mesh / fragment-level selection，可選取 loader 拆出的 fragment。
- Level 3：IFC element-level selection，可對應牆、門、窗等 BIM element。

交付前 README 必須明確標示目前達到哪一個 level。
