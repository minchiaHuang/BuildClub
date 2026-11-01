# Client dashboard UI patterns (research)

Researched 2026-11-01. Question: what should the per-client screen (e.g. "Evergreen Foods") look like, so it answers "what should this client film next?" at a glance, in a card (bento) layout instead of a bare search box?

All sources accessed 2026-11-01 unless noted. Publication dates are given where the page shows one. Vendor blogs are flagged as such.

---

## 1. What good dashboards do in 2025–2026

### 1.1 Core principles from research and design writing

| # | Finding | Source |
|---|---|---|
| P1 | A dashboard is a single screen read **at a glance** to support quick action. It is not a place for deep exploration, which belongs on detail pages. | [Dashboards: Making Charts and Graphs Easier to Understand](https://www.nngroup.com/articles/dashboards-preattentive/), Page Laubheimer, Nielsen Norman Group, 18 Jun 2017. *Old, but the principle is still the standard reference.* |
| P2 | Use length and position (bars, lines) for quantities. Avoid pies, donuts, gauges and 3D. Color is for categories or state, never the only cue. | Same NN/g article |
| P3 | Cards suit **heterogeneous** content (a dashboard is the textbook case). They act as a summary plus an entry point to a detail page. Secondary actions sit apart. **Avoid cards for long homogeneous lists or side-by-side comparison**: use a list instead. Top and left still get the most attention. | [Cards: UI-Component Definition](https://www.nngroup.com/articles/cards-component/), Page Laubheimer, NN/g, 6 Nov 2016. *Old, still valid.* |
| P4 | Put the most critical figures **top-left** and make primary KPIs large and bold. Keep about **five visible elements** and collapse the rest. KPI card = label + value + delta (arrow and %) + optional sparkline covering 7–30 days. Don't use color alone for status. Use skeleton loaders, not spinners. Show "Data as of …" freshness rather than blank panels. | [From Data To Decisions: UX Strategies For Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/), Karan Rawal, Smashing Magazine, 12 Sep 2025 |
| P5 | Empty states must (1) show system status (empty vs loading vs error), (2) teach what the area is for, and (3) give a direct button to the task that fills it. | [Designing Empty States in Complex Applications: 3 Guidelines](https://www.nngroup.com/articles/empty-state-interface-design/), Kate Kaplan, NN/g, 19 Sep 2021 |
| P6 | Layout patterns observed across 144 dashboards. The useful ones here: **Stratified** (overview at top, detail below), **Grouped** (related widgets bounded together), **Detail-on-demand**, and **Update information** (show freshness). Higher abstraction (a threshold such as "good/bad", or a derived KPI) sits higher on the page. | [Dashboard Design Patterns](https://dashboarddesignpatterns.github.io/patterns.html), Bach et al., University of Edinburgh / IEEE VIS 2022 |
| P7 | Labels: when showing several similar values (dashboards), keep labels but de-emphasize them (smaller, lower contrast, lighter weight) so the value carries the hierarchy. | [Labels are a last resort](https://www.refactoringui.com/previews/labels-are-a-last-resort), Adam Wathan & Steve Schoger, Refactoring UI (undated preview) |

### 1.2 Bento grid mechanics

From [Designing Bento Grids That Actually Work: A 2026 Practical Guide](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide), SaaSFrame (no author; © 2026). *Design-gallery blog, practitioner opinion. Its statistics (for example "67% of top ProductHunt products") cite no sources and are unverified.*

- **Size, not position, signals importance.** The hero gets the largest tile. A bento grid with equal tiles is just a card grid.
- **Columns:** 3–4 on desktop, 2 on tablet, 1 on mobile. On mobile, order cards **by importance**, hero first.
- **Gutters** 16–24px desktop, 12–16px tablet, 12px mobile, identical everywhere. **Card padding** 16–20px for small tiles, 24–32px for large ones.
- **Dashboard spans:** 2×1 for KPIs, 2×2 for a funnel/pipeline, 1×2 (tall) for recent-activity lists.
- **Mistakes:** cramming content into small tiles; using bento where content is linear or deep; heavy hover animation (one or two properties at most).
- A secondary source adds that 8–12px gaps read as dense/operational and 24–32px as premium ([Bento grid dashboard aesthetics](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics), Orbix Studio, agency blog; unverified).

### 1.3 What specific products do

| Product | Pattern worth copying | Source / caveat |
|---|---|---|
| **Stripe** | Home = performance charts **plus "actions needed"** (unresolved disputes, verifications). The user adds and removes widgets via Edit/Add. Neutral palette, with **color reserved for state** (succeeded/refunded/failed) as status chips. | [Web Dashboard docs](https://docs.stripe.com/dashboard/basics), Stripe (live docs); palette notes from [Fintech Dashboard Design: 9 Real Products, Analyzed (2026)](https://adminlte.io/blog/fintech-dashboard-design-examples/), Aigars Silkalns, AdminLTE, 24 Aug 2026 (vendor blog) |
| **Ramp** | **Work-queue first:** inboxes to approve, automation status and month-close progress get the prime space. Analytics sit one level down. "Finance dashboards are to-do lists wearing charts." | AdminLTE article above. *Third-party analysis, not confirmed by Ramp.* |
| **Mercury** | Calm, restrained, type-led hierarchy. Financial status first, controls second. Red/yellow are used only for errors and warnings. | [Mercury Design Breakdown](https://www.925studios.co/blog/mercury-design-breakdown), 925studios (agency; page shows conflicting dates, Apr/Oct 2026). Mercury job ads describe home as tying together "tasks, notifications and priorities" and say each module must "earn its space" ([Working Nomads listing](https://www.workingnomads.com/jobs/senior-product-manager-dashboard-experience-mercury-1814920), undated). |
| **Linear** | Reduce visual noise. Neutral palette with limited accent use. Layered elevation for hierarchy. **Priority inbox** (Sep 2026) splits "needs your attention" from "can wait", e.g. a review blocking a release. | [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui), Karri Saarinen et al., 28 Mar 2024; [Priority inbox changelog](https://linear.app/changelog/2026-09-03-priority-inbox), Linear, 3 Sep 2026 |
| **Vercel** | The overview leads with "the most crucial project elements": production status, latest deployment, links. Recent activity can be filtered by teammate. A thumbnail of the latest output is used for quick recognition. | [Dashboard redesign](https://vercel.com/blog/dashboard-redesign), Vercel, 20 Nov 2019. *Old, but the principle holds.* The navigation redesign became the default on 26 Feb 2026 ([The New Side of Vercel](https://vercel.com/try/new-dashboard)). |
| **Notion Home** | Widget home: Recently visited, Upcoming events, My tasks. Widgets can be shown or hidden. | [Home and My Tasks](https://www.notion.com/help/home-and-my-tasks), Notion Help Center (live) |
| **Hootsuite** | Homepage widgets include a **content inspiration bar**, a getting-started guide and **"your most engaging posts"**. This is the closest social-tool analog to a "what to post next" card. | [New homepage widgets](https://www.hootsuite.com/whats-new/new-homepage-widgets), Hootsuite, 10 Jul 2024 (may have changed since) |
| **Sprout Social** | Approvals live in a dedicated **Needs Approval** queue with an approval activity feed per message. Unanswered approvals auto-reject at the scheduled time, so deadlines matter. | [Message approval workflow](https://sproutsocial.com/insights/message-approval-workflow), Sprout Social; [Approval Activity Feed release](https://sproutsocial.com/insights/release/april-27-2017), 27 Apr 2017 (old) |
| **Planable** | Per-client approval flows, filter by approval status, bulk approve, and client reviewers who need no account. | [Approval features](https://planable.io/features/approval/), Planable (vendor page, undated) |
| **Metricool** | A "best time to post" heatmap where a darker shade means a better time. A good example of a glanceable "when" recommendation. | [Best time to post](https://help.metricool.com/best-time-to-post-on-social-media-in-metricool-w7ll9), Metricool Help (live) |
| **Buffer** | Moving to a "Buffer Home" hub that brings posting, channels and activity into one view (beta). | [Navigating Buffer's new dashboard layout](https://support.buffer.com/articles/navigating-buffers-new-dashboard-layout-JsRJX4s6QQ), via search snippet only; the page returned 404 when fetched. **Unverified.** |

**Not verified:** I found no primary source for current home layouts of Attio, Later, Planable or Sprout Social, or for Mobbin/Dribbble patterns. Attio's docs only cover user-built dashboards ([Attio Dashboards](https://attio.com/help/reference/managing-your-data/dashboard-and-reports/dashboards.md)). Don't treat claims about those home screens as researched.

---

## 2. Buildable patterns (summary)

1. **Grid:** 12-column CSS grid at desktop (≥1200px), with cards spanning 3/4/6/8/12 columns. Collapse to 6 columns on tablet and 1 on mobile. Use a 16–24px gap and the same radius on every card. A 12-column grid gives the "3–4 visual columns" bento look while still allowing 8+4 splits.
2. **Top-left** holds the single answer to the page's question (the "verdict row": AdminLTE's term; Smashing P4). Here that answer is the top format to film next.
3. **KPIs:** at most 4 small stat tiles, keeping the visible total near 5 major elements (P4). Anatomy: muted label, large value, delta with arrow and text ("+2 this week"), and optionally one action link.
4. **Card anatomy:** title row (title, plus a quiet "View all →" at right), body (one primary thing), and at most one primary button per card. Secondary actions go in a footer or overflow menu (P3).
5. **Work-queue over charts:** what needs someone's action gets prime space, and analytics come second (Ramp, Stripe "actions needed", Linear priority inbox).
6. **Pipeline:** a horizontal stage strip with a count per stage, where each stage is clickable and filters the board. Use colored chips with text labels, never color alone (P2, P4, Stripe chips).
7. **Density:** operational, not marketing. Keep a calm neutral palette with the accent reserved for the one primary action and for status (Linear, Mercury, Stripe).
8. **Empty states** in every card: say why it's empty and give one button that fills it (P5).
9. **Freshness:** show "Trends updated 2h ago" on any data that comes from TikTok (P4, P6).

---

## 3. Proposed layout: "What should Evergreen Foods film next?"

Uses the stages already in the build (`docs/remake-flow-plan.md`): **Shortlisted → Waiting for manager → Approved (ready to film)**, plus a **Sent back** lane. "Sent to client" is **not** a current stage. It appears below as an optional future stage, so this proposal does not change the flow decision. Confirm with the user before adding it.

### Desktop wireframe (12 columns)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Evergreen Foods ▾   Food & bev · TikTok · Due: 3 plans by 14 Nov   [⌕ Search formats…] │  header bar (12)
├───────────────────────────────────────────────┬──────────────────────────────┤
│ ① FILM NEXT (hero)                    8 col   │ ② NEEDS ACTION           4 col│
│  [thumb] "Ingredient reveal in 3 cuts"        │  2 waiting for manager (due 5d)│
│  Proven: 14 videos, median 2.1M views, ▲38%   │  1 sent back – "too salesy"   │
│  Why for Evergreen: matches brief "recipes"   │  3 approved, ready to film    │
│  [Add to shortlist]  See 2 more ›             │  [Review now]  (manager)      │
│  alt #2 · alt #3 (small rows)                 │                              │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ ③ PIPELINE                                                         12 col    │
│  Shortlisted 4 ─▶ Waiting 2 ─▶ Approved 3 ─▶ (Sent to client – future)  ↺ Sent back 1 │
├─────────────────────────┬─────────────────────────┬──────────────────────────┤
│ ④ TRENDING IN NICHE 4   │ ⑤ CLIENT BRIEF & MEMORY 4│ ⑥ RECENT ACTIVITY     4 │
│  3 rising formats       │  Tone, do/don't          │  Ana approved "Pantry…" │
│  ▲ "POV grocery haul"   │  Last 3 decisions + why  │  Sam shortlisted 2      │
│  updated 2h ago         │  [Edit brief]            │  View all ›             │
└─────────────────────────┴─────────────────────────┴──────────────────────────┘
```

Tablet (6 columns): ① spans 6, then ② 6, ③ 6, and ④/⑤/⑥ at 3+3, with ⑥ wrapping. Mobile (1 column), by importance: header search, ① Film next, ② Needs action, ③ Pipeline (horizontally scrollable chips), ⑤ Brief, ④ Trending, ⑥ Activity.

### Cards and why each exists

| # | Card | Span (desktop) | Content | Primary action | Why |
|---|---|---|---|---|---|
| 0 | **Header bar** with client switcher and **quick search** | 12, slim | Client name, niche/platform chips, the next due date, and a compact search field (⌘K) | Search | Keeps today's search, which still matters, but demotes it from the whole page to a utility. Mirrors Stripe/Linear global search. |
| ① | **Film next** (hero) | 8 × 2 rows | The #1 recommended format: thumbnail, format name, proof ("14 videos, median 2.1M views, ▲38% in 30d" from the existing "Best to copy" analytics), and a one-line *why for this client* drawn from brief or memory. Formats #2–#3 appear as small rows below. | **Add to shortlist** (the single existing action) | Answers the page's question at top-left in the largest tile (P4, bento "size = importance"). Proof plus reason is the decision content. Keep it to 3 options, because cards are poor for comparing long lists (P3). |
| ② | **Needs action** | 4 × 2 rows | The role-aware queue. **Manager:** "N waiting for your review" with the earliest due date. **Staff:** sent-back items with the manager's reason, plus approved items ready to film. | Manager: **Review now**. Staff: **Fix sent-back**. | Work-queue-first (Ramp, Stripe "actions needed", Linear priority inbox, Sprout Needs Approval). Due dates are shown because approvals have deadlines. |
| ③ | **Pipeline strip** | 12 × 1 row (short) | Stage chips with counts: Shortlisted → Waiting for manager → Approved. A separate "Sent back" chip. Each chip links to the Shortlist board filtered to that stage. | Click a stage | Shows the whole status at a glance in one row (stratified overview; P6). It replaces a chart: counts in labeled chips are glanceable, and text plus icon means color isn't the only cue (P2). |
| ④ | **Trending in this niche** | 4 | 3 rising formats for the client's niche with a short ▲ delta and "updated Xh ago" | **See trend** (opens search pre-filled) | This is the "what's new" input to film-next, kept separate so the hero stays a single answer. Comparable to Hootsuite's inspiration bar. The freshness stamp follows P4/P6. |
| ⑤ | **Client brief & memory** | 4 | Tone, do/don't, audience (from the brief), and the last 3 decisions with reasons ("Sent back: too salesy") | **Edit brief** / View all | Puts the moat (client memory) where staff see it *before* choosing, not buried in settings. It also explains the hero's "why for this client". |
| ⑥ | **Recent activity** | 4 (tall list) | The last 5 events: who shortlisted, approved or sent back what, and when | View all | Team awareness (Vercel's filter by teammate, Sprout's approval feed). It sits at the bottom because it's context, not action (stratified, P6). |
| opt | **Stat tiles** (only if wanted) | 3 each, 4 tiles max | Approved this month · Avg days to approval · Sent-back rate · Plans due | none | Optional. The pipeline strip already carries the counts, and adding tiles risks going past about 5 major elements (P4). Add later only if managers ask for performance numbers. |

### Empty states (P5)

- **New client, no brief:** the hero says "Tell us about Evergreen Foods to get recommendations", with an **Add brief** button. Trending still shows niche data, so the page is never blank.
- **No shortlist yet:** the pipeline shows zeros as muted chips, and Needs action says "Nothing waiting. Shortlist a format to start", linking to the hero.
- **Loading:** skeleton tiles in the same grid shapes, never spinners (P4).

---

## 4. Most important principles (ranked)

1. **One question, one hero.** The largest tile, top-left, answers "film next" with proof and a client-specific reason (P4, bento size rule).
2. **Action before analytics.** The "Needs action" queue sits next to the hero and changes by role (Ramp, Stripe, Linear).
3. **About 5 major elements**, with everything else reached by drill-down (P1, P4, P6).
4. **One primary button per card**, with secondary actions quiet (P3).
5. **Status uses text plus color**, in neutral surroundings. The accent is reserved for the primary action and state (P2, Stripe, Mercury, Linear).
6. **Demote search to a utility**: keep it, just not as the page.
7. **Every card has a useful empty state** with a direct fix button (P5).
8. **Show freshness** on trend data, and order cards by importance on mobile (P4, SaaSFrame).

All visual specs (colors, radii, type) must use the Remake design system tokens. This doc covers structure only.
