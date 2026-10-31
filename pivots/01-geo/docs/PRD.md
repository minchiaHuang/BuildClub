# PRD: Recite

_Built from the Miro boards, 4 Oct 2026. Product status as of 2 Oct 2026. The team's original PRD (referenced on the board as "PRD section 54") is not in this repo; this document may differ from it._

## Problem
When buyers ask AI tools for recommendations, businesses don't know whether they appear, who appears instead, or why. Existing AEO tools show a visibility score but not the fix, cost US$400–600/mo, and give unstable numbers that are hard to trust or report to clients. See `research/user-research.md`.

## Users
- **Buyer:** Sydney digital marketing agencies, 1–50 staff. In a 15-agency sample, 13 sell SEO and 10 already sell AI search optimisation.
- **Subject:** the agency's clients (e-commerce, law firms, finance, etc.), whose websites are tested.

## Value Proposition
The client gives a website URL and gets back: which buyers can't find them in AI search, why, and what to change — with every recommendation traced to evidence.

## Product: the 6 steps

| # | Step | What it does |
|---|---|---|
| 1 | Enter website | `init` reads the site; Claude Haiku 4.5 drafts a config (company, service, city, personas, questions), ~US$0.01. Competitors come from the AI answers (`discover --suggest`); name variants are merged. |
| 2 | Create personas | 3 personas, 12 questions each, mixing intents and wording styles (keyword / scenario / different angle). A human reviews before running. |
| 3 | Ask AI search | ChatGPT web via Bright Data (main engine, ~80 s per answer, 5,000 free per month). Runs in parallel: 108 answers in ~30 min. Claude API is for development tests only. |
| 4 | Count mentions | Mention rate with a Wilson interval, per persona and per question. Counter-questions, login walls and non-answers are excluded from the denominator. |
| 5 | Gap analysis | Compares cited websites, directories and question coverage against competitors that get recommended. |
| 6 | Recommendations | 3–5 rule-based recommendations, each with evidence (question and count) and a confidence level. |

**Personas (Option A):** a persona is only the set of questions that kind of buyer would ask. The report lists who wins per persona but does not claim personas differ, because tests did not show differences larger than noise.

**Extras**
- Recommendation strength: Jev rates each mentioned brand on 4 levels (passing mention / one of a list / strongly recommended / top pick). In the pipeline and web page.
- Jev name judging removes non-company names from the competitor list; on by default in the pipeline.

### Example output (Yoghurt Digital, 50 ChatGPT web answers, appeared 2/50)
1. Cover the questions where you never appear: Q1, Q2, Q4, Q5, Q6 — 24 answers (high)
2. Get your own website cited: Q Agency's site cited 16 times, Sellevate 9, Click Click 6, Yoghurt 0 (high)
3. Get listed on agencies.semrush.com: cited 13 times in 43 answers that recommended a competitor but not you (high)
4. Get listed on clutch.co: 3 answers (medium)

## Interfaces
- CLI: `init → run → report → discover / gap → recommend`; `pipeline` runs all and outputs `report.md` and `report.html`
- Local web page (`serve`): URL → review questions → run → report → download HTML

## How We Know It Works (5 benches)

| Bench | Status |
|---|---|
| 1. Matches what real users see | Passed — use ChatGPT web, not the API |
| 2. Reads answers correctly | Passed — 1 difference in 350 judgments |
| 3. Numbers are stable | Passed — re-runs + Wilson intervals built in; each question needs several runs |
| 4. Agrees with existing tools (Gumshoe) | Skipped — not in MVP |
| 5. Persona differences bigger than noise | Not passed (75 API / 108 web answers) → Option A |

## Unit Economics (assumptions)
- Cost: ~US$0.18 per report (108 answers); data cost is under 1% of price
- Price assumption: A$60 per client per month, 4 clients per agency → A$2,880 per agency per year. To be replaced by sprint W5 pricing.
- Market (as of 3 Oct): TAM ≈ A$65M (22,523 agencies AU/US/NZ), SAM ≈ A$12M (~4,160 Australian agencies selling AI search or SEO), SOM ≈ A$9k ARR (2–4 paying Sydney agencies in year 1)

## Success Criteria
- MVP (target 4 Oct): 6 steps run with no manual help; every recommendation points to a specific answer or citation; works on a second company
- Sprint: first paying customer(s) by W7
