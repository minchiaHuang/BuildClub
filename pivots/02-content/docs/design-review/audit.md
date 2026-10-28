# Trend Finder: UX/UI audit (Phase 1)

Date: 28 Oct 2026. Covers the three variations **Altitude, Unify and Midnight** (`html[data-ui]`, `src/lib/theme.ts`) at 1440px and 390px.
Screenshots are in `img/` and named `<theme>-<width>-<step>.png` (1 landing, 2 login, 3 search, 4 results, 5 video drawer, 6 plan). They were captured headless against the dev server with sample (tofu) data.

Nothing in the app was changed for this review.

Severity: **S1** blocks the product goal (content-first and trustworthy), **S2** clearly hurts the experience or the identity, **S3** is polish.

## Why it "looks AI": what causes it

The founder is right, and the causes can be named. None of them is a single bad decision. Together they read as the default output of a generator.

| Cause | Where | Theme |
| --- | --- | --- |
| Gradient-filled headline text (`background-clip: text`, white to grey) | `theme-midnight.css:78`, `landing-midnight.css:53` (`.mn-how .mn-close h2`) | Midnight |
| Blue glow under the primary CTA (`0 10px 30px -8px rgb(59 108 246 / .7)`) | `landing-midnight.css:25` `.mn-blue` | Midnight |
| A radial "spotlight" behind the page and hero (`radial-gradient(1200px 600px at 50% -200px …)`) | `theme-midnight.css:37`, `:56` | Midnight |
| A conic-gradient rainbow logo mark | `landing-midnight.css:15` `.mn-mark` | Midnight |
| Glossy 3D "pill" stickers floating, rotated and blurred around the headline (TikTok, YouTube, "153× BREAKOUT") | `theme-midnight.css:103-123` `.mn-pill-body`; reused in `landing-altitude-sunny.css:44` | Midnight, Altitude |
| Blurred cloud blobs and sky gradients behind a 28px-radius hero card | `theme-altitude.css:95-129` `.alt-hero`, `.alt-ground`; `landing-altitude.css:86` | Altitude |
| Ring-halo social icons in a cluster (`0 0 0 6px rgb(255 255 255 / .35)` + drop shadow) | `landing-altitude-sky.css:10-19` `.la-sky-icon` | Altitude |
| Hover lift on everything (`translateY(-4px)` + shadow) | `landing-altitude.css:28`, `:50` `.la-step:hover` | Altitude |
| Everything in a rounded card, cards inside cards (search box card inside hero card inside page; score card inside drawer card) | `search-results.css:13` `.search-box`, `theme-altitude.css:70-74`, drawer stat boxes in `drawer-plan.css` | All |
| Pills for everything: tags under the hero ("TikTok live search", "Outlier scores"), starter searches, stage badge, tier badge, "Approved" badge, "SAMPLE" badge, count badge | `theme-unify.css:116,182,192`, `.suggestion` in `search-results.css:62` | All (worst in Unify) |
| One font size doing every job: sidebar, meta, captions and body are all ~14px; the only contrast is "huge headline vs everything else" | `tokens.css` type scale, `search-results.css` | All |
| Uppercase tracked micro-labels ("SEARCH ON", "STARTER SEARCHES", "SEARCHING FOR") | `theme-unify.css` eyebrow rules | Unify (contradicts `visual-direction.md`: "No monospace uppercase labels") |
| Fake social-proof stat ("has scanned 1,284,301 videos this month", five stars) | Unify landing (`UnifyHero.tsx`) | Unify |
| Platform logos for YouTube, Reddit, X, Instagram shown prominently when the product is TikTok-only | `PlatformToggles`, Altitude/Midnight heroes | All |

The common thread: the decoration is spent on the **chrome** (hero cards, pills, glows), while the **videos**, which are the actual product, sit in a uniform grid of identical boxes with three lines of metric text under each.

## Prioritised findings

### 1. S1: The videos are not the hero; metrics and chrome are
- Results (`*-1440-4-results.png`): the first screen at 1440 is the search card again, a "Searching for" row, a count, then "Best to copy". In Unify the first video starts ~470px down. At 390 (`*-390-4-results.png`) no grid tile is visible above the fold.
- Every tile repeats the same stack under the cover: `9k → 2.4M`, "usual views → this video", a tier pill, the title, the handle (`VideoTile.tsx:34-48`). Thirteen tiles means 65 lines of near-identical small text competing with the covers.
- **Proposal:** a masonry or tight grid where the cover is the tile. One signal stays visible (the outlier multiple, e.g. `153×`, set large in tabular numerals on the cover corner). Everything else (usual vs this, handle, age, save) appears on hover or focus, and always on touch in a compact caption. Collapse the search card into a slim query bar once results exist.

### 2. S1: The answer to "why is it trending?" is buried and split
- Trend stage (one-off / early / rising / peaked) lives in a horizontal chip strip above the grid (`PatternStrip.tsx`), which is cut off at 1440 in Midnight (`midnight-1440-5-drawer.png`, top row). The stage of each **video** is not shown on the tile at all, so the user cannot see which posts belong to a rising pattern.
- **Proposal:** treat the pattern (format) as a first-class object. Group the grid by pattern, with a header row per pattern: name, stage, account count ("Rising · 5 accounts, still new posts", the copy already exists). Users read "what's trending" as patterns and "proof" as the posts under them. This answers questions 1 and 2 of the journey at a glance.

