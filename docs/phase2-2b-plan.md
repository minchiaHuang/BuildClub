# Remake 2b 拍攝清單與實拍上傳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已核准的 plan 在 PlanScreen 上有逐鏡頭的拍攝清單：每個鏡頭可以上傳多個實拍 take、預覽、選定一個、刪除。重開後資料還在。

**Architecture:** 新增後端模組 `backend/takes.py`，做法跟 `comments.py`、`publishing.py` 一樣是 `make_router(...)`，用 `server.include_router` 掛上。take 的紀錄存在 SQLite 的 `takes` 表（schema 跟著 `publishing.SCHEMA` 一起在 `server.db()` 建立），影片檔存在 `backend/media/<ideaId>/<takeId>.<ext>`。上傳用 raw body 串流寫到磁碟並設上限，沿用 brand-studio `api/shots_routes.py:38-47` 的做法，所以不需要 python-multipart。前端新增 `src/lib/takes.ts`（API client 加純函式）和 `src/components/ShotChecklist.tsx`，掛在 PlanScreen 的鏡頭區塊下方。

**Tech Stack:** FastAPI 0.162 / Starlette 1.10（`FileResponse` 支援 Range，`<video>` 可以拖曳）、SQLite、pytest；React 19 + TypeScript；`node --test unit/`。

**Spec:** `docs/phase2-scope.md` §4 第 2 項（2b）。參考來源（唯讀）：brand-studio `api/shots_routes.py:24-47, 180-287`。

**分支／worktree：** `feat/remake-shot-takes`，worktree 在 `/Users/tommy/orca/workspaces/BuildClub/remake-stage-board`，從 fork main @ 83c5753 開出（#4、#5 都已合併，2026-10-31）。PR 開到 fork（minchiaHuang/BuildClub），base 是 `main`。

除非另外註明，以下路徑都相對於 `pivots/02-content/app/trend-finder/`。

## Global Constraints

- 不加任何依賴，也不發付費呼叫（`docs/phase2-scope.md` §5）。2b 不需要 ffmpeg：不轉檔、不抽縮圖。
- 不要動 8805、8787、8801、5195、8798 這幾個 port。e2e 的後端用其他空的 port，例如 8812。
- 不要讀 `.env`。
- 介面文字用英文，跟現有的 UI 一致。
- 完成條件（spec 原文）：
  - 上傳有大小上限和格式檢查。
  - 套用帳號權限。
  - 重開後資料還在。
  - 有單元測試和 e2e。
- 固定值：
  - `MAX_TAKE_BYTES = 200 * 1024 * 1024`（200 MB）。
  - `VIDEO_TYPES = {"video/mp4": "mp4", "video/quicktime": "mov"}`。
  - `MAX_TAKES_PER_SHOT = 10`。
  - `MAX_SHOTS = 50`，鏡頭編號是 0 起算的 index，範圍 `0 <= shot < 50`，跟 `SavedIdea.shotComments` 的 key 一樣。
  - 檔頭檢查：body 的 byte 4-8 必須是 `b"ftyp"`。mp4 和 mov 都是 ISO BMFF 格式，這個檢查兩種都適用。
- 錯誤訊息（前後端一致）：
  - 413：`"The file is over the 200 MB limit."`
  - 415：`"Upload an .mp4 or .mov video file."`
  - 409（plan 不是 approved）：`"Only an approved plan can take footage."`
  - 409（take 數量滿了）：`"This shot has the most takes it can hold (10)."`
  - 404 plan：`"That plan doesn't exist."`；404 take：`"That take doesn't exist."`
  - 422 鏡頭編號：`"The shot number must be between 1 and 50."`（顯示給人看時用 1 起算）。

### 我做的預設決定（使用者選了「直接用預設值」，2026-10-31）

