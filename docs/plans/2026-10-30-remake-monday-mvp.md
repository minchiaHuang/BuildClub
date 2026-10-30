# Remake Monday MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before the Mercif test on Monday 2026-11-02, every recommendation card shows how its multiple was calculated and how strong the evidence is, each repeating pattern lists its accounts and hit rate, every number names its source, the product is called Remake, a rejection can carry reason tags, and a separate Monday environment runs on pinned data.

**Architecture:** The backend stores each account baseline's N, date range and fetch time next to the median it already keeps, and returns them on every search video. A new pure front-end module (`src/lib/evidence.ts`) turns those fields into an evidence level, a follow list and copy, and runs under `node --test` with no new dependency. Components only render what that module returns. Instagram baselines come last in their own module (`backend/instagram.py`), so a TikTok-only fallback means leaving those tasks undone.

**Tech Stack:** Python 3 + FastAPI + pydantic + sqlite3 (backend, pytest); React 19 + TypeScript 5.8 + Vite 6 (front end); Node 26 built-in `node:test` with native type stripping for front-end unit tests. No new npm or pip dependencies.

**Spec:** `pivots/02-content/docs/specs/2026-10-30-remake-monday-mvp-design.md`. Sections 5 (W1–W7) and 7 are binding, and so is every 〔我的判斷〕 item. Executors read both documents.

Working directory: `/Users/tommy/orca/workspaces/BuildClub/remake-monday-mvp` (a **new worktree**, see Branch). Below, `TF` = `pivots/02-content/app/trend-finder`.

**Never work in the `full-backend-coverage` worktree.** Since 2026-10-30 Daphne's 8787 runs from it (see `docs/STATUS.md`): switching its branch, editing files or running `npm run build` there changes her live site. Another session also commits to that branch.

**Commits:** in this repo, commits happen only when the user asks (project `CLAUDE.md`). Each task ends with its commit command written out. An implementer runs it only when the user has said to commit for this run. Otherwise the implementer stops at the green verification and reports.

**Branch:** create `feat/remake-monday-mvp` from the current tip of `feat/full-backend-coverage` (`584b9f4` on 2026-10-30 15:00; take whatever the tip is when you start), in its own worktree, and open the PR against `feat/full-backend-coverage`. Why: PR #1 is already waiting for Veralyn's review. Adding about 15 commits of Monday work to it would make that review larger and would tie Monday to it. The tip contains `5a3ba66`, so the spec's "start from branch A" still holds. Line numbers quoted below were read at `669a9cf` and may have shifted slightly.

```bash
cd /Users/tommy/orca/workspaces/BuildClub/full-backend-coverage
git worktree add -b feat/remake-monday-mvp ../remake-monday-mvp feat/full-backend-coverage
mkdir -p ../remake-monday-mvp/docs/plans ../remake-monday-mvp/pivots/02-content/docs/specs
mv docs/plans/2026-10-30-remake-monday-mvp.md ../remake-monday-mvp/docs/plans/
mv pivots/02-content/docs/specs/2026-10-30-remake-monday-mvp-design.md ../remake-monday-mvp/pivots/02-content/docs/specs/
cd ../remake-monday-mvp
# backend venv and node_modules are not shared between worktrees: create them per AGENTS.md / README before verify
bash bin/verify.sh        # expect: verify: GREEN, before any change
```

## Global Constraints

- No new npm or pip dependencies (spec §3). Front-end unit tests use `node --test` (Node v26.12.0 on this machine strips TypeScript types natively). Any `.ts` file that a test imports must import values with explicit `.ts` extensions, or import only types (`import type`).
- Paid calls (Apify, Claude) need the user's approval each time: account, action, estimated cost, hard cap (spec §7.1). No implementer runs a step marked **STOP** on their own.
- Ports: never touch 8787 (Daphne), 5195 (video server), 8797–8799 (isolated test backends), or 8798. The Monday environment uses **8801**, which was free on 2026-10-30 (`lsof` showed no listener).
- Never read `.env`. Check whether a key is set with `grep -cE '^KEY=.+' .env` only.
- Product rule (AGENTS.md): AI explains real videos and never writes scripts. Anti-goals (spec §2): no copy that claims "film this and it will go viral", no AI-written "why it went viral" in place of the numbers, no sample data in live mode, no ranking by saves, shares or watch time.
- Evidence rule (spec W1, binding):
  - **Limited:** the denominator is followers, or there is no N, or the recommended video was posted more than 30 days ago.
  - An unknown posting date does not make a card limited, but the card shows 「發佈日期未知」.
  - **High:** the denominator is the median, and the pattern has at least 3 accounts in this search, of which at least 2 are hits.
  - **Medium:** everything else.
- Hit (spec W2, binding): multiple ≥ 2×. Accounts whose denominator is followers are listed as 「粗估」 and are not counted in the hit rate. There is one row per account, from that account's **newest** video in the group. The scope is this search only. A group with fewer than 3 accounts shows 「單次出現」.
- Platforms: TikTok gets W1 and W3 first. Instagram gets them in Tasks 14–15. YouTube, X and Reddit cards show 「此平台尚無基準」 in place of an evidence label (spec §7.2). W2 counts TikTok only, because live Instagram videos have no shared `formatId` (see the note under Task 4).
- **UI language:** every existing screen is in English, and the 2026-10-29 plan made English copy a constraint. The spec gives copy in Traditional Chinese. The UI ships the English column of the copy table below. Each row quotes the spec's Chinese exactly, so switching languages means swapping one column. **Confirm this with the user before Task 3.**
- Leave unchanged (W4 〔我的判斷〕): the `trend-finder` folder name, `FastAPI(title="Trend Finder API")`, the Basic realm `"Trend Finder"`, the READMEs, and code comments.
- Every task ends with `bash bin/verify.sh` printing `verify: GREEN`. When the front end changed, the task also needs `cd $TF && npx tsc -b && npm run lint` clean.
- Commit messages: `<type>(trend-finder): ...`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Copy table (the single source for new UI strings)

