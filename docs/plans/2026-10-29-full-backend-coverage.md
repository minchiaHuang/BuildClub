# Trend Finder 全功能後端化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端每一個看得到的功能都由真的後端撐著（沒有假資料、沒有「Coming soon」、沒有只存在瀏覽器的業務資料），並把規格與決定寫回 repo，讓 AI 只讀本地檔案就能接手。

**Architecture:** 後端仍是單一 FastAPI（`backend/server.py`），新增的路由各自放在小模組（`auth.py`、`share.py`、`assist.py`），資料都進現有的 SQLite `store` 表（key/value JSON）或新表。前端只透過 `src/lib/live.ts`（與新的 `src/lib/api/*.ts`）呼叫後端；元件改動要讓 Veralyn 在 PR 審（使用者 2026-10-29 已同意改元件）。

**Tech Stack:** Python 3 + FastAPI + pydantic + sqlite3 + anthropic SDK（已安裝）；React 19 + TypeScript + Vite。**不新增任何依賴**（見 Global Constraints）。

**Spec:** 本檔 §0 的範圍表，加上雲端 PRD https://claude.ai/artifact/MoURLkE4hAGvKHWu3kZskD（Task 1 會把它同步成本地 `docs/PRD.md`，之後以本地為準）。

工作目錄（所有 task 都在這裡做）：`/Users/tommy/orca/workspaces/BuildClub/full-backend-coverage`，分支 `feat/full-backend-coverage`，從 `feat/integrate-premium-ui`（PR #4，3cb2171）開出。下文 `TF` = `pivots/02-content/app/trend-finder`。

---

## 0. 範圍（使用者 2026-10-29 決定：全部都做）

| # | 功能 | 現況 | 這次做成 |
|---|---|---|---|
| 1 | 本地規格文件 | PRD 只在雲端；decision-log 停在 10/27；README/AGENTS 過時 | `docs/PRD.md`、decision-log、README、AGENTS、STATUS 全部對齊現況 |
| 2 | Channel 樣式 | `.chip`、`.bar` 沒樣式；寫死圓角字級；沒空狀態 | 用共用 token 與元件 class，四套主題都對 |
| 3 | 新增客戶 | 按鈕停用「Coming soon」 | 側邊欄可新增客戶，存 `/api/clients` |
| 4 | 「拍得出來嗎」 | 真實影片永遠「We can't check this one」 | 拆解回傳 `needs`，舊拆解可補判 |
| 5 | 拆解 `lines` | 後端有、前端沒顯示 | 抽屜與規劃頁顯示每句的角色 |
| 6 | Trending now | 只存 localStorage | 存後端 `/api/pulses` |
| 7 | 多平台搜尋 | 只能選 TikTok | IG／YouTube／Reddit／X 都能選，結果合併並標平台 |
| 8 | Annie 審批 | 同一台瀏覽器預覽 | 分享連結 `/review/<token>`，不用登入，決定即時回到 Daphne 那邊 |
| 9 | 登入 | 假登入（localStorage），整站只有 Basic 密碼 | 真帳號（email＋密碼，HttpOnly session cookie） |
| 10 | 貼連結搜尋 | 「Link search isn't live yet」 | 貼影片連結 → 拆解 → 找同類影片 |
| 11 | 截圖搜尋 | 範本假資料 | 上傳截圖 → AI 讀圖 → 找同類影片 |
| 12 | Ask 回答 | live 模式不顯示（範本） | 根據真實結果的簡短回答（只解釋，不寫腳本） |
| 13 | 打字建議 | 只用範例格式 | 加上過去搜尋、pin、客戶主題 |
| 14 | 追蹤看板 | 沒有 | 已批准 → 拍攝 → 剪輯 → 發布，Overview 計數用「已發布」 |
| 15 | 範例資料殘留 | live 模式首裝帶 sampleIdeas、「Sample」標籤、landing 假計數器 | live 模式不出現任何範例資料或 sample 標籤 |

明確不做：AI 寫腳本或生成內容（產品規則）、多代理商多租戶、Annie 的推播通知、手機 App。

## Global Constraints

- 產品規則：「AI explains why real videos went viral. It never writes scripts or generates content.」所有新的 AI 呼叫（Ask、截圖、補判 needs）都只能描述／歸納真實影片。
- 不新增任何 npm 或 pip 依賴。檔案上傳用 JSON base64，不用 `python-multipart`；密碼雜湊用 `hashlib.scrypt`；前端沒有測試框架，前端邏輯用 `tsc -b`、`npm run lint` 與 Playwright E2E 驗證。
- 便宜的 AI 呼叫用 `claude-haiku-5-5`；拆解維持 `analyze.AI_MODEL`（`claude-opus-5-5`）。每個新 AI 呼叫都先 `spend("claude", <估價>, DAILY_CLAUDE_USD)`，超過回 `over_budget(...)`。估價常數：`ASK_USD = 0.01`、`NEEDS_USD = 0.01`、`IMAGE_USD = 0.02`、`LIKE_USD = 0.01`（另加拆解本身的 `ANALYZE_USD`）。
- 每個 AI 結果都快取在磁碟或 `store`，同一輸入第二次免費。
- 後端測試全部離線：沿用 `backend/tests/conftest.py` 的 `offline` fixture；新增的 Anthropic 呼叫一律包在模組層函式（例如 `assist.call_claude(...)`），測試用 monkeypatch 換掉。任何測試碰到網路就算失敗。
- API 契約：新 pydantic model 放 `backend/models.py`，欄位 camelCase 與 `src/types.ts` 一致。舊路由的路徑和回應形狀不變（向下相容 8787 上的舊前端）。
- 前端文案英文、簡短、不提「sample」「coming soon」「demo only」（live 模式下）。
- 不碰：port 8787 與 5195 上跑的東西、`integrate-premium-ui` worktree（它的 `dist/` 就是 Daphne 看到的畫面）、`.env`（只能 `grep -cE '^KEY=.+'` 檢查有沒有填）、`AGENTS.md` 以外的 AI 設定檔。
- 每個 task 結束：`bash bin/verify.sh` 綠 + `cd $TF && npx tsc -b && npm run lint`（前端有改時）乾淨，才 commit。commit 訊息 `<type>(trend-finder): ...`，結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 付費實測只在 Task 16，總上限 US$0.50（見 §測試計畫）。