- 影片放後端本機磁碟 `backend/media/`，加進 `.gitignore`。8805 這類暫存環境停掉後檔案會跟著消失，這是已知限制（scope §6）。雲端儲存不在 2b。
- 上傳和選定只能在 plan 是 `approved` 時進行。按 Edit 重開 plan 以後，take 不會被刪掉，清單變成唯讀；再次核准後又可以操作。
- 一個鏡頭的第一個 take 會自動被選定。刪掉已選定的 take 後，該鏡頭就沒有選定的 take，要重新選。
- take 用鏡頭 index 對應。如果之後刪掉鏡頭，或改了鏡頭順序，舊的 take 還是留在原本的 index 上，不會自動搬。超出目前鏡頭數的 take 會隱藏起來，但不刪除。
- 「Copy brief for editor」按鈕保留。清單是新增的區塊，不取代那個按鈕。
- 上傳 take 不會自動把 stage 改成 Filming。
- 刪除 plan 時不清理它的 take。現在沒有刪除 plan 的路由，所以這一步留到以後。
- 審閱連結（`/api/review/...`）完全看不到 take。所有 take 路由都放在 `/api/ideas/...` 底下，所以 `needs_session` 已經會要求登入，不需要另外加規則。

## Review Focus

1. **上傳到一半超過上限，或連線中斷**：磁碟上不能留下半個檔案，資料庫也不能多一筆紀錄。→ Task 1 `test_over_cap_mid_stream_leaves_nothing`。
2. **副檔名或 Content-Type 是對的，內容卻不是影片**（例如把 `.txt` 改名成 `.mp4`）：要回 415，也不能存檔。→ Task 1 `test_wrong_magic_bytes_415`。
3. **plan 按 Edit 重開以後**：已經上傳的 take 不能消失，也不能再上傳；前端要變成唯讀，而不是顯示錯誤。→ Task 2 `test_reopened_plan_keeps_takes_read_only`；Task 4 的 `canEdit` 單元測試。
4. **刪掉鏡頭之後**：清單的完成數只計算目前存在的鏡頭，被隱藏的 take 不算進去。→ Task 3 `checklistProgress ignores takes past the last shot`。
5. **沒有 Content-Length 的 chunked 上傳**：串流上限照樣有效。→ Task 1 `test_over_cap_mid_stream_leaves_nothing` 用 generator body，所以不會帶 Content-Length。

---

### Task 1: 後端 take 儲存、上傳、列表、取檔

**Files:**
- Create: `backend/takes.py`
- Modify: `backend/server.py:661-670`（`db()` 加上 `takes.SCHEMA`）、`backend/server.py:799-802`（`include_router`）、`backend/server.py:51-54` 附近（`MEDIA_DIR = HERE / "media"`）
- Modify: `backend/tests/conftest.py`（`monkeypatch.setattr(server, "MEDIA_DIR", tmp_path / "media")`）
- Modify: `.gitignore`（加 `backend/media/`，放在 `backend/channels/` 那行旁邊）
- Test: `backend/tests/test_takes.py`

**Interfaces:**
- Produces:
  - `takes.SCHEMA: tuple[str, ...]`，內容是 `CREATE TABLE IF NOT EXISTS takes (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, shot INTEGER NOT NULL, ext TEXT NOT NULL, size INTEGER NOT NULL, name TEXT NOT NULL, chosen INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`，另外在 `(idea_id, shot)` 上建 index。
  - `takes.make_router(db, load, media_dir: Callable[[], Path]) -> APIRouter`。`media_dir` 用 callable 傳進去，例如 `lambda: MEDIA_DIR`，這樣測試 monkeypatch 才會生效。
  - JSON 形狀 `Take`：`{id: str, ideaId: str, shot: int, name: str, size: int, chosen: bool, createdAt: int, url: str}`，其中 `url = f"/api/ideas/{ideaId}/takes/{id}/file"`。
  - `POST /api/ideas/{idea_id}/shots/{shot}/takes`：raw body。Content-Type 必須是 `VIDEO_TYPES` 之一。可選的 header `X-Filename` 是 URL 編碼的原始檔名（`urllib.parse.unquote`，截到 200 字元；沒帶就用 `f"take.{ext}"`）。成功回 `Take`。
  - `GET /api/ideas/{idea_id}/takes`：回 `list[Take]`，依 `(shot, createdAt)` 排序。plan 不存在時回 404。
  - `GET /api/ideas/{idea_id}/takes/{take_id}/file`：回 `FileResponse`，`media_type` 依 ext 而定。

