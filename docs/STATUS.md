# STATUS

**一句話：** Trend Finder 後端已做到 PRD 範圍，前端搜尋頁可切 TikTok / Instagram（2026-10-27 晚）：TikTok + IG 搜尋、每帳號中位數爆紅分數、clients/ideas、analyze（Claude 拆解），前端資料層已接線；已從 fork 開 PR #3 給 Veralyn 審（2026-10-27）。

- **上次驗證：** 2026-10-27 晚（搜尋加速）：`bash bin/verify.sh` 綠（49 個離線測試）、`npm run build` 過、eslint 乾淨；隔離副本用假的 Apify（`run_actor` 換成假資料，中位數延遲 15 秒，不花錢）以 curl 實測：新搜尋 0.03 秒回結果（`mediansPending: true`），15 秒後讀快取分數已補上；`cachedOnly=1` 對沒快取的字回 404。**真實新 TikTok 搜尋還沒實測**（約 US$0.07–0.31，要先問）。更早（IG 前端）：`bash bin/verify.sh` 綠、`npm run build` 過、eslint 改動檔乾淨；Playwright 在隔離副本（scratchpad 複製 backend+dist，無 `.env`、每日上限 0，不可能付費）只搜 tofu 快取，7 項全過：TikTok/IG 單選切換、IG 結果只顯示觀看數（無 × 分數、無 0 followers）、IG 拆解抽屜 Score 顯示「–」、切回 TikTok 分數照舊、「tofu instagram」自動搜 IG、未快取字回每日上限錯誤、IG 規劃頁只顯示觀看數。更早 2026-10-27 晚，`bash bin/verify.sh` 綠（32 個離線測試，含 5 個每日上限測試）；載入多餘 PUT 修好後在瀏覽器實測（vite 5191 → 8787）：載入只有 GET，改一次 client 設定就送一次 `PUT /api/clients`。更早：worktree 裡 `npm ci` 後 `npm run build` 通過（tsc 無錯誤），`eslint src/lib/live.ts src/App.tsx` 無警告；瀏覽器實測（Playwright，vite 5190 → API 8787）全部通過：demo 登入 → 搜尋 tofu（快取）→ 存 xingye0615（快取拆解，秒回）→ 規劃 → 存 thaotamto「Boil your tofu」（真實拆解約 1 分鐘，15 次輪詢）→ 重新整理後 clients/ideas 還在；console 只有 favicon 404 和 TikTok embed 503。本次實測：
  - 作者中位數：對 pin 住的 tofu 補抓 15 個作者 × 10 支，39 秒，134 支，16/30 支有分數。
  - Prompt 修正後重跑 tofu 拆解：28 秒，in 6,530 / out 2,609；shotList/lines 不再有括號註解。舊結果備份在 `backend/jobs/01f97bb23401/breakdown.before-prompt-fix.json`。
  - IG 真實搜尋「tofu」：18 秒，回 12 支 reels（不是 30，actor 說免費方案只抓第一頁）；IG 第一名影片 analyze 全流程 39 秒，yt-dlp 不需登入。
  - `npm run api` 指令改成 Python 後，在 8790 試跑：health、IG pin、TikTok pin 都正常。