## Review Focus

1. **Daphne 的整份 PUT 蓋掉 Annie 的決定**：Annie 在分享頁按了 Approve，Daphne 的分頁還開著、隨後改了一個 due date，整份 `/api/ideas` PUT 回去時不能把狀態改回 `waiting`。→ Task 8 的 `test_put_ideas_keeps_newer_decision`。
2. **登入改版後舊網址與 Basic 密碼**：還沒建立任何帳號時，行為要跟今天一模一樣（只有 `APP_PASSWORD` Basic）；建立帳號後，Annie 的分享連結和 landing 頁不需要登入也能打開，其他 `/api/*` 沒 session 一律 401。→ Task 9 的 `test_no_users_keeps_basic_auth`、`test_share_routes_skip_login`。
3. **分享 token 被猜或過期**：token 至少 128 bit；撤銷後立刻 404；token 只能看到該客戶「waiting」的點子，看不到其他客戶。→ Task 8 的 `test_token_scoped_to_one_client`、`test_revoked_token_404`。
4. **多平台一次搜尋的花費**：同時開五個平台時，每個平台各自過每日上限；某個平台 429 或 502 不能讓整次搜尋失敗，其他平台照常顯示，並在畫面上說哪個平台沒結果。→ Task 7 的 E2E 步驟與 `searchAll` 的部分失敗處理。
5. **舊快取／舊拆解沒有新欄位**：`breakdown.json` 沒有 `needs`、`lines`，`SavedIdea` 沒有 `stage`、`decidedAt`，pulse 舊資料在 localStorage。全部要能讀、能顯示、能補。→ Task 4 `test_old_breakdown_without_needs_loads`、Task 6 的 localStorage 遷移、Task 14 `stage` 預設。

---

## 檔案結構

後端（`TF/backend/`）
- `models.py`：加 `needs`、`decidedAt`、`stage`、`postedAt`、各新請求／回應 model。
- `server.py`：掛新路由；`put_ideas` 加合併規則；middleware 改成「session 或 Basic」。
- `auth.py`（新）：users / sessions 表、`hash_password`、`verify_password`、`create_session`、`user_for_session`、CLI `add-user`。
- `share.py`（新）：分享 token 建立／撤銷／查詢、Annie 決定。
- `assist.py`（新）：所有便宜的 Claude 呼叫（Ask、needs 補判、截圖讀圖、連結轉關鍵字）與其快取。
- `analyze.py`：PROMPT 與 `Breakdown` 加 `needs`。
- `tests/test_auth.py`、`test_share_link.py`、`test_assist.py`、`test_pulses.py`、`test_ideas_merge.py`、`test_stats.py`（新）；`test_analyze.py` 擴充。

前端（`TF/src/`）
- `lib/live.ts`：新 API 呼叫（pulses、stats、suggest、answer、like、needs）。
- `lib/auth.ts`（新）：`me()`、`login()`、`logout()`。
- `lib/share.ts`（新）：`createShareLink()`、`loadReview()`、`decide()`。
- `components/ReviewPage.tsx`（新）：Annie 的獨立審核頁（重用 `ReviewScreen` 的卡片）。
- `components/TrackingBoard.tsx`（新）、`components/NewClientForm.tsx`（新，或重用 SettingsScreen 的表單）。
- 修改：`App.tsx`、`Sidebar.tsx`、`LoginScreen.tsx`、`PlatformToggles.tsx`、`parseQuery.ts`、`BreakdownPanel.tsx`、`PlanScreen.tsx`、`ApprovalsScreen.tsx`、`PlansScreen.tsx`、`OverviewScreen.tsx`、`ResultsScreen.tsx`、`LikeThisCard.tsx`、`ChannelScreen.tsx`、`styles/channel.css`、`metrics.ts`、`state.ts`、`types.ts`、landing 三頁與 `themes/UnifyHero.tsx`。

工具：`bin/isolated-backend.sh` 加 `--demo-data`（複製 pinned 與 tofu 的 jobs），E2E 才有資料。

---

## 任務

順序有相依性（多數都改 `App.tsx`），**一次只跑一個 task**，不要平行。

### Task 1：本地規格文件

**Files:**
- Create: `docs/PRD.md`
- Modify: `docs/decision-log.md`、`TF/README.md`、`AGENTS.md`（使用者 2026-10-29 同意）、`docs/STATUS.md`

