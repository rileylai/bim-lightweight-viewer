# 01 - 架構設計

## 前端架構

本專案採用 React + TypeScript + Vite。3D scene 使用 Three.js、@react-three/fiber 與 @react-three/drei。

第一版架構避免過早複雜化，但保留以下邊界：

- UI layout：檔案上傳、toolbar、sidebar、狀態提示。
- 3D scene：camera、lights、controls、loaded models、TransformControls。
- loaders：IFC loader 與 GLB / GLTF loader。
- selection：raycasting、IFC object metadata、GLB object metadata。
- persistence：project JSON serialize / restore。

## State Ownership

為降低功能耦合，state ownership 採分層管理：

- loaded model state：只負責「目前載入了哪些模型」與其 source metadata（IFC / GLB 檔名、來源、載入狀態）。
- selection state：只負責「目前選到哪個 scene object identity」。不可直接持有 UI 元件 instance。
- transform state：只負責 position / rotation / scale 的可還原資料，以及 transform mode。
- UI state：只負責 upload dialog、status message、toolbar mode、暫時性提示。
- project state：只負責可序列化、可還原的 plain JSON-compatible 資料，不依賴 React component instance。

責任分離原則：

- `src/components/` 只做顯示與互動事件轉發。
- `src/lib/` 負責 loader、mapping、serialize / restore、camera fitting 等可重用邏輯。
- `src/types/` 定義跨層共用的 domain types，避免 UI state 與 project state 混用。

## 預期資料模型

project JSON 只保存可還原狀態：

- version number。
- IFC file name / model reference。
- IFC object id 或 expressID。
- object transform：position / rotation / scale。
- GLB object source info。
- GLB object transform。

不保存完整 IFC / GLB geometry。

## Persistence 邊界

save / restore 必須依賴 plain JSON-compatible project state，而不是 React component instance 或 Three.js runtime reference。

- save：從 scene 狀態抽取最小可還原資料，轉為純 JSON。
- restore：先驗證 JSON schema，再依 object identity 把 transform 套回目前 scene。
- 若 object identity 對不上（例如檔案不同、物件遺失），要回報可理解錯誤並保留可回滾狀態。

## State 管理方向

MVP 先使用 React state 與小型 context 管理。若狀態快速變複雜，再評估 Zustand 或其他輕量 store。

## 可重用 utility

重要邏輯應抽成 utility：

- camera fitting。
- transform serialize / restore。
- selection metadata normalization。
- project JSON validation。
- scene object identity mapping（IFC / GLB 共用）。

## Browser-only 限制

所有操作在瀏覽器完成。檔案讀取使用 Browser File API，儲存使用 local JSON download。

## IFC loader 整合邊界（Step 4A 決策）

Step 4A 選型採 `@thatopen/components` + `@thatopen/fragments` + `web-ifc`，並維持現有 React + R3F 架構不重寫。

- `src/lib/` 新增 IFC runtime loader utility：
  - 封裝 `IfcLoader.setup()`、`IfcLoader.load()`、Fragments worker 初始化。
  - 封裝 progress callback 與錯誤轉譯，避免 UI 直接依賴第三方 API 細節。
- `src/components/`：
  - 只處理上傳事件、狀態顯示、scene 掛載，不直接 new loader instance。
- identity 策略：
  - Step 5~7 先以 `modelId + localId` 作為 IFC scene object identity。
  - Step 8 再驗證 `localId` 與 `expressID` 對映精度，決定 element-level selection 可行性。
- persistence 影響：
  - project JSON 仍只存 object identity + transform，不存幾何本體。
