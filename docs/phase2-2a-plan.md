# Remake 2a 製作看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已核准的 plan 可以標成 Ready to film / Filming / Editing / Posted，Shortlist 看板按階段分欄，並顯示本月已發佈數。

**Architecture:** 後端的 `stage`、`postedAt` 欄位已經存在（`backend/models.py:105-107`），也已經有來回存取的測試（`backend/tests/test_ideas_merge.py` 的 `test_stage_round_trips`）。後端只補一條規則：非 approved 的 plan 存檔時丟掉 stage。前端新增一個純函式模組 `src/lib/stage.ts`，加上一個共用的 `StageSelect` 元件，用在看板卡片和 PlanScreen。

**Tech Stack:** FastAPI + Pydantic、pytest；React 19 + TypeScript；`node --test` 跑 `unit/*.test.mjs`（Node 26 直接載入 `.ts`）。

**Spec:** `docs/phase2-scope.md` §4 第 1 項（2a）。

**分支／worktree：** `feat/remake-stage-board`，worktree 在 `/Users/tommy/orca/workspaces/BuildClub/remake-stage-board`，從 `feat/remake-e2e` @ 80eae54 開出（PR #4 還沒合併）。PR 開到 fork（minchiaHuang/BuildClub），base 是 `feat/remake-e2e`。

除非另外註明，以下路徑都相對於 `pivots/02-content/app/trend-finder/`。

## Global Constraints

- 不加任何依賴，也不發付費呼叫（`docs/phase2-scope.md` §5）。
- 不要動 8805、8787、8801、5195、8798 這幾個 port。e2e 的後端用其他空的 port，例如 8811。
- 不要讀 `.env`。
- 介面文字用英文，跟現有的 UI 一致。
- 完成條件（spec 原文）：
  - 重新整理頁面後階段還在。
  - 審閱連結看不到階段。
  - 不是 approved 的 plan 不能設定階段。
  - `bin/verify.sh` GREEN，e2e 在 1440 和 390 兩種寬度都通過。
- 階段顯示名稱：`approved` → "Ready to film"、`filming` → "Filming"、`editing` → "Editing"、`posted` → "Posted"。
- 沒有 stage 的 approved plan 一律當成 "Ready to film"（`models.py:105` 的註解）。

## Review Focus

1. **已核准的 plan 用 "Edit" 重新送審**（`PlanScreen.tsx:75-78` 的 `reopen`）：stage 和 postedAt 要清掉，否則送審中的 plan 還會帶著 "Posted"。測試放在 Task 1（後端會丟掉）和 Task 4（前端的 patch）。
2. **跨月邊界用的是本地時間**（雪梨 UTC+11）：本地 11/1 00:00 發佈的影片不能算進 10 月。測試放在 Task 2。
3. **2a 之前就存在的 approved plan 沒有 stage**：要出現在 "Ready to film" 欄，不能消失。測試放在 Task 2（`stageOf`）和 Task 3（e2e 的 demo 資料）。
4. **390 寬度下，看板從 3 欄變 6 欄**：不能出現水平捲軸。檢查放在 Task 5：`document.documentElement.scrollWidth <= 390`。
5. **審閱連結的資料裡就算有 stage，也不能送出去**：直接寫進 store 的 waiting plan 帶著 stage，`GET /api/review/{token}` 也不能有這個欄位。測試放在 Task 1。

---

### Task 0: 後端保留前端的 approvedAt、managerNote、shotComments（phase 1 的問題）

使用者 2026-10-31 要求一起處理。前端的 `SavedIdea` 有這三個欄位（`src/types.ts`），但後端的 `SavedIdea` 沒有定義，所以每次 `PUT /api/ideas` 都會把它們丟掉。結果是已核准的 plan 按 Edit 重新送審後，`approvedAt` 在重新整理頁面後就不見了，`PlanScreen.tsx:54` 的 `reopened` 判斷也跟著失效。

**Files:**
- Modify: `backend/models.py`（`SavedIdea`）
- Test: `backend/tests/test_ideas_merge.py`

**Interfaces:**
- Produces: `SavedIdea` 新增三個欄位：
  - `approvedAt: Optional[int]`
  - `managerNote: Optional[str]`，最長 2000 字。
  - `shotComments: Optional[dict[int, str]]`，JSON 的 key 是數字字串。