- [ ] **Step 1：** 用 Claude Docs connector 讀雲端 PRD（doc id `a873e274-5032-4ec1-a021-b24ac6f03242`，tab node `38f5e5f2-ee00`），轉成 markdown 寫進 `docs/PRD.md`。開頭寫「本檔是 Trend Finder 規格的正本；雲端版只是 2026-10-27 的快照」。
- [ ] **Step 2：** 更新 `docs/PRD.md` 的範圍表與 API 表，改成本計畫 §0 與「做完後」的路由清單（`/api/auth/*`、`/api/share*`、`/api/review/*`、`/api/pulses`、`/api/stats`、`/api/suggest`、`/api/answer`、`/api/like`、`/api/needs`、`/api/channel*`、`/api/library`）。路由欄註明「Task N 完成後生效」。
- [ ] **Step 3：** `docs/decision-log.md` 補 10/27 之後的決定（每條一行，日期＋決定＋理由，來源是 `docs/STATUS.md`）：花費上限 2.00／中位數 0.60、每帳號 6 支、中位數重用 30 天、拿掉其他平台切換（10/28）、Daphne 的 8787 設 `DAILY_APIFY_USD=0`、2026-10-29「前端功能全部後端化」與本計畫連結。
- [ ] **Step 4：** `TF/README.md` 改掉「All data is sample data / no backend」、24 小時快取、US$0.05 等錯誤；寫清楚兩種模式、怎麼啟動、`bin/isolated-backend.sh`。`AGENTS.md` 第 24 行舊 Node API 那句與費用數字改成現況（搜尋約 US$0.11、全新 TikTok 含分數約 US$0.45），「Start here」加 `docs/PRD.md`。
- [ ] **Step 5：** `bash bin/verify.sh` 綠 → commit `docs(trend-finder): bring PRD and decisions into the repo`。

### Task 2：Channel 樣式對齊

**Files:** Modify `TF/src/styles/channel.css`、`TF/src/components/ChannelScreen.tsx`

- [ ] **Step 1：** 平台選擇改用現有的 chip 樣式（先在 `src/styles/` 找已定義的 pill／chip 類別，例如 `.cchip` 或 `.pill-btn`，用 `rg -n "\.cchip|\.pill-btn" src/styles`）；選中狀態用 `--accent` 填色。不要另外發明一套。
- [ ] **Step 2：** 新增 `.chan-progress .bar`（軌道 `--surface-2`、填色 `--accent`、高 6px、圓角 999px）。
- [ ] **Step 3：** `12px` 圓角全改 `var(--radius)`；寫死字級改 `--text-*` token（先 `rg -n "\-\-text-" src/styles/tokens.css` 看有哪些）；`--font-display` 改 `--font-sans`。
- [ ] **Step 4：** 沒有結果也沒有在跑時，顯示和 Plans 一樣的虛線空狀態卡（重用 Plans 的 class），文案：「Decode a channel to see the formats it keeps using.」
- [ ] **Step 5：** 驗證：`npx tsc -b && npm run lint`；Playwright 在 default、Altitude、Unify、Midnight 四套主題各截一張 Channel 頁（1440×900），與 Plans 頁比對圓角、chip、字體一致。截圖放 session scratchpad。
- [ ] **Step 6：** commit `fix(trend-finder): match the channel page to the shared design tokens`。

### Task 3：新增客戶

**Files:** Modify `TF/src/components/Sidebar.tsx:110-115`、`TF/src/App.tsx`；Create `TF/src/components/NewClientForm.tsx`（若 `SettingsScreen` 的表單可抽出來共用，改成抽出共用元件，不要複製）

**Interfaces:** Produces `onAddClient(c: Client): void`（App.tsx 內，`setClients([...clients, c])` 後切到該客戶並進 settings）

- [ ] **Step 1：** 「Coming soon」換成「Add client」按鈕，打開表單：name（必填）、niche、audience、monthlyTarget（預設 8）、topics（一行一個）、cannot（同 Settings 的勾選）。`id` = `slug(name)`，重複就加 `-2`、`-3`。
- [ ] **Step 2：** 送出後透過現有 `setClients`（live 模式會 PUT `/api/clients`）存檔並切到新客戶。
- [ ] **Step 3：** 後端不用改，但加一個測試確認新客戶能存回來：`backend/tests/test_store.py::test_added_client_round_trips`（PUT 兩個客戶 → GET 回兩個，第二個 `topics` 保留）。
- [ ] **Step 4：** 驗證：verify 綠、tsc/lint 乾淨；E2E 新增「Acme Bakery」→ 重新整理還在 → `curl` 隔離後端 `/api/clients` 看得到。
- [ ] **Step 5：** commit `feat(trend-finder): add clients from the sidebar`。

### Task 4：「拍得出來嗎」＋ `lines` 顯示

**Files:** Modify `TF/backend/models.py`（`Breakdown`）、`TF/backend/analyze.py`（PROMPT、`breakdown()`）、`TF/backend/server.py`、Create `TF/backend/assist.py`、Test `TF/backend/tests/test_analyze.py`、`test_assist.py`；前端 `types.ts`、`lib/live.ts`、`lib/metrics.ts:102`、`BreakdownPanel.tsx`、`PlanScreen.tsx`

