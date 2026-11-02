# Remake: app flow (who lands where, and how you get around)

_1 Nov 2026, updated 2 Nov 2026. Phase 1 wrote this spec; phase 2 built it (not committed). Founder answers are in section 5 and in `docs/decision-log.md` (2 Nov 2026). Branch `feature/client-dashboard`, worktree `buildclub-remake-start`._

**What I read.** `app/trend-finder/src/App.tsx`, `components/Sidebar.tsx`, `LoginScreen.tsx`, `OverviewScreen.tsx`, `ClientHome.tsx`, `home/HomeCards.tsx`, `SearchScreen.tsx`, `ResultsScreen.tsx`, `BreakdownPanel.tsx`, `ShortlistBoard.tsx`, `ReviewScreen.tsx`, `PlanScreen.tsx`, `SettingsScreen.tsx`, `AddClientScreen.tsx`, `ClientPortal.tsx`, `state.ts`. Docs: `client-workspace-nav.md`, `docs/decision-log.md` (1 Nov entry), and from the main checkout `flow-gaps.md`, `remake-flow-plan.md`, `research/interviews/2026-10-21-daphene-summary.md`. `user-flow.md` is the old nail-tech flow (v3.1, 14 Oct), a different doc, so this is a new file.

**Caveats.**
- Two other agents are rebuilding Home and Find ideas right now. File:line references are from the code as of 1 Nov and **will move**. Search for the quoted text if a line is off.
- Evidence about how agencies work comes from one agency (Mercif, via Daphene). Directional only.

**Words used here.** *Home* = analytics page. *Find ideas* = the search page plus its results. *Plans* = the board (Shortlisted → Waiting for approval → Approved, plus Sent back), each plan's own page, and Review (approve several in a row). *Brief* = the client profile and client memory. *All clients* = the agency-wide workspace.

---

## 1. Who lands where

### 1.1 Landing rules

