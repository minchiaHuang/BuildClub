# Remake: sidebar tabs for the client workspace

> **Updated 2 Nov 2026:** picking a client now opens **Find ideas**, not Home. Home is a separate analytics tab with no search bar. The final flow is in `app-flow.md`; wording rules are in `copy-guide.md`.

_1 Nov 2026. Status: proposal for discussion, nothing built. Goal: the sidebar for one selected client (e.g. Evergreen Foods), to go with the new card dashboard that answers "what should this client film next?". Also a short note on the All-clients sidebar._

**Sources read.** Code in this worktree (`feature/client-dashboard`): `app/trend-finder/src/components/Sidebar.tsx`, `App.tsx`, `types.ts`, `SearchScreen.tsx`, `ShortlistBoard.tsx`, `ReviewScreen.tsx`, `PlanScreen.tsx`, `SettingsScreen.tsx`, `ClientMemory.tsx`, `OverviewScreen.tsx`, `ClientPortal.tsx`. The docs (`PRD.md`, `flow-gaps.md`, `remake-flow-plan.md`, `software-spec.md`, `user-flow.md`) and interview files are untracked, so they aren't in this worktree. I read them from the main checkout (`/Users/veralynlavignechong/Developer/projects/buildclub/pivots/02-content/`). Paths below are relative to `pivots/02-content/` unless they start with `/`.

**Caveats.**
- The evidence comes from **one agency** (Mercif, through Daphene). The buyer, Annie, hasn't been interviewed (`docs/PRD.md` line 115). Treat every "why" below as directional.
- `docs/user-flow.md` (v3.1, 14 Oct) describes the old nail-tech flow. It isn't evidence for this IA, so I don't use it.
- This worktree has uncommitted code changes from another session. Line numbers in the code may move.

---

## 1. Recommendation: four tabs now, a fifth later