**Interfaces:**
- Produces（後端）：`Breakdown.needs: list[str] = []`；`AnalyzeRequest.needs: list[str] = []`（可選的詞彙表）；`POST /api/needs` body `{url: str, needs: list[str]}` → `{needs: list[str]}`（用 `job_id_for(url)` 找到該影片的 `breakdown.json`；沒有拆解 → 404）；`assist.call_claude(model: str, system: str, content: list, max_tokens: int) -> str`（之後所有 task 共用）。
- Produces（前端）：`Format.needsKnown?: boolean`、`Format.lines?: Line[]`、`Line = {time: string; text: string; role: 'hook'|'setup'|'proof'|'payoff'|'cta'}`；`checkNeeds(url: string, vocab: string[]): Promise<string[]>`。

- [ ] **Step 1：寫失敗的測試**
  - `test_analyze.py::test_breakdown_needs_are_limited_to_the_vocabulary`：假 Claude 回 `needs: ["A kitchen", "A drone"]`、詞彙表 `["A kitchen"]` → 結果 `needs == ["A kitchen"]`。
  - `test_analyze.py::test_old_breakdown_without_needs_loads`：jobs 目錄放一個沒有 `needs` 的 `breakdown.json` → `GET /api/analyze/{id}` 200，`result.needs == []`。
  - `test_assist.py::test_needs_backfill_is_cached`：`POST /api/needs` 同一個 url 兩次 → 假 Claude 只被叫一次，`breakdown.json` 已寫入 `needs`。
  - `test_assist.py::test_needs_backfill_over_budget`：`DAILY_CLAUDE_USD=0` → 429。
- [ ] **Step 2：** 跑 `backend/.venv/bin/python -m pytest -q backend/tests/test_analyze.py backend/tests/test_assist.py`，確認失敗。
- [ ] **Step 3：** 實作：PROMPT 加一行「needs: which of these the video requires, chosen only from this list: …」（詞彙表由請求帶來，沒帶就用 `DEFAULT_NEEDS`，內容是 `src/data/sample.ts` 裡所有 `needs` 的聯集，共 7 項，照抄）；回傳後用詞彙表過濾。補判路由讀 `breakdown.json` 的文字欄位（shotList、props、why）送 `claude-haiku-5-5`，回 JSON 陣列，過濾後寫回。花費 `NEEDS_USD`。
- [ ] **Step 4：** 前端：`applyBreakdown` 帶 `needs`、`lines`、`needsKnown: true`（`needs` 欄位存在時）；`metrics.ts` 的判斷改成 `!format.needsKnown` 才說「can't check」；打開抽屜時若是 live 影片、有拆解但 `needsKnown` 不為真，呼叫 `checkNeeds` 補判。`BreakdownPanel` 與 `PlanScreen` 加「What each line does」區塊：每列 `time · role 標籤 · text`，role 標籤用現有 tag 樣式。
- [ ] **Step 5：** 跑測試通過、verify 綠、tsc/lint 乾淨。
- [ ] **Step 6：** commit `feat(trend-finder): check if a client can film a live video and show line roles`。

### Task 5：範例資料殘留清掉＋真實計數

**Files:** `TF/backend/server.py`、Test `TF/backend/tests/test_stats.py`；前端 `state.ts:44`、`App.tsx:78`、`Sidebar.tsx:179`、`landing/*.tsx`、`themes/UnifyHero.tsx`、`ResultsScreen.tsx:217`

**Interfaces:** Produces `GET /api/stats` → `{videosScanned: int, searches: int}`（公開路由，Task 9 會列入免登入清單）。

- [ ] **Step 1：** `test_stats.py::test_counts_cached_and_pinned_videos`：cache 放 2 個搜尋（30＋20 支，其中 5 支 id 重複）、pinned 放 1 個（10 支）→ `videosScanned == 55`、`searches == 3`（以 id 去重；同一個搜尋在 cache 與 pinned 都有時算一次）。
- [ ] **Step 2：** 實作 `/api/stats`，結果在記憶體快取 60 秒。
- [ ] **Step 3：** 前端：live 模式且後端回 `ideas` 為 null 時從空陣列開始（不是 `sampleIdeas`）；live 模式隱藏「Sample」pill 與 landing 的「sample」標籤，計數器改用 `/api/stats`（取不到就整行不顯示）；landing 的「Instagram coming soon」「Demo: both buttons open the sample agency」等字在 live 模式移除；App.tsx:78 說明文字改成現況；ResultsScreen 空結果文案在 live 模式不提 sample。
- [ ] **Step 4：** verify 綠、tsc/lint 乾淨 → commit `fix(trend-finder): drop sample leftovers in live mode and count real videos`。

### Task 6：Trending now 存後端

**Files:** `TF/backend/models.py`、`server.py`、Test `tests/test_pulses.py`；前端 `lib/live.ts`、`App.tsx:97`

**Interfaces:** `GET /api/pulses` → `dict[str, Pulse] | null`；`PUT /api/pulses` body `dict[str, Pulse]`。`Pulse` model 欄位照 `src/lib/clientChips.ts:22` 的 interface 逐欄定義。

