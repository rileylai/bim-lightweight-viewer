# 07 - Coding Style

## 命名

- 程式碼中的變數、function、component、type、interface 使用英文。
- README、docs 與 UI 文字使用繁體中文。
- branch name、commit message、package name 使用英文。

## TypeScript

- 優先定義清楚的 domain types。
- 避免濫用 `any`。
- loader 回傳資料若型別不足，先建立 narrow wrapper 或 adapter。

## React

- component 以功能邊界拆分。
- 3D scene 邏輯不要長期塞在 app root。
- 與 Three.js instance 互動時注意 React lifecycle。

## Three.js

- 複雜 Three.js、IFC、raycasting、TransformControls、save / restore 邏輯要用繁體中文註解說明。
- camera fitting、selection、serialization 應抽出 utility。
- 注意 dispose geometry / material，避免重複載入模型造成記憶體累積。

## 文件同步

每個 step 完成時，依影響範圍更新 README 或 docs，不把文件留到最後才補。