| # | Label | Icon idea | What's on it | Maps to | Status |
|---|---|---|---|---|---|
| 1 | **Home** | Progress ring or house | The card dashboard: "X of Y this month", Next to film, Needs your approval, Shortlist in progress, Trending now for this client, Latest from client memory | **New** (built from parts of `ShortlistBoard`, `ClientPortal`, `ClientMemory` and the search pulse) | Becomes the screen you land on when you pick a client |
| 2 | **Find ideas** | Magnifier (existing `search` path) | Search box, client chips, Trending now, results, breakdown panel | `search` + `results` (`SearchScreen`, `ResultsScreen`, `BreakdownPanel`) | Exists. Rename only |
| 3 | **Plans** | Columns / board | One board: Shortlisted → Needs approval → Ready to film, plus Sent back. Opening a card opens its plan. "Review" is a focused mode started from the board, not a tab | `shortlist` + `review` + `plan` (`ShortlistBoard`, `ReviewScreen`, `PlanScreen`) | Exists. Rename and change the approval step (see 1.3) |
| 4 | **Brief** | Person card or notebook | Client profile (niche, audience, monthly target, topics, starter searches, what they can't film) **and** "What we've learned" (client memory) | `settings` (`SettingsScreen` + `ClientMemory`) | Exists. Rename and reorder |
| 5 | **Client view** (later) | Eye or share arrow | What the client sees: plans sent to them, their feedback, a share link | `ClientPortal.tsx` (built, not wired up) | Add **only** once "send to client" exists (see 3) |

Order follows the job: check where the client stands (Home), find more if short (Find ideas), move ideas to filming (Plans), keep the client's rules and history (Brief). Brief sits below a divider, like Client settings does today (`Sidebar.tsx` line 194), because you go there less often.

### 1.1 Home (new)

**What's on it.** One card per question, each linking to the tab that answers it in depth:

| Card | Shows | Data it uses |
|---|---|---|
| This month | "4 of 12 approved, 9 days left, need 8 more" | `monthlyTarget`, approved ideas (already shown in `ShortlistBoard` and `OverviewScreen`) |
| Next to film | Approved plans, soonest due date first, with "Copy brief for editor" | Approved column of `ShortlistBoard`, sorted by `dueDate`; "Ready to film" in `ClientPortal` |
| Needs your approval | "3 plans waiting", opens Review | `status: 'waiting'` |
| In progress | "2 shortlisted, 1 without a shot list" | `status: 'saved'`, `shotsOf()` in `ShortlistBoard` |
| Trending now for Evergreen | The daily topic check, top 3 formats that pass the can't-film check | `topics[0]` pulse, already used for the search chips |
| What we've learned | Last 2–3 decisions and reasons, e.g. "Sent back: not on brand" | `client.memory`, `ClientMemory` |

**Why.**
- **It's the top pain, word for word.** Daphene's one wish was a tool that shows "how many videos do we need, like KPI, and where are we at the moment, because sometimes I lose track". What helps today is "sending notifications hey you need to film like three more videos for this client this month" (`research/interviews/2026-10-21-daphene-transcript.md` 18:04–18:37; summary line 26). The "This month" and "Next to film" cards turn that reminder into a screen.
- **It's the pitch.** "Remake tells you what *this client* should film this week, and where every client is at" (`docs/PRD.md` line 45). Today nothing answers "this week" for one client. You land in Search (`App.tsx` line 109–110: "Picking a client from the switcher always starts on Search"), and progress shows only as a small line above the search box once something is planned (`SearchScreen.tsx`).
- **It shows the moat.** Client memory is "the moat, and it has no storage yet" (`docs/flow-gaps.md` line 14). It's stored now, but only at the bottom of Client settings, below a long form. A Home card makes it visible every day.

**Trade-off.** One more click before searching. Fix: a "Find ideas" button on the This month card when the client is behind target, and keep the Overview's "Find ideas" button going straight to Find ideas.

**Scope guard.** The PRD says Remake is "not a general project management tool" and tracks "only the video pipeline per client" (`docs/PRD.md` line 109). So Home has no tasks, no editor assignments, no calendar. Editor tracking is "mention only" for demo night (line 71), even though late editors are a real pain (Daphene 20:44–21:26).

### 1.2 Find ideas (rename of Search)

**What's on it.** Unchanged: `SearchScreen` and `ResultsScreen`, with the breakdown panel and "Add to shortlist".

**Why a tab of its own.** Research is the step the agency dislikes: "Research. I don't like research." (Daphene 08:14–08:20). Their method is a clear rule, the "1-to-10" search (04:33–05:11), which Remake's ranking copies. It's a full-screen mode (search, grid, drawer) that doesn't fit inside a dashboard card. **Why rename.** The Overview button already says "Find ideas" (`OverviewScreen.tsx`), and "Search" doesn't say whose search. Optional; "Search" is fine if you prefer short labels.

### 1.3 Plans (Shortlist + Review + Plan)

**What's on it.** The `ShortlistBoard` columns, renamed:

| Today | Proposed | Why |
|---|---|---|
| Shortlisted | Shortlisted | Matches the flow's word (`docs/flow-gaps.md` line 35) |
| Waiting for {manager} | **Needs approval** | When the person signed in *is* the manager, "Waiting for Annie" reads as waiting for yourself |
| Approved, ready to film | Ready to film | The handoff the team cares about ("'Ready to film', sorted by due date, is a clean handoff", `docs/flow-gaps.md` line 30) |
| Sent back (lane) | Sent back | Keep |

**Keep Plans and Shortlist together.** Splitting them again would undo the fix in `docs/flow-gaps.md` line 33: "Three lists for one pipeline. Saved ideas, Approvals and Plans all show the same ideas at different stages. Replace them with one Shortlist board per client". A plan is one idea's detail page, so it opens from a card. It isn't a list, so it shouldn't be a tab.

**Why rename to Plans.** "Shortlist" names only the first column. Most of the board is plans at later stages. "Plans" covers the whole lifecycle. (Keep "Add to shortlist" as the button in search results; the first column is still called Shortlisted.)

**Review is no longer a tab, and it's no longer a separate step for the person who just wrote the plan.** Today it already isn't a sidebar item; it only highlights Shortlist (`Sidebar.tsx` line 192). With every staff login as the manager (`LoginScreen.tsx` line 10, 32), the current path is: write shots → "Send N to {manager}" → "Review as {manager}" → swipe approve. That's two hand-offs to yourself. Proposed:
- On each plan and each Shortlisted card: **Approve** (and Approve with changes / Send back) directly, with no send step.
- Keep `ReviewScreen` as a **batch mode** opened from "Needs approval (n)" on Home or the board. It's still the best screen for a set of plans: "The manager's review card is simple and phone-like" (`docs/flow-gaps.md` line 29), and it works at 390px (`docs/software-spec.md` section 8).
- Keep the **Needs approval** column. Ideas can still wait (for example, drafted on Monday and approved on Friday), and every decision must still write a `ClientEvent` to client memory (`docs/remake-flow-plan.md` feature 11). That's what feeds the moat.

**Sidebar badge.** Count what needs action (Needs approval + Sent back), not the total shortlist (`counts.shortlist` today). A badge that only grows stops meaning anything.

### 1.4 Brief (rename of Client settings)

**What's on it.** The `SettingsScreen` form plus `ClientMemory`, in this order:
1. The essentials, short: what they sell, audience, monthly target, **what they can't film**
2. **What we've learned** (client memory): approvals, send-backs and reasons, newest first
3. Topics to watch and starter searches (set once, rarely changed)

**Why "Brief", not "Settings".** This is the client profile the PRD calls the product's core: "Remake remembers every client" (`docs/PRD.md` line 9), differentiators 1 and 2 (lines 39–40). The agency's own word for this step is onboarding the client's "branding, direction, goals ... and KPIs" (Daphene summary, line 14; transcript 08:32). "Settings" sounds like app configuration, and teams don't open settings to learn about a client.

**Why memory lives here and not in its own tab.** A memory tab would be empty for a new client and would hold one list. With the latest decisions on Home and the full history next to the can't-film rules, the manager sees the rules and the evidence for them together: "Sent back: no kitchen shots" sits beside the "A kitchen" checkbox. If memory later shapes ranking and shot lists (out of scope now, `docs/remake-flow-plan.md` line 35), revisit this. At that point it may deserve a tab (see alternative B).

### 1.5 Client view (later, conditional)

**What it would be.** A preview of what the client sees (`ClientPortal.tsx`: "Ready to film", "Waiting for {manager}", monthly progress), a "Share with client" link, and the client's likes and dislikes once they can respond.

**Why it's not in the first four.** Nothing sends a plan to a client today: no status, no button, no share link. `ClientPortal` is built but "not wired up" (`ClientPortal.tsx` line 16–18). A tab with nothing to send is a dead end, and the flow plan's goal is no dead ends (`docs/remake-flow-plan.md` line 9).

**Why it's likely needed.** Clients do approve some content at Mercif. When asked "Do clients have to approve that storyboard?", Daphene said "Yes, yes" for influencer content (transcript 03:42). The suggested design is "no client login in v1. Later, the manager shares a read-only link ... and the client's likes and dislikes go into client memory. That's what feeds the moat." (`docs/flow-gaps.md` line 20). If "sent to client" becomes a real step (see 3), add it as a fourth column on Plans ("Sent to client") **and** this tab.

### 1.6 What to merge or drop

| Item | Decision | Reason |
|---|---|---|
| Review as a tab | Drop (never was one). Becomes Approve on the plan plus a batch mode | The person signed in is the manager; one board for one pipeline |
| Plans separate from Shortlist | Don't split | `docs/flow-gaps.md` fix 1 |
| Client settings | Rename to Brief, memory moved up | It's the moat, not configuration |
| Client memory tab | Don't add yet | One list, empty for new clients; surface it on Home instead |
| "Waiting for {manager}" wording | Change to "Needs approval" | Self-referential when everyone is the manager |
| Old `saved`, `approvals`, `plans` views | Already gone from `View`; keep them gone | Stream B retired them |

---

## 2. All clients: should the sidebar change?

Today: one item, **Overview**, plus the hint "Pick a client above to search and save ideas." (`Sidebar.tsx` line 199–200). The agency name and manager name are edited at the bottom of the Overview page (`AgencySection` in `OverviewScreen.tsx`).

Recommendation: **two items**.

1. **Overview**: keep it, but make it card-led like the client Home: clients behind target first, "N plans need approval across clients", due soon. Why: Annie approves every idea for 10+ clients (Daphene 09:44–10:03, 18:04), so a manager wants to see the whole queue before choosing a client. The Overview table already links "N waiting" per client.
2. **Agency settings**: move `AgencySection` out of Overview into its own item. Why: Overview should answer "where does every client stand", and an edit form at the bottom of a status page is easy to miss and easy to change by accident.

Optional, only if testing shows managers approve across clients in one sitting: an **Approvals (all clients)** item that runs `ReviewScreen` over every client's waiting plans. That's new (Review is per-client today). Don't build it before the Daphne session; ask her (it's already an open question: "Would Annie approve ideas in a tool, or does that happen in chat?", `docs/PRD.md` line 128).

