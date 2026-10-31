# Remake 2c-2 成品核准 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daphne 在 PlanScreen 把做好的成品「送給 Annie 核准」；Annie 在不用登入的審閱連結 `/review/<token>` 看到成品、可以播放，按 Approve 或寫一句話 Send back；結果存在 SQLite，重開後還在，Daphne 在 CutPanel 看得到。順便修掉審閱頁在 390 寬度的水平溢出。

**Architecture:** 核准紀錄是一張新的 SQLite 表 `cut_reviews`，一個 plan 一列，記下送出時 `final.mp4` 的版本（`st_mtime_ns`，跟 2c-1 的 `?v=` 同一個值）。資料層函式和 Daphne 的送出路由放進 `backend/renders.py`（它已經擁有 `renders` 表和成品檔案）；Annie 那邊的三條路由放進新模組 `backend/cut_review.py`，掛在 `/api/review/{token}/...` 底下，沿用 `share.active_link` 驗 token。不放進 `ideas` JSON：`merge_ideas`（`share.py:39`）會用 Daphne 分頁送回的整份清單覆蓋欄位，核准狀態放那裡會被舊分頁蓋掉。前端在 `src/lib/cut.ts`、`src/lib/share.ts` 加函式，`CutPanel` 加送出按鈕和狀態，`SharedReviewPage` 加一種「成品卡」。

**Tech Stack:** FastAPI、SQLite、pytest；React 19 + TypeScript；`node --test unit/`；e2e 用 Playwright MCP。

**Spec:** `docs/phase2-scope.md` §4 第 3 項的 2c-2；`docs/phase2-2c1-plan.md`「後續」一節（成品檔案要另開以 token 為依據的路徑，不放寬 `/api/ideas/.../cut/file` 的登入要求）；`docs/STATUS.md` Known issues 最後一條（審閱頁 390 寬 scrollWidth 1200，2026-10-31 量過一次，原因未查）。

**分支／worktree：** `feat/remake-cut-approval`，worktree 在 `/Users/tommy/orca/workspaces/BuildClub/remake-cut-approval`，起點 fork main @ 359791c（2c-1 已合併，PR #7）。PR 開到 fork（minchiaHuang/BuildClub），base 是 `main`。worktree 裡的 `backend/.venv` 和 `node_modules` 是指向 remake-rough-cut 的 symlink（git 忽略）。

除非另外註明，以下路徑都相對於 `pivots/02-content/app/trend-finder/`。

## Global Constraints

- 不加任何依賴（Python 或 npm），不發網路呼叫，不用付費 API。
- 不要動 8805、8787、8801、5195、8798、5174/5175、8100/3100 這幾個 port。e2e 後端用其他空的 port，例如 8814。不要讀 `.env`。
- 介面文字用英文，跟現有 UI 一致。
- `/api/ideas/{id}/cut/file` 維持要登入，不改 `needs_session`（`server.py:132-145`）。Annie 只透過 `/api/review/{token}/cuts/...` 拿成品，`PUBLIC_API_PREFIX` 已涵蓋 `/api/review/`（`server.py:141`），不需要新規則。
- Annie 的成品檔案路由只回 inline 播放，不支援 `download=1`，也不帶 `Content-Disposition: attachment`。「不能下載」是指介面不給下載鈕、伺服器不提供下載標頭；看得到 `<video>` 的人技術上仍能存檔，這點寫在 STATUS，不假裝做得到。
- 只有同時符合下列條件，Annie 才看得到（列表）和拿得到（檔案、決定）一支成品：token 有效、plan 屬於該 token 的 client、plan 的 `status == "approved"`、`cut_reviews` 有該 plan 且 `status == "waiting"`、`final.mp4` 存在且版本等於送出時的版本。任何一項不符一律回 404，錯誤文字跟現有的一樣：link 關了回 `share.no_such_link()`，其他回 `{"error": "This video isn't waiting for review.", "code": "not_waiting"}`。
- 文案（前後端一致）：
  - Daphne 端的稱呼一律用 `useManagerName()`（`src/lib/appContext.ts`，`ShortlistBoard.tsx:34`、`PlanScreen.tsx:45` 已這樣用），下面寫成 `<manager>`；後端的錯誤文字不放人名。
  - Daphne 的按鈕：`Send to <manager> for approval`
  - 409 沒有成品：`"Make the video first."`
  - 409 成品過期：`"The takes or music changed after this was made. Make it again before sending it."`
  - 409 正在剪：`"Wait for the cut to finish before sending it."`
  - 409 沒有審閱連結：`"This client's review link is turned off. Make a new one on the Shortlist first."`（連結在 Shortlist 送出 plan 時自動建立，`ShortlistBoard.tsx:84-94`；approved 的 plan 一定送過，所以只有連結被關掉時才會遇到）
  - 409 已核准：`"This video is already approved."`
  - Annie 看到的版本已被換掉（409，`code: "replaced"`）：`"This video was replaced while you were watching. Here is the new one."`
  - Send back 沒寫原因（422）：`"Say what to change."`
  - CutPanel 狀態列：`Waiting for <manager>'s approval · sent <日期>`、`<manager> approved this video · <日期>`、`<manager> sent this back · <日期>` 加引述原因。
  - CutPanel 在已核准時按 Make the video 的提示：`Making it again clears <manager>'s approval.`

