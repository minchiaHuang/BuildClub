# Trend Finder

Clickable prototype of the trending-video research tool for agencies. Built for Daphne at Mercif (design partner) and the hackathon. Plan: `../../research/hackathon-plan-trend-tool.md`.

The app runs in two modes:

- **Live mode** (the Python backend is running): real searches, real AI breakdowns, and clients, saved ideas, plans and accounts stored in the backend's SQLite database. The sidebar shows **Live TikTok data**.
- **Sample mode** (no backend): a clickable prototype on made-up data. Every account, number and caption in `src/data/sample.ts` is invented, and the "AI breakdown" text is written by hand per format.

Spec, scope and API table: [`docs/PRD.md`](../../../../docs/PRD.md). Current status: [`docs/STATUS.md`](../../../../docs/STATUS.md).

## Run it

Front end only (sample mode):

```bash
npm install
npm run dev
```

With the backend (live mode):

1. Create `backend/.venv` from `backend/requirements.txt`.
2. Copy `.env.example` to `.env` and fill in `APIFY_TOKEN=` (from [apify.com](https://apify.com) Console, Settings, API & Integrations) and `ANTHROPIC_API_KEY=`. `.env` is git-ignored. Never commit it.
3. Start the API from this folder (default port 8787):

   ```bash
   backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload
   ```

4. In a second terminal run `npm run dev`; Vite forwards `/api/*` to port 8787. `http://localhost:8787/docs` lists every route.

To check the UI without spending any money, use the zero-cost throwaway backend. It needs a built `dist/` (`npm run build`), copies the backend to a temp folder with no `.env`, a dummy token and all daily budgets at 0, and serves the built app:

```bash
bash bin/isolated-backend.sh 8797      # from the repo root; optional 2nd arg: a jobs/ folder to copy
```

Use ports 8797–8799 (the script refuses 8787 and 5195). Add `--demo-data` for sample searches and `--user email:password` to start with an account. Stop it with Ctrl-C; the temp copy is removed.

## How live search works

- The browser calls `/api/search`. The API calls Apify actors (TikTok `clockworks/tiktok-scraper`; Instagram, YouTube, Reddit and X are also supported by the backend via `?platform=`) with your token, so the token never reaches the browser.
- Each TikTok search fetches up to 30 videos. A brand-new search takes about a minute; the author medians are filled in afterwards in the background. Results are cached in `backend/cache/` for 24 hours (`CACHE_HOURS`), so repeats within a day are free; `fresh=1` forces a new search. The cache is git-ignored. `backend/server.py pin "<search>"` keeps a search permanently for offline demos.
- **Score in live mode** = views / the account's usual views (median of its latest 6 videos, reused for 30 days), for the top 15 accounts of each TikTok search. Accounts with fewer than 5 videos fall back to views / followers.
- **Cost** (Apify prices checked 28 Oct 2026): a TikTok search is about US$0.11, and the scores for 15 authors add about US$0.34, so a brand-new TikTok search with scores is about US$0.45. Claude breakdowns cost about US$0.08 the first time you save or plan a video; repeats come from the cache. Daily caps are `DAILY_APIFY_USD` and `DAILY_CLAUDE_USD`; with `DAILY_APIFY_USD=0` only cached and pinned searches work (this is how Daphne's copy on port 8787 runs).
- **Also live:** paste a video link, attach or paste a screenshot, and written answers to questions (Ask). Each is a small Claude call (about US$0.01-0.02), cached after the first time. See the scope table in `docs/PRD.md` for anything still missing.
- Live results only use public data. Check each platform's and Apify's terms before using this beyond internal testing.

Clients for testing: **Evergreen Foods** and **MYST Nightclub Sydney**, each with starter searches (edit in Client settings, or `examples` in `src/data/sample.ts`).

## App layout (agency workspace)

Laid out like an agency platform (e.g. GoHighLevel):

- **Sign-in:** with the backend running, you sign in with an account (see Accounts below). Without the backend, "Continue as demo agency" enters the sample mode as **Sample Social Co.** Sign out from the bottom of the sidebar.
- **Left sidebar** with a **client switcher** at the top: "All clients" (agency view) or one client. "Add client" creates a real client.
- **All clients → Overview:** every client's videos posted this month vs monthly target, how many are waiting for approval, and the next due date.
- **Inside a client:** Search, Saved ideas, Approvals, Plans, Client settings. Saving, the "Can they film this?" check and plans all use the selected client.
- **Client settings:** name, what they sell, audience, videos per month, and what the client can't do (feeds the film check).
- On phones the sidebar opens from a ☰ menu button.

In live mode, clients, saved ideas and plans live on the server (SQLite `data.db`), so they follow the account to any device. In sample mode they are kept in the browser (localStorage) and the app starts with a few sample saved ideas (`sampleIdeas` in `src/data/sample.ts`).

## Screens

1. **Search**: one box for a niche, a sentence or a question. Under it, "Trending now" chips (Early and Rising formats only), or the client's "Starter searches" when nothing is trending.
2. **Results**: "Searching for" chips show what we understood from the text. Remove a chip to widen the search. Questions also get a short written answer. Then:
   - **Best to copy**: the top-scoring video whose format is Early or Rising, not already sent or approved, and filmable by this client (falls back to the top score). Shows the format's stage as a badge.
   - **Formats in these results**: filter chips with each format's stage and account count.
   - **All videos**, sortable by outlier score, views ÷ followers, newest or fastest growing.
3. **Video breakdown** (drawer): the metrics, "Can this client film it?", why it worked. Save to client or plan it.
4. **Plan**: editable shots and a note to Annie, then "Send to Annie for approval". Back returns to the screen the plan was opened from.
5. **Approvals**: what's waiting and what's decided. **Review as Annie** opens a phone-sized preview where Annie approves or sends back with a reason. Annie needs no login: **Copy link** gives her a private page (`/review/<token>`) that shows only that client's waiting ideas; **Turn off** kills the link.
6. **After approval**: the plan shows the due date, props and editor notes, and **Copy brief for editor** copies everything the editor needs. Approved plans are listed under **Plans**, soonest due first.

In sample mode, saved ideas are kept in the browser (localStorage); clear site data to reset.

## How the numbers work

In `src/lib/metrics.ts`:

- **Outlier score** = views ÷ the account's usual (median) views
- **Views ÷ followers**: Daphne's "1-to-10" rule
- **Shares + saves per 100 views**
- **Growth** = views ÷ days since posted
- **Format stage**, from how many TikTok accounts used the format and how recently:
  - One-off: fewer than 3 accounts
  - Peaked: no new posts in the last 2 weeks
  - Early: 3–4 accounts, all posted in the last 2 weeks
  - Rising: 5+ accounts, still getting new posts

## How search understands sentences

`src/lib/parseQuery.ts` uses simple rules for now (no AI call):

- **Time:** "this week" → 7 days, "this month" / "lately" → 30, "3 months" → 90
- **Platform:** "TikTok" (Instagram is parked for now)
- **Length:** "short" → under 15 sec, "under 30 seconds", "under a minute"
- **Audience:** mums, students, families, professionals, health / gym. Matched against each format's `audiences`
- **Format:** words in each format's `tags` (e.g. "dessert", "taste test", "crispy")
- **Question:** ends with "?" or starts with why / what / how / is / should… → shows an answer box

- **Video link or screenshot:** paste a TikTok link, or attach or paste a screenshot (paperclip button or Ctrl/Cmd+V). This switches to **"Find more like this"**: the real video (or the screenshot) is read by Claude, which says which format it matches, whether it's worth copying (Early / Rising / Peaked) and why it works, then searches for more videos like it. In sample mode this is a mock: the format is guessed from words in the link or file name.

Whatever's left (minus filler words) becomes the keywords.

**Suggestions while typing** (`src/lib/suggest.ts`): chips pop up under the search box as she types.

- **Narrow it down:** after a niche ("tofu"), chips offer the formats that exist for it (most promising first), an audience, "this week", "on TikTok" and "under 30 sec". A half-typed word gets finished ("tofu des" → "desserts"). Picking one adds it to the box.
- **Ask:** once she starts with why / what / is / how…, chips become full questions built from the formats that exist ("why are tofu desserts trending?"). Picking one runs the search.
- ↓ moves from the box into the chips, ← / → move between them, Esc or ↑ goes back. An empty box shows the "Try:" examples instead. `src/lib/answer.ts` writes the answer from templates. Both can be swapped for an AI call that returns the same shape.

## Accounts

Create accounts on the server; the password is asked twice and stored as a scrypt hash:

```bash
backend/.venv/bin/python backend/server.py add-user <email> "<name>" "<agency>"
# or, for scripts: echo "$PW" | backend/.venv/bin/python backend/server.py add-user <email> "<name>" "<agency>" --password-stdin
```

- Once any account exists, the shared `APP_PASSWORD` is no longer used; everyone signs in with an account. Annie's review link never needs a password.
- With no accounts but `APP_PASSWORD` set, the browser asks for the shared password, and that includes Annie's review link.
- **Rollout order:** switch port 8787 to the new front-end build (`npm run build`) first, then create the first account. The old front end has no sign-in screen, so it gets 401 on every call once an account exists.

## Swapping in real videos

Replace the `videos` array in `src/data/sample.ts`. Each video needs:

`id, platform, handle, hook, views, followers, medianViews, daysAgo, lengthSec, shares, saves (null on Instagram), formatId`

Each `formatId` must match a format in the `formats` array. Formats hold the "why it worked" notes, shot list, props and what you need to film.

## Next

- Real data source (third-party API). Check cost and platform terms first.
- Real AI breakdown from key frames + transcript.