---

## 3. Alternative structures

### A. One tab per stage (6 tabs)

Home · Find ideas · Shortlist · Needs approval · Ready to film · Brief

- **For:** each stage gets a sidebar count. It mirrors Mercif's linear pipeline (research → qualify → approve → film → edit → review → post, Daphene summary lines 14–20). "Ready to film" becomes a direct entry point for whoever films (Daphene films herself, transcript 09:38–10:09).
- **Against:** it brings back "three lists for one pipeline" (`docs/flow-gaps.md` line 33), which was fixed on purpose. Moving an idea moves it to a different tab, so people lose sight of it. Six items for one client is a lot next to a client switcher.
- **When to pick it:** if Daphene's session shows that the filmer and the approver are different people who each only care about one stage.

### B. Three tabs, with Home as the hub

Home (dashboard with the pipeline as cards and a search entry) · Find ideas · Brief & memory

- **For:** fewest choices. Home answers "what next" and the pipeline in one place. Fits the audit's view that the sidebar is "a generic SaaS rail that takes 264px from the grid" (`docs/design-review/audit.md` line 46).
- **Against:** the board needs width (three columns plus batch controls), so it would be cramped as cards. Batch "Send" and "Add suggested shots" need room. Home becomes two screens in one.
- **Variant:** give memory its own tab (**Learnings**) once it changes ranking or shot lists. Then it's a feature, not a log, and earns the space.

