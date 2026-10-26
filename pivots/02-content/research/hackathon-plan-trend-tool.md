# Hackathon plan: trending-video research tool for agencies

_Drafted 26 Oct 2026. Built 80% for Daphne at [Mercif](https://www.mercif.com/) (first design partner) and 20% for the hackathon. This sits outside the current career-consulting pivot in `PROJECT_CONTEXT.md`; no pivot decision has been made. Competitors: `market/trend-research-competitors.md`._

## The pitch in one line

Other tools stop at a list of trending videos. We take an agency from "what's trending" to "a plan our team can film, approved by the client."

## Why Daphne

From the interview (`interviews/2026-10-21-daphene-summary.md`):

| Her problem | What it means for the product |
| --- | --- |
| "Research. I don't like research." She does "1-to-10 research" by hand for every client | Automate the search, using her own rule (views ÷ followers) |
| Knows [Cila](https://cila.app/) but won't pay the subscription | Research alone won't win. Cila is cheap |
| AI is "too robotic"; AI-scripted videos did worse | AI analyses real videos. It does not write scripts |
| Loses track across 10+ clients (her #1 wish) | Save to a client, approvals, tracking |
| Late editors in Indonesia hold up everything | Clear recreate briefs with due dates |

## The flow

1. **Search.** Type a keyword ("tofu"). Instagram and TikTok on by default, YouTube Shorts optional. Filter by last 7 or 30 days and video length. No client setup needed to start.
2. **Results side by side.** One column per platform, ranked by outlier score. Each card shows views, followers, views ÷ followers, date posted and a one-line hook note.
3. **Formats that repeat.** Above the results, formats that show up across several small accounts, with a label: "Early: big on TikTok, not yet on Instagram" or "Everywhere: probably too late." This is the part to test with her.
4. **Save to a client.** Pick videos or formats and save them to a client, like Evergreen Foods.
5. **Shortlist → Annie approves.** Approve or reject each idea.
6. **Recreate plan.** The reference video, a shot list, timing and notes for editors. We plan it; Daphne films it.
7. **Track (later).** A board per client: approved → filming → editing → posted, with a monthly video count.

## Metrics the tool shows for each video

1. **Outlier score:** views compared to the account's usual views
2. **Views ÷ followers:** Daphne's own rule
3. **Shares and saves per view:** TikTok shows both publicly; Instagram shows less, so check what's available
4. **How new it is and how fast it's growing:** date posted and views per day
5. **How many accounts the format worked for:** proves the format, not luck

Plus one filter: **does it fit the client?** (keyword, audience, a format they can film)

## How we stand out

Cross-platform keyword search already exists (Mysocial, Virlo and others), so it isn't our difference. What we lead with:

1. **A real user.** Show Daphne's quote, then what happened when she used it. Ask her on Thursday how long research takes per client now, to get a before/after number.
2. **One live "wow" moment:** type "tofu" → ranked videos across platforms → click one → AI reads key frames plus transcript and writes a shot list ("0–2 sec: top-down sizzle shot, text hook 'crispy in 5 min'") → send it to Annie's phone to approve. Under a minute.
3. **"We don't write your content. We show you why videos work."** Says we listened to users about AI.
4. **A competitor slide** with the gap table from `market/trend-research-competitors.md`. Answer "isn't this Virlo?" before judges ask.
5. **A price signal from Annie**, even a rough "I'd pay $X".

## Build scope

| Build for real | Mock up | Mention only |
| --- | --- | --- |
| Steps 1–4 (search, results, repeating formats, save to client) and the shot-list "wow" moment | Step 5 (approval) and step 6 (recreate plan) screens | Step 7 (tracking) |

**Data:** don't build scrapers. Collect 15–20 real "tofu" videos from Instagram and 15–20 from TikTok by hand (link, views, followers, date, format, hook). A paid data API can come later; check cost and platform terms first.

## Before Thursday (29 Oct)

- [ ] Collect the tofu videos from both platforms. Check posting dates: does any format show up on TikTok before Instagram?
- [ ] Build the clickable demo for steps 1–4 on that data
- [ ] Mock up the approval and recreate-plan screens
- [ ] Message Daphne to confirm and ask her to bring one real client brief

## Questions for Daphne on Thursday

- How long does research take for one client right now?
- Does Cila let you search "tofu" across all of Instagram, or only accounts you've added?
- Do you ever look at TikTok for ideas? Have you ever been late to a trend?
- Which of the five metrics do you already look at, and in what order?
- Would Annie approve a shortlist in a tool, or does that happen in chat?
- If Cila were free, would you still want this? Why?
- Could you introduce us to Annie? What would she pay compared to Cila's US$48?

## Open decisions

- Is the hackathon project a side project, or the start of a new pivot? (Affects `PROJECT_CONTEXT.md` and `docs/decision-log.md`, not changed yet.)
- On the first screen, search by keyword (faster, matches how she works today) or by client (better for weekly use)? Current plan: keyword first.
