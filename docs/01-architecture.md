# 01 - 架構設計

## 前端架構

本專案採用 React + TypeScript + Vite。3D scene 預計使用 Three.js、@react-three/fiber 與 @react-three/drei。

第一版架構會避免過早複雜化，但保留以下邊界：

- UI layout：檔案上傳、toolbar、sidebar、狀態提示。
- 3D scene：camera、lights、controls、loaded models、TransformControls。
- loaders：IFC loader 與 GLB / GLTF loader。
- selection：raycasting、IFC object metadata、GLB object metadata。
- persistence：project JSON serialize / restore。

## 預期資料模型

project JSON 只保存可還原狀態：

- version number。
- IFC file name / model reference。
- IFC object id 或 expressID。
- object transform：position / rotation / scale。
- GLB object source info。
- GLB object transform。

不保存完整 IFC geometry。

## State 管理方向

MVP 可先使用 React state 與小型 context 管理 scene 狀態。若狀態快速變複雜，再評估 Zustand 或其他輕量 store。

## 可重用 utility

重要邏輯應抽成 utility：

- camera fitting。
- transform serialize / restore。
- selection metadata normalization。
- project JSON validation。

## Browser-only 限制

所有操作在瀏覽器完成。檔案讀取使用 Browser File API，儲存使用 local JSON download。