| Key | Spec (verbatim) | UI string |
|---|---|---|
| level.high / medium / limited | 高 / 中 / 有限 | `Evidence: high` / `Evidence: medium` / `Evidence: limited` |
| noDetails | 基準明細未記錄 | `Baseline details not recorded` |
| noPlatform | 此平台尚無基準明細 | `No baseline details for this platform yet` (YouTube, X and Reddit do have a median; only N and dates are missing) |
| rough | 粗估（觀看 ÷ 粉絲） | `Rough estimate (views ÷ followers)` |
| roughShort | 粗估 | `Rough` |
| dateUnknown | 發佈日期未知 | `Posting date unknown` (already in BreakdownPanel) |
| plain (median) | 22.9 倍於帳號中位數，基準 6 支；4 個帳號在做這個格式，3 個也超出基準 | `22.9× this account's median (baseline: 6 videos); 4 accounts use this pattern, 3 also hit 2× or more` |
| plain (followers) | — | `Rough: 77× views ÷ followers` |
| formula | 觀看 ÷ 中位數（基準 N 支，日期區間）＝ 倍數 | `145k views ÷ 6.3k median (6 videos, 2026-10-02 to 2026-10-24) = 22.9×` |
| fetched | 中位數的抓取時間，和這次搜尋的抓取時間 | `Median fetched 2026-10-29 09:12 · this search fetched 2026-10-31 14:02` |
| source | 公開頁面，抓取時間 2026-10-31 14:02 | `Public page, fetched 2026-10-31 14:02` |
| limits (3 fixed lines) | 拿不到留存率；這個平台拿不到的其他指標（依平台列出）/ Instagram 的觀看數包含付費流量 / 這些數字不代表照拍一定會紅 | `We can't see watch time or retention` + per platform, only the metrics that are actually null for that platform (e.g. Instagram: `or saves`); never claim TikTok shares/saves are missing, they are stored / `Instagram views include paid (boosted) views` (Instagram cards only) / `These numbers don't mean a copy will go viral` |
| hitRate | 命中率 3 / 5 … 這次搜尋結果中 | `Hit rate 3 / 5 · within this search's results` |
| tiktokOnly | 目前格式階段只看 TikTok | `Counts TikTok accounts only for now` |
| oneOff | 單次出現 | `One-off` |
| cached | 快取 · N 天前抓取 | `Cached · fetched N days ago` (`Cached · fetched today` when N = 0) |
| methodTitle | 方法說明 | `How we calculate this` |
| methodSample | 每個帳號只取最新 6 支影片當基準，樣本小 | `Each account's baseline is only its latest 6 videos: a small sample.` |
| tags | 不符合品牌調性 / 格式不適合這個客戶 / 太難拍或成本太高 / 最近做過類似的 / 其他 | `Doesn't fit the brand's tone` / `Format doesn't suit this client` / `Too hard or costly to film` / `Did something similar recently` / `Other` |
| brand | Remake | `Remake` (mailto subject `Remake access`) |

## Review Focus

1. **Old data without the new fields.** The three pinned files in `backend/pinned/` and every `medians` row written before Task 1 have no N and no date range, and their videos have no `denominator`. Cards built from them must say 「基準明細未記錄」, be rated limited, and never crash or show `NaN`. Tests: Task 1 `test_old_median_rows_load_without_details`, and Task 2 `limited when the median has no N`.
2. **The score poll replaces only `medianViews`.** `App.tsx` `fillScores` copies only `medianViews` from the poll today. A card would then keep `denominator: 'followers'` after its median arrived, and stay "rough" forever. Test: Task 2 `fillBaseline copies medianViews and every baseline field`. Task 3 wires `fillBaseline` into the poll.
3. **Annie's tags lost on Daphne's next save.** Daphne's tab sends the whole ideas list back with `PUT /api/ideas`, and `share.merge_ideas` keeps only the `DECISION_FIELDS`. If `rejectTags` is missing from that list, a due-date edit wipes Annie's tags. Test: Task 8 `test_put_ideas_keeps_newer_reject_tags`.
4. **One search mixes cached and fresh platforms.** With TikTok pinned and Reddit live, a single "cached" banner would mislabel half the results. The cached label belongs to each video's own search (`fromCache`, `fetchedAt`). Test: Task 6 `cachedLabel` cases, plus the Task 6 check that each platform section carries its own label.
5. **One account with several videos in a pattern.** Taking the best video would inflate the hit rate. The spec says to take the newest. Test: Task 2 `cohort: one row per account, from its newest video, not its best`.

---

## File Structure

Backend (`TF/backend/`)
- `models.py`: `SearchVideo` gets `medianN`, `baselineFrom`, `baselineTo`, `medianFetchedAt` and `denominator`. `SavedIdea`, `ReviewIdea` and `DecideRequest` get `rejectTags` (`DecideRequest` calls it `tags`).
- `server.py`: a `medians` table migration, account baselines in place of `median_views`, baseline-aware `saved_medians` / `save_medians` / `apply_medians`, the `refetch` CLI, and the Instagram baseline fill (Task 14).
- `share.py`: `rejectTags` in `DECISION_FIELDS` and in `decide_idea`.
- `instagram.py` (new, Task 14): Instagram account baselines, in the same shape as `x.py`.
- Tests: extend `tests/test_search.py` and `tests/test_share_link.py`. Add `tests/test_refetch.py` and `tests/test_instagram_baseline.py`, plus `tests/fixtures/instagram_reels_synthetic.json`.

Front end (`TF/src/`)
- `lib/evidence.ts` (new): pure logic and copy for W1–W3 and W6. It is the only file the unit tests import.
- `types.ts`: `Baseline`, plus `Video.baseline`, `Video.fetchedAt`, `Video.fromCache` and `SavedIdea.rejectTags`.
- `lib/live.ts`: maps the new fields in `toVideo`.
- `lib/share.ts`: `REJECT_TAGS`, and a tags argument on `sendDecision`.
- Components: `VideoTile`, `BestVideo`, `BreakdownPanel`, `PatternStrip`, `ResultsScreen`, `ReviewScreen`, `ReviewPage`, `PlanScreen`, `Sidebar`, `LoginScreen`, the three landing components, `themes/UnifyHero`. New: `MethodPage.tsx`. Routing: `main.tsx`.
- `App.tsx`: computes the cohorts, passes them down, and the `fillScores` and `decide` changes.
- `TF/unit/evidence.test.mjs` (new): `node --test` unit tests.
- `TF/index.html`: the page title.

Repo
- `bin/verify.sh`: one new `run_step` for the front-end unit tests.
- `pivots/02-content/docs/specs/2026-11-02-monday-observation-checklist.md` (new, W7).
- `docs/STATUS.md`, `docs/decision-log.md`: appended lines only.

---

## Tasks

Run the tasks in order, one at a time. Tasks 3–8 all touch `App.tsx` or `ResultsScreen.tsx`. **Task 11 is the TikTok gate:** no Instagram work starts until it is green.

### Task 1: Store and return baseline details (W1 backend, TikTok)

**Files:**
- Modify: `TF/backend/models.py` (`SearchVideo`), and `TF/backend/server.py`: `trim` (~L180), `median_views` (~L272) → `account_baselines`, `saved_medians`, `save_medians`, `apply_medians`, `fetch_medians`, `db()` (~L575)
- Test: `TF/backend/tests/test_search.py`

**Interfaces:**
- Produces, as `SearchVideo` JSON fields (all optional, default null):
  - `medianN: int`
  - `baselineFrom: str` and `baselineTo: str`, as `YYYY-MM-DD`
  - `medianFetchedAt: int`, in ms
  - `denominator: Literal["median", "followers"]`
- Produces:
  - `account_baselines(items: list) -> dict[str, dict]`, with keys `median`, `n`, `from`, `to`. Only authors with at least `MIN_VIDEOS` videos are included.
  - `saved_medians(authors) -> dict[str, Optional[dict]]`. A non-null value has `median`, `n`, `from`, `to`, `fetchedAt` (ms). `None` means the account had too few videos.
  - `apply_medians(videos, baselines) -> None` sets `medianViews`, `outlier` and the five new fields.
- `created_iso(item) -> Optional[str]` is lifted out of `trim` so that baselines and `trim` read dates the same way.