| Situation | Lands on | Why |
|---|---|---|
| **First-ever log-in** (no client remembered in this browser) | **All clients → Home** | Nothing to go back to; the agency view shows every client and lets you pick or add one. |
| **Returning log-in** (a client is remembered) | **That client → Find ideas** | You pick up where you left off. Search is the main job. |
| Remembered client was deleted or no longer exists | All clients → Home | Never open a client that isn't there. |
| **Sign out** | The log-in form (not the marketing landing page) | You just used the app; you want to get back in, not be sold to. |
| **Sign back in** (same browser) | Same as returning log-in: last client → Find ideas | Signing out does not forget the last client. |
| **Page refresh** while signed in | Same client, **same tab** you were on (results, a plan and Review reopen as Find ideas or Plans, since their contents aren't saved) | A refresh shouldn't move you. |
| **Switch client** (switcher, or a client name on All clients Home) | That client → **Find ideas** | Founder decision: picking a client opens search first. |
| **Switch to All clients** | All clients → Home | |
| **Add a new client** (Save) | The new client → **Find ideas** | The button already says "Save and find ideas" (`AddClientScreen.tsx:164`). A new client has nothing else to look at yet. |
| **Cancel** adding a client | The page you were on before | Cancel should undo, not move you. |
| **Client with nothing saved yet** | Find ideas (as normal) | Every other tab must still work when empty, with one clear button back to Find ideas (see 1.2). |

**What "last client" means.** The last client whose workspace you were in, saved in the browser whenever you enter a client. Visiting All clients does **not** clear it. It needs its own stored value (today the same value, `trend-finder.workspace.v2`, also holds `'all'` and defaults to the first sample client, so the app can't tell a first-ever log-in from a returning one).

### 1.2 Empty client (nothing saved yet): what each tab shows

| Tab | Shows | The one button |
|---|---|---|
| Find ideas | Search box, starter searches, Trending now | (search itself) |
| Home | "0 of N approved", empty cards with a reason | **Find ideas** |
| Plans | "Nothing shortlisted yet" (`ShortlistBoard.tsx:145-152`) | **Find trending videos** → Find ideas (works today) |
| Review | "Nothing to review" | **Back to Plans** (today there's only a small back link, see gap G9) |
| Brief | The form, memory empty ("No decisions yet") | none needed |

---

## 2. Path map

### 2.1 Navigation that's always there

| From anywhere | Goes to |
|---|---|
| Client switcher → **All clients** | All clients → Home |
| Client switcher → a client | That client → Find ideas |
| Client switcher → **Add client** | Add client form |
| Sidebar (in a client): **Home · Find ideas · Plans · Brief** | That tab. Plans stays highlighted on the board, a plan and Review. |
| Sidebar (All clients): **Home** | All clients Home. (Undecided later: Approvals queue, Clients list, Agency settings.) |
| Sign out (sidebar foot) | Log-in form |

### 2.2 Page by page: main buttons and where they go

| Page | Button / link | Goes to | Status today |
|---|---|---|---|
| **All clients Home** | Client name | Client → Find ideas | Goes to client Home (`OverviewScreen.tsx:115`) |
| | "N waiting" pill | That client → **Review** (back returns to All clients) | Goes to Plans, not scrolled to Waiting (`App.tsx:456`) |
| | "Find ideas" (row button) | Client → Find ideas. Change to **"Home"** so the row offers analytics, since the name already opens Find ideas | Works, but duplicates the name once the rule changes |
| | + Add client | Add client form | Works |
| **Add client** | Save and find ideas | New client → Find ideas | Goes to Home (`App.tsx:444` → `setWorkspace` → `'home'`) |
| | Cancel | Previous page | Goes to client Home or All clients (`App.tsx:445`) |
| **Find ideas (search)** | Search | Results | Works |
| | "← Back to results for …" | Results | Works, but shows the **previous client's** search after switching (gap G7) |
| **Results** | Add to shortlist (best video, tile, panel) | Stays on results; tray counts up | Works |
| | Open plan (on a shortlisted video) | That plan; Back returns to results | Works |
| | Tray: "Go to shortlist" | Plans | Works; wording should say **Plans** (`ResultsScreen.tsx:339-341`) |
| | Tile → breakdown panel | Panel over results | Works |
| **Client Home** | Pipeline stage chips | Plans, scrolled to that stage | Works (`ClientHome.tsx:169-178`) |
| | Approve (on a waiting plan) | Approves in place, stays on Home | Works (`HomeCards.tsx:209-215`) |
| | Review N | Review; **back returns to Home** | Back goes to Plans (`App.tsx:611`) |
| | Plan name | That plan; back returns to Home | Works (back label "home") |
| | Edit brief | Brief | Works |
| | Find ideas (empty states) | Find ideas | Works |
| | Search bar | **Remove**: Home has no search bar | Still there (`App.tsx:474-496`, `ClientHome.tsx:198`); Home agent is rebuilding |
| **Plans (board)** | Open plan | That plan; back returns to Plans | Works |
| | Add suggested shots / Send N for approval | Moves ready ideas to Waiting | Works |
| | Review N | Review; back returns to Plans | Works |
| | Find trending videos (empty) | Find ideas | Works |
| **One plan** | Saved: Send for approval | Waiting (stays on plan) | Works |
| | Saved: Save for later | Back to where you came from | Works |
| | Waiting: **Approve / Approve with changes / Send back** | Decision recorded, stays on plan | **Missing**: you can only "Take it back" (gap G4) |
| | Waiting: "Open Plans" (link) and "Take it back" | Plans / back to Saved | Built 2 Nov |
| | Approved: Copy brief for editor | Copies text | Works |
| | Approved: Edit (confirm) | Back to Waiting, editable | Works |
| | Sent back: fix shots, Send again | Waiting | Works |
| | Any: "Plan another video" / "Find another idea" | Find ideas (clean search) | Works |
| **Review** | Approve / with changes / Send back (swipe or buttons) | Next card | Works |
| | ← Back | Where you came from (Plans, Home or All clients) | Always Plans (`ReviewScreen.tsx:107-108`) |
| | All done | **Back to Plans** + **Next client with plans waiting** (when there is one) | No buttons (`ReviewScreen.tsx:124-129`) |
| **Brief** | (form saves as you type) | none | Works |

### 2.3 Journeys end to end

**A. Find an idea → ready to film** (one client)

| # | Where | Action | Result |
|---|---|---|---|
| 1 | Log in | Log in | Last client → Find ideas (first time: All clients Home → pick client → Find ideas) |
| 2 | Find ideas | Type "tofu", search | Results |
| 3 | Results | Add to shortlist ×3 | Tray: "3 shortlisted for Evergreen" |
| 4 | Results tray | Open Plans | Plans board, 3 in Shortlisted |
| 5 | Plans | Add suggested shots (or open each plan and write them) | Every card has shots |
| 6 | Plans | Set due date, Send 3 for approval | 3 move to Waiting for approval |
| 7 | Plans | Review 3 | Review |
| 8 | Review | Approve ×3 | "All done" → Back to Plans |
| 9 | Plans | Open an approved plan → Copy brief for editor | Ready to film |

Clicks today: about the same. Only step 8 has a gap (no button on "All done").

**B. Fix a sent-back plan**

| # | Where | Action | Result |
|---|---|---|---|
| 1 | Client Home (or Plans) | "Sent back to fix" → plan name | The plan, with the manager's reason and per-shot comments |
| 2 | Plan | Edit shots or note | Saves as you type |
| 3 | Plan | Send for approval | Waiting |
| 4 | Plan | **Approve** right there (you're the manager) | Approved. Today you must go to Plans → Review instead (gap G4). |

Alternative: from the sent-back plan, "Find another idea" → Find ideas, leaving the plan in Sent back.

**C. Manager clears approvals across several clients**

| # | Where | Action | Result |
|---|---|---|---|
| 1 | All clients Home | See "Evergreen: 3 waiting", "Club X: 2 waiting" | |
| 2 | All clients Home | Click "3 waiting" on Evergreen | Evergreen → Review |
| 3 | Review | Approve / send back ×3 | All done: **"Next: Club X (2 waiting)"** |
| 4 | Review | Next | Club X → Review (switches client) |
| 5 | Review | Decide ×2 | All done: "Back to All clients" |

Today: All clients → pill → Plans board → Review N → decide → "All done" with no button → back link → Plans → switcher → All clients → next pill. About 5 clicks of navigation per client instead of 1. A full cross-client Approvals queue is undecided; the "Next client" button gets most of the benefit without a new page.

---

## 3. Gaps in the current code vs this spec

**Phase 2 status (2 Nov):** G1–G15 and G17 are fixed in the files the flow lead owns. Left: G16 is half done (Find ideas now counts approved videos, but `SearchScreen.tsx` still says "videos planned"; the copy editor owns that file). G18 stays for later, by decision.

Most important first (as found on 1 Nov).

| # | Problem | Where | Fix |
|---|---|---|---|
| G1 | **Log-in always opens All clients.** A returning user loses their place. | `App.tsx:403-407` (`setWorkspace('all')`) | Apply the 1.1 rule using a new stored "last client". |
| G2 | **Picking a client opens Home, not Find ideas.** Same for a new client and a page refresh. | `App.tsx:114-115` (`setWorkspace`), `App.tsx:52` (first view), `OverviewScreen.tsx:115` | Client → `'search'`. |
| G3 | **Can't tell first-ever log-in from returning.** The workspace value defaults to the first sample client and is overwritten with `'all'` at every log-in. | `App.tsx:51`, `App.tsx:406` | Separate stored key, default empty. |
| G4 | **A waiting plan can't be approved from its own page.** You're the only approver, but the plan page only offers "Take it back", "See sent ideas" and "Plan another". Home approves inline, Review approves, the plan page doesn't. | `PlanScreen.tsx:350-368` | Add Approve / Approve with changes / Send back to the waiting plan's bar, using the same `decide` handler. |
| G5 | **Review always goes back to Plans**, even when opened from Home or (after G6) All clients. | `App.tsx:611`, `ReviewScreen.tsx:107-108` | Remember where Review was opened from; label the back link with it. |
| G6 | **"N waiting" on All clients opens the board, unscrolled.** The type even still says `'approvals'`. | `OverviewScreen.tsx:8,131`, `App.tsx:453-457` | Open that client's Review. |
| G7 | **Last search follows you to another client.** "Back to results for 'tofu'" shows on a different client's Find ideas, with results that were checked against the old client. | `App.tsx:74` (`lastSearch` is global), `SearchScreen.tsx:72-76` | Keep the last search per client, or clear it on client switch. |
| G8 | **All clients page is called "Overview"**, not Home. | `Sidebar.tsx:199`, switcher subtitle `Sidebar.tsx:103` ("Agency overview") | Label "Home". The internal view name can stay `overview`. |
| G9 | **Review "All done" is a dead end.** Only a small back link at the top. | `ReviewScreen.tsx:124-129` | Buttons: Back to (origin), Next client with plans waiting. |
| G10 | **Talking to yourself.** You are the manager, but screens say "This is what Annie sees. In the real app, it opens on Annie's phone", "Sent to Annie for approval", "Annie's answer will show up in the Shortlist". | `ReviewScreen.tsx:110-114`, `PlanScreen.tsx:121-125`, `PlanScreen.tsx:23` | Plain status words: "Waiting for approval". Drop the phone banner. "Shortlist" → "Plans". |
| G11 | **Home still has a search bar.** | `App.tsx:474-496`, `ClientHome.tsx:198` | Remove (Home agent's job; I'll remove the `search` prop wiring in App). |
| G12 | **Cancel on Add client jumps to Home/All clients**, not back where you were. | `App.tsx:445` | Return to the previous view. |
| G13 | **Missing client opens a different client silently.** If the stored id isn't found, the app shows `clients[0]` under the wrong name in the switcher. | `App.tsx:109` | If not found, go to All clients. |
| G14 | **Blank page if a plan can't be found** (e.g. after switching live/sample mode while on a plan). | `App.tsx:620` (renders nothing if `planIdea` is missing) | Fall back to Plans. |
| G15 | **Sign out shows the marketing landing page**, so getting back in takes an extra click. | `LoginScreen.tsx:18` (always starts at `'landing'`) | Start at the log-in form after a sign-out. |
| G16 | **Two different progress numbers.** Home and Plans count *approved*; Find ideas counts *waiting + approved* as "planned". | `App.tsx:527` vs `ClientHome.tsx:87`, `ShortlistBoard.tsx:42` | Use approved everywhere (Q8). |
| G17 | **Old wording.** "Go to shortlist", "See sent ideas", "change everything later in client settings". | `ResultsScreen.tsx:340`, `PlanScreen.tsx:358-360`, `AddClientScreen.tsx:81` | "Open Plans", "Open Plans", "in the Brief". |
| G18 | **Browser Back leaves the app.** No page addresses, so Back/Forward and links don't work. | `App.tsx` (view is plain state) | Out of scope for phase 2 (Q5). |

Not a problem: Plans empty state, Brief, Results "no matches" state, breakdown panel, plan "Back to …" labels, sidebar Plans badge (counts waiting + sent back, `App.tsx:392`).

---

## 4. Code changes for phase 2 (navigation only)

I'll do these after the Home and Find ideas agents finish, so App.tsx doesn't collide. Line numbers as of 1 Nov.

### App.tsx

| # | Change | Lines |
|---|---|---|
| A1 | Add `const [lastClient, setLastClient] = useStored<string \| null>('remake.last-client.v1', null)`. | near 51 |
| A2 | One helper `enterClient(id, to: View = 'search')`: set workspace, close the breakdown panel, set view, save `lastClient`. Use it everywhere a client is entered (switcher, All clients rows, Add client, log-in, Review "Next client"). | new, replaces 111-116 |
| A3 | `setWorkspace('all')` → All clients Home; does **not** clear `lastClient`. | 111-116 |
| A4 | Log-in: if `lastClient` exists and is in `clients` → `enterClient(lastClient)`; else All clients. Always `setRole('manager')` (already done in LoginScreen). | 403-407 |
| A5 | First view after a refresh: keep the current tab (store view in `sessionStorage`, key `remake.view.v1`), fallback `'search'` in a client and `'overview'` in All clients. Plan and Review fall back to Plans since their ids aren't stored. | 52 |
| A6 | If `workspace` isn't `'all'` and isn't found in `clients`, switch to All clients (effect), instead of `?? clients[0]`. | 109 |
| A7 | `lastSearch` per client: `Record<clientId, string>`, or clear it in `enterClient`. | 74, 161, 194, 529 |
| A8 | All clients `onOpen`: use `enterClient`; map `'search'` → Find ideas, `'home'` → Home, `'review'` → Review with origin `'overview'`. Stop calling `setWorkspaceRaw` directly. | 453-457 |
| A9 | Add `reviewFrom: View` state. Set it when Review opens (Home 504, Plans 598, All clients). `onBack` → `reviewFrom` (or All clients). Pass a back label. | 504, 598, 604-613 |
| A10 | Pass `nextClientWaiting` (first other client with waiting plans, name + count) and `onNextClient` to ReviewScreen. | 604-613 |
| A11 | Add `addFrom: View` state; Add client Cancel → `addFrom`. `onCreated` → `enterClient(id)`. | 426, 441-447, 458 |
| A12 | Sign out: keep `lastClient`; tell LoginScreen to open on the form (`startOn="login"`). | 425, 403 |
| A13 | PlanScreen gets `onDecide={(d) => decide(planIdea.id, d)}`. | 620-633 |
| A14 | If `view === 'plan'` and the plan isn't found, show Plans. | 620 |
| A15 | Remove the `search={<SearchBox …/>}` prop from ClientHome (coordinate with the Home agent). | 474-496 |
| A16 | Find ideas progress: count approved only (if Q8 agreed). | 527 |

### Sidebar.tsx

| # | Change | Lines |
|---|---|---|
| S1 | All clients item label "Overview" → **"Home"** (icon `home`; view id stays `overview`). | 199 |
| S2 | Hint → "Pick a client to find ideas for them." | 200 |
| S3 | Switcher "All clients" subtitle "Agency overview" → "Every client at a glance". | 103 |
| S4 | Optional: badge on All clients Home = plans waiting across all clients. | 199, Props `counts` |

### Other screens

| File | Change | Lines |
|---|---|---|
| `OverviewScreen.tsx` | `onOpen` type → `'home' \| 'review' \| 'search'`; name → `'search'`; "N waiting" → `'review'`; row button "Find ideas" → **"Home"** (`'home'`). | 8, 115, 131, 148-150 |
| `ReviewScreen.tsx` | Props `backLabel`, `nextClient?: { name; waiting }`, `onNextClient`. Back link uses `backLabel`. Drop the "This is what Annie sees…" banner for the manager. "All done" gets buttons: Back to {origin}, Next: {client} ({n} waiting). | 15, 107-114, 124-129 |
| `PlanScreen.tsx` | New prop `onDecide`. Waiting bar: Approve, Approve with changes (needs comment), Send back (needs reason), plus "Take it back". Banner and status: "Waiting for approval" instead of "Sent to {manager}"; "Shortlist" → "Plans". "See sent ideas" → "Open Plans". | 7-19, 21-26, 115-128, 350-368 |
| `LoginScreen.tsx` | Prop `startOn?: 'landing' \| 'login'` for the initial `mode`. | 5-7, 18 |
| `AddClientScreen.tsx` | "client settings" → "the Brief". | 81 |
| `ResultsScreen.tsx` | Tray button "Go to shortlist" → "Open Plans". Prop rename `onGoShortlist` → `onOpenPlans` (optional). | 339-341 |

### Test checklist for phase 2

1. Fresh browser (clear storage) → landing → log in → All clients Home.
2. Pick Evergreen → Find ideas. Sign out → log-in form → log in → Evergreen Find ideas.
3. Add client "Mia's Bakery" → Find ideas for Mia's. Cancel from inside a Plans page → back on Plans.
4. Refresh on Plans → still Plans.
5. Search "tofu" on Evergreen, switch to Mia's → no "Back to results for tofu".
6. Journey A, B, C from 2.3 with no dead end; Review back returns to its origin each time.
7. Delete the remembered client from storage → log in → All clients Home, no wrong client shown.
8. Phone width (390px): sidebar closes after every pick.

---

## 5. Founder answers (2 Nov 2026)

All recommendations accepted. Recorded in `docs/decision-log.md` (2 Nov 2026).

| # | Question | Answer |
|---|---|---|
| Q1 | Refresh: same tab or Find ideas? | Same client and tab. |
| Q2 | Keep the Waiting step? | Yes, plus Approve / Approve with changes / Send back on a waiting plan's own page (reusing App's `decide`). |
| Q3 | "N waiting" on All clients Home | Opens that client's Review. "All done" offers "Next client with plans waiting" and "Back to Plans". |
| Q4 | After sign out | Log-in form. |
| Q5 | Page addresses / browser Back | Later. Not built. |
| Q6 | Last search when switching clients | Kept per client. |
| Q7 | Decision log | New 2 Nov entry added; the 1 Nov line marked replaced. `client-workspace-nav.md` and `remake-flow-plan.md` (main checkout) still say "opens on Home" and need a note. |
| Q8 | Progress number | Videos approved, everywhere. |
| Q9 | After adding a client | Find ideas. |
| Q10 | All clients row button | "Home", opens that client's Home. The client name opens Find ideas. |

Out of scope here (undecided, not designed): All-clients Approvals queue, Clients list and Agency settings tabs; analytics depth on either Home; "send to client" and the client view (`ClientPortal.tsx`, not wired up).