### 我做的預設決定（每項附理由，使用者可否決）

| # | 項目 | 預設 | 理由 |
| --- | --- | --- | --- |
| D1 | 什麼時候 Annie 看得到成品 | Daphne 按「送出」才看得到，不是剪好就自動出現 | 剪好的第一版常要重剪；自動出現會讓 Annie 看到 Daphne 還沒看過的版本 |
| D2 | 核准存哪裡 | 新的 SQLite 表 `cut_reviews`，不放 `ideas` JSON | 見 Architecture：`merge_ideas` 會用舊分頁蓋掉 `ideas` 裡的欄位 |
| D3 | 重剪成功之後 | 刪掉該 plan 的 `cut_reviews` 列（跟寫 `status='done'` 同一個 transaction）；Annie 頁上那張卡消失，Daphne 要重新送 | 核准的是「那一支影片」，換了影片就不算核准 |
| D4 | Annie 看片中途被換掉 | 決定請求帶 `version`，跟紀錄不同就 409 `replaced`，前端重新載入 | 不讓 Annie 核准她沒看過的版本 |
| D5 | Send back 的內容 | 必填一段文字（1–1000 字），不用 plan 那組 `REJECT_TAGS` | 那組標籤是講企劃的（品牌語氣、太難拍），不適用成品；成品的問題要具體說 |
| D6 | 核准後製作階段 | 不自動改 `stage` | `stage` 是 Daphne 手動管的（2a），自動改會跟她的操作打架 |
| D7 | 介面上的稱呼 | Daphne 端用 `useManagerName()`；Annie 的審閱頁不出現人名 | 跟 Shortlist 的 `Send N to <manager>`、PlanScreen 的 `Waiting for <manager>` 一致（已查，2026-11-01） |
| D8 | 撤回送出 | 不做撤回；Daphne 可以重剪（會清掉）或等 Annie 回覆 | YAGNI，沒有需求提到 |
| D9 | 成品卡上的留言 | 不支援時間軸留言（`TimedComments` 只掛參考影片） | 範圍沒寫；Send back 的文字已足夠第一版 |
| D10 | 審閱頁的標題數字 | `N to review` 的 N = 等待中的 plan 數 + 等待中的成品數 | 一頁一個總數，Annie 不用分辨兩種 |

## 資料模型與 API

SQLite（加進 `renders.SCHEMA`，`server.db()` 已經會跑它，`server.py:675`）：

- `cut_reviews(idea_id TEXT PRIMARY KEY, version INTEGER NOT NULL, status TEXT NOT NULL, sent_at INTEGER NOT NULL, decided_at INTEGER, reason TEXT)`；`status` 是 `waiting | approved | rejected`。