- [ ] **Step 1: Write the failing tests** in `tests/test_search.py`. Give the `item()` helper an optional `created` (epoch seconds) argument; it defaults to the current value.
  - `test_baseline_records_count_and_date_range`: 6 items for author `a`, with plays 1..6 and dates from 2026-10-01 to 2026-10-06. Assert that `server.account_baselines(items)["a"] == {"median": 3.5, "n": 6, "from": "2026-10-01", "to": "2026-10-06"}`.
  - Rewrite `test_median_needs_five_videos`: 4 items give `{}`. 5 items give `["a"]["median"] == 2` and `["a"]["n"] == 5`.
  - `test_live_search_returns_baseline_details`: use the `median_search` fake. The first video has `medianN == 5`, both baseline dates set, `medianFetchedAt` an int within 5 s of now·1000, and `denominator == "median"`.
  - `test_unscored_account_falls_back_to_followers`: when the medians run returns nothing for an author, its video has `denominator == "followers"` and `medianN is None`. When it also has `fans=0`, `denominator is None`.
  - `test_old_median_rows_load_without_details`: before the first `server.db()` call, create `data.db` with the **old** schema (`CREATE TABLE medians (author TEXT PRIMARY KEY, median REAL, fetched_at REAL NOT NULL)`), with one row `("a", 100, now)`. A search whose only author is `a` makes no medians call (the offline fixture would fail). Its video has `medianViews == 100`, `medianN is None`, `baselineFrom is None`, `medianFetchedAt == int(now*1000)`, and `denominator == "median"`.
  - `test_saved_pins_still_match_the_contract` must stay green without edits.
- [ ] **Step 2: Run them and see them fail.**
  Run: `cd $TF && backend/.venv/bin/python -m pytest -q backend/tests/test_search.py`
  Expected: FAIL. `account_baselines` does not exist, and there are KeyErrors on `medianN`.
- [ ] **Step 3: Implement the changes in `server.py`.**
  - `db()` calls `migrate_medians(conn)`, which adds the nullable columns `n INTEGER`, `base_from TEXT` and `base_to TEXT` when `PRAGMA table_info(medians)` lacks them. It never drops or rewrites a row.
  - `save_medians` writes all of `n`, `base_from` and `base_to`. A `None` baseline still writes a null-median row, as today.
  - `account_baselines` replaces `median_views`. Delete `median_views`, because this change orphans it.
  - The `denominator` rule: `"median"` when there is a median, else `"followers"` when `followers > 0`, else `None`.
  - Add the five optional fields to `SearchVideo`, with a one-line comment each.
- [ ] **Step 4: Run them and see them pass.**
  Run: `cd $TF && backend/.venv/bin/python -m pytest -q backend/tests/test_search.py`
  Expected: all pass.
- [ ] **Step 5: Verify.** Run `bash bin/verify.sh`. Expected: `verify: GREEN`.
- [ ] **Step 6: Commit.**
  ```bash
  git add $TF/backend/models.py $TF/backend/server.py $TF/backend/tests/test_search.py
  git commit -m "feat(trend-finder): keep each account baseline's size, dates and fetch time"
  ```

### Task 2: Evidence module and front-end unit tests (W1, W2, W3 and W6 logic)

**Files:**
- Create: `TF/src/lib/evidence.ts`, `TF/unit/evidence.test.mjs`
- Modify: `TF/src/types.ts`, and `bin/verify.sh` (one new `run_step` line after the backend tests)