### 3. S2: Three themes, one skeleton, so none of them has an identity
- Altitude, Unify and Midnight change colour, font and radius over the **same** sidebar, search card, best pick, grid and drawer. The layout and hierarchy are identical; only the paint differs. This is why they read as generated variants rather than designed products.
- The sidebar (client switcher, Search, Saved ideas, Approvals, Plans, Client settings) is a generic SaaS rail that takes 264px from the grid on every screen.
- **Proposal:** each direction in `directions.html` changes the **structure** (grid model, where metrics live, navigation), not only the paint. Move workspace navigation to a slim top bar; the client switcher becomes a quiet text control.

### 4. S2: Landing heroes sell decoration, and overclaim
- Midnight: gradient text, glossy floating stickers that overlap the headline, glowing CTA, typing search field that does nothing (`midnight-1440-1-landing.png`).
- Altitude: clouds, ringed logos of five platforms (four are not supported), two headlines fighting either side of an icon cluster (`altitude-1440-3-search.png`, also echoed in-app).
- Unify: headline with three underlined accent words, fake "scanned 1,284,301 videos" stat with stars.
- **Proposal:** the hero should show the product's real output: a strip of actual covers with their multiples ("153×"), one honest line about TikTok-only, one CTA. No platform logos beyond TikTok, no invented totals.

### 5. S2: Pill and badge overload makes states unreadable
- Count of pill-shaped elements on Unify results above the fold: ~14 (starter searches, platform toggles, "tofu ×", count badge, stage, tier). Stage pills, tier pills, "Approved" pills and filter chips share one shape, so meaning has to be read word by word.
- **Proposal:** reserve one shape per meaning. Filters are plain text tabs with an underline (the Pinterest reference). Stage is a small coloured dot + word. The multiple is typography, not a badge. "Approved" becomes a corner tick on the cover.

### 6. S2: Typography has two sizes: huge and small
- Headlines 56-96px, then everything else at 13-15px. No mid-level (18-22px) for tile titles, pattern names or the drawer score explanation. Unify mixes a display serif headline with an Inter UI that never uses the serif again below the fold.
- **Proposal:** a five-step scale with a defined job per step (see design-system sheets in `directions.html`), and tabular numerals for every metric.

### 7. S2: Video drawer is a stack of cards
- `*-1440-5-drawer.png`: cover, then a bordered score card with a left accent bar, then two more bordered stat boxes. Three containers to say "267×, 2.4M views, 6.7 shares+saves per 100".
- **Proposal:** a two-column detail view: large cover with playback on the left; on the right one typographic block (multiple, then the "9k usual → 2.4M this" comparison as a single bar), then "why it worked" notes, then actions. No nested borders.

### 8. S2: Search returns to the same big card on results
- The full search card (platform toggles + starter searches) repeats at the top of results (`unify-1440-4-results.png`), pushing content down 280px.
- **Proposal:** on results it becomes a single-line query bar with the interpretation ("tofu") inline and editable.

### 9. S3: Mobile
- 390px landing pages are long and the floating stickers crowd the headline (`midnight-390-1-landing.png`, `*-390-1-landing-full.png`). Results at 390 show no video above the fold.
- **Proposal:** two-column grid at 390 with covers first; the query bar collapses into the header.

### 10. S3: States
- Loading uses shimmer, good. Empty and error states reuse a generic card. Save star sits in a blue filled circle on the cover in Midnight, which reads like a notification badge.
- The theme switcher is a frosted floating pill with `backdrop-filter` (`theme-switcher.css:2`); fine as a dev tool, but it should not ship.

### Retain (these work)
- The outlier idea and its plain wording: "usual views → this video", "267 times its usual views". Honest and specific.
- The "Plan this for Evergreen Foods" CTA naming the client.
- Sample-data labelling, keyboard shortcuts (J/K/S/P/Esc in `useShortcuts.ts`), reduced-motion handling in tokens.
- Altitude's recent yellow/Sentient serif landing direction is the most distinctive of the three. Direction B builds on its warmth.

## Journey check (the founder's five questions)

| Question | Today | Gap |
| --- | --- | --- |
| What's trending? | Answered by "Best to copy" + grid | Patterns are a side strip; grid is flat |
| Why is it trending? | Only inside the drawer ("See why it worked") | Not visible while browsing |
| Is it relevant to me? | Client name in CTA; query interpretation | No signal per tile; relies on the search |
| Worth recreating? | Outlier multiple + tier | Good data, poor emphasis (it's a pill) |
| What next? | Save star, Plan button | Save and plan are fine; saved items have no visible "tray" while browsing |

Data limits to respect in every direction: TikTok only; per video we have views, followers, median views, shares, saves, days ago, length, hook, format id, live cover image (sample data uses coloured stand-ins); per pattern we have stage and account count. No engagement-over-time series, so no sparklines.