| 方法 路徑 | 認證 | 請求 | 回應 |
| --- | --- | --- | --- |
| `GET /api/ideas/{id}/cut`（改） | 登入 | 不變 | `CutState` 多一個 `review: {status, sentAt, decidedAt?, reason?} \| null`；紀錄的 `version` 跟目前 `final.mp4` 不同時回 `null` |
| `POST /api/ideas/{id}/cut/review` | 登入 | 無 body | 200 加 `CutState`；錯誤見文案（404 plan 不存在、409 各種） |
| `GET /api/review/{token}`（改） | token | 不變 | `ReviewList` 多一個 `cuts: [{idea, video?, format?, cut: {url, durationSec, version, sentAt}}]`，`idea` 一樣去掉 `notes`；`url` 是 `/api/review/<token>/cuts/<ideaId>/file?v=<version>` |
| `GET /api/review/{token}/cuts/{idea_id}/file` | token | 無 | `FileResponse(video/mp4)`，inline，支援 Range |
| `POST /api/review/{token}/cuts/{idea_id}/decide` | token | `{decision: "approved"\|"rejected", reason?: str(≤1000), version: int}` | 200 `{status, decidedAt, reason?}` |

- 送出：檢查順序 plan 存在且 approved → 沒有進行中的工作 → 有成品 → 不是 stale → 該 client 有有效的審閱連結 → 不是已核准。通過就 `INSERT ... ON CONFLICT DO UPDATE` 成 `waiting`，`decided_at`、`reason` 清空，`version` 是當下 `final.mp4` 的 `st_mtime_ns`。
- 決定：`BEGIN IMMEDIATE` 裡重新檢查 Global Constraints 那串條件和 `version`，再寫入。`rejected` 時 `reason` 去頭尾空白後不能是空的。
- 重剪中（`queued`/`running`）不影響已送出的紀錄；只有成功才刪（D3）。失敗的重剪不動紀錄，舊成品也還在（2c-1 的行為）。

## Review Focus

1. **token 換成別的 client 的 plan id**：Annie 用 A 的連結去拿 B 的成品檔案或送決定，要 404，不能因為檔案存在就給。→ Task 2 `test_cut_file_other_client_404`、`test_cut_decide_other_client_404`。
2. **plan 送出後被 Daphne 按 Edit 重開（不再 approved）**：Annie 的列表、檔案、決定都要看不到。→ Task 2 `test_reopened_plan_hides_cut`。
3. **Annie 看片時 Daphne 重剪並重新送出**：Annie 按 Approve 帶的是舊版本，要 409 `replaced`，前端換成新片。→ Task 2 `test_decide_with_old_version_409`、Task 3 的 `decideCut` unit test。
4. **`idea_id` 是 `..` 或含 `/`**：檔案路由不能讀出媒體目錄以外的東西。→ Task 2 `test_cut_file_traversal_404`（沿用 `renders.folder_of` 的 `folder.parent == root` 檢查）。
5. **兩個分頁同時決定**（Annie 手機和電腦都開著）：第二個要得到「已經決定」而不是覆蓋。→ Task 2 `test_second_decision_404_not_waiting`。

---

### Task 1: 核准紀錄與 Daphne 的送出路由（`backend/renders.py`）

**Files:**
- Modify: `backend/renders.py`（`SCHEMA` 加表；抽出模組層的 `cut_folder`；`state_of` 加 `review`；`_run` 成功時刪紀錄；新路由）
- Test: `backend/tests/test_renders.py`（沿用 `setup`、`fake_pipeline`、`with_take`、`start`、`wait_for`）

**Interfaces:**
- Produces（Task 2 會用）：
  - `cut_folder(root: Path, idea_id: str) -> Optional[Path]`：`root` 已 `resolve()`；回 `root/idea_id/cut`，`idea_id` 跳出 `root` 時回 `None`。`make_router` 裡的 `folder_of` 改成呼叫它。
  - `final_version(folder: Optional[Path]) -> Optional[int]`：`folder/"final.mp4"` 存在就回 `st_mtime_ns`，否則 `None`。
  - `review_row(conn, idea_id: str) -> Optional[tuple]`：`(version, status, sent_at, decided_at, reason)`。
  - 常數 `NOT_WAITING = "This video isn't waiting for review."`、`REPLACED = "This video was replaced while you were watching. Here is the new one."`、`NEED_REASON = "Say what to change."`