- **本次花費（2026-10-27，上限 Apify US$1 / Claude US$1）：** Apify 約 US$0.26（中位數 0.23 + IG 0.03，2/2 次 run），Claude 約 US$0.23（tofu 重跑 + IG 拆解，各約 0.08；瀏覽器實測拆解 1 支，in 6,018 / out 1,828，約 0.07）。Apify 依每支單價估算，實際扣款看 console.apify.com。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`），已 push 到 fork `minchiaHuang/BuildClub`（remote 名 `fork`，upstream 已設），PR：https://github.com/veralynchong/BuildClub/pull/3 。origin 仍是 veralynchong/BuildClub，minchiaHuang 對 origin 沒有寫入權限；之後的 commit 一律 `git push`（推到 fork）。
- **每日花費上限（2026-10-27 新增）：** 後端在每次付費呼叫之前先記一筆估算花費，記在 `data.db`，以這台電腦的當地日期計，午夜歸零。超過上限就回 429，並附上說明。快取、pin 住的搜尋和已經完成的拆解都免費，不會被擋。估算單價：TikTok 搜尋 US$0.31（含作者中位數）、IG 搜尋 US$0.03、拆解 US$0.08。新增的 env：
  - `DAILY_APIFY_USD`（預設 1.00）
  - `DAILY_CLAUDE_USD`（預設 1.00）
- **給 Daphne 用（2026-10-27 決定走選項 1：Mac mini + 通道 + 簡單密碼）：** 後端現在直接提供 `dist/` 的網頁，`npm run build` 之後只要開 8787 一個網址就能用。在 `.env` 設了 `APP_PASSWORD`，打開網頁或呼叫 API 時，瀏覽器都會跳出密碼框（帳號隨便填）；沒設就不檢查。設了密碼之後，本機開 vite 開發時也要輸入一次密碼。2026-10-27 已在 `.env` 設好密碼，用 curl 實測：沒帶密碼的話，網頁、JS 和 API 都回 401，帶對的密碼就回 200。通道已開（2026-10-27）：`tailscale funnel --bg 8787` → https://tommymac-mini.tail8e20a0.ts.net 。從公開網址實測：沒帶密碼或密碼錯都回 401，帶對的密碼網頁回 200，快取的 tofu 搜尋回 30 支。要關通道就跑 `tailscale funnel --https=443 off`。Daphne 要能用，Mac mini 必須開機，8787 後端也要在跑。
- **已知問題：**
  - X 搜尋（2026-10-27，分支 `feat/x-search`，離線測試 only，尚未實測）：用 Apify actor `kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest`（`APIFY_X_ACTOR` 可換），查詢加 `filter:native_video`、`queryType: Top`、30 筆。選它是因為官方文件的輸出明確有 `viewCount` 和 `author.followers`（apidojo/tweet-scraper 的 README 沒有 viewCount）。**輸出裡影片 media 的結構（`extendedEntities.media[].video_info`、`media_url_https`）文件沒寫**，`x.py` 防禦式讀取：找不到 media 就信任 `native_video` 查詢，封面可能是空的，要第一次真實搜尋後對照。分數：同一次 actor 執行用 `from:a OR from:b …`（最多 10 個作者）抓近期影片推文，作者至少 3 支才算中位數，存在 `x_medians` 表（7 天），不夠的作者退回觀看數 ÷ 粉絲數。花費估算：搜尋 US$0.02、中位數 10 個作者約 US$0.04，都算進 Apify 每日上限。**風險：X 服務條款禁止爬取**，只能用在內部研究，不要對外承諾這個來源。`/api/analyze` 接受 x.com / twitter.com 的 status 連結（yt-dlp 可抓公開影片，沒實測）。
  - Reddit 搜尋（2026-10-27，feat/reddit-search）：免費路線走不通——這台機器打 `reddit.com/*.json` 回 403、`.rss` 回 429 且沒有分數、`old.reddit.com` 轉去登入頁；Reddit 的 API 條款也限制商業使用，若以後改回直連要先確認。改用 Apify `clearpath/reddit-search-scraper`（`<關鍵字> site:v.redd.it` 只回 Reddit 託管影片，30 筆約 6 秒、約 US$0.03）；subreddit 中位數用 `clearpath/reddit-subreddit-posts-scraper`，一次 run 抓全部（8 個 sub 實測 US$0.16，每個 sub 約 US$0.02）。這個 actor 偶爾會悄悄少回某些 subreddit（實測 4 個 sub 只回 2 個），少於 5 筆的 sub 不存快取、下次搜尋再試。舊的 `trudax/reddit-scraper-lite` 每篇 15–25 秒、tofu 17 篇沒有任何影片，已棄用。
  - 搜尋加速（2026-10-27）：作者中位數存在 `data.db` 的 `medians` 表，7 天內重用（`MEDIAN_DAYS`），影片太少的作者也記一筆空值；只抓缺的作者，最多 `AUTHORS_PER_SEARCH`（15）個。TikTok 搜尋先回結果（`mediansPending: true`），中位數在背景抓（約 40 秒），抓完改寫快取檔；前端每 5 秒用 `cachedOnly=1` 重問（不會觸發付費搜尋），最多 3 分鐘，右下角顯示「Checking each account's usual views…」。分數補到之前，TikTok 卡片先用觀看數 ÷ 粉絲數。花費估算拆兩筆：搜尋 US$0.05，中位數每位實際抓的作者 US$0.017（10 支 × 0.0017）。「Trending now」不等中位數。背景抓的途中重啟後端，那次搜尋就不會有中位數，下次搜尋會再抓。
  - IG 搜尋結果沒有粉絲數 → `followers`/`ratio` 為 null，依觀看數排序；IG 不算作者中位數。前端（2026-10-27 經使用者同意改 Veralyn 元件）：沒有基準時（`hasScore` 為 false）只顯示觀看數，不顯示 × 分數與 tier；改到 `lib/metrics.ts`、VideoTile、ResultsScreen、BreakdownPanel、PlanScreen、ApprovalsScreen、ClientScreen、PlatformToggles，要給 Veralyn 看。`LikeThisCard` 沒改（只在範例模式的連結搜尋出現）。「Trending now」仍只查 TikTok。
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
  0. 用一次真實的新 TikTok 搜尋實測搜尋加速（約 US$0.07–0.31，先問使用者），對照 Apify console 的實際扣款，校正 `APIFY_USD_PER_VIDEO`。
  1. 等 Veralyn 審 PR #3，回應她的意見。
  2. 和 Veralyn 討論上面的前端已知問題（費用提示、拆解狀態顯示、自動搜尋客戶主題）。
  3. 前端 `lines` 顯示（Veralyn 的元件）。

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