- [ ] **Step 1: 寫失敗的測試** `backend/tests/test_takes.py`。共用 fixture 沿用 `test_comments.py:1-20` 的形狀：`setup` 放兩個 approved 的 idea `"ia"`、`"ib"`，和一個 waiting 的 idea `"iw"`。`MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64`。

```python
def up(client, idea="ia", shot=0, body=MP4, ctype="video/mp4", name="IMG_0001.MOV"):
    return client.post(f"/api/ideas/{idea}/shots/{shot}/takes", content=body,
                       headers={"content-type": ctype, "x-filename": quote(name)})

def test_upload_then_list_and_fetch(client, setup):
    t = up(client).json()
    assert t["shot"] == 0 and t["chosen"] is True and t["size"] == len(MP4) and t["name"] == "IMG_0001.MOV"
    assert client.get("/api/ideas/ia/takes").json() == [t]
    f = client.get(t["url"])
    assert f.status_code == 200 and f.content == MP4 and f.headers["content-type"] == "video/mp4"

def test_second_take_is_not_chosen(client, setup):
    up(client); assert up(client).json()["chosen"] is False

def test_survives_restart(client, setup):
    t = up(client).json()
    from fastapi.testclient import TestClient
    assert TestClient(server.app).get("/api/ideas/ia/takes").json() == [t]

def test_wrong_content_type_415(client, setup):
    r = up(client, ctype="text/plain")
    assert r.status_code == 415 and r.json()["error"] == "Upload an .mp4 or .mov video file."

def test_wrong_magic_bytes_415(client, setup):
    assert up(client, body=b"hello world, not a video at all").status_code == 415
    assert client.get("/api/ideas/ia/takes").json() == []
    assert not any((server.MEDIA_DIR / "ia").glob("*")) if (server.MEDIA_DIR / "ia").exists() else True

def test_declared_over_cap_413(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKE_BYTES", 100)
    r = up(client, body=MP4 + b"\x00" * 200)
    assert r.status_code == 413 and r.json()["error"] == "The file is over the 200 MB limit."

def test_over_cap_mid_stream_leaves_nothing(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKE_BYTES", 100)
    def chunks():  # generator body: no Content-Length, so only the streaming cap can catch it
        yield MP4
        yield b"\x00" * 200
    assert up(client, body=chunks()).status_code == 413
    assert client.get("/api/ideas/ia/takes").json() == []
    assert list(server.MEDIA_DIR.rglob("*.*")) == []

def test_not_approved_409(client, setup):
    r = up(client, idea="iw")
    assert r.status_code == 409 and r.json()["error"] == "Only an approved plan can take footage."

def test_unknown_plan_404(client, setup):
    assert up(client, idea="nope").status_code == 404
    assert client.get("/api/ideas/nope/takes").status_code == 404

def test_shot_out_of_range_422(client, setup):
    assert up(client, shot=50).status_code == 422
    assert up(client, shot=-1).status_code == 422

def test_take_cap_per_shot_409(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKES_PER_SHOT", 2)
    up(client); up(client)
    assert up(client).status_code == 409
    assert up(client, shot=1).status_code == 200

def test_takes_need_sign_in(client, setup):
    t = up(client).json()
    add_user()  # from test_auth; from now on every non-public /api path needs a session
    assert up(client).status_code == 401
    assert client.get("/api/ideas/ia/takes").status_code == 401
    assert client.get(t["url"]).status_code == 401

def test_review_link_shows_no_takes(client, setup):
    t = up(client).json()
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    for path in (f"/api/review/{token}", f"/api/review/{token}/ideas/ia/takes"):
        assert t["id"] not in client.get(path).text
```

