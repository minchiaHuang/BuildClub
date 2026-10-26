# Trend Finder (v1 front end)

Clickable prototype of the trending-video research tool for agencies. Built for Daphne at Mercif (design partner) and the hackathon. Plan: `../../research/hackathon-plan-trend-tool.md`.

**All data is sample data.** Every account, number and caption in `src/data/sample.ts` is made up. There is no backend, no scraping and no real AI call yet. The "AI breakdown" text is written by hand per format.

## Run it

```bash
npm install
npm run dev
```

Or start `trend-finder` from `pivots/02-content/.claude/launch.json` (port 5174).

## App layout (agency workspace)

Laid out like an agency platform (e.g. GoHighLevel):

- **Sign-in (mock):** "Continue as demo agency" enters as **Sample Social Co.** (a made-up agency). No account or password is checked or stored. Sign out from the bottom of the sidebar.
- **Left sidebar** with a **client switcher** at the top: "All clients" (agency view) or one client. "Add client" is a placeholder.
- **All clients → Overview:** every client's videos approved vs monthly target, how many are waiting for approval, and the next due date.
- **Inside a client:** Search, Saved ideas, Approvals, Recreate plans, Tracking (soon), Client settings. Saving, the "Can they film this?" check and plans all use the selected client.
- **Client settings:** name, what they sell, audience, videos per month, and what the client can't do (feeds the film check).
- On phones the sidebar opens from a ☰ menu button.

Clients, saved ideas, the selected client and sign-in are kept in the browser (localStorage). The app starts with a few **sample saved ideas** (`sampleIdeas` in `src/data/sample.ts`) so the overview, approvals and plans aren't empty.

## Screens

1. **Search**: one box for a niche, a sentence or a question, plus example searches. Platforms (Instagram, TikTok), date range, video length, client.
2. **Results**: "Searching for" chips show what we understood from the text (keywords, format, audience, time, platform, length). Remove a chip to widen the search. Questions also get a short written answer built from the results. Then the "Formats that repeat" strip (Early / Rising / Everywhere / One-off), then one column per platform ranked by outlier score. Sort by outlier score, views ÷ followers, newest or fastest growing.
3. **Video breakdown** (drawer): the five metrics, "Can this client film it?", why it worked, shot list. Save to client or create a recreate plan.
4. **Client shortlist**: saved ideas, monthly target, send to Annie, and a phone view where Annie approves or rejects.
5. **Recreate plan**: shot list, props, what you'll need, editor notes, due date, copy brief for the editor.

Saved ideas are kept in the browser (localStorage), so the demo keeps its state between reloads. Clear site data to reset.

## How the numbers work

In `src/lib/metrics.ts`:

- **Outlier score** = views ÷ the account's usual (median) views
- **Views ÷ followers**: Daphne's "1-to-10" rule
- **Shares + saves per 100 views**: Instagram hides saves, so shares only there
- **Growth** = views ÷ days since posted
- **Format stage**, from how many accounts used the format on each platform:
  - Early: 3+ accounts on one platform, 0–1 on the other
  - Everywhere: 4+ on both
  - One-off: fewer than 3 accounts in total
  - Rising: everything else

## How search understands sentences

`src/lib/parseQuery.ts` uses simple rules for now (no AI call):

- **Time:** "this week" → 7 days, "this month" / "lately" → 30, "3 months" → 90
- **Platform:** "TikTok", "Instagram" / "Reels" / "IG"
- **Length:** "short" → under 15 sec, "under 30 seconds", "under a minute"
- **Audience:** mums, students, families, professionals, health / gym. Matched against each format's `audiences`
- **Format:** words in each format's `tags` (e.g. "dessert", "taste test", "crispy")
- **Question:** ends with "?" or starts with why / what / how / is / should… → shows an answer box

- **Video link or screenshot:** paste a TikTok / Instagram link, or attach or paste a screenshot (paperclip button or Ctrl/Cmd+V). This switches to **"Find more like this"**: a short "Reading this video…" animation, then a card saying which format it matches, whether it's worth copying (Early / Rising / Everywhere), why it works, and a button to plan a version for the client. **This is a mock:** nothing is fetched or analysed. The format is guessed from words in the link or file name (e.g. "taste-test"), falling back to the crispy ASMR format.

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
