# Trend Finder (v1 front end)

Clickable prototype of the trending-video research tool for agencies. Built for Daphne at Mercif (design partner) and the hackathon. Plan: `../../research/hackathon-plan-trend-tool.md`.

**All data is sample data.** Every account, number and caption in `src/data/sample.ts` is made up. There is no backend, no scraping and no real AI call yet. The "AI breakdown" text is written by hand per format.

## Run it

```bash
npm install
npm run dev
```

Or start `trend-finder` from `pivots/02-content/.claude/launch.json` (port 5174).

## Live TikTok search

Without a key the app runs on sample tofu data. With an Apify key it searches real TikTok videos.

1. Create a free account at [apify.com](https://apify.com) and copy your API token (Console → Settings → API & Integrations).
2. Copy `.env.example` to `.env` and paste the token after `APIFY_TOKEN=`. `.env` is git-ignored.
3. Run the local API in a second terminal, next to `npm run dev`:

   ```bash
   npm run api
   ```

   It should print `live search ON`. Reload the app: the sidebar label changes to **Live TikTok data**.

How it works:

- The browser calls `/api/search`, which Vite forwards to the local API (`server/index.mjs`, port 8787). The API calls the Apify actor `clockworks/tiktok-scraper` with your token, so the token never reaches the browser.
- Each search fetches up to 30 videos (`RESULTS_PER_SEARCH`). New searches take about 20–60 seconds. Results are cached in `server/cache/` for 24 hours (`CACHE_HOURS`), so repeats are instant and free. The cache is git-ignored.
- **Cost:** Apify bills per result. The actor's page listed pricing "from $1.70 / 1,000 results" (checked 26 Oct 2026), so a 30-video search is roughly 5 cents. Check your Apify usage page.
- **Score in live mode** = views ÷ followers. We don't fetch each account's usual views yet, so this replaces the outlier score.
- **TikTok only for now.** Instagram is parked: its sample rows stay in `src/data/sample.ts` but aren't shown.
- **What's not live yet:** link/screenshot search, the "Ask" answers and the AI shot lists. Live videos show what TikTok gives us (caption, sound, hashtags) and link to the video.
- Live results only use public TikTok data. Check TikTok's and Apify's terms before using this beyond internal testing.

Clients for testing: **Evergreen Foods** and **MYST Nightclub Sydney**, each with starter searches (edit in Client settings, or `examples` in `src/data/sample.ts`).

## App layout (agency workspace)

Laid out like an agency platform (e.g. GoHighLevel):

- **Sign-in (mock):** "Continue as demo agency" enters as **Sample Social Co.** (a made-up agency). No account or password is checked or stored. Sign out from the bottom of the sidebar.
- **Left sidebar** with a **client switcher** at the top: "All clients" (agency view) or one client. "Add client" is a placeholder.
- **All clients → Overview:** every client's videos approved vs monthly target, how many are waiting for approval, and the next due date.
- **Inside a client:** Search, Saved ideas, Approvals, Plans, Client settings. Saving, the "Can they film this?" check and plans all use the selected client.
- **Client settings:** name, what they sell, audience, videos per month, and what the client can't do (feeds the film check).
- On phones the sidebar opens from a ☰ menu button.

Clients, saved ideas, the selected client and sign-in are kept in the browser (localStorage). The app starts with a few **sample saved ideas** (`sampleIdeas` in `src/data/sample.ts`) so the overview, approvals and plans aren't empty.

## Screens

1. **Search**: one box for a niche, a sentence or a question. Under it, "Trending now" chips (Early and Rising formats only), or the client's "Starter searches" when nothing is trending.
2. **Results**: "Searching for" chips show what we understood from the text. Remove a chip to widen the search. Questions also get a short written answer. Then:
   - **Best to copy**: the top-scoring video whose format is Early or Rising, not already sent or approved, and filmable by this client (falls back to the top score). Shows the format's stage as a badge.
   - **Formats in these results**: filter chips with each format's stage and account count.
   - **All videos**, sortable by outlier score, views ÷ followers, newest or fastest growing.
3. **Video breakdown** (drawer): the metrics, "Can this client film it?", why it worked. Save to client or plan it.
4. **Plan**: editable shots and a note to Annie, then "Send to Annie for approval". Back returns to the screen the plan was opened from.
5. **Approvals**: what's waiting and what's decided. **Review as Annie** opens a phone-sized preview where Annie approves or sends back with a reason. Demo only: Annie has no separate login.
6. **After approval**: the plan shows the due date, props and editor notes, and **Copy brief for editor** copies everything the editor needs. Approved plans are listed under **Plans**, soonest due first.

Saved ideas are kept in the browser (localStorage), so the demo keeps its state between reloads. Clear site data to reset.

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

- **Video link or screenshot:** paste a TikTok link, or attach or paste a screenshot (paperclip button or Ctrl/Cmd+V). This switches to **"Find more like this"**: a short "Reading this video…" animation, then a card saying which format it matches, whether it's worth copying (Early / Rising / Peaked), why it works, and a button to plan a version for the client. **This is a mock:** nothing is fetched or analysed. The format is guessed from words in the link or file name (e.g. "taste-test"), falling back to the crispy ASMR format.

Whatever's left (minus filler words) becomes the keywords.

**Suggestions while typing** (`src/lib/suggest.ts`): chips pop up under the search box as she types.

- **Narrow it down:** after a niche ("tofu"), chips offer the formats that exist for it (most promising first), an audience, "this week", "on TikTok" and "under 30 sec". A half-typed word gets finished ("tofu des" → "desserts"). Picking one adds it to the box.
- **Ask:** once she starts with why / what / is / how…, chips become full questions built from the formats that exist ("why are tofu desserts trending?"). Picking one runs the search.
- ↓ moves from the box into the chips, ← / → move between them, Esc or ↑ goes back. An empty box shows the "Try:" examples instead. `src/lib/answer.ts` writes the answer from templates. Both can be swapped for an AI call that returns the same shape.

## Swapping in real videos

Replace the `videos` array in `src/data/sample.ts`. Each video needs:

`id, platform, handle, hook, views, followers, medianViews, daysAgo, lengthSec, shares, saves (null on Instagram), formatId`

Each `formatId` must match a format in the `formats` array. Formats hold the "why it worked" notes, shot list, props and what you need to film.

## Next

- Real data source (third-party API). Check cost and platform terms first.
- Real AI breakdown from key frames + transcript.
- Client tracking board (approved → filming → editing → posted).
