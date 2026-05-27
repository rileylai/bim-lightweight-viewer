# 04 - AI 輔助開發紀錄

## 文件目的

本文件用來記錄本專案如何使用 AI 工具輔助開發。

本專案不是一次性要求 AI 產生完整程式碼，而是採用 learn-loop agent 的方式，將需求拆成多個小型、可驗證、可回滾的 roadmap step。每個 step 都會先明確定義目標、讀取必要文件、實作範圍、驗證方式與人工瀏覽器檢查項目，再由 AI coding agent 協助實作。

這份文件也會作為最後交件說明的一部分，用來說明：

- 使用哪些 AI 工具協助開發。
- 如何撰寫 prompt。
- 如何拆解 milestone。
- 如何驗證 AI 產生的程式碼。
- 遇到哪些 AI 生成錯誤或技術困難。
- 如何透過人工檢查與後續 prompt 修正問題。

---

## 開發方法

本專案採用 learn-loop agent 方式協作：

- `AGENTS.md` 定義 AI coding agent 規則。
- `docs/*.md` 記錄長期設計、技術決策、限制與驗證方式。
- `dev_state/PROJECT_ROADMAP.md` 管理 step-by-step roadmap。
- `dev_state/DAILY_LOG.md` 記錄每次任務的結果、驗證狀態、遇到的問題與下一步。

開發流程採用以下循環：

```txt
需求定義 → 文件讀取 → 小步實作 → 自動驗證 → 人工瀏覽器驗證 → 紀錄結果 → 進入下一步
```

每個 step 不追求一次完成大量功能，而是先完成一個可以被驗證的小目標。例如：

- 先建立 3D canvas，再加入 OrbitControls。
- 先建立 IFC file upload UI，再整合 IFC loader。
- 先調查 IFC object identity，再實作 selection。
- 先定義 project JSON schema，再實作 save / restore。

這樣可以降低 AI 一次修改過多檔案、產生不可控錯誤，或讓錯誤累積到後期才被發現的風險。

---

## AI 工具使用原則

本專案會把 AI coding agent 當成 coding harness，而不是完全自動化開發者。

AI 主要負責：

- 根據 roadmap step 實作小範圍功能。
- 建立或修改 React / TypeScript / Three.js 程式碼。
- 協助設計 IFC / GLB loading、selection、transform、save / restore 的程式結構。
- 更新 README、docs 與 dev_state。
- 提供 verification commands 與 manual browser validation steps。
- 協助分析錯誤、提出修正方案與 fallback strategy。

人工開發者主要負責：

- 決定功能優先順序。
- 確認實作是否符合題目需求。
- 在瀏覽器中人工驗證 3D 行為。
- 判斷 UI / UX 是否適合 demo。
- 確認 README 是否誠實描述功能完成狀況與限制。
- 確認 AI 產生的程式碼沒有過度宣稱或錯誤假設。

---

## Prompt 原則

後續 prompt 應盡量指定：

- 要執行哪個 roadmap step。
- 開始前需要讀哪些文件。
- current step。
- success criteria。
- expected change scope。
- verification commands。
- manual browser validation。
- known risks。
- 完成後需要更新哪些文件。
- 完成後需要回報哪些資訊。

標準 prompt 範例：

```txt
請執行 dev_state/PROJECT_ROADMAP.md 的下一個 todo step。

開始前請先讀：
1. AGENTS.md
2. dev_state/PROJECT_ROADMAP.md
3. docs/00-design-doc.md 中與本 step 相關的章節
4. 依照 Documentation Timing Rule，只讀本 step 必要的 docs/*.md，不要一次讀完整 docs 目錄

開始實作前請簡短列出：
- current step
- docs read
- success criteria
- expected change scope
- verification commands
- risks

實作時遵守 AGENTS.md 的架構規則。

完成後請：
- 跑必要驗證
- 更新 dev_state/PROJECT_ROADMAP.md 的 status/current pointer
- 更新 dev_state/DAILY_LOG.md
- 回報 changed files、verification、manual browser validation、commit message、next step
```

---

## Prompt 設計策略

本專案的 prompt 設計會遵守以下原則：

### 1. 一次只做一個小 step

避免要求 AI 一次完成 IFC loading、selection、transform、save / restore 等多個功能。

不建議：

```txt
請一次完成整個 BIM viewer。
```

建議：

```txt
請只完成 Step 4 - IFC file upload UI。
本 step 不需要解析 IFC，只需要讓使用者可以選擇 .ifc 檔案並在 UI 顯示檔名。
```

---

### 2. 每次明確限制 change scope

每個 step 都要告訴 AI 這次可以改哪些範圍，避免它重構過多檔案。

例如：

```txt
Expected change scope:
- upload component
- file state
- basic status UI

請不要在此 step 實作 IFC loader。
請不要改動 persistence 相關邏輯。
```

---

### 3. 每次要求驗證方式

AI 完成後必須提供：

- automated verification，例如 `npm run build`、`npm run lint`。
- manual browser validation，例如「選擇 IFC 檔案後，UI 應顯示檔名」。
- known limitations，例如「此 step 尚未解析 IFC」。

---

### 4. 不讓 AI 自行宣稱 visual validation 通過

