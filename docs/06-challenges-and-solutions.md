# 06 - 挑戰與解法

## IFC loader object id

挑戰：IFC loader 可能把模型合併為大 mesh，造成物件級 selection 困難。

Step 4A 決策後解法：

- 先採 `@thatopen/components` 的 Fragments 管線，避免使用已 deprecated 的 `web-ifc-three` 主線整合。
- Step 5~7 先以 `modelId + localId` 當作可持久化 object identity，先確保載入、顯示、camera fit、狀態流可落地。
- Step 8 再專門驗證 `localId` 與 `expressID` 對映與 raycast metadata 精度，決定是否可提升到 IFC element-level selection。

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

Step 4A 補充：

- 若 localId 可穩定對應到 IFC item，就優先走 Level 2（fragment-level）並在 Step 8 挑戰 Level 3。
- 若 localId / metadata 不穩定，Step 9~10 僅承諾 Level 1 或 Level 2，不在 MVP 強推 element-level transform。

## Step 8 探針實作（IFC selection metadata）

本輪在 viewer 中加入「點擊探針」流程，目標是確認 IFC 載入後可取得哪些 selection metadata，作為後續正式 selection、highlight、TransformControls 與 save / restore 的基礎。

- 點擊模型後透過 `FragmentsModel.raycast()` 取得命中結果。
- 探針優先記錄 `localId`、`itemId`、命中點、distance、representation/snapping class。
- 額外嘗試從 hit object `userData` 與 `getItemsData(localId)` 中搜尋 `expressID` 候選欄位。
- 若 raycast 未命中，sidebar 會顯示 miss，用來區分「真正沒有點到 IFC 幾何」與「raycast pipeline 沒有正常執行」。

目前策略：

- 若穩定得到 `localId` 但 `expressID` 不穩定，先以 Level 2（fragment/localId-level selection）推進。
- 若 `localId` 也不穩定，回退 Level 1（model-level selection）並在 README 揭露限制。
- 不在 MVP 階段強行宣稱完整 IFC element-level selection，除非 raycast metadata 與 object identity 都能穩定驗證。

注意：

- 此探針主要作為 Step 8 調查依據，不等於 Step 9 的正式高亮與選取行為。
- Step 8 的目標是先確認可取得哪些 IFC metadata，不在此階段實作 highlight、selection state 或 TransformControls。

### Step 8 補充：R3F 預設 raycast 與 fragments 相容性

挑戰：

- 一開始若把點擊事件綁在 R3F 的 `primitive onClick` / `onPointerDown` 路徑下，R3F 事件系統會先對 scene object 執行 Three.js 預設 raycast。
- 對 ThatOpen Fragments 產生的 IFC 子 mesh 來說，Three.js 預設 `Mesh.raycast()` 可能因 geometry / BufferAttribute 結構不符合預期而拋出 runtime error。
- 這會導致自訂的 IFC probe 還沒執行，state 就已經被錯誤中斷，sidebar 因此無法更新 hit / miss。

解法：

- Step 8 探針改為 canvas DOM-level pointer event，例如綁在 `gl.domElement`。
- 這樣可以避開 R3F 物件事件管線，不讓 Three.js 預設 `Mesh.raycast()` 先掃 IFC fragments。
- DOM pointer event 觸發後，再手動呼叫 `FragmentsModel.raycast()`，讓 IFC hit / miss 探針由 Fragments API 處理。

效果：

- 先前的 `Mesh.raycast` / `BufferAttribute.getX` runtime error 被移除。
- Probe pipeline 可以正常執行，sidebar 開始能更新 hit / miss。
- 但這一階段只解決「事件管線被 Three.js 預設 raycast 中斷」的問題，尚不代表 hit location 已完全準確。

### Step 8 診斷追蹤：點房子 miss、點地板 hit

現象：

- 移除 R3F / Three.js runtime error 後，`FragmentsModel.raycast()` 已能執行，也偶爾能回傳 `localId / itemId`。但實際點擊時，房子本體常常顯示 `miss`，反而點擊地板或周邊區域才 `hit`，代表 raycast 射線與畫面滑鼠位置沒有正確對齊。

排查方式：

- 在 viewer pointer handler 加入 `clientX/clientY`、canvas rect、canvas-relative coordinate、NDC、camera 參數與 modelId log；並在 IFC probe utility 加入 `raycast` / `raycastAll` raw result、hit candidate、localId、itemId、point、distance 等 log，用來比對「實際點擊位置」與「raycast 命中點」是否一致。

根因：

- 原本傳入 `FragmentsModel.raycast()` 的座標是 canvas-relative coordinate：

```ts
clientX = event.clientX - rect.left;
clientY = event.clientY - rect.top;
```

但 FragmentsModel.raycast() 同時收到 dom 與 mouse，因此它內部很可能會根據 dom.getBoundingClientRect() 自行轉換座標。外部先轉一次、內部再轉一次，造成重複 offset，導致 raycast 射線偏移。

解法：

- 呼叫 FragmentsModel.raycast() 時改傳原始 browser client coordinate：

```ts
clientX: event.clientX,
clientY: event.clientY
```

- canvas-relative coordinate 只保留給 rect 範圍判斷與 debug log。

結果：

- 修正後 hit area 與畫面點擊位置對齊，點擊 IFC 可見幾何時能穩定更新 hit / miss 與 localId / itemId metadata，Step 8 可作為後續 shared scene object identity model 的基礎。

### Step 8 補充：Fragments runtime 更新時序

現象：

- 即使座標空間修正後，若 camera 剛移動且 fragments tile/request 尚未同步完成，仍可能出現「畫面看得到幾何但當下 raycast miss」。

解法：

- 在 `probeIfcRuntimeSelection()` 執行 raycast 前，先呼叫 `fragments.core.update(true)` 強制完成 pending request。
- 在 DOM pointer 事件觸發 probe 前，再次 `bindIfcRuntimeCamera(currentCamera)`，避免 runtime 使用過期 camera 參考。

結果與限制：

- 這個修補主要降低「更新時序造成的暫時 miss」；是否完全解決命中精度仍需人工點擊 roof/wall/column/floor/background 驗證。
- `update(true)` 可能增加單次點擊延遲，因此目前僅作為 Step 8 探針穩定性補強，不代表最終 production 策略已定案。

## Selection abstraction

挑戰：IFC 與 GLB 的 object identity 來源不同。

Step 8A 實作解法：

- 建立 shared identity contract：`sourceType`、`sourceId`、`objectKey`、`identityId`、`selectionLevel`、`displayLabel`。
- selected state 僅保存 shared identity，不保存 React/Three runtime instance。
- IFC probe 命中後先做 normalization：
  - `sourceType = ifc`
  - `sourceId = modelId`
  - `objectKey` 優先 `local:{localId}`，其次 `item:{itemId}`，沒有命中 metadata 時使用 `model-root`
- `selectionLevel` 由 metadata 完整度決定：
  - 有 `expressId` 候選：`element`
  - 只有 `localId/itemId`：`fragment`
  - 其他：`model`

這樣 Step 9~14 可以直接沿用 `identityId` 與 `objectRef` 做 selection/highlight、transform attach、serialize/restore。

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
