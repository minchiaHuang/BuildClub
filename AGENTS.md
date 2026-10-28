# AGENTS.md

Working rules for AI tools in the BuildClub repo. `CLAUDE.md` holds the general repo rules (where files go, git); this file holds the rules for the current product, Trend Finder.

## Start here

1. `PROJECT_CONTEXT.md` — what the product is.
2. `docs/STATUS.md` — where the work stands; it outranks older notes.
3. `bash bin/verify.sh` — must be green before you change anything.
4. `docs/PRD.md` — scope, API and timeline; it is the source of truth. The cloud copy (https://claude.ai/artifact/MoURLkE4hAGvKHWu3kZskD) is only a 2026-10-27 snapshot.

## Where to edit

`~/Desktop/BuildClub` is the main checkout; a hook blocks edits there. Work in an Orca worktree (`orca worktree create --repo path:/Users/tommy/Desktop/BuildClub ...`), then rename its branch to `<type>/<description>`. In a new worktree, link the ignored files instead of reinstalling:
`ln -s ~/Desktop/BuildClub/pivots/02-content/app/trend-finder/backend/.venv` and the same for `.env`.

## Trend Finder (`pivots/02-content/app/trend-finder`)

- **Product rule:** AI explains why real videos went viral. It never writes scripts or generates content.
- **Backend:** Python only (FastAPI + uvicorn) in `backend/`, port 8787.
  Run from `trend-finder/`: `backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload`
- **API contract:** the Pydantic models in `backend/models.py` are the single source of truth; `http://localhost:8787/docs` shows them. Keep route paths and response shapes compatible with `src/lib/live.ts`.
- **Front end** (`src/`) belongs to Veralyn. Backend wiring changes `src/lib/live.ts` and `src/App.tsx`. Since 2026-10-29 (user decision) components may change too when a feature needs it (full-backend-coverage plan); all front-end changes go in a PR for her review.
- The old Node API (`server/index.mjs`) has been removed; the Python backend is the only API.

## Paid APIs

- Apify and Claude cost money. Before each paid run, state the cost and cap, and wait for a yes.
- Apify cost is held by per-run caps (`MAX_USD_PER_SEARCH` 0.50, `MAX_USD_PER_MEDIANS` 0.60) and the daily caps `DAILY_APIFY_USD` (2.00) and `DAILY_CLAUDE_USD`. Roughly: a TikTok search is about US$0.11; a brand-new TikTok search with scores is about US$0.45; an AI breakdown is about US$0.08 the first time.
- A new live search takes about a minute; scores fill in afterwards in the background. Repeat searches come from `backend/cache/` for free (24 hours); `backend/server.py pin "<search>"` keeps one for offline demos.
- For UI checks that must not spend money, use `bash bin/isolated-backend.sh <port>` (ports 8797–8799).

## Secrets

Never read `.env`. Check whether a key is filled with `grep -cE '^KEY=.+' .env`.
