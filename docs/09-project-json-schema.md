# 09 - Project JSON Schema（Step 12）

## 目的

Step 12 定義 `project JSON` 的第一版 schema，作為 Step 13~15（save / open / quick save）的共同契約。

設計原則：

- 只保存可還原狀態，不保存 IFC / GLB 幾何本體。
- 使用明確 `schema + version` 做相容性 gate。
- transform 以 `sourceType/sourceId/objectKey` 對應 shared scene object identity。

## Schema 版本

- `schema`: `bim-lightweight-viewer/project`
- `version`: `1`

目前只接受 `version = 1`。未來若欄位有破壞性變更，應升版而非覆蓋舊版語意。

## 欄位定義（v1）

- `schema`: 固定字串，辨識檔案型別。
- `version`: schema 版本號。
- `createdAt`: 建立時間（ISO string）。
- `updatedAt`: 最後更新時間（ISO string）。
- `sources[]`: 已載入 source 清單。
  - IFC source: `sourceType=ifc`, `sourceId`, `fileName`, `modelId`
  - GLB source: `sourceType=glb`, `sourceId`, `fileName`, `rootObjectId`, `nodePath`
- `objectTransforms[]`: 可還原的物件變形清單。
  - `objectRef`: `sourceType/sourceId/objectKey`
  - `position`: `[x, y, z]`
  - `rotation`: `[x, y, z]`（radian）
  - `scale`: `[x, y, z]`

## JSON 範例（v1）

```json
{
  "schema": "bim-lightweight-viewer/project",
  "version": 1,
  "createdAt": "2026-05-29T01:40:00.000Z",
  "updatedAt": "2026-05-29T01:41:32.000Z",
  "sources": [
    {
      "sourceType": "ifc",
      "sourceId": "ifc-1-building-architecture",
      "fileName": "Building-Architecture.ifc",
      "modelId": "ifc-1-building-architecture"
    },
    {
      "sourceType": "glb",
      "sourceId": "glb-1-crane",
      "fileName": "crane.glb",
      "rootObjectId": "root-0",
      "nodePath": "root/CraneBody"
    }
  ],
  "objectTransforms": [
    {
      "objectRef": {
        "sourceType": "ifc",
        "sourceId": "ifc-1-building-architecture",
        "objectKey": "local:2564"
      },
      "position": [1.25, 0, -3.1],
      "rotation": [0, 0.5235987756, 0],
      "scale": [1, 1, 1]
    },
    {
      "objectRef": {
        "sourceType": "glb",
        "sourceId": "glb-1-crane",
        "objectKey": "node:root/CraneBody"
      },
      "position": [4, 0, 2],
      "rotation": [0, 1.5707963268, 0],
      "scale": [1.1, 1.1, 1.1]
    }
  ]
}
```

## 與現況對齊

- 目前 Step 10/11 的 transform runtime 已有 `position/rotation/scale` snapshot，可直接映射到 `objectTransforms[]`。
- 目前 IFC transform attach target 仍是 model root fallback；儲存時仍沿用 shared identity（`sourceType/sourceId/objectKey`）記錄。
- GLB 欄位先在 schema 保留，待 Step 16~19 以實際 GLB loader/selection 流程落地。