`add_user` 從 `test_auth.py:25` import。`/api/share` 的 request body 照 `models.ShareRequest` 的實際欄位寫；如果欄位名稱不是 `clientId`，以 model 為準。

- [ ] **Step 2: 執行測試，確認會失敗**

Run: `backend/.venv/bin/python -m pytest -q backend/tests/test_takes.py`
Expected: FAIL（`ModuleNotFoundError: takes`，或 404）

- [ ] **Step 3: 實作 `backend/takes.py`，並修改 server、conftest、.gitignore**

上傳流程：
1. 驗證鏡頭編號，不合法回 422。
2. 找 idea，找不到回 404；不是 approved 回 409。
3. 檢查 Content-Type，不合法回 415。
4. 如果宣告的 Content-Length 超過上限，回 413。
5. 用 `request.stream()` 寫到 `media_dir()/idea_id/.<takeId>.part`。累積超過上限時就刪掉暫存檔並回 413。如果發生例外（包括斷線）也刪掉暫存檔。
6. 檢查前 12 bytes 的 `ftyp`，不符合就刪檔並回 415。
7. 在 `takes_lock`（`threading.Lock`）裡檢查這個鏡頭的 take 數量，滿了就刪檔並回 409。數量夠的話就 `os.replace` 成正式檔名，再 INSERT 一筆。如果這是該鏡頭的第一個 take，`chosen=1`。

`take_id = secrets.token_urlsafe(9)`。檔名只用 take id 和 ext，不用使用者給的檔名。錯誤一律回 `JSONResponse({"error": ...})`，跟 `comments.py` 一致。

- [ ] **Step 4: 執行測試，確認通過**

Run: `backend/.venv/bin/python -m pytest -q backend/tests/test_takes.py` → PASS；再跑 `bash bin/verify.sh`（在 repo 根目錄）→ `verify: GREEN`

- [ ] **Step 5: Commit**

```bash
git add backend/takes.py backend/server.py backend/tests/conftest.py backend/tests/test_takes.py .gitignore
git commit -m "feat(trend-finder): store real-footage takes per shot of an approved plan"
```

### Task 2: 後端選定與刪除

**Files:**
- Modify: `backend/takes.py`
- Test: `backend/tests/test_takes.py`

**Interfaces:**
- Consumes: Task 1 的 `make_router`、`Take` 形狀、`takes_lock`。
- Produces:
  - `POST /api/ideas/{idea_id}/takes/{take_id}/choose`：把同一個鏡頭的 take 全部設成 `chosen=0`，再把這一個設成 1。回該 idea 的 `list[Take]`。
  - `DELETE /api/ideas/{idea_id}/takes/{take_id}`：刪掉紀錄和檔案，回該 idea 的 `list[Take]`。
  - 兩條路由都要求 plan 是 approved，否則回 409；take 不存在，或 take 不屬於這個 idea，回 404。

- [ ] **Step 1: 寫失敗的測試**

```python
def test_choose_moves_the_pick(client, setup):
    a = up(client).json(); b = up(client).json()
    got = client.post(f"/api/ideas/ia/takes/{b['id']}/choose").json()
    assert [t["chosen"] for t in got] == [False, True]

def test_choose_is_per_shot(client, setup):
    a = up(client, shot=0).json(); b = up(client, shot=1).json(); c = up(client, shot=1).json()
    got = {t["id"]: t["chosen"] for t in client.post(f"/api/ideas/ia/takes/{c['id']}/choose").json()}
    assert got == {a["id"]: True, b["id"]: False, c["id"]: True}

def test_delete_removes_file_and_unchooses(client, setup):
    a = up(client).json(); up(client)
    got = client.delete(f"/api/ideas/ia/takes/{a['id']}").json()
    assert len(got) == 1 and got[0]["chosen"] is False
    assert client.get(a["url"]).status_code == 404

def test_take_of_other_plan_404(client, setup):
    other = up(client, idea="ib").json()  # setup 也要放一個 approved 的 "ib"
    assert client.post(f"/api/ideas/ia/takes/{other['id']}/choose").status_code == 404
    assert client.delete(f"/api/ideas/ia/takes/{other['id']}").status_code == 404

def test_reopened_plan_keeps_takes_read_only(client, setup):
    t = up(client).json()
    reopen("ia")  # 透過 PUT /api/ideas 把 ia 改成 waiting，照 test_ideas_merge 的寫法
    assert client.get("/api/ideas/ia/takes").json() == [t]
    assert client.get(t["url"]).status_code == 200
    assert up(client).status_code == 409
    assert client.post(f"/api/ideas/ia/takes/{t['id']}/choose").status_code == 409
    assert client.delete(f"/api/ideas/ia/takes/{t['id']}").status_code == 409
```