- [ ] **Step 1: 寫失敗的測試**
  - `test_send_for_review_sets_waiting`：做好成品（`fake_pipeline`），建立該 client 的審閱連結（`POST /api/share`），`POST /api/ideas/ia/cut/review` → 200，`review.status == "waiting"`，`sentAt` 是整數；`GET /api/ideas/ia/cut` 一樣。
  - `test_send_needs_a_cut_409`（`"Make the video first."`）、`test_send_stale_cut_409`（換選另一個 take 後送）、`test_send_while_cutting_409`（`slow_pipeline`）、`test_send_needs_review_link_409`、`test_send_not_approved_409`（`NOT_APPROVED`）、`test_send_already_approved_409`（直接在 DB 把列改成 approved 再送）。
  - `test_recut_clears_review`：送出後重剪成功 → `review is None`，`cut_reviews` 沒有該列。
  - `test_failed_recut_keeps_review`：送出後重剪失敗 → `review.status` 仍是 `waiting`。
  - `test_review_survives_restart`：送出後呼叫 `renders.recover(db)`，`review` 還在。
- [ ] **Step 2: 跑測試確認失敗**：`backend/.venv/bin/python -m pytest -q backend/tests/test_renders.py -k review` → FAIL（路由不存在）。
- [ ] **Step 3: 實作**：照「資料模型與 API」。查有效審閱連結：`store` 表 `key LIKE 'share:%'` 中 `clientId` 相符的列（同 `share.keys_of` 的查法，`share.py:97-100`；`keys_of` 是 `make_router` 內部函式，這裡在 `renders.py` 寫一個同樣查法的小函式，不要動 `share.py`）。`_run` 成功那次 `_set(status="done", ...)` 改成在同一個 `with self._db() as conn:` 裡先 `UPDATE renders` 再 `DELETE FROM cut_reviews WHERE idea_id = ?`。
- [ ] **Step 4: 跑 `backend/tests/test_renders.py` 全部** → PASS（2c-1 原有測試也要過）。
- [ ] **Step 5: Commit** `feat(trend-finder): let the team send a finished cut for approval`

### Task 2: Annie 的成品路由（`backend/cut_review.py`）

**Files:**
- Create: `backend/cut_review.py`：`make_router(db, load, media_dir: Callable[[], Path]) -> APIRouter`
- Modify: `backend/share.py`（`get_review` 回傳多 `cuts`；呼叫 `cut_review.waiting_cuts(...)`）、`backend/models.py`（`ReviewCut`、`ReviewCutItem`、`ReviewList.cuts: list[ReviewCutItem] = []`、`CutDecideRequest`）、`backend/server.py:813` 之後加 `app.include_router(cut_review.make_router(db, load, lambda: MEDIA_DIR))`
- Test: Create `backend/tests/test_cut_review.py`（fixture 仿 `test_share_link.py:11-30` 的 `idea`、`two_clients`、`link`，成品用 `test_renders.py` 的 `fake_pipeline` 做法；可以把共用 helper 搬進 `conftest.py`）

**Interfaces:**
- Consumes：Task 1 的 `cut_folder`、`final_version`、`review_row`、三個常數；`share.active_link(load, token)`、`share.no_such_link()`。
- Produces：
  - `waiting_cuts(db, load, media_dir, client_id: str, token: str) -> list[dict]`：每筆 `{"idea": <去掉 notes>, "video", "format", "cut": {"url", "durationSec", "version", "sentAt"}}`，依 `sent_at` 排序。`cut_review` 會 import `share`，所以 `share` 不能反過來 import 它：改成 `share.make_router(db, load, save, cuts=None)`，`cuts: Optional[Callable[[str, str], list]]`（參數是 `client_id, token`），`server.py` 傳 `lambda c, t: cut_review.waiting_cuts(db, load, lambda: MEDIA_DIR, c, t)`。
  - 路由：`GET /api/review/{token}/cuts/{idea_id}/file`、`POST /api/review/{token}/cuts/{idea_id}/decide`，回應見「資料模型與 API」。

