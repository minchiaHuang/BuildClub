# MVP Scope

_Updated 4 Oct 2026 from the Miro boards. Details of each step are in `PRD.md`._

## Goal
Build a simple AI search visibility tool that helps agencies show their clients whether they appear in AI recommendations, why not, and what to change.

## Primary User
Sydney digital marketing agencies with 1–50 staff, running Recite for their clients.

## Core Problem
Businesses do not know why AI tools recommend competitors instead of them.

## MVP Must Have
- Enter a website; config drafted automatically, reviewed by a human
- 3 personas × 12 questions, mixed intents and wording
- Run on ChatGPT web, several runs per question
- Mention rate with error ranges; non-answers excluded
- Competitor list built automatically from the answers
- Gap analysis: cited sites, directories, question coverage
- 3–5 recommendations, each traced to an answer or citation
- Local web app: URL → review questions → run → report → download HTML

## Pass Criteria (target Sun 4 Oct)
- [ ] All 6 steps run start to finish with no manual help
- [ ] Every recommendation points back to a specific answer or citation
- [ ] Runs on a second company

_Status of these on 4 Oct is not recorded on the board yet._

## Not in MVP
- Automatic website changes or content publishing
- Browser extension
- Complex dashboards
- Full enterprise account system
- Team collaboration
- A second AI engine (Perplexity / Gemini / Google AI Overviews) — later
- Comparison against Gumshoe — later
- Claims that personas get different results
- Revenue attribution
- Hosted / public deployment (web app is local only)

## Answered Questions
| Question | Answer |
|---|---|
| Which AI platforms first? | ChatGPT web only |
| How many personas? | 3 |
| How many queries? | 12 per persona (~108 answers per report with re-runs) |
| How to score visibility? | Mention rate with Wilson interval; non-answers excluded; 4-level recommendation strength as an extra |
| What evidence supports recommendations? | A specific answer to a specific question, or a cited website |
| How should personas affect queries? | Only through question wording (Option A); intent matters more |

## Open Questions
- How to define and group "use cases" (intent labels not yet saved in config)
- Make "search area" the report's focus? (Eventus was only recommended for questions with a suburb name, 8 of 9)
- Which agencies to test first, and is anyone willing to try it?
- How specific should recommendations be? (e.g. "get listed on the Semrush directory")
- Who reads the report: the agency or its clients?
- Should clients write personas, or generate them from the website? (now: auto-drafted, client edits)
- Is white-label needed? (left open until interviews)
- Add 1–2 often-recommended companies as controls to check measurement?
- Make `discover --jev` the default? (compare in another industry first)
