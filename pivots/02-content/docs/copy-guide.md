# Remake copy guide

How we write every word in the Remake app (Home, Find ideas, Plans, approvals). Written 2 Nov 2026 during the copy pass on `feature/client-dashboard`.

**The test.** Picture an agency owner who has never seen the app. They read one label or one sentence on its own. If they have to stop and think about what it means, rewrite it.

Bad: a card labelled "Pipeline" with "1 Shortlisted → 2 Waiting for approval → 5 Approved".
Good: "Where Evergreen's 8 ideas are · 1 saved, shots not planned yet · 2 waiting for you to approve · 5 approved and ready to film".

## Glossary: the words we use

Always use these words, and use them the same way on every screen.

| Word | Means | Example |
| --- | --- | --- |
| **idea** | A TikTok video we want to copy for a client | "Where Evergreen's 8 ideas are" |
| **save / saved** | Put an idea aside for a client. Shots are not planned yet. | "Save for Evergreen Foods", "✓ Saved", "1 saved, shots not planned yet" |
| **plan / plan the shots** | The shot list written for a saved idea | "Plan the shots", "Open plan" |
| **send for approval** | The team sends a finished plan to the manager | "Send 3 for approval" |
| **waiting for you to approve** | Sent, but the manager hasn't decided yet. The manager is the signed-in user, so say "you". | "2 waiting for you" |
| **approve / approved** | The manager said yes, so the video can be filmed | "Approve", "approved and ready to film" |
| **send back / sent back** | The manager said no and gave a reason | "sent back to fix", "Your reason: …" |
| **brief** | What we know about a client: audience, topics, what they can't film | Sidebar "Brief" |
| **usual views** | How many views the account normally gets | "62 times more views than this account usually gets" |
| **catching on / spreading** | Several accounts are posting the same idea | "Spreading now: 6 accounts have posted this, and new ones keep coming" |
| **sounds and hashtags** | Say which one it is | "Sounds and hashtags many accounts are using" |

## Words we never use

Don't use these in the interface: **shortlist / shortlisted**, pipeline, stage, format (unless you explain it), pattern, breakout, outlier, score, tier, pulse, niche, hook (say "how it starts"), metric, insights, leverage, engagement rate, "× usual", "77×", workspace, reference, "Early / Rising / Peaked / One-off" pills.

No AI-sounding filler either: Unlock, Discover, Seamlessly, Supercharge, Elevate, at a glance, "powered by", and taglines full of em dashes.

The code still uses some of these words in names like `pulse`, `onShortlist`, `stage` and `hook`. That's fine. The rule is only about text people can see on screen.

## Rules in short

1. **Every number says what it counts and who it's about.** Write "7 videos approved this month", not "7/10".
2. **Use sentences, not tags.** Don't put status pills or coloured badges on ideas. Write a short line under the video instead, e.g. "Plan sent to Lin for approval".
3. **Buttons say what happens:** "Find ideas for Evergreen Foods", "Save for Evergreen Foods", "Approve", "Plan the shots". Avoid a bare "Open" or "Go" when you can.
4. **Headings answer a question the user has:** "What should Evergreen Foods film next?", "Where every client stands", "Needs your approval".
5. **Empty states say why it's empty and what to do:** "No ideas saved for Evergreen Foods yet. Add one from Find ideas and it shows up here."
6. **Placeholder cards stay dashed and say plainly what will go there**, plus what data we'd need: "Would need: access to Evergreen's TikTok stats." Never show made-up numbers.
7. **Compare views with the account's usual views in words:** use `beatUsual` / `beatUsualAverage` from `components/find/words.ts`. Never use the × score.
8. **Say whether an idea is catching on in words:** use `spreadSentence` / `spreadVerdict` from the same file.
9. **Keep it short and plain.** One idea per sentence. Avoid em dashes in UI copy.

## Before → after (most important changes)

| Where | Before | After |
| --- | --- | --- |
| Home, idea steps | Pipeline: Shortlisted → Waiting → Approved | Where Evergreen's 8 ideas are · 1 saved, shots not planned yet · 2 waiting for you to approve · 5 approved and ready to film · 1 sent back to fix |
| Results, sort menu | Outlier score / Views ÷ followers / Fastest growing | Most views compared with usual / Most views per follower |
| Results, score help | "77× means 77 times its usual views… Breakout = 100× or more" | "62 times more views than this account usually gets" (on each video) |
| Trend tags | Early / Rising / Peaked / One-off pills | "Just starting to spread: 4 accounts posted this in the last 2 weeks" |
| Video tile button | + Shortlist / ✓ Shortlisted | + Save / ✓ Saved |
| Video tile status | On the shortlist | Saved, shots not planned yet |
| Best video button | Add to shortlist for Evergreen Foods | Save for Evergreen Foods |
| Results tray | 3 shortlisted for Evergreen Foods · Go to shortlist | 3 saved for Evergreen Foods, shots not planned yet · Plan the shots |
| Video drawer, stats | Score · Breakout · Growth · Format used by · "A pattern, not luck" | Views compared with the account's usual · Views a day · Accounts posting this idea · "Enough accounts to show it is catching on, not luck" |
| Video drawer, labels | Hook / Format · "Sample · written by hand" tag | How it starts / How it's made · "A sample, written by hand for the demo." |
| Home "Film next" proof | 6 accounts using it · on average 12× their usual views | 6 accounts used it, and on average got 12 times their usual views. The biggest one got 1.2M views |
| Home sound/hashtag tag | Sound / Hashtag pill | "A sound several accounts are using right now." |
| Question answers (`lib/answer.ts`) | "X is peaked: …", "about 12× usual views" | "Probably not. X: probably too late: 9 accounts posted this, but nobody new for 3 weeks", "on average 12 times their usual views" |
| Search suggestions | "Lin approved a video like this" (wrong: the manager approves, not the client) | "You approved a plan like this" |
| All clients Home | This month / Saved / Waiting / Next due · "active clients" | Approved this month / Waiting for you / Sent back / Your decisions / Next to film |
| Loading a pasted video | Finding trending videos like it | Finding other videos that copy the same idea |

## Still to fix (files owned by the flow lead)

- `Sidebar.tsx`: the client switcher shows `c.niche` under each name. Show the audience or first topic instead, or label it "Sells: …".
- `ShortlistBoard.tsx`: rename the column "Shortlisted" to "Saved, shots not planned yet". Change "Nothing shortlisted yet" to "No saved ideas yet". Change "Add videos to the shortlist from the search results…" to "Save videos from Find ideas. They show up here so you can plan the shots." Replace "Reference: … · 12×" with "Copies "…" by @x · 1.2M views, 12 times their usual views" (use `beatUsual`). Change the button "Find trending videos" to "Find ideas for {client}".
- `PlanScreen.tsx:125`: change "answer will show up in the Shortlist" to "answer will show up in Plans". At :154, replace `{tierName} · {times(score)}` with `beatUsual(video)`. At :82, the brief text "Reference:" should become "Video to copy:".
- `ReviewScreen.tsx:293`: change "· 12× usual" to "· 12 times their usual views".