- [ ] **Step 1: 寫失敗的測試**
  - `test_review_lists_waiting_cut`：送出後 `GET /api/review/<token>` 的 `cuts` 有一筆，`cut.url` 以 `/api/review/<token>/cuts/ia/file?v=` 開頭，`idea` 沒有 `notes`。
  - `test_review_lists_no_unsent_cut`：剪好但沒送 → `cuts == []`。
  - `test_cut_file_plays_inline`：200，`content-type: video/mp4`，沒有 `content-disposition: attachment`；帶 `Range: bytes=0-9` → 206。
  - `test_cut_file_ignores_download_param`：`?download=1` 一樣沒有 attachment。
  - `test_cut_file_other_client_404`、`test_cut_decide_other_client_404`（Review Focus 1）。
  - `test_reopened_plan_hides_cut`（Review Focus 2）：把 idea 的 `status` 改成 `waiting` 後，列表沒有、檔案 404、決定 404。
  - `test_cut_file_traversal_404`（Review Focus 4）：`idea_id` 用 `%2E%2E`。
  - `test_revoked_link_404_link_closed`：關掉連結後檔案和決定都回 `code == "link_closed"`。
  - `test_approve_cut`：決定 approved → 200；`GET /api/ideas/ia/cut`（登入）的 `review.status == "approved"`，列表不再有它。
  - `test_send_back_needs_reason_422`（`NEED_REASON`，空白字串也算空）、`test_send_back_keeps_reason`。
  - `test_decide_with_old_version_409`（Review Focus 3）：回 `{"error": REPLACED, "code": "replaced"}`。
  - `test_second_decision_404_not_waiting`（Review Focus 5）。
  - `test_signed_in_cut_file_still_needs_login`：有帳號時不帶 cookie 打 `/api/ideas/ia/cut/file` 仍是 401（照 `test_auth.py` 現有建帳號的做法）。
- [ ] **Step 2: 跑測試確認失敗**：`backend/.venv/bin/python -m pytest -q backend/tests/test_cut_review.py` → FAIL。
- [ ] **Step 3: 實作**：每條路由先 `active_link`（無 → `no_such_link()`），再用一個內部函式 `waiting(conn, client_id, idea_id) -> Optional[(folder, version)]` 檢查 Global Constraints 那串條件；決定在 `BEGIN IMMEDIATE` 裡重查，仿 `renders.start_cut` 的寫法（`renders.py:357-374`）。`share.make_router` 的 `cuts` 預設 `None` 時回 `[]`，讓 `test_share_link.py` 等舊測試不用改。
- [ ] **Step 4: 跑 `backend/tests/` 全部** → PASS。
- [ ] **Step 5: Commit** `feat(trend-finder): show a sent cut on the review link and take the approver's answer`

### Task 3: 前端資料層（`src/lib/cut.ts`、`src/lib/share.ts`）

**Files:**
- Modify: `src/lib/cut.ts`（`CutState.review`、`sendCutForReview(ideaId): Promise<CutState>`、`reviewLine(review, formatDay): string | null`）、`src/lib/share.ts`（`ReviewCutItem`、`Review.cuts`、`decideCut(token, ideaId, approved, version, reason?)`、`VideoReplaced` 錯誤類別）
- Test: `unit/cut.test.mjs`、`unit/share.test.mjs`

**Interfaces:**
- Produces：
  - `interface CutReview { status: 'waiting' | 'approved' | 'rejected'; sentAt: number; decidedAt?: number; reason?: string }`；`CutState.review: CutReview | null`
  - `reviewLine(r: CutReview | null, manager: string, day: (ms: number) => string): string | null` → 依文案回三種狀態列文字（不含原因；原因由元件另外顯示），`null` 時回 `null`。
  - `decideCut(token: string, ideaId: string, approved: boolean, version: number, reason?: string): Promise<void>`：404 時 `code == 'link_closed'` 丟 `LinkClosed`，否則丟 `AlreadyReviewed`；409 `code == 'replaced'` 丟 `VideoReplaced`；其他非 2xx 丟 `Error("Couldn't save your answer.")`。
  - `interface ReviewCutItem { idea: Omit<SavedIdea, 'notes'>; video?: Video; format?: Format; cut: { url: string; durationSec: number; version: number; sentAt: number } }`；`Review.cuts: ReviewCutItem[]`（舊後端沒有這欄時 `loadReview` 補成 `[]`）。

