# Build Club Project Context

_Snapshot synced from the Miro boards on 4 Oct 2026. Product status reflects the board as of 2 Oct 2026._

## Product
**Recite** is an AI mystery shopper for AI search visibility (GEO / AEO).

It asks ChatGPT the questions a real buyer would ask, then reports:
1. Does this business show up in the answers?
2. Which competitors show up instead?
3. What should it change to get recommended?

## Problem
Businesses do not understand why AI tools recommend competitors instead of them. Existing tools show a visibility score, but not why or what to fix.

## Target Customer (ICP)
Sydney digital marketing agencies with 1–50 staff. Agencies buy Recite and run it for their clients (e.g. e-commerce, law firms, finance).

Not current focus: brands, in-house marketing teams, startups.

## How It Works (current)
1. Enter a website; Recite drafts a config and finds competitors from the AI answers
2. Generate 3 personas × 12 questions (mixed intents and wording); a human reviews them
3. Ask ChatGPT web (via Bright Data) every question, several runs each
4. Count mention rate with an error range (Wilson interval)
5. Gap analysis: cited websites, directories, question coverage
6. 3–5 recommendations, each tied to a specific answer or citation

## Key Constraints
- **Engine:** ChatGPT web only for real results. Claude API is for development tests.
- **Personas = Option A:** personas are only a way to write questions. The report shows who wins per persona but does not claim personas differ (tests did not support it).
- **Intent matters most:** what the buyer asks decides the list far more than how they phrase it or who they are.

## Current Stage
UTS Startups × Build Club 8-week AI Build Sprint. Currently W1 "Scope & Wedge" (6 Oct). W2 (12 Oct) target: working MVP a real person can use.

The working tool (CLI) and a local web page work end to end. Real runs so far: Yoghurt Digital (agency) and Eventus Financial (Sydney finance).

## Product Principles
- Keep MVP narrow
- Explain why, not just what
- Make outputs actionable and traceable to evidence
- Honest measurement: exclude non-answers, show error ranges, don't overclaim
- Focus on agencies first
- Validate before overbuilding

## Important Links
Miro (main Build Club board): https://miro.com/app/board/uXjVEffF6VU=/
Miro (Recite team overview): https://miro.com/app/board/uXjVEf96tu4=/
Figma:
GitHub:
Survey:

## Current Questions
See `docs/mvp-scope.md` → Open Questions. Biggest unknowns:
- Will agencies pay? (no first-hand demand evidence yet)
- How to define and group "use cases" in the report
- Who reads the report: the agency or its clients?
