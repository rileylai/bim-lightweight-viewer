# AGENTS.md

## 專案目標

本專案是 BIM 輕量檢視器。

目標是建立一個純瀏覽器端運作的 BIM 3D scene editor MVP，而不是完整 BIM 規格平台。核心 demo 能力包含 IFC 載入、3D 幾何顯示、物件選取與高亮、TransformControls 移動 / 旋轉 / 縮放、project JSON 儲存與還原，以及後續 GLB / GLTF 匯入與保存。

## 技術選型

- React
- TypeScript
- Vite
- Three.js
- @react-three/fiber
- @react-three/drei
- IFC loader / web-ifc 相關 library
- GLTFLoader / GLB loader
- Browser File API
- local JSON download / upload

除非使用者明確要求，不要加入後端、資料庫或 server-side 儲存。所有核心操作應在現代瀏覽器中完成。

## 資料夾結構規範

- `src/`：前端程式碼。
- `src/components/`：React UI 與 3D component。
- `src/lib/`：Three.js、IFC、GLTF、camera fitting、persistence 等可重用邏輯。
- `src/types/`：共用 TypeScript type / interface。
- `docs/`：正式設計文件與技術決策，應被 Git 追蹤。
- `dev_state/`：本機協作狀態與 roadmap，不應被 Git 追蹤。
- `public/`：靜態資源。

尚未建立的資料夾，應等到對應功能 step 需要時再建立。

## Code Style

- 變數、function、component、type、interface 使用英文命名。
- TypeScript type 要清楚表達 IFC object、GLB object、scene object、transform、project JSON schema 的差異。
- 優先使用小而明確的 utility，例如 `fitCameraToObject`、`serializeProject`、`restoreProjectTransforms`。
- 程式碼註解使用繁體中文，尤其是 Three.js、IFC loading、raycasting、TransformControls、save / restore 等較難理解的邏輯。
- 不要為了過早抽象而拆太多層；先讓 MVP 可 demo、可驗證、可回滾。
- 避免把 loader、selection、persistence 邏輯全部塞進單一 React component。

## Doc Style

- README.md 與 docs/\*.md 使用繁體中文。
- 文件要持續更新，特別是功能完成狀況、限制、AI-assisted development、驗證方式、挑戰與解法。
- 文件應記錄實際決策，不要只寫理想架構。
- docs 是交件內容的一部分；dev_state 是本機協作用狀態紀錄。

## Documentation Timing Rule

每次執行任務前，必須先讀：

1. `AGENTS.md`
2. `dev_state/PROJECT_ROADMAP.md`
3. `docs/00-design-doc.md` 中與本 step 相關的章節
4. 依照本 step 的需求，只讀必要的 `docs/*.md`

不要一次讀完整 docs 目錄，避免浪費 context 或混淆目前任務。

範例：

- 如果要做 IFC loader，只需要讀：
  - `docs/00-design-doc.md`
  - `docs/01-architecture.md`
  - `docs/02-workflows.md` 中 IFC loading 相關章節
  - `docs/03-visual-test-checklist.md` 中 IFC loading checklist
- 如果要做 save / restore，只需要讀：
  - `docs/00-design-doc.md`
  - `docs/02-workflows.md` 中 save / restore 相關章節
  - `docs/01-architecture.md` 中 state / persistence 相關章節

## Visual Validation Rule

這是 3D visual application。自動測試與 TypeScript build 不足以代表功能正確。

每個 milestone 都必須搭配人工瀏覽器驗證，例如：

- 是否成功顯示模型。
- camera 是否對準模型。
- orbit rotate / pan / zoom 是否可用。
- 點選物件是否高亮。
- TransformControls 是否正確移動 / 旋轉 / 縮放。
- save / open project 是否真的還原 transform。

## 開發狀態更新規則

每次任務完成後都應更新：

- `dev_state/PROJECT_ROADMAP.md`
- `dev_state/DAILY_LOG.md`

`dev_state/` 是本機協作狀態，不需要 Git 追蹤，但必須在本機維持最新，方便 Codex 和使用者接續開發。
