# STATUS

**一句話：** Trend Finder 後端已做到 PRD 範圍：TikTok + IG 搜尋、每帳號中位數爆紅分數、clients/ideas、analyze（Claude 拆解），前端資料層已接線；已從 fork 開 PR #3 給 Veralyn 審（2026-10-27）。

- **上次驗證：** 2026-10-27 晚，`bash bin/verify.sh` 綠（32 個離線測試，含 5 個每日上限測試）；載入多餘 PUT 修好後在瀏覽器實測（vite 5191 → 8787）：載入只有 GET，改一次 client 設定就送一次 `PUT /api/clients`。更早：worktree 裡 `npm ci` 後 `npm run build` 通過（tsc 無錯誤），`eslint src/lib/live.ts src/App.tsx` 無警告；瀏覽器實測（Playwright，vite 5190 → API 8787）全部通過：demo 登入 → 搜尋 tofu（快取）→ 存 xingye0615（快取拆解，秒回）→ 規劃 → 存 thaotamto「Boil your tofu」（真實拆解約 1 分鐘，15 次輪詢）→ 重新整理後 clients/ideas 還在；console 只有 favicon 404 和 TikTok embed 503。本次實測：
  - 作者中位數：對 pin 住的 tofu 補抓 15 個作者 × 10 支，39 秒，134 支，16/30 支有分數。
  - Prompt 修正後重跑 tofu 拆解：28 秒，in 6,530 / out 2,609；shotList/lines 不再有括號註解。舊結果備份在 `backend/jobs/01f97bb23401/breakdown.before-prompt-fix.json`。
  - IG 真實搜尋「tofu」：18 秒，回 12 支 reels（不是 30，actor 說免費方案只抓第一頁）；IG 第一名影片 analyze 全流程 39 秒，yt-dlp 不需登入。
  - `npm run api` 指令改成 Python 後，在 8790 試跑：health、IG pin、TikTok pin 都正常。
- **本次花費（2026-10-27，上限 Apify US$1 / Claude US$1）：** Apify 約 US$0.26（中位數 0.23 + IG 0.03，2/2 次 run），Claude 約 US$0.23（tofu 重跑 + IG 拆解，各約 0.08；瀏覽器實測拆解 1 支，in 6,018 / out 1,828，約 0.07）。Apify 依每支單價估算，實際扣款看 console.apify.com。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`），已 push 到 fork `minchiaHuang/BuildClub`（remote 名 `fork`，upstream 已設），PR：https://github.com/veralynchong/BuildClub/pull/3 。origin 仍是 veralynchong/BuildClub，minchiaHuang 對 origin 沒有寫入權限；之後的 commit 一律 `git push`（推到 fork）。
- **每日花費上限（2026-10-27 新增）：** 後端在每次付費呼叫之前先記一筆估算花費，記在 `data.db`，以這台電腦的當地日期計，午夜歸零。超過上限就回 429，並附上說明。快取、pin 住的搜尋和已經完成的拆解都免費，不會被擋。估算單價：TikTok 搜尋 US$0.31（含作者中位數）、IG 搜尋 US$0.03、拆解 US$0.08。新增的 env：
  - `DAILY_APIFY_USD`（預設 1.00）
  - `DAILY_CLAUDE_USD`（預設 1.00）
- **已知問題：**
  - 每次新的 TikTok 搜尋多花約 US$0.26（作者中位數），時間也多約 40 秒；可用 `AUTHORS_PER_SEARCH`、`VIDEOS_PER_AUTHOR` 調整。
  - IG 搜尋結果沒有粉絲數 → `followers`/`ratio` 為 null，依觀看數排序；IG 不算作者中位數。前端還沒有選 IG 的 UI（要改元件，屬 Veralyn）。若在前端直接顯示 IG 結果，`outlierScore` 會退回 views÷1，需要先處理。
  - 前端存/規劃一支真實影片就自動跑拆解（首次約 US$0.08，同一連結之後免費）。
  - 前端開啟時會自動搜尋客戶主題（demo 客戶是「tofu recipe」）；目前有快取所以免費，但換客戶主題就會觸發付費搜尋。
  - 頁面文案寫「Live TikTok data」「Each new search costs a few cents」，即使結果來自快取（Veralyn 的元件）。
  - 存影片自動拆解沒有費用提示；Saved ideas 清單看不到拆解狀態，「why it works」只在影片抽屜裡顯示，規劃頁只有 shot list。
  - pin 檔裡的封面網址是 CDN 簽章連結，會過期；離線 demo 時封面可能載不出來。
  - 真實搜尋要 3.5 分鐘以上，現場 demo 一定用 pin 住的快取（tofu 的 TikTok 和 IG 都已 pin）。
  - Breakdown 的 `lines` 前端還沒用到（`Format` 型別沒有這欄，要改 `types.ts`）。
  - 沒改到、但還寫著舊 Node API 的地方：`AGENTS.md` 第 24 行、`vite.config.ts` 註解（`npm run api` 仍然有效）。
  - repo 根目錄有個只有 `.git` 的 `BuildClub/` 資料夾，來源不明，未處理。
- **下一步：**
  1. 等 Veralyn 審 PR #3，回應她的意見。
  2. 和 Veralyn 討論上面的前端已知問題（費用提示、拆解狀態顯示、自動搜尋客戶主題）。
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
- Ran: `npm run build` (passes), eslint on `src/lib/live.ts` and `src/App.tsx` (clean)
- Exercised in the browser: search tofu (cached) → save a video (cached breakdown) → plan → save a second video (real breakdown, ~1 min) → reload, clients and ideas persist
- Not verified: Instagram in the UI (no platform picker yet)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