本專案是 3D visual application。TypeScript build 通過不代表功能真的正確。

因此 AI 只能說：

```txt
已提供 manual browser validation steps，等待使用者確認。
```

不能說：

```txt
瀏覽器驗證已通過。
```

除非使用者已經實際打開瀏覽器並回報通過。

---

## 驗證 AI 產生的程式碼

每次完成後至少檢查：

- TypeScript build 是否通過。
- lint 是否通過，如果專案有設定 lint。
- UI 是否可在瀏覽器載入。
- console 是否沒有重大錯誤。
- 3D 行為是否符合 `docs/03-visual-test-checklist.md`。
- README / docs / dev_state 是否同步更新。
- roadmap status 是否正確，不應把尚未人工驗證的 visual step 直接標記為 `done`。

---

## 驗證層級

本專案採用兩層驗證：

### 1. Automated Verification

由 Codex 或開發者執行：

```bash
npm run build
npm run lint
```

必要時也可以執行：

```bash
git status --short
```

目的：

- 確認 TypeScript 編譯通過。
- 確認沒有明顯語法錯誤。
- 確認提交前知道哪些檔案被修改。

---

### 2. Manual Browser Validation

由使用者人工執行：

```bash
npm run dev
```

然後在瀏覽器中檢查：

- 頁面是否正常載入。
- canvas 是否正常顯示。
- camera / controls 是否可用。
- IFC / GLB 是否正確顯示。
- selection 是否真的選到物件。
- highlight 是否明確。
- TransformControls 是否真的能 move / rotate / scale。
- save / restore 是否真的還原 transform。
- console 是否出現重大錯誤。

如果 manual browser validation 尚未完成，roadmap status 應維持：

```txt
implemented_pending_manual_validation
```

只有人工確認通過後，才可以改成：

```txt
done
```

---

## AI Output Validation Record

後續每個重要 step 可以用以下格式記錄 AI 產出的驗證結果。

```md
### Step X - <step title>

#### AI 產出摘要

-

#### Automated verification

- Command:
- Result:
- Notes:

#### Manual browser validation

- Checklist used:
- Result: pass / fail / pending
- Notes:

#### Issues found

-

#### Fix prompt / follow-up action

-

#### Final status

- todo / in_progress / implemented_pending_manual_validation / done / blocked
```

---

## Prompt Examples

### Example 1 - 文件與 roadmap 優化

```txt
請先不要實作 UI / 3D 功能。

請檢查並優化目前的 AGENTS.md、docs/*.md、dev_state/PROJECT_ROADMAP.md，目標是讓後續每一步開發都能更穩定、可驗證、可回滾，避免錯誤累積。

請只做文件與 roadmap 優化，不要實作功能。
```

---

### Example 2 - Bug fix prompt

```txt
我完成了人工瀏覽器驗證，但發現以下問題：

Current step:
<step title>

Expected behavior:
<預期行為>

Actual behavior:
<實際行為>

Console error:
<貼上錯誤訊息，如果有>

請先分析可能原因，不要直接大改架構。
請提出最小修改方案，並說明會修改哪些檔案。
確認後再實作修正。
```

---

## AI 產生錯誤的處理方式

如果 AI 產生的程式碼出現問題，處理流程如下：

1. 不直接要求 AI 重寫整個功能。
2. 先描述 expected behavior 與 actual behavior。
3. 附上 console error、build error 或截圖觀察。
4. 要求 AI 先分析原因。
5. 要求 AI 提出最小修正範圍。
6. 修正後重新執行 automated verification。
7. 再進行 manual browser validation。
8. 將問題與修正記錄到 `dev_state/DAILY_LOG.md`，必要時同步到 `docs/06-challenges-and-solutions.md`。

---

## 已知 AI 使用風險

### 1. AI 可能一次修改太多檔案

解法：

- 每次 prompt 明確限制 expected change scope。
- 要求 AI 回報 changed files。
- 不允許一次完成多個 roadmap step。

### 2. AI 可能誤以為 build pass 就代表功能完成

解法：

- 使用 `implemented_pending_manual_validation` 狀態。
- UI / 3D 功能必須由使用者人工驗證。
- Codex 不得自行宣稱 visual validation 通過。

### 3. AI 可能對 IFC loader 能力做錯誤假設

解法：

- 在正式整合 IFC loader 前先做 strategy spike。
- 優先確認 browser-only、WASM、geometry rendering、raycasting、expressID / object id。
- 若 element-level selection 不穩定，採用 fallback 並在 README 誠實揭露。

### 4. AI 可能產生過度複雜架構

解法：

- 優先 MVP。
- 不加入後端。
- 不加入資料庫。
- 不過早引入大型 state management。
- 除非必要，不一次重構整個資料夾。

### 5. AI 可能讓 README 過度宣稱

解法：

- README 只能寫已完成且已驗證的功能。
- 尚未完成或只有 fallback 的功能，必須列在已知限制。
- IFC selection 支援等級需要誠實標示。

---

## 待補內容

後續開發時需要逐步補上：

- 每個重要 step 的 AI output validation record。
- AI 產生錯誤案例。
- IFC loader 調查結果。
- selection / transform / save-restore 的主要挑戰與修正方式。
- 最終交件時的 AI-assisted development summary。
