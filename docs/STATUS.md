# STATUS

**一句話：** Trend Finder Python 後端可以真實搜尋 TikTok；clients / ideas / analyze 端點還沒做。

- **上次驗證：** 2026-10-27，`bash bin/verify.sh` 綠（後端可編譯）；「tofu」真實搜尋 HTTP 200，30 支影片，耗時 3 分 20 秒，已 pin。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`）：Pydantic 欄位模型 → `/api/clients`、`/api/ideas`（SQLite）→ `/api/analyze`（背景工作）。
- **已知問題：**
  - `ANTHROPIC_API_KEY` 還沒填，AI 拆解要用到。
  - 真實搜尋要 3.5 分鐘，現場 demo 一定要用 pin 住的快取。
  - Instagram 關鍵字搜尋還沒驗證（Apify actor 只用過依帳號抓）。
  - `feat/live-backend` 和 `feat/backend-api` 都還沒推上遠端。
  - repo 根目錄有個只有 `.git` 的 `BuildClub/` 資料夾，來源不明，未處理。
- **下一步：**
  1. 寫 `backend/models.py`（clients、ideas、analyze 的欄位）。
  2. `/api/clients`、`/api/ideas` 存 SQLite。
  3. `/api/analyze` 背景工作 + 輪詢。
  4. IG 搜尋小額實測（先報價）。
  5. 前端接線（只改 `src/lib/live.ts`、`src/App.tsx`），開 PR 給 Veralyn 審。
