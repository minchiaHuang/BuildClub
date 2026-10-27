# AGENTS.md

Working rules for AI tools in the BuildClub repo. `CLAUDE.md` holds the general repo rules (where files go, git); this file holds the rules for the current product, Trend Finder.

## Start here

1. `PROJECT_CONTEXT.md` — what the product is.
2. `docs/STATUS.md` — where the work stands; it outranks older notes.
3. `bash bin/verify.sh` — must be green before you change anything.
4. PRD (scope, API, timeline): https://claude.ai/artifact/MoURLkE4hAGvKHWu3kZskD

## Where to edit

`~/Desktop/BuildClub` is the main checkout; a hook blocks edits there. Work in an Orca worktree (`orca worktree create --repo path:/Users/tommy/Desktop/BuildClub ...`), then rename its branch to `<type>/<description>`. In a new worktree, link the ignored files instead of reinstalling:
`ln -s ~/Desktop/BuildClub/pivots/02-content/app/trend-finder/backend/.venv` and the same for `.env`.

## Trend Finder (`pivots/02-content/app/trend-finder`)

- **Product rule:** AI explains why real videos went viral. It never writes scripts or generates content.
- **Backend:** Python only (FastAPI + uvicorn) in `backend/`, port 8787.
  Run from `trend-finder/`: `backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload`
- **API contract:** the Pydantic models in `backend/models.py` are the single source of truth; `http://localhost:8787/docs` shows them. Keep route paths and response shapes compatible with `src/lib/live.ts`.
- **Front end** (`src/`) belongs to Veralyn. Backend wiring changes only `src/lib/live.ts` and `src/App.tsx`, goes in a PR for her review, and leaves components alone.
- `server/index.mjs` is the old Node API. Keep it until the Python backend matches it, then delete.

## Paid APIs

- Apify and Claude cost money. Before each paid run, state the cost and cap, and wait for a yes.
- Apify cost is held by `maxItems` (30 results, about US$0.05). The `maxTotalChargeUsd` cap is US$0.50, the lowest Apify accepts.
- A live search takes about 3.5 minutes. Repeat searches come from `backend/cache/` for free; `backend/server.py pin "<search>"` keeps one for offline demos.

## Secrets

Never read `.env`. Check whether a key is filled with `grep -cE '^KEY=.+' .env`.
