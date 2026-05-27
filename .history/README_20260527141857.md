# BIM 輕量檢視器

專案目標是在現代瀏覽器中建立一個不依賴後端的 BIM 3D scene editor MVP。第一階段聚焦 IFC 模型載入、檢視、物件選取、高亮、TransformControls，以及 project JSON 儲存 / 開啟；第二階段再擴充 GLB / GLTF 匯入與狀態保存。

## 目前狀態

- 已建立 React + TypeScript + Vite 專案。
- 已建立 `AGENTS.md`、正式 docs 骨架與本機 `dev_state/` roadmap。
- 目前畫面是 3D viewer placeholder，尚未實作 IFC / GLB 功能。

## 技術選擇

- React：建立可維護的 UI component。
- TypeScript：讓 scene object、transform、project JSON schema 有明確型別。
- Vite：快速啟動與打包前端 demo。
- Three.js / @react-three/fiber / @react-three/drei：後續用於 3D scene、camera、controls 與互動。
- Browser File API：支援本機 IFC、GLB / GLTF、project JSON 上傳與下載。
- 不使用後端：所有狀態以本機 JSON 檔案保存。

## 啟動方式

```bash
npm install
npm run dev
```

打包驗證：

```bash
npm run build
```

## MVP 功能規劃

第一階段：

- IFC 檔案上傳。
- IFC 幾何載入與渲染。
- loading / progress 狀態。
- camera fit to model。
- OrbitControls rotate / pan / zoom。
- 物件選取與高亮。
- TransformControls move / rotate / scale。
- project JSON 儲存與開啟。
- Ctrl+S 快速儲存。

第二階段：

- GLB / GLTF 上傳。
- GLB / GLTF 物件選取、transform、刪除。
- GLB / GLTF 狀態保存與還原。
- UI polish、錯誤提示、使用者操作說明。
- 完整 README 與 AI-assisted development 文件。

## 已知限制

- 尚未確認 IFC loader 是否能穩定保留 object-level structure。
- project JSON 不會保存完整 IFC geometry，只保存可還原狀態。
- 大型 IFC 檔案效能不是第一版 MVP 目標。
- 3D visual correctness 需要人工瀏覽器驗證，不能只靠自動測試。

## AI 輔助開發方式

本專案使用 `AGENTS.md`、`docs/*.md`、`dev_state/PROJECT_ROADMAP.md` 與 `dev_state/DAILY_LOG.md` 形成 learn-loop agent workflow。

後續每次開發會依 roadmap 執行一個小 step，開始前只讀必要文件，完成後更新 roadmap 與 daily log，並記錄驗證結果、遇到的問題與下一步。

## 驗證方式

每個 milestone 至少需要：

- `npm run build`
- 必要的 lint / test
- 手動瀏覽器驗證

3D 功能完成後，人工檢查項目會包含模型顯示、camera fit、orbit 操作、選取高亮、transform、save / restore。
