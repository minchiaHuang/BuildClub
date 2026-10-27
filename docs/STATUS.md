# STATUS

**一句話：** Trend Finder 後端有搜尋、clients/ideas（SQLite）、analyze 全流程（下載、影格、逐字稿、Claude Opus 5.5 拆解）。

- **上次驗證：** 2026-10-27，`bash bin/verify.sh` 綠（可編譯、可載入）；Claude 拆解實測 tofu 第一名影片一次：約 1 分鐘，in 6,455 / out 2,601 tokens，約 US$0.08，結果符合 `Breakdown`；analyze 用 tofu 第一名影片實測：13 鏡頭、12 影格、70 段逐字稿，約 35 秒；「tofu」真實搜尋 HTTP 200，30 支影片，耗時 3 分 20 秒，已 pin。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`）：analyze 已接通，下一步前端接線。
- **已知問題：**
  - 拆解偶爾在 shotList 的 `text` 裡多寫說明文字（如「(Chinese subtitle with English translation)」），之後調 prompt。
  - 真實搜尋要 3.5 分鐘，現場 demo 一定要用 pin 住的快取。
  - Instagram 關鍵字搜尋還沒驗證（Apify actor 只用過依帳號抓）。
  - `feat/live-backend` 還沒推上遠端。
  - repo 根目錄有個只有 `.git` 的 `BuildClub/` 資料夾，來源不明，未處理。
- **下一步：**
  1. IG 搜尋小額實測（先報價）。
  2. 前端接線（只改 `src/lib/live.ts`、`src/App.tsx`），開 PR 給 Veralyn 審。
