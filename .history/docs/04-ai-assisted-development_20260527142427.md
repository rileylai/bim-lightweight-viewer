# 04 - AI 輔助開發紀錄

## 開發方法

本專案採用 learn-loop agent 方式協作：

- `AGENTS.md` 定義 AI coding agent 規則。
- `docs/*.md` 記錄長期設計與技術決策。
- `dev_state/PROJECT_ROADMAP.md` 管理 step-by-step roadmap。
- `dev_state/DAILY_LOG.md` 記錄每次任務的結果與下一步。

## Prompt 原則

後續 prompt 應盡量指定：

- 要執行哪個 roadmap step。
- 開始前需要讀哪些文件。
- success criteria。
- expected change scope。
- verification commands。
- manual browser validation。

## 驗證 AI 產生的程式碼

每次完成後至少檢查：

- TypeScript build 是否通過。
- UI 是否可在瀏覽器載入。
- 3D 行為是否符合 visual checklist。
- README / docs / dev_state 是否同步更新。

## 待補內容

後續會補上實際 prompt 範例、AI 產生錯誤案例、如何修正與人工驗證紀錄。
