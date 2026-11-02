# Decision Log

Newest first. Dates are when the decision was made (from the Miro board), except sync entries.

## 2 Nov 2026

### Decision: Remake landing rules: log-in reopens the last client on Find ideas; picking a client opens Find ideas
- **Log-in:** the first log-in in a browser (or when the remembered client no longer exists) opens **All clients → Home**. A returning log-in opens the **last client worked on, on Find ideas**.
- **Picking a client** (switcher, client name on All clients Home, a newly added client) opens **Find ideas**. The client's Home (analytics, no search bar) is one click away. On All clients Home, each row's "Home" button opens that client's Home, and "N waiting" opens that client's Review.
- The All-clients sidebar item is called **Home** (was Overview). A client's tabs stay Home · Find ideas · Plans · Brief.
- **Single approver:** the signed-in user is the manager. A plan waiting for approval can be approved, approved with changes or sent back from its own page, as well as from Home and Review. Review's "All done" offers "Next client with plans waiting" and "Back to Plans".
- A **refresh** keeps the same client and tab. The **last search is kept per client**. **Sign out** returns to the log-in form, not the landing page. The progress number everywhere is **videos approved** this month.
- Later, not built: page addresses (browser Back and shareable links).

**Why:** Founder decisions, 2 Nov 2026, answering the questions in `pivots/02-content/docs/app-flow.md` section 5. Search is the main daily job, so it comes first; returning users shouldn't lose their place.

**Status:** Current. Built on `feature/client-dashboard` (not committed yet). Replaces the "a client opens on Home" line of the 1 Nov entry below, and the earlier "after log-in, land on the all-clients overview" rule (`remake-flow-plan.md`, stream A).

## 1 Nov 2026

### Decision: Remake client workspace = Home · Find ideas · Plans · Brief; a client opens on Home; one approver
- The sidebar for one client is now **Home** (new card dashboard: what to film next, needs action, pipeline, trending, brief and memory, recent activity), **Find ideas** (was Search + results), **Plans** (was Shortlist; the board, Review and each plan in one place, with Review as a batch mode started from Plans or Home, not a tab) and **Brief** (was Client settings; client memory sits beside the can't-film list). The All-clients sidebar (Overview) is unchanged.
- ~~Picking a client (switcher, overview client name, new client) lands on **Home**, not Search.~~ **Replaced 2 Nov 2026:** picking a client opens Find ideas (see the 2 Nov entry above).
- For the demo there is a **single approver**: the signed-in user is always the manager, so Home shows plans waiting for approval with Approve and Review right there. Pipeline stages are Shortlisted → Waiting for approval → Approved, plus Sent back. No "sent to client" stage.

**Why:** Founder decision, 1 Nov 2026, from `pivots/02-content/docs/client-workspace-nav.md` and `pivots/02-content/research/client-dashboard-ui-patterns.md`. Landing on Search hid where a client stands; the agency's top pain is losing track of how many videos each client still needs (one agency, Mercif; directional evidence only).

**Status:** Partly replaced on 2 Nov 2026 (where a client opens, and log-in). The tabs and the single approver still stand. A "Client view" tab and a "sent to client" stage stay out until sending plans to clients exists.

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
