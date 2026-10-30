# Decision Log

Newest first. Dates are when the decision was made (from the Miro board), except sync entries.

## 30 Oct 2026

Source for all entries below: `docs/plans/2026-10-30-remake-monday-mvp.md` and `docs/STATUS.md`.

- Rename: Trend Finder is now called Remake.
- Evidence rule: Limited when the denominator is followers, there is no N, or the recommended video is more than 30 days old (unknown posting date is not Limited; show `Posting date unknown`). High when the denominator is the median and the pattern has at least 3 accounts in this search with at least 2 hits. Medium otherwise. YouTube, X, Reddit (and Instagram until Task 15) show `No baseline details for this platform yet` instead of a label.
- Hit threshold: a hit is a multiple of 2x or more (to be tuned after asking Daphne on Monday).
- One row per account, taken from that account's newest video in the group.
- Scope: the hit rate counts this search only. Follower-denominator accounts are listed as `Rough` and not counted; a group with fewer than 3 accounts shows `One-off`.
- Reject tags are stored in `rejectTags`.
- The Monday environment runs on port 8801 (new database, new Daphne account); 8787 is not touched.
- UI copy language: UI copy is English (the English column of the copy table); conversation and internal docs are Chinese.
- User decision: mobile/phone width (390px) is not a focus for Monday; verify at desktop 1440 only.

## 29 Oct 2026

Source for all entries below: `docs/STATUS.md`.

### Decision
Back every visible front-end feature with the real backend (new clients, Annie share links, real login, link/screenshot search, Ask, tracking board, and so on). Plan: `docs/plans/2026-10-29-full-backend-coverage.md`; the scope table is in `docs/PRD.md`.

### Why
Several screens still showed sample data or "Coming soon". No visible feature should run on made-up data. AI stays descriptive only: it explains real videos and never writes scripts.

### Status
Current.

## 28 Oct 2026

### Decision
Daphne's site on port 8787 runs with `DAILY_APIFY_USD=0`: cached and pinned searches only, no new Apify work. The 8787 backend now runs from the `integrate-premium-ui` worktree (no `--reload`).

### Why
The Apify account had about US$0.0006 left for the billing period (a fresh search got a 402), and two days of tests had already cost about US$5. Cached results are enough for Daphne's meeting.

### Status
Current.

---

### Decision
Remove the platform toggles (Instagram, YouTube, Reddit, X) from the front end for now. The backend still supports all five platforms.

### Why
Merging Veralyn's premium UI took her TikTok-first design; the other toggles were parked rather than carried into the new layout. Task 7 of the 29 Oct plan brings them back.

### Status
Superseded by the 29 Oct plan (Task 7).

---

### Decision
Save money by simulating "6 videos per author" instead of paying for a test; the simulation used only free read access to Apify datasets.

### Why
Two days of paid tests cost about US$5, over budget. The simulation showed 6 videos give the same scored-video count as 10 (129 of 210); the real bottleneck for unscored videos is scoring only the top 15 authors.

### Status
Current.

## 27 Oct 2026 (later entries)

### Decision
Daily Apify cap `DAILY_APIFY_USD` raised from 1.00 to 2.00. The author-median run gets its own cap, `MAX_USD_PER_MEDIANS` = 0.60; the search itself stays at `MAX_USD_PER_SEARCH` = 0.50.

### Why
15 authors x 10 videos cost about US$0.56, which the old 0.50 cap cut off at 134 items. A real "miso soup recipe" search cost US$0.668.

### Status
Current (the median cap is now 0.60 for 6 videos per author; see the next entry).

---

### Decision
`VIDEOS_PER_AUTHOR` 10 -> 6 (6 videos per account) and `MEDIAN_DAYS` 7 -> 30 (median window reused for 30 days, shared by all five platforms).

### Why
Cuts a fresh TikTok search from about US$0.68 to about US$0.45 (search about 0.11 plus medians about 0.34). Cost: some accounts may end up with no score; `MIN_VIDEOS` stays 5.

### Status
Current.

---

### Decision
Unit costs recalibrated from real Apify charges: a 30-video TikTok search is US$0.12 (`SEARCH_USD["tiktok"]`), and each extra video is US$0.0037 (`APIFY_USD_PER_VIDEO`).

### Why
The first estimates were about 2.2x too low (real search US$0.112, real 134-video median run US$0.497).

### Status
Current.

## 27 Oct 2026

### Decision
Trend Finder (`pivots/02-content/app/trend-finder`) is the current product, built with design partner Daphne (Mercif). Recite is paused.