- [ ] **Step 1: 寫失敗的測試**：`reviewLine` 三種狀態加 `null`；`decideCut` 用假的 `fetch` 驗四種錯誤對應和請求 body（`{decision, reason, version}`）；`loadReview` 回應缺 `cuts` 時補 `[]`。
- [ ] **Step 2: `node --test unit/`** → FAIL。
- [ ] **Step 3: 實作**（沿用 `share.ts` 現有 `sendDecision` 的錯誤處理寫法）。
- [ ] **Step 4: `node --test unit/`** → PASS；`npx tsc -b`（或 `npm run build`）無型別錯誤。
- [ ] **Step 5: Commit** `feat(trend-finder): client calls for cut approval`

### Task 4: CutPanel 的送出與狀態

**Files:**
- Modify: `src/components/CutPanel.tsx`（`cut-output` 區塊，`CutPanel.tsx:202-216` 附近）、樣式放現有 CutPanel 用的那個 css 檔

- [ ] **Step 1: 實作**：有 `output` 時在 Download 旁顯示送出按鈕，條件 `approved && !stale && !active && review?.status !== 'waiting' && review?.status !== 'approved'`；按下呼叫 `sendCutForReview`，用回傳的 `CutState` 更新；錯誤用現有的錯誤顯示方式。按鈕下方顯示 `reviewLine(...)`，`rejected` 時再顯示引述的原因（class 用現有的 `quote`）。`review?.status === 'approved'` 時，Make the video 按鈕旁顯示 `Making it again clears <manager>'s approval.`。plan 重開（唯讀）時只顯示狀態列，不顯示按鈕。
- [ ] **Step 2: `npm run build`、`npm run lint`** → exit 0。
- [ ] **Step 3: Commit** `feat(trend-finder): send the cut for approval from the plan page`

（這個 task 的行為在 Task 6 的 e2e 驗；純函式部分已在 Task 3 測過。）

### Task 5: 審閱頁的成品卡，並修 390 溢出

**Files:**
- Modify: `src/components/SharedReviewPage.tsx`（新增 `SharedCutCard`；`n` 改成 plan 數加成品數，D10）、`src/styles/shared-review.css`
- 溢出的實際修改位置由 Step 1 的量測決定

- [ ] **Step 1: 先量溢出原因**（Task 6 的 demo 後端起好之後做，或先用同樣方式起一個）：390 寬開 `/review/<token>`，在頁面跑：
  ```js
  [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > 390).map(e => [e.tagName, e.className, Math.round(e.getBoundingClientRect().width)]).slice(0, 15)
  ```
  找出最外層超寬的元素（STATUS 推測是 TikTok embed，**未確認**），把結果寫進 commit 訊息內文。修法以 CSS 為主（例如 `max-width: 100%`、`min-width: 0`、embed 容器 `overflow: hidden`），不改 `BestVideo` 的行為；如果原因在共用元件，只加審閱頁範圍的選擇器（`.shared-review ...`），不影響登入後的頁面。
- [ ] **Step 2: 寫 `SharedCutCard`**：標題（`format.name ?? video.hook ?? 'Plan'`）、`Video for this plan` 標籤、`<video controls playsInline preload="metadata" src={cut.url}>`（不放下載連結）、片長 `formatDuration`、`Approve` 和 `Send back`；Send back 展開一個必填 textarea（`maxLength={1000}`，空白時送出鈕停用），送出呼叫 `decideCut(token, idea.id, approved, cut.version, reason)`。錯誤：`VideoReplaced` → 顯示 `REPLACED` 文案並重新載入列表；`AlreadyReviewed` / `LinkClosed` 照 `SharedCard` 的做法。成品卡排在 plan 卡之後，有自己的小標題 `Videos to approve`（只在有成品時顯示）。
- [ ] **Step 3: `npm run build`、`npm run lint`、`node --test unit/`** → 全過。
- [ ] **Step 4: Commit** `feat(trend-finder): approver reviews the finished video` 和（另一個 commit）`fix(trend-finder): stop the review page overflowing at 390`

### Task 6: e2e、STATUS 和 PR

