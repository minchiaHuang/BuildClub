# STATUS

**一句話：** Trend Finder 搜尋支援 TikTok / Instagram / YouTube / Reddit / X 五個平台；2026-10-27 用 Apify 實際扣款校正 TikTok 單價，每日上限調到 US$2、中位數 run 另設 US$0.60 上限，全新 TikTok 搜尋實測估算 0.68 ≈ 實扣 0.668（已 push，PR #3）。

- **2026-10-27 22:30（TikTok 省錢）：** 使用者選 1 + 3：`VIDEOS_PER_AUTHOR` 10 → **6**（中位數 15 個作者約 US$0.33，全新 TikTok 搜尋估約 **US$0.45**，原本 0.68）；`MEDIAN_DAYS` 7 → **30**（五個平台共用，X/Reddit 的中位數也會少抓）。風險：只抓 6 支、`MIN_VIDEOS` 仍是 5，近期影片少的帳號沒有分數的比例可能變高（10 支時 16/30 有分數）。驗證：`bash bin/verify.sh` 綠。**還沒真實實測**：今天 app 記 1.67/2.00，剩的不夠一次 0.45。
- **2026-10-27 22:10（花費上限）：** 使用者決定：`DAILY_APIFY_USD` 預設 1.00 → **2.00**；新增 `MAX_USD_PER_MEDIANS`（預設 **0.60**），只用在 TikTok 作者中位數那個 run（15 × 10 支約 0.56，原本被 0.50 截在 134 支），搜尋本身仍是 `MAX_USD_PER_SEARCH` 0.50。`run_actor` 多一個 `max_usd` 參數，測試的假 actor 跟著改，加 1 個測試（共 159）。真實全新 TikTok 搜尋「miso soup recipe」：搜尋 49 秒回 30 支，中位數背景 48 秒，16/30 支有分數；app 估算 0.12 + 0.56 = **0.68**，Apify 實際扣款 **0.668**（搜尋 0.112、中位數 0.556，上限 0.6，沒有截斷）。app 今天記的 Apify 花費 1.67/2.00。驗證：`bash bin/verify.sh` 綠。

- **2026-10-27 深夜（UI + 花費校正）：**
  - UI（`e756179`）：YouTube 拆解面板不再顯示 Shares + saves（YouTube 搜尋沒有這兩個數字）；側邊欄「Live TikTok data」改成「Live data」；平台切換旁的說明不再多一個空的「· soon」；天數篩選保留沒有日期的 YouTube 影片（`App.tsx` 用 `hasDate`）；規劃頁 IG/X 參考影片只剩一個「Watch on <平台> ↗」文字連結，封面本身改成連到原影片（`BestVideo.tsx`）。改到 Veralyn 的元件：BestVideo、BreakdownPanel、Sidebar、PlatformToggles，加上 `App.tsx`。驗證：verify 綠、`npm run build` 過、eslint 乾淨；Playwright 隔離副本（無 `.env`、假 token、上限 0）5 項全過，TikTok/IG 拆解面板仍有 Shares + saves，TikTok 規劃頁仍是嵌入播放器。
  - X 真實搜尋「tofu」：18 秒回 38 支，36 支有封面（`x.py` 猜的 media 結構讀得到），背景中位數 22 秒，8/38 支有分數。**實際扣款 US$0.0345**（搜尋 38 筆 0.0095 + 中位數 100 筆 0.025；估算 0.06，偏高、安全）。已 pin：`backend/pinned/47b2f044….json`。`server.py pin` 現在接受五個平台。Playwright 隔離副本實測 X 畫面 5 項全過：38 張卡片都有 × 分數（沒中位數的用觀看數 ÷ 粉絲數）、Best 卡片「Open to watch on X」點了開拆解抽屜、抽屜數字正常且有 x.com 連結、規劃頁只有一個「Watch on X ↗」。
  - TikTok 單價校正（沒有另跑新搜尋：app 今天的每日估算已到 US$0.99/1.00 會被擋，而 Apify API 已有 14 筆今天的真實 TikTok run 可對照）：每次搜尋 30 支 **實際 US$0.112**、作者中位數 134 支 **實際 US$0.497**（每支 US$0.0037 + 啟動約 0.001）。原估算搜尋 0.05、每支 0.0017，低估約 2.2 倍 → 改成 `SEARCH_USD["tiktok"] = 0.12`、`APIFY_USD_PER_VIDEO = 0.0037`，`test_budget.py` 跟著改。一次全新 TikTok 搜尋（含 15 個作者中位數）現在估約 US$0.68。

