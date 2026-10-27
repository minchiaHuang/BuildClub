# STATUS

**一句話：** Trend Finder 後端已做到 PRD 範圍：TikTok + IG 搜尋、每帳號中位數爆紅分數、clients/ideas、analyze（Claude 拆解），前端資料層已接線；已從 fork 開 PR #3 給 Veralyn 審（2026-10-27）。

- **上次驗證：** 2026-10-27，`bash bin/verify.sh` 綠（可編譯、可載入、27 個離線測試）。本次實測：
  - 作者中位數：對 pin 住的 tofu 補抓 15 個作者 × 10 支，39 秒，134 支，16/30 支有分數。
  - Prompt 修正後重跑 tofu 拆解：28 秒，in 6,530 / out 2,609；shotList/lines 不再有括號註解。舊結果備份在 `backend/jobs/01f97bb23401/breakdown.before-prompt-fix.json`。
  - IG 真實搜尋「tofu」：18 秒，回 12 支 reels（不是 30，actor 說免費方案只抓第一頁）；IG 第一名影片 analyze 全流程 39 秒，yt-dlp 不需登入。
  - `npm run api` 指令改成 Python 後，在 8790 試跑：health、IG pin、TikTok pin 都正常。
- **本次花費（2026-10-27，上限 Apify US$1 / Claude US$1）：** Apify 約 US$0.26（中位數 0.23 + IG 0.03，2/2 次 run），Claude 約 US$0.16（tofu 重跑 + IG 拆解，各約 0.08）。Apify 依每支單價估算，實際扣款看 console.apify.com。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`），已 push 到 fork `minchiaHuang/BuildClub`（remote 名 `fork`，upstream 已設），PR：https://github.com/veralynchong/BuildClub/pull/3 。origin 仍是 veralynchong/BuildClub，minchiaHuang 對 origin 沒有寫入權限；之後的 commit 一律 `git push`（推到 fork）。
- **已知問題：**
  - 前端沒有 build 過：worktree 和主 checkout 都沒有 `node_modules`，`live.ts`、`App.tsx` 只做了人工型別檢查。先 `npm install` 再 `npm run build`。
  - 每次新的 TikTok 搜尋多花約 US$0.26（作者中位數），時間也多約 40 秒；可用 `AUTHORS_PER_SEARCH`、`VIDEOS_PER_AUTHOR` 調整。
  - IG 搜尋結果沒有粉絲數 → `followers`/`ratio` 為 null，依觀看數排序；IG 不算作者中位數。前端還沒有選 IG 的 UI（要改元件，屬 Veralyn）。若在前端直接顯示 IG 結果，`outlierScore` 會退回 views÷1，需要先處理。
  - 前端存/規劃一支真實影片就自動跑拆解（首次約 US$0.08，同一連結之後免費）。
  - pin 檔裡的封面網址是 CDN 簽章連結，會過期；離線 demo 時封面可能載不出來。
  - 真實搜尋要 3.5 分鐘以上，現場 demo 一定用 pin 住的快取（tofu 的 TikTok 和 IG 都已 pin）。
  - Breakdown 的 `lines` 前端還沒用到（`Format` 型別沒有這欄，要改 `types.ts`）。
  - 沒改到、但還寫著舊 Node API 的地方：`AGENTS.md` 第 24 行、`vite.config.ts` 註解（`npm run api` 仍然有效）。
  - repo 根目錄有個只有 `.git` 的 `BuildClub/` 資料夾，來源不明，未處理。
- **下一步：**
  1. 等 Veralyn 審 PR #3，回應她的意見。
  2. `npm install` 後跑 `npm run build`，在瀏覽器實際點一次：搜尋 tofu → 存一支 → 等拆解完成 → 規劃。
  3. 前端 IG UI 和 `lines` 顯示（Veralyn 的元件）。

## PR 說明（已用於 PR #3）

**Title:** Python backend for Trend Finder: search, scores, clients/ideas, AI breakdown

Replaces the Node API (`server/index.mjs`) with a FastAPI backend in `backend/`. `npm run api` now starts it.

- `GET /api/search?q=&platform=tiktok|instagram`: TikTok results now include `medianViews` and `outlier` (views ÷ the account's usual views, from its latest 10 videos). Instagram results have no follower counts, so they are sorted by views.
- `GET/PUT /api/clients`, `/api/ideas`: saved in SQLite.
- `POST /api/analyze` + `GET /api/analyze/{job}`: downloads the video, finds shots, transcribes it, and asks Claude why it works. Takes about a minute and costs about US$0.08 the first time.
- Front end (only `src/lib/live.ts` and `src/App.tsx`): loads and saves clients and ideas through the API. Saving or planning a real video fills its shot list and "why it works". No component changes.
- 27 offline tests in `backend/tests`, run by `bin/verify.sh`.

## Verification
- Ran: `bash bin/verify.sh` (green, 27 tests)
- Exercised: real TikTok median fetch, real Instagram search, analyze on one TikTok video and one Instagram video, and the API on a spare port
- Not verified: `npm run build` and a click-through in the browser (no node_modules)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