### Also on the table: a top bar instead of a sidebar

`docs/design-review/implementation-plan.md` step 8 proposes "Replace sidebar with a top bar (Chart, Saved, Plans, Approvals, client switcher)". The four-tab list above works in either layout. Its tab names are out of date (Saved and Approvals no longer exist).

---

## 4. Contradictions and decisions for you

1. **Is approval still a separate person?** Every staff login is now the manager (`LoginScreen.tsx` line 10; `docs/remake-flow-plan.md` decision 5: "Staff covers team members and the manager"). But the evidence is a **two-person** gate: Daphene finds and drafts, "Annie is the one to approve that" (Daphene 09:44–10:03), and the PRD lists the founder as the buyer and approver (`docs/PRD.md` line 28, differentiator 4). The code also still has `Role = 'member' | 'manager' | 'client'` and `isManager` checks in `ReviewScreen`. **Confirm:** do we design for one person approving their own plans (my recommendation 1.3 assumes this), or keep a member/manager split for later? If the split comes back, "Needs approval" should read "Waiting for {manager}" again for members.
2. **"Sent to the client" isn't in any doc.** The PRD flow ends at approval and progress (`docs/PRD.md` lines 55–65). The flow plan puts client login out of scope (`docs/remake-flow-plan.md` line 34), and `flow-gaps.md` line 20 suggests no client login in v1. The brief for this task says plans are "sent to the client" after approval. **Confirm:** is send-to-client in scope now? That decides whether tab 5 and a "Sent to client" column exist.
3. **Home vs "not a project management tool."** Daphene's top wish was a PM tool (transcript 17:31), but her summary says project tracking is "not our wedge" because it's crowded (`research/interviews/2026-10-21-daphene-summary.md` line 36), and the PRD lists drift into PM as a risk (`docs/PRD.md` line 117). The Home dashboard leans toward tracking. **Confirm:** Home stays limited to the video pipeline (target, next to film, approvals, trends, memory), with no tasks or editor tracking.
4. **"What to film next" stops at approved.** Statuses end at `approved` (`types.ts` `IdeaStatus`). Filming, editing and posted belong to your friend's part (★, `docs/remake-flow-plan.md` line 31). So "Next to film" can only mean "approved, soonest due". It can't tell filmed from not filmed. **Confirm** whether the dashboard needs at least a "Filmed" tick, and who builds it.
5. **Landing on Home instead of Search** changes `App.tsx` line 109–110 and stream A's "Picking a client opens its search" (`docs/remake-flow-plan.md` line 76). Small, but it reverses a written decision.
6. **Sidebar vs top bar.** See section 3: `docs/design-review/implementation-plan.md` step 8 and `audit.md` line 46–47 propose removing the sidebar.
7. **Project-level status (carried over, still open).** The worktree's `PROJECT_CONTEXT.md` still describes Recite (pivot 1). The main checkout's version says career consulting is current and pivot 2 is archived. Remake is active work anyway. This was already flagged in `docs/PRD.md` lines 133–137, and none of the Remake decisions are in `docs/decision-log.md`.