- [ ] **Step 2: 執行測試，確認會失敗**：`pytest -q backend/tests/test_takes.py` 預期出現 405 或 404 的失敗。
- [ ] **Step 3: 在 `takes_lock` 裡實作這兩條路由**。DELETE 先刪資料庫的紀錄，再 `unlink(missing_ok=True)` 檔案。
- [ ] **Step 4: 執行測試，確認通過**：`pytest -q backend/tests/test_takes.py` → PASS；`bash bin/verify.sh` → GREEN
- [ ] **Step 5: Commit**：`feat(trend-finder): choose or delete a take`

### Task 3: 前端 `src/lib/takes.ts`

**Files:**
- Create: `src/lib/takes.ts`
- Test: `unit/takes.test.mjs`

**Interfaces:**
- Consumes: Task 1 和 Task 2 的路由與 `Take` 形狀。
- Produces:
  - `export interface Take { id: string; ideaId: string; shot: number; name: string; size: number; chosen: boolean; createdAt: number; url: string }`
  - `export const MAX_TAKE_BYTES = 200 * 1024 * 1024`
  - `export function videoType(file: { name: string; type: string }): 'video/mp4' | 'video/quicktime' | null`：先看 `file.type`，如果是空的就看副檔名（`.mp4`，或不分大小寫的 `.mov`）。
  - `export function checkFile(file: { name: string; type: string; size: number }): string | null`：回錯誤文案（跟 Global Constraints 的 413 和 415 完全一致），沒問題回 null。
  - `export function formatSize(bytes: number): string`：`1536` → `"1.5 KB"`，`52_428_800` → `"50 MB"`，`0` → `"0 B"`。
  - `export function checklistProgress(shotCount: number, takes: Take[]): { done: number; total: number }`：`done` 是 `shot < shotCount` 而且有 chosen take 的鏡頭數。
  - `export function takesByShot(takes: Take[], shotCount: number): Take[][]`：長度等於 `shotCount`，超出範圍的 take 丟掉。
  - `export function canEdit(status: IdeaStatus): boolean`：等於 `status === 'approved'`。
  - `export async function listTakes(ideaId: string): Promise<Take[]>`
  - `export async function uploadTake(ideaId: string, shot: number, file: File): Promise<Take>`：`fetch(..., { method: 'POST', body: file, headers: { 'content-type': videoType(file)!, 'x-filename': encodeURIComponent(file.name) } })`。非 2xx 時 `throw new Error(json.error ?? "Couldn't upload the take.")`。
  - `export async function chooseTake(ideaId: string, takeId: string): Promise<Take[]>`
  - `export async function deleteTake(ideaId: string, takeId: string): Promise<Take[]>`

- [ ] **Step 1: 寫失敗的測試** `unit/takes.test.mjs`，寫法參考 `unit/comments.test.mjs`：