### Why
Daphne does viral-video research by hand every week and dislikes it; she agreed to try a tool at a meeting on 2 Nov. Earlier pivots were built before asking a customer, so this one starts from a real user and fixed success criteria (see the PRD).

### Status
Current.

## 4 Oct 2026

### Decision
Synced repo docs with the Miro boards; the board is the working source of truth.

### Why
Repo docs still described the pre-sprint idea (multi-platform, persona comparison, broad customer list).

### Status
Current.

---

### Decision
Focus the MVP on SEO and digital marketing agencies first.

### Why
Agencies manage multiple clients and are more likely to repeatedly need AI visibility monitoring.

### Status
Current — narrowed on 29 Sep and 1 Oct (see below).

## 1 Oct 2026

### Decision: Personas = Option A (pivot)
Personas are only a way to write questions. The report lists who wins per persona but does not claim personas differ.

**Why:** On 29 Sep personas were called "the only core selling point". Bench 5 then failed twice: per question, no persona pair had separate error ranges (75 API answers, 108 web answers). List overlap was 0.063 same-persona vs 0.043 different-persona — real but very small. B1 showed intent decides the list (similarity 0.03 across intents vs 0.29 across rephrasings). Gumshoe and BrandViz already simulate personas.

**Status:** Current. Next step: change the report to Option A and decide how to group "use cases".

### Decision: ICP — agencies run Recite for their clients
Agencies buy Recite and use it to test clients (e-commerce, law firms, etc.).

**Status:** Current.

### Decision: ChatGPT web is the main engine
**Why:** API and web recommended very different companies (e.g. SOUP: API 19/46 vs web 3/50). Web is what real users see, has a free quota, and doesn't ask questions back. Claude API kept for development tests.

**Status:** Current. Replaces 29 Sep "API first, web later".

### Decision: Competitor list is built from AI answers
**Why:** Only 5 of ChatGPT web's top 20 were on the team's hand-written competitor list.

**Status:** Current.

### Decision: Questions generated by intent, 12 per persona (#26)
Each persona covers several intents with mixed wording (keyword / scenario / different angle).

**Why:** B1 — intent decides the list; keyword wording missed Yoghurt (0/2) where scenario wording found it (2/2).

**Status:** Current.

### Decision: Keep map cards in the count
**Why:** Excluding them did not change the numbers.

**Status:** Current.

### Decision: Jev is not in the main measurement flow
**Why:** Rule-based matching was accurate enough (1 difference in 350 judgments). Jev became a bonus: recommendation strength (#46) and name judging (#47).

**Status:** Partly changed later the same day — pipeline keeps Jev name judging on by default (Eventus: removed 33 non-company names, none wrongly). ⚠ The board lists both; confirm which applies.

### Decision: Test finance first, starting with Eventus Financial
Mortgage brokers and financial advisers first, then education, then real estate.

**Why:** Industry trial had 0 refusals, long lists and mixed citations. Stellar Finance Group dropped as riskier.

**Status:** Done — Eventus run complete (9/102, lowest of 11 brands).

## 29 Sep 2026

### Decision: Target Sydney digital marketing agencies, 1–50 staff
**Why:** In a 15-agency sample, 13 sell SEO and 10 already sell AI search optimisation. Earlier targets (startups / design studios on 27 Sep, Sydney web studios with 1–10 staff on 27–28 Sep) came from a misread brief.

**Status:** Current.

### Decision: Renamed to Recite
**Status:** Current.

### Decision: Use Bright Data for ChatGPT web answers (over DataForSEO)
**Status:** Current.

### Decision: Stop research, start building
**Why:** "Too much research today." All 6 steps had commands within 3 days.

**Status:** Done.

### Decision: No interviews ("not the focus of our work")
**Status:** Superseded — outreach, survey and calls are now under way, and sprint W3 requires 5–10 customer conversations.

### Decision: Honest measurement as a core design
Whole-word matching, failed answers excluded from the denominator, Wilson intervals, spending cap.

**Why:** Open-source tools tested on 28 Sep got this wrong (elmo counted failures in the denominator; ansvisor and Canonry misjudged names).

**Status:** Current.

## 28 Sep 2026

### Decision: Drop consumer and small-shop targets
Coffee shops, international students and local small shops dropped.

**Status:** Current.

### Decision: White-label left open
**Why:** "We'll only know after interviews." An AI-suggested lean towards white-label resale was weakened by Semrush/Ahrefs research.

**Status:** Open.

## 27 Sep 2026

### Decision: Keep the AEO topic; research competitors before interview questions
**Status:** Done.
