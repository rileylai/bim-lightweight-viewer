# 06 - 挑戰與解法

## IFC loader object id

挑戰：IFC loader 可能把模型合併為大 mesh，造成物件級 selection 困難。

暫定解法：在 IFC loader step 優先調查 expressID、geometry groups、raycasting metadata，以及 loader 是否提供 element lookup API。

## IFC object-level selection fallback strategy

挑戰：若 loader 最終只能提供「大 mesh 命中」，無法穩定定位單一 BIM element。

fallback demo 方案：

- 第一層：先支援 model-level selection（選整體 IFC model）並可高亮整體模型。
- 第二層：若能取得 face / fragment metadata，顯示「局部命中資訊」作為 debug 輔助，但不承諾 element-level transform。
- 第三層：TransformControls 僅 attach 在可穩定識別的 object identity（例如 model root 或已映射 fragment root）。

README 揭露要求：

- 明確說明「目前 IFC selection 精度」是 element-level 或 model-level。
- 若是 model-level fallback，需寫清楚限制、影響範圍、後續改善方向。
- demo 說明需避免誤導成完整 BIM element 編輯器。

## Selection abstraction

挑戰：IFC 與 GLB 的 object identity 來源不同。

暫定解法：建立共用 selected object model，但保留 `sourceType` 與 source-specific metadata。

## Controls 衝突

挑戰：TransformControls 拖曳時，OrbitControls 也可能響應滑鼠事件。

暫定解法：TransformControls drag start 時 disable OrbitControls，drag end 時恢復。

## Project JSON schema

挑戰：保存太多 geometry 會讓檔案巨大且不符合 browser-only lightweight 目標。

暫定解法：schema 只保存 file reference、object id、transform、版本號。若需要完整重建模型，讓使用者重新載入原始 IFC / GLB。

## Camera fitting

挑戰：不同模型 bounding box 差異大，camera fit 容易過近或過遠。

暫定解法：建立獨立 camera fitting utility，集中處理 bounding sphere、padding、near / far 與 controls target。

## AI-assisted development

挑戰：AI 容易一次修改過多檔案，或生成看似正確但未經瀏覽器驗證的 3D 程式碼。

暫定解法：以 roadmap 小步驟開發，每次要求 build、manual browser validation 與 daily log 紀錄。