```js
test('videoType falls back to the extension when the browser gives no type', () => {
  assert.equal(videoType({ name: 'IMG_1.MOV', type: '' }), 'video/quicktime')
  assert.equal(videoType({ name: 'a.mp4', type: '' }), 'video/mp4')
  assert.equal(videoType({ name: 'a.webm', type: 'video/webm' }), null)
})
test('checkFile rejects big and non-video files with the server copy', () => {
  assert.equal(checkFile({ name: 'a.mp4', type: 'video/mp4', size: MAX_TAKE_BYTES + 1 }), 'The file is over the 200 MB limit.')
  assert.equal(checkFile({ name: 'a.txt', type: 'text/plain', size: 10 }), 'Upload an .mp4 or .mov video file.')
  assert.equal(checkFile({ name: 'a.mov', type: 'video/quicktime', size: 10 }), null)
})
test('checklistProgress ignores takes past the last shot', () => {
  const t = (shot, chosen) => ({ id: `${shot}${chosen}`, shot, chosen })
  assert.deepEqual(checklistProgress(2, [t(0, true), t(1, false), t(3, true)]), { done: 1, total: 2 })
})
test('takesByShot groups by shot and drops out-of-range ones', () => {
  const t = (id, shot) => ({ id, shot })
  assert.deepEqual(takesByShot([t('a', 1), t('b', 0), t('c', 5)], 2).map((g) => g.map((x) => x.id)), [['b'], ['a']])
})
test('formatSize', () => {
  assert.equal(formatSize(0), '0 B'); assert.equal(formatSize(1536), '1.5 KB'); assert.equal(formatSize(52_428_800), '50 MB')
})
test('canEdit only for approved', () => {
  assert.equal(canEdit('approved'), true); for (const s of ['saved', 'waiting', 'rejected']) assert.equal(canEdit(s), false)
})
test('uploadTake sends the raw file with type and encoded name, and surfaces the server error', async () => {
  // 照 authGate.test.mjs 的方式 mock globalThis.fetch：先 assert 請求的 headers 和 body，再回 409 { error } → rejects 帶相同訊息
})
```

- [ ] **Step 2: 執行測試，確認會失敗**：`node --test unit/takes.test.mjs` 預期出現 `Cannot find module`
- [ ] **Step 3: 實作 `src/lib/takes.ts`**
- [ ] **Step 4: 執行測試，確認通過**：`node --test unit/` → 全部 PASS
- [ ] **Step 5: Commit**：`feat(trend-finder): takes client and checklist helpers`

### Task 4: `ShotChecklist` 元件，接到 PlanScreen

**Files:**
- Create: `src/components/ShotChecklist.tsx`
- Modify: `src/components/PlanScreen.tsx`（鏡頭區塊結束後、`plan-bar` 之前插入 `<ShotChecklist ideaId={idea.id} status={idea.status} shots={shots} />`；如果 idea 不是 approved，而且也沒有任何 take，元件就回 null）
- Modify: `src/styles/drawer-plan.css`（新的 `.shot-checklist*` 樣式）

**Interfaces:**
- Consumes: Task 3 的全部 export；`Shot` 型別（`src/types.ts`）。
- Produces: `export function ShotChecklist(p: { ideaId: string; status: IdeaStatus; shots: Shot[] }): JSX.Element | null`

畫面內容（文案固定）：
- 標題 `Shot checklist`，旁邊顯示 `{done} of {total} shots have a take`。
- 每個鏡頭一列：`{n}.`、`[{time}]`（有值才顯示）、`{shot}`，還有 `Text on screen: "{text}"`（有值才顯示）。
- 每列底下是該鏡頭的 take：
  - 每個 take 有 `<video controls preload="metadata" playsInline src={url}>`，寬度固定 160px，390 寬度下會換行。
  - 顯示檔名和 `formatSize`。
  - 選定的 take 顯示 `Chosen` 標籤，其他的顯示 `Use this take` 按鈕。
  - `Delete` 按下後在原地換成 `Delete this take?` 加上 `Delete` 和 `Keep` 兩個按鈕。不用 `window.confirm`，跟 PlanScreen 的 `confirmEdit` 寫法一樣。