- **2026-10-27 晚（UI 小問題）：** pulse 文案改成「"Trending now" is from TikTok for …, whichever platforms you search」（仍只查 TikTok）；`times()` 10× 以上加千分位；BestVideo 對 YouTube 嵌入 `youtube.com/embed`，IG/X/Reddit 真實影片改顯示「Open to watch on <平台>」（規劃頁是「Watch on <平台> ↗」連結）；YouTube 封面放大 1.34 倍裁掉 hqdefault 的上下黑邊；沒有發布日期（`UNKNOWN_DAYS` = 999，YouTube 搜尋）時影片卡片和 Best 卡片不顯示日期，拆解面板 Growth 顯示「– / Posting date unknown」。改到 Veralyn 的元件：BestVideo、Thumb、ClientChips、VideoTile、ResultsScreen、BreakdownPanel、`index.css`，加上 `lib/metrics.ts`、`lib/live.ts`。驗證：`bash bin/verify.sh` 綠、`npm run build` 過、eslint 改動檔乾淨；Playwright 在隔離副本（無 `.env`、假 token、每日上限 0）實測：pulse 文案、千分位（2,730×、759,722×）、YouTube 嵌入、YouTube 無黑邊／無日期／Growth「–」、IG Best 卡片與規劃頁連結都通過，TikTok 日期與嵌入照舊。**X 沒實測**（沒有 X 快取；和 IG 走同一段程式）。

- **2026-10-27 晚（manager session）：** hover 播放（TikTok 會播；IG embed 不自動播，維持封面）；YouTube 用 yt-dlp 免費，一次約 13 支 Shorts；X 用 kaito actor，tofu 實測 38 支、估 US$0.06；Reddit 改用 clearpath actor 搜 `site:v.redd.it`，tofu 實測 5.4 秒 30 支影片、23 支有分數（免費 JSON 從這台被 403 擋）；Channel 總結呼叫 channel-decoder，@mkbhd 50 支實測：7 種格式、Claude 命名約 US$0.15、Jev US$0.005，結果已快取。驗證：`bash bin/verify.sh` 綠（158 測試）、`npm run build` 過、eslint 乾淨、8787 `/api/health` 列出 5 個平台。使用者授權：驗證過可自動 commit push，付費實測低於 US$1 不用先問。

- **上次驗證：** 2026-10-27 晚（搜尋加速）：`bash bin/verify.sh` 綠（49 個離線測試）、`npm run build` 過、eslint 乾淨；隔離副本用假的 Apify（`run_actor` 換成假資料，中位數延遲 15 秒，不花錢）以 curl 實測：新搜尋 0.03 秒回結果（`mediansPending: true`），15 秒後讀快取分數已補上；`cachedOnly=1` 對沒快取的字回 404。**真實新 TikTok 搜尋還沒實測**（約 US$0.07–0.31，要先問）。更早（IG 前端）：`bash bin/verify.sh` 綠、`npm run build` 過、eslint 改動檔乾淨；Playwright 在隔離副本（scratchpad 複製 backend+dist，無 `.env`、每日上限 0，不可能付費）只搜 tofu 快取，7 項全過：TikTok/IG 單選切換、IG 結果只顯示觀看數（無 × 分數、無 0 followers）、IG 拆解抽屜 Score 顯示「–」、切回 TikTok 分數照舊、「tofu instagram」自動搜 IG、未快取字回每日上限錯誤、IG 規劃頁只顯示觀看數。更早 2026-10-27 晚，`bash bin/verify.sh` 綠（32 個離線測試，含 5 個每日上限測試）；載入多餘 PUT 修好後在瀏覽器實測（vite 5191 → 8787）：載入只有 GET，改一次 client 設定就送一次 `PUT /api/clients`。更早：worktree 裡 `npm ci` 後 `npm run build` 通過（tsc 無錯誤），`eslint src/lib/live.ts src/App.tsx` 無警告；瀏覽器實測（Playwright，vite 5190 → API 8787）全部通過：demo 登入 → 搜尋 tofu（快取）→ 存 xingye0615（快取拆解，秒回）→ 規劃 → 存 thaotamto「Boil your tofu」（真實拆解約 1 分鐘，15 次輪詢）→ 重新整理後 clients/ideas 還在；console 只有 favicon 404 和 TikTok embed 503。本次實測：
  - 作者中位數：對 pin 住的 tofu 補抓 15 個作者 × 10 支，39 秒，134 支，16/30 支有分數。
  - Prompt 修正後重跑 tofu 拆解：28 秒，in 6,530 / out 2,609；shotList/lines 不再有括號註解。舊結果備份在 `backend/jobs/01f97bb23401/breakdown.before-prompt-fix.json`。
  - IG 真實搜尋「tofu」：18 秒，回 12 支 reels（不是 30，actor 說免費方案只抓第一頁）；IG 第一名影片 analyze 全流程 39 秒，yt-dlp 不需登入。
  - `npm run api` 指令改成 Python 後，在 8790 試跑：health、IG pin、TikTok pin 都正常。