- `ReviewIdea` 不加這三個欄位，審閱連結的內容維持原樣。

- [ ] **Step 1:** 寫 `test_frontend_fields_round_trip`：用 PUT 存一筆帶 `approvedAt: 4000`、`managerNote: "tighter hook"`、`shotComments: {"0": "closer"}` 的 waiting idea，接著 GET，三個欄位都要原樣回來。
- [ ] **Step 2:** 跑測試，確認失敗（欄位被丟掉）。
- [ ] **Step 3:** 在 `SavedIdea` 加上這三個欄位。
- [ ] **Step 4:** `backend/.venv/bin/python -m pytest -q backend/tests` 全部 PASS。
- [ ] **Step 5: Commit** — `fix(trend-finder): keep approvedAt, managerNote and shotComments on save`

### Task 1: 後端只讓 approved plan 帶 stage

**Files:**
- Modify: `backend/share.py`（`merge_ideas`，`:39-56`）
- Test: `backend/tests/test_ideas_merge.py`、`backend/tests/test_share_link.py`

**Interfaces:**
- Produces: `PUT /api/ideas` 回傳和存檔時，`status != "approved"` 的 idea 沒有 `stage`、`postedAt`；`stage != "posted"` 的 idea 沒有 `postedAt`。

- [ ] **Step 1: 寫失敗的測試**（`test_ideas_merge.py`，沿用檔內的 `IDEA`）

```python
def test_stage_dropped_when_not_approved(client):
    saved = client.put("/api/ideas", json=[{**IDEA, "stage": "filming", "postedAt": 5000}]).json()[0]
    assert "stage" not in saved and "postedAt" not in saved

def test_reopened_plan_loses_stage(client):
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000, "stage": "posted", "postedAt": 5000}])
    saved = client.put("/api/ideas", json=[{**IDEA, "sentAt": 3000, "stage": "posted", "postedAt": 5000}]).json()[0]
    assert saved["status"] == "waiting"
    assert "stage" not in saved and "postedAt" not in saved

def test_posted_at_only_when_posted(client):
    saved = client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000, "stage": "editing", "postedAt": 5000}]).json()[0]
    assert saved["stage"] == "editing" and "postedAt" not in saved
```

`test_share_link.py`：PUT 會把 stage 丟掉，所以這裡繞過 PUT，直接呼叫 `server.save`（`import server`，跟 `conftest.py:15` 一樣）。

```python
def test_review_link_never_shows_stage(client, two_clients):
    server.save("ideas", [SavedIdea(**idea("ia", "a", stage="filming", postedAt=5000))])
    token, _ = link(client, "a")
    item = client.get(f"/api/review/{token}").json()["ideas"][0]["idea"]
    assert "stage" not in item and "postedAt" not in item
```

- [ ] **Step 2: 跑測試，確認新的 merge 測試失敗**

Run: `backend/.venv/bin/python -m pytest -q backend/tests/test_ideas_merge.py backend/tests/test_share_link.py`
Expected: 3 個 merge 測試 FAIL。審閱連結的測試應該已經 PASS（`ReviewIdea` 本來就沒有這個欄位），這是要防止以後退步。

- [ ] **Step 3: 在 `merge_ideas` 的迴圈尾端（`merged.append` 之前）加上規則**

非 approved 就移除 `stage` 和 `postedAt`；`stage != "posted"` 就移除 `postedAt`。docstring 加一句說明。

- [ ] **Step 4: 跑 backend 全部測試**

Run: `backend/.venv/bin/python -m pytest -q backend/tests`
Expected: 全部 PASS，包含原本的 `test_stage_round_trips`。

- [ ] **Step 5: Commit** — `fix(trend-finder): keep production stage only on approved plans`

### Task 2: 前端型別和 `stage.ts`

**Files:**
- Modify: `src/types.ts`（`SavedIdea`，`:134-160`）
- Create: `src/lib/stage.ts`
- Test: `unit/stage.test.mjs`