**Interfaces:**
- Consumes the Task 1 field names.
- Produces in `types.ts`:
  - `type Denominator = 'median' | 'followers'`
  - `interface Baseline { medianN: number | null; baselineFrom: string | null; baselineTo: string | null; medianFetchedAt: number | null; denominator: Denominator | null }`
  - `Video` gets the optional fields `baseline?: Baseline`, `fetchedAt?: number` (the search's fetch time, ms) and `fromCache?: boolean`.
- Produces in `evidence.ts`. Values are imported only from `'./metrics.ts'`, with the extension; everything else is `import type`.
  - Constants:
    - `HIT_MULTIPLE = 2`
    - `LIMITED_DAYS = 30`
    - `BASELINE_PLATFORMS: Platform[] = ['tiktok']` (Task 15 adds `'instagram'`)
    - `COHORT_PLATFORMS: Platform[] = ['tiktok']`
  - `type Evidence = 'high' | 'medium' | 'limited'`
  - `interface CohortRow { videoId: string; handle: string; followers: number; multiple: number | null; rough: boolean; hit: boolean | null }`
  - `interface Cohort { rows: CohortRow[]; accounts: number; hits: number; counted: number }`
  - `denominatorOf(v: Video): Denominator | null`. It uses `v.baseline?.denominator` when present. Otherwise it derives the denominator the same way the backend does, which covers old cache files.
  - `multipleOf(v: Video): number | null`
  - `cohortOf(group: Video[]): Cohort`
  - `cohortsByPattern(videos: Video[], patterns: Pattern[]): Map<string, Cohort>`, keyed by `Pattern.label`. It uses only `COHORT_PLATFORMS` videos.
  - `cohortsByVideo(videos: Video[], patterns: Pattern[]): Map<string, Cohort>`. A video maps to the first pattern (the one with the most accounts, in `findPatterns` order) that contains it.
  - `evidenceOf(v: Video, cohort?: Cohort): Evidence | null`. It returns `null` when the platform is not in `BASELINE_PLATFORMS` or there is no denominator.
  - `plainLine(v: Video, cohort?: Cohort): string`
  - `formulaLine(v: Video): string`
  - `fetchedLine(v: Video): string`
  - `sourceLine(v: Video): string`
  - `followerBand(n: number): string`
  - `stamp(ms: number): string`, formatted as `YYYY-MM-DD HH:mm` in the viewer's local time
  - `cachedLabel(fetchedAt: number, now: number): string`
  - `fillBaseline(v: Video, fresh: Video): Video`
  - `EVIDENCE_TEXT: Record<Evidence, string>`
  - `COPY`, the copy-table strings that are not built by a function
- Follower bands: `<10k`, `10k–100k`, `100k–1M`, `1M+`. An account with 0 followers or an unknown count shows `–`.

- [ ] **Step 1: Write the failing tests** in `unit/evidence.test.mjs`, with `import { test } from 'node:test'`, `import assert from 'node:assert/strict'` and `import * as e from '../src/lib/evidence.ts'`. Add a `vid({...})` factory that fills a full `Video`. Test names and assertions:
  - `limited when the denominator is followers`: `evidenceOf(vid({medianViews: null, followers: 1000}))` returns `'limited'`.
  - `limited when the median has no N`: `baseline.medianN` is `null` and the denominator is median, which gives `'limited'`. A video with no `baseline` at all but with a `medianViews` (old cache) also gives `'limited'`.
  - `limited when posted more than 30 days ago; an unknown date is not`: `daysAgo: 31` gives `'limited'`. `daysAgo: 30` and a 3-account / 2-hit cohort give `'high'`. `daysAgo: UNKNOWN_DAYS` gives `'medium'` without a cohort, and `sourceLine` or `plainLine` contains `Posting date unknown`.
  - `high needs a median, 3 accounts and 2 hits`: a cohort with 3 accounts and 2 hits gives `'high'`.
  - `medium with 2 hits among only 2 accounts`
  - `no label for YouTube, X, Reddit and (for now) Instagram`: each gives `null`.
  - `cohort: one row per account, from its newest video, not its best`: `@a` has a 10× video at `daysAgo` 9 and a 1.5× video at `daysAgo` 2. The row for `@a` has `multiple === 1.5` and `hit === false`.
  - `cohort: 2× is a hit, 1.9× is not; rough rows are listed but not counted`: three median accounts at 2, 1.9 and 5, plus one followers account at 50. Expect `rows.length === 4`, `accounts === 4`, `counted === 3`, `hits === 2`, and the followers row has `rough === true` and `hit === null`.
  - `cohorts use TikTok videos only`: a pattern holding 2 TikTok accounts and 2 Instagram accounts gives `accounts === 2`.
  - `plainLine matches the copy table`: a median of 6.3k, views of 144,270 (22.9×), `medianN` 6, and a cohort with 4 accounts and 3 hits. Assert ``=== `22.9× this account's median (baseline: 6 videos); 4 accounts use this pattern, 3 also hit 2× or more` ``. Without a cohort the string ends after `)`. The followers version is `Rough: 77× views ÷ followers`.
  - `formulaLine shows N and the date range, or says the details are missing`. The missing case contains `Baseline details not recorded`.
  - `cachedLabel: today and N days`: `(now, now)` gives `Cached · fetched today`. `(now - 3*86400000, now)` gives `Cached · fetched 3 days ago`. `fetchedAt <= 0` gives `Cached`.
  - `fillBaseline copies medianViews and every baseline field`: start from `fresh.baseline.denominator === 'median'` and `old.baseline.denominator === 'followers'`. The result has `denominator === 'median'` and the fresh `medianViews`, and its `id`, `views` and `fetchedAt` are unchanged.
  - `followerBand edges`: 9,999 gives `<10k`, 10,000 gives `10k–100k`, 1,000,000 gives `1M+`, and 0 gives `–`.
- [ ] **Step 2: Run them and see them fail.**
  Run: `cd $TF && node --test unit/`
  Expected: FAIL, `Cannot find module …/src/lib/evidence.ts`.
- [ ] **Step 3: Implement `evidence.ts` and the `types.ts` additions.** Implement `evidenceOf` in this order: the `null` cases, then limited, then high, then medium. Then add to `bin/verify.sh`:
  `run_step "trend-finder frontend unit tests" node --test "$TF/unit/"`
- [ ] **Step 4: Run them and see them pass.**
  Run: `cd $TF && node --test unit/ && npx tsc -b && npm run lint`
  Expected: all tests pass, and there are no tsc or lint errors.
- [ ] **Step 5: Verify.** Run `bash bin/verify.sh`. Expected: a `PASS  trend-finder frontend unit tests` line and `verify: GREEN`. Prove that the new step can go red: break one assertion locally and check that verify prints `RED`, then revert it.
- [ ] **Step 6: Commit.**
  ```bash
  git add $TF/src/lib/evidence.ts $TF/src/types.ts $TF/unit/evidence.test.mjs bin/verify.sh
  git commit -m "feat(trend-finder): evidence level, follow list and source copy, with unit tests"
  ```

### Task 3: Show the calculation on cards and in the drawer (W1 and W3 front end)

**Files:**
- Modify: `TF/src/lib/live.ts` (`LiveItem` and `toVideo`, ~L6–L95), `TF/src/App.tsx` (`fillScores` ~L540, cohort memo next to `patterns` ~L670, the props to the results and the drawer ~L1105), `TF/src/components/VideoTile.tsx`, `TF/src/components/BestVideo.tsx`, `TF/src/components/BreakdownPanel.tsx`, `TF/src/components/ResultsScreen.tsx` (pass-through), and the matching `src/styles/*.css` (existing tokens only)
- Test: `TF/e2e/full-flow.mjs` step `6 open a broken-down video` (new assertions)

**Interfaces:**
- Consumes everything in Task 2's `evidence.ts`.
- Produces:
  - `ResultsScreen` and `BreakdownPanel` props: `cohorts: Map<string, Cohort>` (by video id) for the results, and `cohort?: Cohort` for the drawer.
  - `App.tsx`: `const cohorts = useMemo(() => cohortsByVideo(liveResults, patterns), …)`, plus `patternCohorts = cohortsByPattern(...)` for Task 4.

- [ ] **Step 1:** In `live.ts`, `toVideo(item, query, platform, search)` takes `{ fetchedAt, cached }` from the search body and sets `fetchedAt`, `fromCache` and `baseline`. `baseline` is filled only when at least one of the five fields is present in the item; otherwise it is left `undefined`, so `denominatorOf` falls back. In `App.tsx` `fillScores`, replace the `medianViews`-only copy with `fillBaseline(v, freshById.get(v.id))`.
- [ ] **Step 2:** Changes to `VideoTile` and `BestVideo`:
  - Add an evidence chip with `EVIDENCE_TEXT[evidenceOf(v, cohort)]` and one line of `plainLine(v, cohort)`.
  - When `evidenceOf` returns `null` and the platform is not in `BASELINE_PLATFORMS`, show `COPY.noPlatform` in place of the chip. The existing score display stays as it is.
  - Put the chip and the line into the tile's `aria-label`.
  - Style the chip with the existing `.tier`/`stage-pill` classes, with no new colour tokens. It must not wrap past two lines at 390 px wide.
- [ ] **Step 3:** In `BreakdownPanel`, under the Score card, add a "How this multiple is calculated" block:
  - `formulaLine(v)`, then `fetchedLine(v)`.
  - `COPY.rough` when the denominator is followers.
  - `COPY.noDetails` when N is null.
  - The three fixed `COPY.limits` lines, as a list.
  - A link to `/method` (`How we calculate this ↗`; the page comes in Task 5).
  - Each stat card gets `sourceLine(v)` as a second small note line. Replace the "Format used by" card's count with `cohort?.accounts ?? 1`, so it counts the same accounts as the follow list.
- [ ] **Step 4:** In `e2e/full-flow.mjs` step 6, the pinned `tofu` search is old data. Add `check(/Baseline details not recorded/.test(t))`, `check(/Evidence: limited/.test(t))`, and one check for each of the three limit lines.
- [ ] **Step 5: Verify.** Run `cd $TF && npx tsc -b && npm run lint && node --test unit/ && npm run build`, then `bash bin/verify.sh`. Expected: everything clean and `verify: GREEN`. Then do a free UI run. In one terminal: `bash bin/isolated-backend.sh 8797 --demo-data --user test@example.com:pw-for-e2e`. In another: `OUT=<scratchpad>/t3 node $TF/e2e/full-flow.mjs http://127.0.0.1:8797`, then `WIDTH=390 …` against the same backend. Expected: every step PASS. Look at the step-6 screenshot at both widths.
- [ ] **Step 6: Commit.**
  ```bash
  git add $TF/src $TF/e2e/full-flow.mjs
  git commit -m "feat(trend-finder): show how each multiple is calculated and where the numbers come from"
  ```

### Task 4: Follow list and hit rate per pattern (W2)

**Files:**
- Modify: `TF/src/components/PatternStrip.tsx`, `TF/src/components/ResultsScreen.tsx` (prop pass-through), `TF/src/App.tsx` (pass `patternCohorts`)

**Interfaces:**
- Consumes `patternCohorts: Map<string, Cohort>`, `followerBand`, `HIT_MULTIPLE` and `COPY` from Task 2.
- Produces a new `PatternStrip` prop, `cohorts: Map<string, Cohort>`.

Why patterns: in live mode every video is its own "format" (`formatId: \`live-${item.id}\`` in `live.ts:82`), and `trends` is `[]` (`App.tsx` ~L690). So the spec's "format stage" exists only in sample mode. The live equivalent is `findPatterns`, the sounds and hashtags that several accounts used, which `PatternStrip` already shows as "formats that repeat". Sample mode is not changed.

- [ ] **Step 1:** Each pattern card gets a separate toggle button, "Accounts (n)", with `aria-expanded`. Clicking the card itself keeps its current filter behaviour.
- [ ] **Step 2:** The expanded list has one row per `CohortRow`: handle, `followerBand(followers)`, `times(multiple)` (or `–`), and `Hit` / `Not a hit` / `COPY.roughShort`.
- [ ] **Step 3:** Under the list: ``Hit rate ${hits} / ${counted} · within this search's results``, then `COPY.tiktokOnly`. When `accounts < 3`, show `COPY.oneOff` in place of the hit rate. A pattern with no TikTok accounts shows only `COPY.tiktokOnly`.
- [ ] **Step 4: Verify.** Run `cd $TF && npx tsc -b && npm run lint && npm run build`, then `bash bin/verify.sh` (GREEN). Repeat the isolated backend run from Task 3 (all PASS). Then use Playwright on 8797 (pinned tofu): expand the first pattern, and check that its row count equals the pattern's account count (TikTok only) and that the hit-rate line is present. Screenshots at 1440 and 390.
- [ ] **Step 5: Commit.**
  ```bash
  git add $TF/src
  git commit -m "feat(trend-finder): list each pattern's accounts with their multiple and hit rate"
  ```

### Task 5: Method page (W3)

**Files:**
- Create: `TF/src/components/MethodPage.tsx`
- Modify: `TF/src/main.tsx` (the `/method` path), `TF/src/components/Sidebar.tsx` (a footer link)

**Interfaces:**
- Consumes `HIT_MULTIPLE`, `LIMITED_DAYS` and `COPY` from Task 2. It also consumes the server constants, written into the page as literals with a comment naming their source: `VIDEOS_PER_AUTHOR=6`, `MIN_VIDEOS=5`, `MEDIAN_DAYS=30`, `AUTHORS_PER_SEARCH=15`, `CACHE_HOURS=24`.
- Produces the route `/method`. It is a static page: non-`/api` paths need no session (`server.needs_session`), so it loads whether or not the viewer is signed in.

- [ ] **Step 1:** Write `MethodPage`, one page in the review-page shell style. Sections:
  - **The formula.** Views ÷ the account's median of its latest 6 videos. With fewer than 5 videos, views ÷ followers, marked rough.
  - **The baseline.** The latest 6 videos, reused for 30 days, at most 15 accounts per search, and `COPY.methodSample` verbatim.
  - **Time windows.** The search is cached for 24 hours, and pinned searches never expire.
  - **Thresholds.** A hit is 2×. The three evidence levels exactly as in Global Constraints. The trend stages from `metrics.ts:formatTrend`: 3 / 5 accounts and 14 days.
  - **Known biases.** The three `COPY.limits` lines; only accounts that this search found; TikTok-only patterns; Instagram views include paid views; the 15-account cap leaves some videos rough.
- [ ] **Step 2:** In `main.tsx`, `window.location.pathname === '/method'` renders `<MethodPage />`, the same way the review token is handled. Add a sidebar footer link `How we calculate this`.
- [ ] **Step 3: Verify.** Run `cd $TF && npx tsc -b && npm run lint && npm run build`, then `bash bin/verify.sh` (GREEN). Use Playwright on 8797: `/method` loads without signing in, and the link in the drawer opens it.
- [ ] **Step 4: Commit.**
  ```bash
  git add $TF/src
  git commit -m "feat(trend-finder): one-page method note"
  ```

### Task 6: Label cached results (W6 UI)

**Files:**
- Modify: `TF/src/components/ResultsScreen.tsx` (results header, and the platform sections, if any), `TF/src/components/VideoTile.tsx` (`tile-meta`)

**Interfaces:**
- Consumes `Video.fromCache`, `Video.fetchedAt` and `cachedLabel` from Tasks 2 and 3.

- [ ] **Step 1:** In the results header, show one chip per platform present in the results whose videos have `fromCache`: ``${platformName[p]} · ${cachedLabel(fetchedAt, Date.now())}``. Fresh platforms get no chip. Add the same label at the end of `tile-meta` for cached videos.
- [ ] **Step 2:** In `unit/evidence.test.mjs`, the `cachedLabel` cases from Task 2 already cover the copy. Add `cachedLabel rounds down: 47 hours is 1 day`.
- [ ] **Step 3: Verify.** Run `node --test unit/`, `npx tsc -b && npm run lint && npm run build`, and `bash bin/verify.sh` (GREEN). Use Playwright on 8797: search `tofu` on TikTok and Reddit. Pinned TikTok shows the chip. Reddit fails the zero budget, so it shows the existing failure line and no chip.
- [ ] **Step 4: Commit.**
  ```bash
  git add $TF/src $TF/unit/evidence.test.mjs
  git commit -m "feat(trend-finder): mark cached and pinned results with their age"
  ```

### Task 7: Rename to Remake (W4)

**Files (current line numbers, at `669a9cf`):**
- `TF/index.html:6`
- `TF/src/components/Sidebar.tsx:180`
- `TF/src/components/LoginScreen.tsx:33` (mailto subject) and `:84`
- `TF/src/components/landing/LandingMidnight.tsx:52`
- `TF/src/components/landing/LandingAltitude.tsx:61`
- `TF/src/components/landing/LandingUnify.tsx:10`, `:97`, `:99`
- `TF/src/components/themes/UnifyHero.tsx:25`, `:30`

- [ ] **Step 1:** Replace the visible text `Trend Finder` with `Remake` in exactly those places, and the mailto subject with `Remake access`. Leave alone the comment in `TypingSearch.tsx:6`, the backend titles and realm, the folder, and the READMEs.
- [ ] **Step 2: Verify.**
  - `cd $TF && grep -rn "Trend Finder" index.html src | grep -v "^src/data"` should print only the `TypingSearch.tsx:6` comment.
  - `npx tsc -b && npm run lint && npm run build` and `bash bin/verify.sh` should both pass (GREEN).
  - Run the Task 3 isolated e2e again. Step 1's regex (`scanned … videos`) must still PASS.
- [ ] **Step 3: Commit.**
  ```bash
  git add $TF/index.html $TF/src
  git commit -m "feat(trend-finder): rename the product to Remake on every visible screen"
  ```

### Task 8: Reject reason tags (W5)

**Files:**
- Modify:
  - Backend: `TF/backend/models.py` (`SavedIdea`, `ReviewIdea`, `DecideRequest`), `TF/backend/share.py` (`DECISION_FIELDS`, `decide_idea`, `decide`)
  - Front end: `TF/src/types.ts` (`SavedIdea.rejectTags?: string[]`), `TF/src/lib/share.ts`, `TF/src/components/ReviewScreen.tsx` (the `p.passing` block ~L339, and `onDecide`), `TF/src/components/ReviewPage.tsx`, `TF/src/App.tsx` (`decide` ~L806), `TF/src/components/PlanScreen.tsx` (resend ~L70, feedback ~L361)
- Test: `TF/backend/tests/test_share_link.py`

**Interfaces:**
- Backend:
  - `Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]`
  - `rejectTags: Optional[list[Tag]] = Field(default=None, max_length=5)` on `SavedIdea` and `ReviewIdea`
  - `DecideRequest.tags: Optional[list[Tag]] = Field(default=None, max_length=5)`
  - `share.decide_idea(ideas, client_id, idea_id, approved, reason, now_ms, tags=None)` drops `rejectReason` **and** `rejectTags` before it sets new ones. Tags are stored only on a rejection, and only when non-empty.
  - The backend does not check tags against the preset list (〔我的判斷〕).
- Front end:
  - `REJECT_TAGS: readonly string[]` in `share.ts`, with the five tags in copy-table order
  - `sendDecision(token, ideaId, approved, reason?, tags?)`
  - `onDecide(ideaId: string, approved: boolean, reason?: string, tags?: string[])`

- [ ] **Step 1: Write the failing tests** in `test_share_link.py`:
  - `test_reject_with_tags_round_trips`: decide `rejected` with `tags=["Other", "Doesn't fit the brand's tone"]` and `reason="x"`. `GET /api/ideas` then has both tags, in order, and `rejectReason == "x"`.
  - `test_unknown_tag_is_accepted`: `tags=["Too long a shoot"]` returns 200.
  - `test_reject_tag_limits`: a 41-character tag returns 422, 6 tags return 422, and the idea is still `waiting`.
  - `test_old_idea_without_tags_still_loads`: a stored idea with no `rejectTags` loads through GET `/api/ideas` and `/api/review/{token}`, and the key is absent.
  - `test_put_ideas_keeps_newer_reject_tags`: Annie rejects with tags, then Daphne PUTs her older copy (with `sentAt` before `decidedAt`) with a changed `dueDate`. The stored idea keeps `rejectTags`, takes the new `dueDate`, and stays `status == "rejected"`.
  - `test_approve_after_resend_drops_old_tags`: reject with tags, Daphne resends (status `waiting`, tags cleared), Annie approves. The approved idea has no `rejectTags`.
- [ ] **Step 2: Run them and see them fail.**
  Run: `cd $TF && backend/.venv/bin/python -m pytest -q backend/tests/test_share_link.py`
  Expected: FAIL, because the tags are dropped by pydantic.
- [ ] **Step 3: Implement the backend** as in Interfaces, and add `"rejectTags"` to `DECISION_FIELDS`.
- [ ] **Step 4: Run them and see them pass.** Use the same command. Expected: all pass.
- [ ] **Step 5: Implement the front end.**
  - Tag chips go above the existing textarea in `ReviewScreen`: `aria-pressed` toggle buttons, any number of them up to 5, with the textarea kept as it is.
  - `decide` passes the tags through, both on `ReviewPage` (share link) and in the in-app `App.decide`, which sets `rejectTags`.
  - PlanScreen's feedback block shows the tags as chips above the quote. When there are tags but no text, it shows only the chips, and never "No reason given." next to them.
  - The resend at PlanScreen ~L70 also clears `rejectTags`.
- [ ] **Step 6: Verify.** Run `npx tsc -b && npm run lint && npm run build` and `bash bin/verify.sh` (GREEN). Use Playwright on 8797: send one plan, open the Annie link, choose "Not this one", tap two tags, type a line, and press Send back. Daphne's plan page then shows both tags and the text. Reload, and they are still there.
- [ ] **Step 7: Commit.**
  ```bash
  git add $TF/backend/models.py $TF/backend/share.py $TF/backend/tests/test_share_link.py $TF/src
  git commit -m "feat(trend-finder): tap reason tags when sending a plan back"
  ```

### Task 9: `refetch` CLI for pinned Monday searches (W6 prep)

**Files:**
- Modify: `TF/backend/server.py` (`refetch`, and the `__main__` usage line)
- Create: `TF/backend/tests/test_refetch.py`

**Interfaces:**
- `refetch(query: str, platform: str = "tiktok") -> None`:
  - It runs `search(query, fresh="1", platform=platform)` with `in_background` swapped for an inline call, so the medians finish before it returns.
  - It exits non-zero with the error text when the search returns a `JSONResponse` (an over-budget 429 or a 502).
  - Otherwise it calls `pin(query, platform)` and prints `scored X of Y videos; baseline details on Z`.
  - It allows only `tiktok` and `instagram`.
- CLI: `backend/server.py refetch "<search>" [tiktok|instagram]`. Why a CLI: it runs in-process, reads `.env` itself, keeps every spend cap, and needs no HTTP session or Basic password. So nobody types a credential into a command.

- [ ] **Step 1: Write the failing tests:**
  - `test_refetch_fills_baselines_and_pins`: with the `median_search` fake from `test_search.py` (move it to a shared helper in `conftest.py` if you import it), `server.refetch("tofu")` writes `PINNED_DIR/cache_name("tofu")`. Its first video has `medianN == 5` and `mediansPending is False`.
  - `test_refetch_over_budget_exits_without_pin`: with `DAILY_APIFY_USD` monkeypatched to 0, it raises `SystemExit`, and no pinned file exists.
  - `test_refetch_rejects_other_platforms`: `refetch("tofu", "youtube")` raises `SystemExit`.
- [ ] **Step 2: Run them and see them fail.**
  Run: `cd $TF && backend/.venv/bin/python -m pytest -q backend/tests/test_refetch.py`
  Expected: FAIL, because `refetch` is missing.
- [ ] **Step 3: Implement `refetch`.**
- [ ] **Step 4: Run them and see them pass.** Expected: all pass.
- [ ] **Step 5: Verify.** Run `bash bin/verify.sh`. Expected: GREEN.
- [ ] **Step 6: Commit.**
  ```bash
  git add $TF/backend/server.py $TF/backend/tests/test_refetch.py $TF/backend/tests/conftest.py
  git commit -m "feat(trend-finder): refetch-and-pin command for demo searches"
  ```

### Task 10: Monday observation checklist and docs (W7, W6 ACCESS_EMAIL)

**Files:**
- Create: `pivots/02-content/docs/specs/2026-11-02-monday-observation-checklist.md`
- Modify (append only): `docs/STATUS.md`, `docs/decision-log.md`

- [ ] **Step 1:** Write the checklist in Traditional Chinese, one page.
  - A header with the date, the participants, the environment URL (from Task 12), and the theme in use.
  - A table with one row for each step of the flow (log in → search → open a card → look at the follow list → save → plan → send for review → Annie approves or rejects → look at the reason). Columns: 卡住在哪 (where they got stuck), 猶豫在哪 (where they hesitated), 原話 (their exact words), 時間 (time).
  - The four questions, verbatim from spec W7.
  - A "rejection tags" observation row: did they tap a tag, and which tags they want changed.
- [ ] **Step 2:** `docs/STATUS.md` gets one line. `ACCESS_EMAIL` has been `tommycat997@gmail.com` (`LoginScreen.tsx:31`) since `5a3ba66`, so the "still a placeholder" note is out of date. The user confirms it is the inbox they read. `docs/decision-log.md` gets one dated line for each of these:
  - the rename to Remake
  - the evidence rule
  - the 2× hit threshold
  - one row per account, newest video
  - the scope is this search only
  - reject tags in `rejectTags`
  - the Monday environment on 8801
  - the UI copy language decision
- [ ] **Step 3: Verify.** Run `bash bin/verify.sh`. Expected: GREEN.
- [ ] **Step 4: Commit.**
  ```bash
  git add pivots/02-content/docs/specs docs/STATUS.md docs/decision-log.md
  git commit -m "docs(trend-finder): Monday observation checklist and decision log"
  ```

### Task 11: TikTok gate. W1–W3 complete and verified (free)

No new code. This gate must be green before Tasks 14–16.

- [ ] **Step 1:** Run `bash bin/verify.sh`. Expected: GREEN, with the backend tests and the front-end unit tests both passing.
- [ ] **Step 2:** Run `cd $TF && npx tsc -b && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3:** Run the full isolated e2e at 1440 and then 390 (commands as in Task 3). Expected: every step PASS.
- [ ] **Step 4:** Do a manual Playwright pass on 8797 (pinned tofu, TikTok + Instagram):
  - TikTok tiles show `Evidence: limited` with `Baseline details not recorded`, because the pins are old data.
  - Instagram tiles show `No baseline for this platform yet`.
  - Patterns expand.
  - `/method` loads.
  - The cached chip is shown.
  - Screenshots go to the scratchpad.
- [ ] **Step 5:** Report to the user. List what passed. Also say that full baseline details appear only after Task 13's paid refetch.

### Task 12: Runbook. Monday environment on port 8801 (STOP: the user runs it)

**STOP: needs the user's approval.**
- What it does: starts a new long-running server on port 8801 and creates Daphne's account on a new database.
- Account: none (no paid call).
- Cost: US$0.
- Hard cap: the server starts with `DAILY_APIFY_USD=0`. `DAILY_CLAUDE_USD` comes from `.env` (default 1.00, which is about 12 first-time breakdowns at US$0.08). The user confirms or lowers it.
- The user runs the `add-user` step in a separate terminal, because it asks for a password.

The commands, in this order. Accounts must exist before the server starts, so that Basic auth never applies.

```bash
ENV=/Users/tommy/remake-monday                      # outside every repo and worktree
WT=/Users/tommy/orca/workspaces/BuildClub/full-backend-coverage/pivots/02-content/app/trend-finder
MAIN=/Users/tommy/Desktop/BuildClub/pivots/02-content/app/trend-finder
VENV=$MAIN/backend/.venv
lsof -nP -iTCP:8801 -sTCP:LISTEN                     # must print nothing
(cd $WT && npm run build)
mkdir -p $ENV/backend
rsync -a --exclude .venv --exclude data.db --exclude cache --exclude jobs --exclude __pycache__ --exclude .env \
  "$WT/backend/" "$ENV/backend/"                     # brings pinned/ along
cp -R "$WT/dist" "$ENV/dist"
cp -R "$MAIN/backend/jobs" "$ENV/backend/jobs"       # finished breakdowns (public videos only); saves Claude spend
ln -s "$MAIN/.env" "$ENV/.env"
cd $ENV && $VENV/bin/python backend/server.py add-user <daphne-email> "Daphne" "Mercif"   # USER, separate terminal
cd $ENV && DAILY_APIFY_USD=0 nohup $VENV/bin/uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8801 \
  >> ~/Library/Logs/remake-8801.log 2>&1 &
curl -s http://127.0.0.1:8801/api/health                                   # {"live": true, ...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8801/api/clients  # 401
tailscale funnel status                                                    # 8443 must be free
tailscale funnel --bg --https=8443 8801             # https://tommymac-mini.tail8e20a0.ts.net:8443
```

To refresh the code after a later task, without touching data: run the same `rsync`, but also add `--exclude pinned`. Then `cp -R "$WT/dist/." "$ENV/dist/"`, then stop and start the 8801 process. To take the environment down: `tailscale funnel --https=8443 off`, then stop the process.

- [ ] **Step 1:** Show the user the block above, with the cost line. Wait for a yes.
- [ ] **Step 2:** After the user has run it, check health and the 401 (above), and confirm that 8787 is untouched: `lsof -nP -iTCP:8787 -sTCP:LISTEN` shows the same pid as before.

### Task 13: Paid TikTok refetch of 3–5 Mercif keywords (STOP: needs approval)

**STOP: needs the user's approval.**
- Account: the Apify account behind `APIFY_TOKEN`. On 2026-10-28 it had a US$10/month limit and about US$0.0006 left, so the user must upgrade or buy credit first.
- Action: one new TikTok search for each keyword, plus up to 15 account baselines of 6 videos each, then a pin.
- Estimate: about US$0.45 per keyword (search US$0.112 + medians up to 15×6×US$0.0037 = US$0.33, from STATUS 2026-10-27/28). That is about US$1.35 for 3 keywords and about US$2.25 for 5.
- Hard cap: the inline `DAILY_APIFY_USD`. Default **2.50**, or lower if the user wants. The app refuses anything past it.
- Keywords: the user picks them (the spec suggests things like 豆腐 and 雪梨夜店活動). Write them down before running.

Prerequisite: Task 12 is done (the medians must land in the 8801 database).

```bash
cd /Users/tommy/remake-monday
for q in "<kw1>" "<kw2>" "<kw3>"; do
  DAILY_APIFY_USD=2.50 /Users/tommy/Desktop/BuildClub/pivots/02-content/app/trend-finder/backend/.venv/bin/python backend/server.py refetch "$q" || break
done
```

- [ ] **Step 1:** Show the user the account, action, estimate and cap. Wait for a yes.
- [ ] **Step 2:** Run the command. Record the `[budget]` lines and each keyword's `scored X of Y; baseline details on Z`.
- [ ] **Step 3:** Restart the 8801 process (pins are read from disk, so a restart is not strictly needed). Sign in as the user in a browser, search one keyword, and confirm that a card shows `Evidence: high` or `Evidence: medium` and a formula with N and a date range. Write the actual Apify charge into `docs/STATUS.md`.

### Task 14: Instagram account baselines, backend (late; stop here if it's Sunday night)

**Fallback (spec §7.2):** if Tasks 14–16 are not all done by Sunday 2026-11-01 evening (Sydney), stop. Do not merge partial Instagram work. Instagram cards keep showing `No baseline for this platform yet`, because `BASELINE_PLATFORMS` is still `['tiktok']`.

**Files:**
- Create: `TF/backend/instagram.py`, `TF/backend/tests/test_instagram_baseline.py`, `TF/backend/tests/fixtures/instagram_reels_synthetic.json`
- Modify: `TF/backend/server.py` (the Instagram branch of `search`, and constants), `TF/backend/tests/test_search.py` (`test_instagram_search_from_a_real_result` and `test_instagram_has_no_medians_to_wait_for` assume that Instagram never looks up accounts, so update them to the new behaviour)

**Interfaces (the same shape as `x.py`; nothing in this module imports `server`):**
- Constants:
  - `REEL_ACTOR = os.environ.get("APIFY_INSTAGRAM_REEL_ACTOR", "<confirmed in Step 1>")`
  - `REELS_PER_ACCOUNT = 6`
  - `MIN_VIDEOS = 5`
  - `ACCOUNTS_PER_FILL = 15`
  - `USD_PER_REEL = <from Step 1>`
- Functions:
  - `baselines(items: list) -> dict[str, dict]` returns `median`, `n`, `from`, `to` and `followers` (when the item carries a follower count). The median uses the same field order as `server.trim_instagram`: `videoPlayCount`, then `videoViewCount`.
  - `fetch_baselines(accounts: list, run) -> dict[str, Optional[dict]]`
  - `table(db)`
  - `saved(db, accounts, days) -> dict`
  - `save(db, found) -> None`
  - `apply(videos, found) -> None`. It sets the same five fields as TikTok, plus `medianViews`, `outlier` and `followers`.
- Storage: a separate table, `ig_medians (author TEXT PRIMARY KEY, median REAL, n INTEGER, base_from TEXT, base_to TEXT, followers INTEGER, fetched_at REAL NOT NULL)`. The TikTok `medians` table is keyed by author name alone, so the same name on two platforms would collide there.

- [ ] **Step 1 (free, no Apify run):** Read the actor's public README and output schema on apify.com (WebFetch; note the date accessed). Candidates are `apify~instagram-reel-scraper` (input `username`, `resultsLimit`) and `apify~instagram-profile-scraper`. Confirm three things: the input for a list of usernames, the output field names for plays or views, date and follower count, and the price per result. Write these into the module docstring, citing the source. If no actor gives plays for each reel, stop and report; do not guess.
- [ ] **Step 2: Write the failing tests.** Use a synthetic fixture built from the documented field names, marked `synthetic` in a comment in the test.
  - `test_ig_baseline_records_count_dates_and_followers`
  - `test_ig_baseline_needs_five_reels`
  - `test_ig_search_fills_baselines_in_background`: the first `actor` call is `IG_ACTOR`, and the second is `REEL_ACTOR` with the missing accounts (at most `ACCOUNTS_PER_FILL`). The videos then have `denominator == "median"` and `medianN == 6`. `mediansPending` is true in the reply and false in the cache.
  - `test_ig_baselines_skip_over_budget`: with `DAILY_APIFY_USD=0` after the search has been counted, the result keeps `denominator is None`, and no reel-actor call is made.
  - `test_ig_and_tiktok_medians_do_not_collide`: a TikTok author `a` and an Instagram author `a` keep separate medians.
  - Update the two existing Instagram tests in `test_search.py`.
- [ ] **Step 3: Run them and see them fail.**
  Run: `cd $TF && backend/.venv/bin/python -m pytest -q backend/tests/test_instagram_baseline.py backend/tests/test_search.py`
- [ ] **Step 4: Implement `instagram.py`** and the server branch. Model the server branch on `search_x`: background fill, `filling` and `write_cache`. Spend is `round(len(missing) * REELS_PER_ACCOUNT * USD_PER_REEL, 2)` against `DAILY_APIFY_USD`, with `max_usd=MAX_USD_PER_MEDIANS`.
- [ ] **Step 5: Run them and see them pass,** then run `bash bin/verify.sh` (GREEN).
- [ ] **Step 6: Commit.**
  ```bash
  git add $TF/backend/instagram.py $TF/backend/server.py $TF/backend/tests
  git commit -m "feat(trend-finder): Instagram account baselines from each account's latest reels"
  ```

### Task 15: Turn on Instagram evidence in the front end

**Files:**
- Modify: `TF/src/lib/evidence.ts` (`BASELINE_PLATFORMS`), `TF/unit/evidence.test.mjs`, `TF/src/lib/live.ts` (only if `fillScores` polling skips Instagram, so check `res.pending`)

- [ ] **Step 1: Update the tests.**
  - In the test `no label for YouTube, X, Reddit and (for now) Instagram`, drop Instagram.
  - Add `instagram gets a level but never high (no cohort)`: an Instagram video with a median and `medianN` 6 gives `'medium'`.
- [ ] **Step 2:** Run `node --test unit/` and see it fail. Set `BASELINE_PLATFORMS = ['tiktok', 'instagram']`. Run it again and see it pass.
- [ ] **Step 3: Verify.** Run `npx tsc -b && npm run lint && npm run build`, `bash bin/verify.sh` (GREEN), and the isolated e2e (all PASS). The pinned Instagram data is old, so its cards now show `Evidence: limited` or no label (no denominator), and never `No baseline for this platform yet`.
- [ ] **Step 4: Commit.**
  ```bash
  git add $TF/src/lib/evidence.ts $TF/unit/evidence.test.mjs $TF/src/lib/live.ts
  git commit -m "feat(trend-finder): show evidence levels on Instagram cards"
  ```

### Task 16: Paid Instagram refetch (STOP: needs approval)

**STOP: needs the user's approval.**
- Account: the Apify account behind `APIFY_TOKEN`.
- Action: one new Instagram search for each keyword (US$0.03), plus up to 15 accounts × 6 reels at the Task 14 Step 1 price.
- Estimate: per keyword, US$0.03 + 90 × `USD_PER_REEL`. At about US$0.0026 per reel that is about US$0.26, so about US$0.80 for 3 keywords. Restate it with the confirmed price before asking.
- Hard cap: inline `DAILY_APIFY_USD`, default 1.50 for this run.

Prerequisites: Tasks 14–15 are done, and the 8801 code has been refreshed (Task 12's refresh commands).

```bash
cd /Users/tommy/remake-monday
for q in "<kw1>" "<kw2>" "<kw3>"; do
  DAILY_APIFY_USD=1.50 /Users/tommy/Desktop/BuildClub/pivots/02-content/app/trend-finder/backend/.venv/bin/python backend/server.py refetch "$q" instagram || break
done
```

- [ ] **Step 1:** Show the account, action, estimate and cap. Wait for a yes.
- [ ] **Step 2:** Run it. Record the charges. Check one dataset against the synthetic fixture's field names. Reading a dataset is free; use the Apify console or the API with the user's own login. If any field differs, fix `instagram.py` and the fixture, and re-run Task 14 Step 5.
- [ ] **Step 3:** Restart 8801. In a browser, confirm that an Instagram card shows a formula with N and dates. Write the result into `docs/STATUS.md`.

### Closing

- [ ] Run `bash bin/verify.sh` (GREEN), `npx tsc -b && npm run lint`, and the isolated e2e (all PASS).
- [ ] `docs/STATUS.md`: one status line, the date of the last verification, and the environment URL. Record whether Instagram shipped or fell back.
- [ ] Commit, push and open the PR against `feat/full-backend-coverage`, only when the user asks.
- [ ] Run `git worktree list` and report the worktrees that are clean and merged. Remove none without the user's approval.