- **本次花費（2026-10-27，上限 Apify US$1 / Claude US$1）：** Apify 約 US$0.26（中位數 0.23 + IG 0.03，2/2 次 run），Claude 約 US$0.23（tofu 重跑 + IG 拆解，各約 0.08；瀏覽器實測拆解 1 支，in 6,018 / out 1,828，約 0.07）。Apify 依每支單價估算，實際扣款看 console.apify.com。
- **進行中：** 分支 `feat/backend-api`（worktree `~/orca/workspaces/BuildClub/feat-backend-api`），已 push 到 fork `minchiaHuang/BuildClub`（remote 名 `fork`，upstream 已設），PR：https://github.com/veralynchong/BuildClub/pull/3 。origin 仍是 veralynchong/BuildClub，minchiaHuang 對 origin 沒有寫入權限；之後的 commit 一律 `git push`（推到 fork）。
- **每日花費上限（2026-10-27 新增）：** 後端在每次付費呼叫之前先記一筆估算花費，記在 `data.db`，以這台電腦的當地日期計，午夜歸零。超過上限就回 429，並附上說明。快取、pin 住的搜尋和已經完成的拆解都免費，不會被擋。估算單價（2026-10-27 深夜依實際扣款校正）：TikTok 搜尋 US$0.12 + 每個新作者 US$0.037（15 個約 0.56）、IG 搜尋 US$0.03、X 搜尋 US$0.02、拆解 US$0.08。**校正前估算偏低約 2.2 倍，所以 2026-10-27 這個 Apify 帳號真實的 TikTok 扣款約 US$3.9（14 次 run），遠超過 app 記的 US$1。**新增的 env：
  - `DAILY_APIFY_USD`（預設 2.00，2026-10-27 從 1.00 調高）
  - `DAILY_CLAUDE_USD`（預設 1.00）
- **給 Daphne 用（2026-10-27 決定走選項 1：Mac mini + 通道 + 簡單密碼）：** 後端現在直接提供 `dist/` 的網頁，`npm run build` 之後只要開 8787 一個網址就能用。在 `.env` 設了 `APP_PASSWORD`，打開網頁或呼叫 API 時，瀏覽器都會跳出密碼框（帳號隨便填）；沒設就不檢查。設了密碼之後，本機開 vite 開發時也要輸入一次密碼。2026-10-27 已在 `.env` 設好密碼，用 curl 實測：沒帶密碼的話，網頁、JS 和 API 都回 401，帶對的密碼就回 200。通道已開（2026-10-27）：`tailscale funnel --bg 8787` → https://tommymac-mini.tail8e20a0.ts.net 。從公開網址實測：沒帶密碼或密碼錯都回 401，帶對的密碼網頁回 200，快取的 tofu 搜尋回 30 支。要關通道就跑 `tailscale funnel --https=443 off`。Daphne 要能用，Mac mini 必須開機，8787 後端也要在跑。
- **已知問題：**
  - X 搜尋（2026-10-27，分支 `feat/x-search`；2026-10-27 深夜已真實搜尋 tofu 一次並 pin，見最上面）：用 Apify actor `kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest`（`APIFY_X_ACTOR` 可換），查詢加 `filter:native_video`、`queryType: Top`、30 筆。選它是因為官方文件的輸出明確有 `viewCount` 和 `author.followers`（apidojo/tweet-scraper 的 README 沒有 viewCount）。**輸出裡影片 media 的結構（`extendedEntities.media[].video_info`、`media_url_https`）文件沒寫**，`x.py` 防禦式讀取：找不到 media 就信任 `native_video` 查詢，封面可能是空的，要第一次真實搜尋後對照。分數：同一次 actor 執行用 `from:a OR from:b …`（最多 10 個作者）抓近期影片推文，作者至少 3 支才算中位數，存在 `x_medians` 表（7 天），不夠的作者退回觀看數 ÷ 粉絲數。花費估算：搜尋 US$0.02、中位數 10 個作者約 US$0.04，都算進 Apify 每日上限。**風險：X 服務條款禁止爬取**，只能用在內部研究，不要對外承諾這個來源。`/api/analyze` 接受 x.com / twitter.com 的 status 連結（yt-dlp 可抓公開影片，沒實測）。
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
  - `.env` 有一行空的重複 `TYPESAFE_API_KEY=`（.env 是 symlink，請使用者自己刪）。
  - IG hover 播放要後端提供影片檔網址才做得到。
  0. 明天跑一次全新 TikTok 搜尋（約 US$0.45），確認實扣和有分數的比例。
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