**Interfaces:**
- Produces（`types.ts`）：`export type Stage = 'approved' | 'filming' | 'editing' | 'posted'`；`SavedIdea` 加上 `stage?: Stage`、`postedAt?: number`，並附一行註解。
- Produces（`stage.ts`，只能用 `import type` 引入型別，node 才載得進來）：
  - `STAGES: Stage[]`，照上面的順序排。
  - `STAGE_LABEL: Record<Stage, string>`，值用 Global Constraints 的那四個。
  - `stageOf(idea: SavedIdea): Stage | null`：非 approved 回傳 null，否則回傳 `idea.stage ?? 'approved'`。
  - `moveTo(idea: SavedIdea, stage: Stage, now?: number): Partial<SavedIdea> | null`：非 approved 回傳 null。移到 posted 時，如果原本就是 posted，保留原來的 `postedAt`，否則設成 `now`（預設 `Date.now()`）。移到其他階段時 `postedAt: undefined`。
  - `postedThisMonth(ideas: SavedIdea[], now?: Date): number`：計算 approved、stage 是 posted、`postedAt` 和 `now` 落在同一個本地年月的數量。

- [ ] **Step 1: 寫失敗的測試**（`unit/stage.test.mjs`，從 `'../src/lib/stage.ts'` 引入）

```js
const base = { id: 'i', videoId: 'v', clientId: 'c', dueDate: '2026-11-02', notes: '' }
test('stageOf: only approved plans have a stage; no stage means Ready to film', () => {
  assert.equal(stageOf({ ...base, status: 'saved' }), null)
  assert.equal(stageOf({ ...base, status: 'waiting', stage: 'filming' }), null)
  assert.equal(stageOf({ ...base, status: 'approved' }), 'approved')
  assert.equal(stageOf({ ...base, status: 'approved', stage: 'editing' }), 'editing')
})
test('moveTo stamps postedAt once and clears it when moved back', () => {
  const a = { ...base, status: 'approved' }
  assert.deepEqual(moveTo(a, 'posted', 100), { stage: 'posted', postedAt: 100 })
  assert.deepEqual(moveTo({ ...a, stage: 'posted', postedAt: 50 }, 'posted', 100), { stage: 'posted', postedAt: 50 })
  assert.deepEqual(moveTo({ ...a, stage: 'posted', postedAt: 50 }, 'editing', 100), { stage: 'editing', postedAt: undefined })
  assert.equal(moveTo({ ...base, status: 'waiting' }, 'filming', 100), null)
})
test('postedThisMonth counts this local month only', () => {
  const now = new Date(2026, 9, 31, 23, 0)
  const p = (t, extra = {}) => ({ ...base, status: 'approved', stage: 'posted', postedAt: t, ...extra })
  const ideas = [
    p(new Date(2026, 9, 1, 0, 0).getTime()),
    p(new Date(2026, 8, 30, 23, 59).getTime()),
    p(new Date(2026, 10, 1, 0, 0).getTime()),
    p(new Date(2026, 9, 5).getTime(), { stage: 'editing' }),
    p(new Date(2026, 9, 5).getTime(), { status: 'waiting' }),
  ]
  assert.equal(postedThisMonth(ideas, now), 1)
})
```

- [ ] **Step 2: 跑測試，確認失敗**

Run: `node --test unit/stage.test.mjs`
Expected: FAIL，找不到模組。

- [ ] **Step 3: 實作 `types.ts` 的改動和 `src/lib/stage.ts`**

- [ ] **Step 4: 跑 unit 測試和型別檢查**

Run: `node --test unit/ && npx tsc -b`
Expected: 全部 PASS，tsc exit 0。

- [ ] **Step 5: Commit** — `feat(trend-finder): add production stage helpers`

### Task 3: 看板按階段分欄

**Files:**
- Create: `src/components/StageSelect.tsx`
- Modify: `src/components/ShortlistBoard.tsx`、`src/styles/approvals.css`（`.board-cols`，`:62-63`）

**Interfaces:**
- Consumes: Task 2 的 `STAGES`、`STAGE_LABEL`、`stageOf`、`moveTo`、`postedThisMonth`。
- Produces: `StageSelect({ idea, name, onChange }: { idea: SavedIdea; name: string; onChange: (patch: Partial<SavedIdea>) => void })`。它是原生的 `<select aria-label={`Stage for ${name}`}>`，四個選項，值用 `stageOf(idea)`。onChange 會送出 `moveTo(...)` 的結果。`stageOf` 是 null 時不渲染任何東西。

- [ ] **Step 1: 實作 `StageSelect`**