- [ ] **Step 1：** `test_pulses.py::test_pulses_round_trip`、`::test_pulses_reject_bad_shape`（缺 `topic` → 422）。
- [ ] **Step 2：** 實作（用現有 `load`/`save`，key `pulses`）。
- [ ] **Step 3：** 前端：live 模式時 pulses 改走 API（同 clients 的模式：載入時伺服器版優先；伺服器是 null 而 localStorage 有資料時，PUT 上去一次＝遷移）。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): keep trending-now checks on the server`。

### Task 7：多平台搜尋

**Files:** 前端 `PlatformToggles.tsx`、`parseQuery.ts`、`lib/live.ts`、`App.tsx:200-280`、`ResultsScreen.tsx`、`state.ts`（`defaultQuery.platforms`）；後端不改路由

**Interfaces:** Produces `searchAll(query: string, platforms: Platform[], opts: {fresh?: boolean; cachedOnly?: boolean}): Promise<{videos: Video[]; failed: {platform: Platform; message: string}[]; pending: Platform[]}>`

- [ ] **Step 1：** PlatformToggles 五個平台都能點；預設 `['tiktok', 'instagram']`（PRD：IG 和 TikTok 預設開）；live 模式不再鎖 TikTok。旁邊說明改成「Each platform is a separate search」。
- [ ] **Step 2：** `parseQuery` 把平台字（instagram／ig／reels、youtube／shorts、reddit、x／twitter、tiktok）加回 `platforms`。
- [ ] **Step 3：** `searchAll` 用 `Promise.allSettled` 平行打 `/api/search?platform=…`；成功的合併，以 `outlierScore` 排序（沒有分數的排在有分數的後面、內部依觀看數）；失敗的收進 `failed`。中位數背景補分（`mediansPending`）的輪詢改成對每個 pending 平台各自輪詢。
- [ ] **Step 4：** ResultsScreen 頂部對每個 `failed` 顯示一行「Instagram: <message>」（用現有錯誤提示樣式）；每張卡已經有平台標籤，確認五個平台的標籤都有樣式（`styles/tags.css`）。
- [ ] **Step 5：** 驗證：tsc/lint；E2E（隔離後端、上限 0）：搜「tofu」勾 TikTok＋Instagram → 兩個平台的 pin 都有，合併顯示且標籤正確；再勾 X → X 顯示 429 那一行，其他照常。
- [ ] **Step 6：** commit `feat(trend-finder): search several platforms at once`。

### Task 8：Annie 分享連結

**Files:** Create `TF/backend/share.py`、`TF/src/lib/share.ts`、`TF/src/components/ReviewPage.tsx`；Modify `models.py`（`SavedIdea.decidedAt: Optional[int]`）、`server.py`（`put_ideas` 合併、掛路由）、`App.tsx`、`ApprovalsScreen.tsx`、`main.tsx`（`/review/<token>` 直接渲染 ReviewPage）；Test `tests/test_share_link.py`、`tests/test_ideas_merge.py`

**Interfaces:**
- `POST /api/share` body `{clientId}` → `{token, url}`（同一客戶已有有效 token 就回同一個）
- `DELETE /api/share/{token}` → 204
- `GET /api/review/{token}` → `{client: {name}, ideas: [{idea: SavedIdea, video: dict, format: dict}]}`（只含該客戶 `status == "waiting"`；video/format 從 `/api/library` 的資料取）
- `POST /api/review/{token}/decide` body `{ideaId, decision: "approved"|"rejected", reason?: str}` → 更新後的 `SavedIdea`（設 `decidedAt = now ms`）
- token：`secrets.token_urlsafe(24)`；存 `store` key `share:<token>` → `{clientId, createdAt}`

- [ ] **Step 1：寫失敗的測試**
  - `test_share_link.py::test_token_scoped_to_one_client`：兩個客戶各一個 waiting 點子 → A 的 token 只看到 A 的。
  - `::test_decide_updates_idea`：decide approved → `GET /api/ideas` 該點子 `status == "approved"`、有 `decidedAt`。
  - `::test_decide_rejects_idea_of_other_client`：用 A 的 token 決定 B 的點子 → 404。
  - `::test_revoked_token_404`。
  - `::test_same_client_reuses_token`。
  - `test_ideas_merge.py::test_put_ideas_keeps_newer_decision`：伺服器上 `status=approved, decidedAt=2000`；PUT 進來同 id `status=waiting`（沒有 decidedAt）、`dueDate` 改了 → 存下的是 `approved`、`decidedAt=2000`、新的 `dueDate`。
  - `::test_put_ideas_allows_resend_after_decision`：PUT 進來 `status=waiting, sentAt=3000`（大於 decidedAt）→ 採用 waiting（Daphne 重新送審）。
- [ ] **Step 2：** 跑，確認失敗。
- [ ] **Step 3：** 實作 `share.py` 與合併規則：對每個進來的點子，若伺服器版 `decidedAt` 存在且 `> max(incoming.decidedAt or 0, incoming.sentAt or 0)`，保留伺服器版的 `status`、`rejectReason`、`decidedAt`，其他欄位用進來的。
- [ ] **Step 4：** 前端：ApprovalsScreen 加「Copy link for Annie」（呼叫 `createShareLink`，`navigator.clipboard.writeText`，按鈕文字變「Copied」2 秒）與「Turn off link」。`/review/<token>` 開 ReviewPage：不顯示側邊欄、不需要登入，重用 `ReviewScreen` 的卡片元件（參考影片、note、shot list、Approve／Reject＋理由），手機寬度 390 要能用。Daphne 這邊在 Approvals 與 Overview 畫面每 20 秒、以及視窗 focus 時重新 `GET /api/ideas`。拿掉 ReviewScreen 的「Annie has no separate login」說明。
- [ ] **Step 5：** 跑測試、verify、tsc/lint。
- [ ] **Step 6：** commit `feat(trend-finder): share a review link with the approver`。

### Task 9：真的登入

**Files:** Create `TF/backend/auth.py`、`TF/src/lib/auth.ts`、Test `tests/test_auth.py`；Modify `server.py`（middleware、路由、CLI）、`LoginScreen.tsx`、`App.tsx:53,532`、`Sidebar.tsx`（顯示使用者與 agency、Sign out）、`state.ts`（`AGENCY_NAME` 改從 `/api/auth/me`）

**Interfaces:**
- 表：`users(email TEXT PRIMARY KEY, name TEXT, agency TEXT, salt BLOB, hash BLOB, created INTEGER)`、`sessions(token TEXT PRIMARY KEY, email TEXT, expires INTEGER)`
- `hash_password(pw: str, salt: bytes) -> bytes`（`hashlib.scrypt(n=2**14, r=8, p=1, dklen=32)`）；`verify_password` 用 `secrets.compare_digest`
- `POST /api/auth/login` `{email, password}` → 200 `{email, name, agency}` + `Set-Cookie: tf_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`（加 `Secure` 當請求是 https，即 `x-forwarded-proto == https` 或 scheme https）；錯誤一律 401 `{"error": "Wrong email or password."}`（不洩漏是哪個錯）
- `POST /api/auth/logout` → 204，刪 session；`GET /api/auth/me` → 有 session：`{users: true, email, name, agency}`；沒有任何帳號：200 `{users: false}`；有帳號但沒 session：401
- CLI：`backend/.venv/bin/python backend/server.py add-user <email> "<name>" "<agency>"`（密碼用 `getpass` 輸入兩次）
- 中介層規則（安全關鍵，照寫）：
  1. 沒有任何使用者 → 行為與現在完全相同（只有 `APP_PASSWORD` Basic，沒設就全開）。
  2. 有使用者 → 不再要求 Basic。免登入：非 `/api/` 的靜態檔（前端要能顯示登入頁與分享頁）、`/api/health`、`/api/stats`、`/api/auth/login`、`/api/review/*`。其他 `/api/*` 沒有有效 session → 401 JSON。
  3. 登入嘗試：同一 email 10 分鐘內失敗 10 次 → 429 到 10 分鐘後（記憶體計數即可）。

- [ ] **Step 1：寫失敗的測試**（`test_auth.py`）：`test_no_users_keeps_basic_auth`、`test_login_sets_http_only_cookie`、`test_wrong_password_401_same_message_for_unknown_email`、`test_api_needs_session_once_users_exist`、`test_share_routes_skip_login`（`/api/review/<t>`、`/api/stats`、`/` 都不用 session）、`test_logout_kills_session`、`test_expired_session_401`、`test_login_rate_limited`、`test_password_stored_hashed`（DB 裡找不到明文）。
- [ ] **Step 2：** 跑，確認失敗。
- [ ] **Step 3：** 實作 `auth.py` 與 middleware；`test_share.py` 現有測試要全部照過。
- [ ] **Step 4：** 前端：App 啟動先 `me()`；live 模式且 401 → LoginScreen 真的送 `/api/auth/login`，錯誤顯示後端訊息；`me()` 回 `{users: false}`（還沒建任何帳號）→ 維持現在的直接進入。拿掉「Demo only: sign-in isn't built yet」。landing 的按鈕：「Log in」進 LoginScreen；「Register free」改成「Ask for access」mailto（不做自助註冊——多租戶不在範圍）。Sign out 呼叫 `logout()`。
- [ ] **Step 5：** 跑測試、verify、tsc/lint。
- [ ] **Step 6：** commit `feat(trend-finder): real sign-in with email and password`。

### Task 10：貼連結搜尋

**Files:** `TF/backend/assist.py`、`server.py`、`models.py`、Test `tests/test_assist.py`；前端 `lib/live.ts`、`App.tsx:205-215`、`LikeThisCard.tsx`

**Interfaces:** `POST /api/like` body `{url}` → `{job}`（啟動或重用 analyze job）；`GET /api/like/{job}` → `{status, step, breakdown?: Breakdown, keywords?: list[str], formatName?: str}`。拆解完成後用 `claude-haiku-5-5` 從拆解文字萃取 1–3 個搜尋關鍵字＋一個格式名稱（`LIKE_USD`），結果存 `jobs/<id>/like.json`。

- [ ] **Step 1：** 測試：`test_like_reuses_analyze_job`（同 URL 的 analyze 已完成 → 不再叫拆解，只叫一次萃取）、`test_like_keywords_cached`、`test_like_bad_url_400`（不是 TikTok／IG／YouTube／X／Reddit 影片連結 → 400，沿用 `start_analyze` 的網址檢查）。
- [ ] **Step 2：** 跑，確認失敗 → 實作 → 通過。
- [ ] **Step 3：** 前端：live 模式貼連結不再顯示「isn't live yet」，改成跑 `/api/like` 顯示進度（沿用右下角搜尋狀態），完成後 LikeThisCard 顯示真實拆解摘要，並用第一個關鍵字跑 `searchAll`（目前選的平台）。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): find videos like a pasted link`。

### Task 11：截圖搜尋

**Files:** 同 Task 10，加前端截圖上傳入口（`SearchBox.tsx` 若已有入口就接上；沒有就加一個「Upload screenshot」按鈕，用 `<input type="file" accept="image/png,image/jpeg,image/webp">`）

**Interfaces:** `POST /api/like-image` body `{image: str (base64，不含 data: 前綴), mediaType: "image/png"|"image/jpeg"|"image/webp"}` → `{keywords: list[str], formatName: str, description: str}`；圖片 base64 解碼後上限 5 MB（超過 413）；以圖片 sha1 快取於 `store` key `likeimg:<sha1>`；花費 `IMAGE_USD`。

- [ ] **Step 1：** 測試：`test_like_image_cached_by_hash`、`test_like_image_too_big_413`、`test_like_image_bad_type_422`、`test_like_image_prompt_forbids_writing_scripts`（斷言送給假 Claude 的 system 含 "Do not write a script"）。
- [ ] **Step 2：** 失敗 → 實作 → 通過。
- [ ] **Step 3：** 前端：選檔 → 前端轉 base64 → 呼叫 → LikeThisCard 顯示 description 與格式名 → `searchAll(keywords[0])`。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): find videos like a screenshot`。

### Task 12：Ask 回答（真實資料）

**Files:** `assist.py`、`server.py`、`models.py`、Test `tests/test_assist.py`；前端 `lib/live.ts`、`App.tsx:406`、`ResultsScreen.tsx:200`

**Interfaces:** `POST /api/answer` body `{query: str, videos: [{platform, hook, views, outlier?, hashtags, music}] (最多 30)}` → 回傳形狀等於前端 `Answer`（`src/lib/answer.ts:9` 的 interface，逐欄做成 pydantic model `AnswerResult`）。快取 key = sha1(query + 影片 id 清單)。花費 `ASK_USD`。

- [ ] **Step 1：** 測試：`test_answer_cached`、`test_answer_over_budget_429`、`test_answer_prompt_is_explain_only`（system 含 "Explain patterns in these real videos. Do not write scripts or captions."）。
- [ ] **Step 2：** 失敗 → 實作 → 通過。
- [ ] **Step 3：** 前端：live 模式結果出來後呼叫一次（失敗就安靜不顯示）；標籤「Answer · sample」改「Answer · from these results」。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): answer the search from real results`。

### Task 13：打字建議加真實來源

**Files:** `server.py`、Test `tests/test_stats.py`（同檔）；前端 `lib/suggest.ts`、`SearchBox.tsx` 或使用 `suggest()` 的元件

**Interfaces:** `GET /api/suggest?q=` → `{queries: list[str]}`：cache＋pinned 的查詢、所有客戶的 topics／examples，前綴或包含 `q`（不分大小寫），去重，最多 8 個，pinned 排前面。免費。

- [ ] **Step 1：** 測試 `test_suggest_matches_past_and_client_topics`、`test_suggest_limit_8`。
- [ ] **Step 2：** 失敗 → 實作 → 通過。
- [ ] **Step 3：** 前端：live 模式把 `/api/suggest` 的結果放在規則建議前面（debounce 150 ms）；`suggest()` 的範例格式建議在 live 模式不顯示。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): suggest past searches and client topics`。

### Task 14：追蹤看板

**Files:** Create `TF/src/components/TrackingBoard.tsx`；Modify `models.py`（`SavedIdea.stage: Optional[Literal["approved","filming","editing","posted"]]`、`postedAt: Optional[int]`）、`types.ts`、`PlansScreen.tsx`、`OverviewScreen.tsx`、`Sidebar.tsx`（若需要入口）；Test `tests/test_ideas_merge.py`

- [ ] **Step 1：** 測試 `test_stage_round_trips`、`test_old_idea_without_stage_loads`。
- [ ] **Step 2：** 實作（只有 model 欄位；存檔沿用 `/api/ideas`）。
- [ ] **Step 3：** 前端：Plans 頁加「List / Board」切換；Board 四欄（Approved、Filming、Editing、Posted），卡片可用按鈕移到下一欄或上一欄（不做拖拉），移到 Posted 記 `postedAt`。沒有 `stage` 的已批准點子視為 `approved`。Overview 的「這個月完成數」改算本月 `postedAt`，`monthlyTarget` 不變。樣式用現有卡片與 token，四套主題截圖檢查。
- [ ] **Step 4：** verify、tsc/lint → commit `feat(trend-finder): track approved ideas from filming to posted`。

### Task 15：E2E 測試工具與全流程

**Files:** Modify `bin/isolated-backend.sh`；Create `TF/e2e/full-flow.mjs`（用已存在的 playwright-core：`/Users/tommy/.hermes/hermes-agent/node_modules/playwright-core`，以絕對路徑 import，不安裝新套件）

- [ ] **Step 1：** `isolated-backend.sh` 加旗標 `--demo-data`：把 `$TF/backend/pinned/` 與 pinned 搜尋用到的 `jobs/<id>/`（breakdown.json 存在者）複製進暫存副本；其餘行為不變（仍無 `.env`、上限 0）。另加 `--user <email>:<password>`：啟動後用 CLI 的非互動模式建立測試帳號（Task 9 的 `add-user` 加 `--password-stdin`）。
- [ ] **Step 2：** `e2e/full-flow.mjs <baseUrl>`：依 §測試計畫 B 的步驟跑，每一步截圖到 `$OUT`（環境變數），任何斷言失敗 exit 1。
- [ ] **Step 3：** 先 `npm run build`（**只在本 worktree**），再起 `bash bin/isolated-backend.sh 8797 --demo-data --user test@example.com:pw-for-e2e`，跑 `node TF/e2e/full-flow.mjs http://127.0.0.1:8797`，1440 與 390 各一次。
- [ ] **Step 4：** commit `test(trend-finder): end-to-end flow on an isolated backend`。

### Task 16：付費冒煙測試（上限 US$0.50）＋收尾

- [ ] **Step 1：** 用本 worktree 的後端、真 `.env`、**另一個 port（8798）**，環境變數把上限壓低：`DAILY_APIFY_USD=0.15 DAILY_CLAUDE_USD=0.35`。只跑下列，每項記實際花費：

  | 項目 | 估價 |
  |---|---|
  | Instagram 搜尋「tofu dessert」 | 0.03 |
  | Reddit 搜尋「tofu」 | 0.03（＋subreddit 中位數最多 0.06，超過上限會自動跳過） |
  | X 搜尋「tofu」若無 pin | 0.02 |
  | YouTube 搜尋「tofu recipe」 | 0（yt-dlp） |
  | 一支新影片拆解（含 needs） | 0.08 |
  | 舊拆解補判 needs ×1 | 0.01 |
  | Ask ×1 | 0.01 |
  | 貼連結 like（重用上面那支拆解） | 0.01 |
  | 截圖 like ×1 | 0.02 |
  | **合計** | **約 0.27，硬上限 0.50** |

  **不跑**全新 TikTok 搜尋（約 0.45，Apify 本期只剩約 US$5，留給 Daphne）。如果 Apify 回 402（額度不足），記下來、跳過 Apify 項目，不要想辦法繞過。
- [ ] **Step 2：** 全分支 review：派一個 `model: "opus"` 的 reviewer 看 `git diff feat/integrate-premium-ui...HEAD`，重點看 Task 9 中介層、Task 8 token 與合併規則；修掉確認的問題。
- [ ] **Step 3：** `docs/STATUS.md` 寫結果（每個 task 的 commit、測試數、E2E 截圖路徑、實際花費、還沒做或失敗的）；`docs/PRD.md` 的路由狀態改成「已做」。
- [ ] **Step 4：** push `feat/full-backend-coverage`，開 PR，base `feat/integrate-premium-ui`（PR #4 還沒 merge），標題「Trend Finder: back every front-end feature with the API」，PR 說明含 `## Verification`（Ran／Exercised／Not verified），請 Veralyn 審元件改動。
- [ ] **Step 5：** **不要**切換 8787。早上由使用者決定何時換、要不要先建 Daphne 的帳號（換之前要先跑 `add-user`，否則 Task 9 規則 1 保持原樣，不會鎖住她）。

---

## 測試計畫

**A. 每個 task 都跑（自動、免費）**
1. 後端單元測試：`bash bin/verify.sh`（compile、import、pytest 全部）。現在 161 個，做完預計約 200 個。全部離線：假 Apify、假 Claude、暫存 DB。
2. 前端：`cd $TF && npx tsc -b && npm run lint`。沒有前端單元測試框架（不新增依賴），前端邏輯靠 B 驗。
3. 有 UI 改動的 task：Playwright 截圖（1440 寬，四套主題至少 default＋一套），放 session scratchpad。

**B. 全流程 E2E（Task 15，免費）**：隔離後端（無 `.env`、所有上限 0、`--demo-data`、測試帳號）
1. 開 `/` → landing 計數器是真數字、沒有「sample」。
2. 登入錯密碼 → 看到「Wrong email or password.」；對的 → 進 Overview，側邊欄顯示測試帳號的 agency。
3. 新增客戶「Acme Bakery」→ 重新整理還在。
4. 搜「tofu」勾 TikTok＋Instagram → 兩平台結果合併、標籤正確；加勾 X → X 顯示沒額度那一行，其他照常。
5. 打「tof」→ 建議出現「tofu」（過去搜尋）。
6. 開一支有拆解的影片 → 「What each line does」出現；「Can they film this?」不再是 can't check（demo 資料的 breakdown 若沒有 needs，補判會因上限 0 回 429 → 畫面要顯示 can't check 而不是壞掉）。
7. 存 → 規劃 → 送審 → Approvals 按「Copy link for Annie」→ 用**另一個瀏覽器 context（無 cookie）**開連結 → 看到該點子 → Approve。
8. 回 Daphne 的 context，20 秒內看到 Approved；改 due date → 重新整理後仍是 Approved（Review Focus 1）。
9. Plans → Board → 移到 Posted → Overview 本月完成數 +1。
10. Channel 頁：平台 chip、空狀態樣式正確（不送出，付費）。
11. Sign out → 回登入頁；直接打 `/api/ideas` → 401。
12. 390 寬度重跑 1、7（Annie 在手機）。

**C. 付費冒煙（Task 16，硬上限 US$0.50）**：見 Task 16 表。

**D. 不在今晚做、早上給使用者確認的**
- 換 8787 給 Daphne（要先建她的帳號）。
- 用 tailscale 公開網址從手機開 Annie 連結。
- 全新 TikTok 搜尋（Apify 額度）。

## 夜間執行方式

- 主 session 依序派 Sonnet implementer（一個 task 一個），每個 task 後派 reviewer 檢查該 task 的 diff；Task 8、9 的 reviewer 用 `model: "opus"`（安全關鍵）。
- 綠就繼續下一個；紅就讓 implementer 修一次，還紅就停在該 task，寫 `docs/STATUS.md`＋handoff，後面的 task 若不依賴它就跳過繼續（Task 1、2、5、6、13 互相獨立；8 → 9 有依賴；10 → 11 有依賴）。
- 每個 task commit 後 push 一次（工作不會只留在 mini 上）。