- `canEdit(status)` 為 true 時，每列有 `<label className="btn btn-ghost">Add take<input type="file" hidden accept="video/mp4,video/quicktime,.mp4,.mov" /></label>`：
  - 選檔後先跑 `checkFile`，有錯就顯示在該列，不送出請求。
  - 上傳中按鈕顯示 `Uploading…`，而且不能再按。
  - 伺服器回的錯誤用 `ErrorText` 顯示在該列。
- `canEdit` 為 false 時，所有按鈕都藏起來，標題下方顯示 `Reopened for edits. Takes are kept and can be changed again once the plan is approved.`
- 載入時呼叫 `listTakes`，失敗就顯示 `Couldn't load the takes.`。

- [ ] **Step 1: 實作元件和樣式**。這個元件是 UI，商業邏輯都在 Task 3 的純函式裡，所以這一步不寫元件測試。
- [ ] **Step 2: 檢查**：`npm run build` 和 `npm run lint` 都 exit 0；`bash bin/verify.sh` → GREEN
- [ ] **Step 3: Commit**：`feat(trend-finder): per-shot checklist with real-footage takes on the plan page`

### Task 5: e2e、STATUS 和 PR

**Files:**
- Modify: `docs/STATUS.md`（新增「Phase 2b」段落，格式照 2a 那段）
- Modify: `docs/phase2-scope.md` §7（勾掉「影片檔要放本機磁碟還是雲端」，記為 2026-10-31 採用預設：本機磁碟）

- [ ] **Step 1: 在空的 port 開 demo 後端**：照 2a 的做法（`docs/phase2-2a-plan.md:223-224`）。
  - 先在 trend-finder 目錄跑 `npm run build`。isolated backend 會自己提供 `dist`，所以不需要 Vite。`vite.config.ts` 的 proxy 寫死成 8787，不要改它。
  - 再到 worktree 根目錄跑 `nohup bash bin/isolated-backend.sh 8812 --demo-data --user e2e@example.com:<一次性密碼> > <scratchpad 絕對路徑>/env-8812.log 2>&1 &`，然後開 `http://127.0.0.1:8812`。
  - isolated backend 跑在暫存目錄裡，所以 `MEDIA_DIR` 也在暫存目錄裡，停掉時會跟著刪除。
- [ ] **Step 2: 用 Playwright MCP 在 1440 和 390 兩種寬度跑完下面的流程**。測試影片用 `ffmpeg -f lavfi -i testsrc=d=2 -pix_fmt yuv420p shot.mp4` 產生，放在 scratchpad。另外準備一個改名成 `.mp4` 的文字檔。
  1. 打開一個 approved 的 plan，畫面上看得到 `Shot checklist`，而且顯示 `0 of N`。
  2. 在鏡頭 1 上傳，出現 `Chosen` 標籤和可以播放的 `<video>`，進度變成 `1 of N`。
  3. 在同一個鏡頭再傳一個，按 `Use this take`，`Chosen` 標籤移到新的那個。
  4. 重新整理頁面，畫面上的狀態都還在。
  5. 刪掉已選定的 take，進度變回 0，畫面顯示 `Use this take`。
  6. 上傳改名的文字檔，顯示 `Upload an .mp4 or .mov video file.`。
  7. 按 Edit 重開 plan，take 還在，按鈕都消失，畫面顯示唯讀提示。
  8. 打開審閱連結，看不到 checklist，也沒有任何 `/takes` 請求。
  9. 在 390 寬度下，`document.documentElement.scrollWidth <= 390`。
- [ ] **Step 3: 停掉 8812**：`kill $(lsof -nP -tiTCP:8812 -sTCP:LISTEN)`；同時關掉自己開的 Playwright 分頁。
- [ ] **Step 4: 更新 STATUS.md 和 scope §7，然後 commit**：`docs(remake): record 2b verification`
- [ ] **Step 5: 跑 `bash bin/verify.sh` 確認 GREEN，然後 push，開 PR 到 fork 的 main**，PR 標題用 `feat(trend-finder): Remake 2b — shot checklist and real-footage takes`。