- [ ] **Step 2: 改 `ShortlistBoard`**
  - `approved` 的清單只放 `stageOf === 'approved'` 的 plan。"Approved, ready to film" 這一欄保留在上排。
  - 上排下面加一排 "In production"，三欄依序是 Filming、Editing、Posted。用同一個 `column()` helper，tone 分別是 `filming`、`editing`、`posted`。
  - Posted 欄只列 `postedThisMonth` 算到的那些 plan，按 `postedAt` 由新到舊排。更早發佈的不列出來，只在欄位底下用一行小字寫 "N posted earlier"。
  - approved 的卡片在 `board-card-actions` 裡放 `StageSelect`，`onChange` 接上 `update(new Set([idea.id]), () => patch)`。
  - header 的 target 區塊保留原本的 approved 進度環，旁邊加一行 `{postedThisMonth(mine)} posted this month`。
- [ ] **Step 3: CSS**
  - 新增一排 `.board-cols-production`，寬螢幕是 3 欄。沿用現有的 `@media (max-width: 1000px)`，在這個寬度以下改成 1 欄。
  - 三個新的 tone 先沿用現有 `board-col-approved` 的樣式，不另外設計顏色。

- [ ] **Step 4: 驗證**

Run: `npm run build && npm run lint && node --test unit/`
Expected: 三個指令都 exit 0。

- [ ] **Step 5: Commit** — `feat(trend-finder): stage board for approved plans`

### Task 4: PlanScreen 的階段切換，以及送審時清掉 stage

**Files:**
- Modify: `src/components/PlanScreen.tsx`（`reopen`，`:75-78`；"For the editor" 區塊，`:343` 起）

**Interfaces:**
- Consumes: Task 3 的 `StageSelect`。

- [ ] **Step 1:** 在 "For the editor" 區塊的 Due 欄位上方放 `<StageSelect idea={idea} name={format.name} onChange={onChange} />`，外面包一層 `<div className="field">`，加上 field-label "Stage"。
- [ ] **Step 2:** `reopen` 的 patch 加上 `stage: undefined, postedAt: undefined`。
- [ ] **Step 3:** 驗證：`npm run build && npm run lint` 都 exit 0。
- [ ] **Step 4: Commit** — `feat(trend-finder): set production stage from the plan page`

### Task 5: e2e、verify 和文件

e2e 用 Playwright MCP 手動跑，不要把 Playwright 裝成依賴。

- [ ] **Step 1: 起一個 demo 環境**
  - 先在 trend-finder 目錄跑 `npm run build`。isolated backend 會把 `dist` 複製過去，自己提供頁面（`bin/isolated-backend.sh:28, 43`），所以不需要 Vite。`vite.config.ts` 的 proxy 寫死 8787，不要改它。
  - 再到 worktree 根目錄執行 `nohup bash bin/isolated-backend.sh 8811 --demo-data --user e2e@example.com:<一次性密碼> > /tmp/env-8811.log 2>&1 &`，然後開 `http://127.0.0.1:8811`。
- [ ] **Step 2: 在 1440 寬度跑以下流程，每一項都要記錄結果**
  1. 送一個 plan，用審閱連結核准。核准後它出現在 "Approved, ready to film"。
  2. 卡片上切到 Filming，重新整理頁面，它還在 Filming 欄。
  3. 開那個 plan，在 PlanScreen 切到 Posted。回到看板，Posted 欄有它，header 寫 "1 posted this month"。
  4. 對另一個 waiting plan 開審閱連結，頁面和 `/api/review/<token>` 的回應裡都沒有 stage 或 Posted 字樣。
  5. 已核准的 plan 按 Edit → Continue，它回到 Waiting。`GET /api/ideas` 裡這筆沒有 stage。
  6. 2a 之前就核准、沒有 stage 的 plan（demo 資料有的話）出現在 "Ready to film"。
- [ ] **Step 3: 在 390 寬度重跑第 1 到 3 項**，並檢查 `document.documentElement.scrollWidth <= 390`。
- [ ] **Step 4: 收尾**
  - 停掉 8811 和 Vite（`kill $(lsof -nP -tiTCP:8811 -sTCP:LISTEN)`），關掉 Playwright 分頁。
  - 跑 `bash bin/verify.sh`，結果要是 GREEN。
  - 更新 `docs/STATUS.md`。
- [ ] **Step 5: Commit 和 PR**
  - Commit：`docs(remake): record 2a stage board verification`。
  - 開 PR 到 fork，base 是 `feat/remake-e2e`。