**Files:** Modify `docs/STATUS.md`（新增「Phase 2c-2」段落，格式照 2c-1；Known issues 的 390 那條改成已修並寫原因）；Modify `docs/phase2-scope.md`（只在需要時補註）

- [ ] **Step 1: 準備素材**：同 2c-1 Task 7 Step 1，只需要一支直式 testsrc take（放在 Playwright 上傳得到的位置）。
- [ ] **Step 2: 啟動 demo 後端**：trend-finder 裡 `npm run build`；worktree 根目錄 `TF_VENV=$PWD/pivots/02-content/app/trend-finder/backend/.venv nohup bash bin/isolated-backend.sh 8814 --demo-data --user e2e@example.com:<一次性密碼> > <scratchpad 絕對路徑>/env-8814.log 2>&1 &`。`TF_VENV` 一定要設（`bin/isolated-backend.sh:30` 預設會用 `~/Desktop/BuildClub` 的 venv，那裡不能碰）。
- [ ] **Step 3: 用 Playwright MCP 在 1440 和 390 兩種寬度跑完**（審閱連結用另一個沒有登入 cookie 的 context 開）：
  1. approved plan 做好成品；沒建審閱連結時按送出 → 顯示沒有連結的錯誤。
  2. 建好連結後送出 → CutPanel 顯示 `Waiting for ... approval`；重新整理還在。
  3. 審閱頁出現成品卡，`<video>` 可以播放，頁面上沒有下載連結；在未登入的 context 直接開 `/api/ideas/<id>/cut/file` → 401。
  4. Send back 沒寫字時按鈕停用；寫字送出 → 卡片消失，CutPanel 顯示原因。
  5. 重新送出、Annie Approve → CutPanel 顯示已核准；重開伺服器（停掉再用同一個資料目錄起來；若 `isolated-backend.sh` 每次都換暫存目錄做不到，就改成只驗重新整理，並在 STATUS 記下沒驗到）。
  6. 已核准後重剪 → 核准清掉、審閱頁不再有這張卡。
  7. Annie 開著頁面時 Daphne 重剪並重送，Annie 按 Approve → 看到 replaced 文案和新片。
  8. 按 Edit 重開 plan → 審閱頁的成品卡消失。
  9. 390 寬：審閱頁（同時有 plan 卡和成品卡時）和 plan 頁的 `document.documentElement.scrollWidth <= 390`。
- [ ] **Step 4: 停掉 8814**：`kill $(lsof -nP -tiTCP:8814 -sTCP:LISTEN)`；關掉自己開的 Playwright 分頁。
- [ ] **Step 5: 更新 STATUS.md，commit** `docs(remake): record 2c-2 verification`
- [ ] **Step 6: `bash bin/verify.sh` GREEN、`npm run build`、`npm run lint` exit 0，push，開 PR 到 fork（minchiaHuang/BuildClub）base `main`**，標題 `feat(trend-finder): Remake 2c-2 — the approver approves or sends back the finished video`。PR 描述列 D1–D10。

## 風險與未驗證

- **390 溢出的原因還沒查**，Task 5 Step 1 才量。如果是 TikTok 的 iframe 自己固定寬度，CSS 可能壓不住，要改成縮放容器；那時再回報，不擅自改 `BestVideo`。
- **「不能下載」只到介面層**（見 Global Constraints）。
- **版本用 `st_mtime_ns`**：同一個 plan 在同一個奈秒內被換兩次檔案的機率可以忽略；檔案被手動複製回去（mtime 變了內容沒變）會被當成新版本，代價只是要重送。
- **審閱連結本身沒有過期時間**（phase 1 的設計），成品跟著這個限制。
- **e2e 的「重開伺服器」**可能受 `isolated-backend.sh` 每次換暫存目錄的限制而做不到，pytest 的 `recover` 測試是替代。

## 後續（不在 2c-2）

成品卡的時間軸留言；撤回送出；核准後自動把 `stage` 推到 posted 前一步；發佈到平台（`publishing.py` 仍是 stub）。延後的 2c-1 follow-up 見 STATUS（ffmpeg 原始錯誤露出、無 ffmpeg 時媒體測試靜默略過、streaming 413 沒測、`receive()` 重複、`signature` 欄位）。
