# Remake landing page: design spec

_Updated 30 Oct 2026. Direction: **Classic + Night Shift** (options 01 and 10 of the look-and-feel research). Page structure and copy reasoning: `landing-page-flow.md` (in the main checkout's `docs/`). App-wide visual rules: `visual-direction.md`. Tokens and components: the Remake design system artifact (https://claude.ai/artifact/H6o4ryyVUujTq136n3PMet)._

> **Status:** the page built on `feature/landing-page` matches this spec (v2.1) as of 30 Oct 2026. Photos and videos are still labelled placeholders.
>
> **Scope: every Remake screen.** This spec is the design system for the whole product, not only the landing page. The landing and login pages use it through `landing-remake.css` (`.rk`); every app screen uses it through `theme-remake.css`. Any new screen uses those tokens and rules only (decided 30 Oct 2026).

## Direction

Modelled on readme.com, made Remake's own.

- **Classic** (from readme.com): a white page, a deep-navy hero panel with big rounded corners, a serif headline with one italic word, small numbered mono labels, and one blue pill button.
- **Night Shift**: navy also appears as full-width "night" bands further down the page, and a **dot pattern** sits on some of the navy surfaces.
- **Dots are selective.** Some navy sections get dots, some don't (see "Page rhythm"). White sections use the hairline grid only where content sits in cells.
- One conversion: **Try the demo**. Blue is used for that button and almost nothing else.
- Two accents on top: **violet** for icons and product illustrations, and **saturated mustard** to mark what wins (the "Best to copy" video, the "New" pill).

## Visual preview

Rendered from `design-review/landing-style-guide.html` (open it in a browser to see it live).

**Colour palette**

![Colour palette](design-review/img/landing-style-colors.png)

**Colour in use on the page**

![Colours in use](design-review/img/landing-style-use.png)

**Page rhythm: which sections get navy, grid or dots**

![Page rhythm](design-review/img/landing-style-rhythm.png)

**Typography**

![Typography specimen](design-review/img/landing-style-type.png)

**Components**

![Components](design-review/img/landing-style-components.png)

## Colour

Token names match the design system artifact.

| Token | Hex | Used for | Contrast |
| --- | --- | --- | --- |
| `canvas` | `#FFFFFF` | Light sections | — |
| `canvas-alt` | `#F5F5F7` | Wells, placeholders, toggle tracks | — |
| `line` | `#E8E8EE` | Hairlines, card borders, the grid | — |
| `line-strong` | `#C9CAD6` | Input and secondary-button borders | 3:1 on white |
| `ink` | `#1A1A22` | Headings and text on white | 17.3:1 |
| `ink-muted` | `#5D5F6E` | Body copy on white | 6.3:1 |
| `navy` | `#060A47` | Hero panel and final CTA panel | — |
| `navy-deep` | `#070B24` | Full-width night bands (comparison, stance) | — |
| `navy-dot` | `#2A3170` | The dots on navy | decorative |
| `on-navy` | `#F4F5FF` | Text on navy | 16.9:1 |
| `on-navy-muted` | `#A9B0E0` | Secondary text on navy | 8.7:1 |
| `sky` | `#7AB8FF` | Mono labels and the italic headline word on navy | 8.9:1 |
| `blue` | `#1A33F2` | **Try the demo**, links | white text 7.5:1 |
| `blue-soft` | `#E9ECFF` | Score badges | blue text 6.4:1 |
| `label` | `#1A33F2` | Mono section labels on white | 7.5:1 |
| `violet` / `violet-soft` | `#7B1FE0` / `#F2E9FF` | Icons in feature cells, product illustrations. Never a button. | 6.7:1 |
| `mustard` | `#F2B705` | Accent for winners: the "★ Best to copy" badge, the "New" pill, the winning clips in a video wall, small marks on navy. Solid fill with `navy` or `ink` text, or as a mark/outline on navy. | navy on mustard 10.1:1 · mustard on navy 10.1:1 · **1.8:1 on white, so never text on white** |
| `early` on `early-soft` | `#1A7A44` on `#E5F4EA` | Early, Approved | 4.7:1 |
| `rising` on `rising-soft` | `#8A5A06` on `#FBF3E1` | Rising, Waiting for manager | 5.4:1 |
| `no` on `no-soft` | `#B42318` on `#FDECEB` | Can't film, Sent back | 5.8:1 |

Rules:
- **Blue means act.** One blue button per view; on navy it stays blue (it reads clearly on both).
- **Sky lives on navy only.** It fails contrast on white.
- **Mustard means "this one wins".** Use it at most once or twice per screen, always solid (no pale tint), never on buttons, never for body text. It stays the "winner" colour, separate from the brown-amber **Rising** status badge, which is pale fill with dark text.
- **Violet decorates, mustard highlights, blue acts.** Don't put two accents on the same element.
- Status colours always come with a word, never colour alone.
- Rough share across the page: white 51%, navy 30%, ink 8%, hairlines 5%, blue 3%, sky 1%, mustard 1%, violet 1%.
- Light page only for now; the navy sections give the page its dark moments.

## Background patterns

| Pattern | Look | Where |
| --- | --- | --- |
| **Dots** | One `navy-dot` dot every 24px, fading out toward the edges | Hero panel, stance band, final CTA panel |
| **Grid** | `line` hairline squares, 48px | How it works only |
| None | Plain | Everything else |

Rules:
- About a third of sections carry a pattern. Never two patterned sections in a row.
- Never a pattern behind long text or a table (problem, close-ups, comparison, FAQ stay plain).
- Dots only on navy; the grid only on white.
- In the design system: `rm-dot-bg`, `rm-grid-bg`, plus `rm-bg-fade` for the edge fade. The dot colour on navy is `navy-dot`.

## Type

Three families, each with one job. All from Google Fonts.

| Role | Font | Size (desktop → phone) | Notes |
| --- | --- | --- | --- |
| Hero headline | Newsreader 400 | 72px → 40px | line-height 1.02, tracking -0.02em. **One word italic** (in `sky` on navy, `blue` on white) |
| Section headline | Newsreader 400 | 48px → 32px | balanced wrapping |
| Card heading | Newsreader 400 | 24px | problem cards, close-ups |
| Cell / step title | Newsreader 400 | 18px | feature cells |
| Lede | Inter 400 | 18 / 28px | `ink-muted` or `on-navy-muted` |
| Body | Inter 400 | 16 / 24px | |
| Buttons | Inter 500 | 15px (14px small) | |
| Section label | Geist Mono 500 | 12px, caps, +0.06em | numbered in page order: `02. How it works`. `label` on white, `sky` on navy |
| Data | Geist Mono 400 | 13px, tabular | scores, counts, `STEP [03]` |

Font link: `https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap`

Writing rules (from the flow doc): grade 5–7 reading level, one idea per sentence, no "AI" in the headline, and the button always says **Try the demo**.

## Layout and spacing

- Content width 1200px max; side gutter 32px desktop, 16px phone.
- Section padding 96px desktop, 64px phone.
- Spacing steps: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px. The 48px step is also the grid cell.
- Radius: pills 999px · inputs 8px · cards 12px · large media 20px · **navy panels 40px** (24px on phones).
- Navy panels are inset from the page edge so the white shows around them. Night bands run full width.
- Shadows only on things that float: the mini-demo window and the tour video.

## Components

| Component | Look | Where |
| --- | --- | --- |
| **Primary button** | Blue pill, white text, arrow nudges 3px on hover | Every "Try the demo" |
| Secondary button | White pill, `line-strong` border | "Watch the tour" on white |
| On-navy button | Transparent pill, `on-navy-muted` border | "Watch the tour" in the hero |
| Ghost button | Text only | Nav "Log in" |
| Section label | Numbered mono caps | Above every section headline |
| **Best-to-copy badge** | Navy text on solid `mustard`, with ★ | The one winning video in the mini demo |
| Score badge | Mono text on `blue-soft` | "18× usual views" on the other videos |
| Status badge | Word on its soft fill | Approved, Waiting, Can't film |
| Feature cell | Hairline cell, violet line icon, serif title, mono `STEP [0n]` | How it works |
| Video card | 9:16 thumb, title, reason, badges; greyed when blocked | Mini demo |
| Announcement pill | "New" on `mustard` + one line | Top of the hero |
| Placeholder | Dashed box tagged **PHOTO** (light) or **VIDEO** (navy) with a caption | Every image or video slot |

All are in the design system artifact as `rm-` classes with live previews.

## Page rhythm

| # | Section | Surface | Pattern | Placeholders |
| --- | --- | --- | --- | --- |
| 0 | Sticky nav | White, frosted | — | — |
| 1 | Hero + mini demo | **Navy panel** | **Dots** | VIDEO thumbs in the mini demo (9:16) |
| 2 | Proof | White | — | Agency quote (waiting on permission) |
| — | Tour video | White; the video overlaps the bottom of the hero panel | — | VIDEO: product tour, under a minute (16:9) |
| 3 | Problem | White | — | — |
| 4 | How it works | White | **Grid** | PHOTO per step (4:3) |
| 5 | Why not a trend tool? | **Night band** | none (table) | — |
| 6 | Close-ups | White | — | PHOTO ×3 (4:3) |
| 7 | Stance | **Night band** | **Dots** | — |
| 8 | FAQ | White | — | — |
| 9 | Final CTA | **Navy panel** | **Dots** | — |
| 10 | Footer | White | — | — |

Section details carried over from the earlier spec:
- **Hero**: centred serif headline with "film" in italic sky, lede, Try the demo + Watch the tour, "No sign-up. Sample agency ready." Below it, the mini demo (tofu search, Evergreen Foods ↔ MYST switch, "Can't film: no kitchen").
- **Comparison**: three-column table on navy; the Remake column has sky ticks.
- **Close-ups**: copy and image swap sides each row.
- **FAQ**: accordion, six questions.

## Motion

- 150–250ms ease-out, small moves only (1px lifts, 3px arrow nudge). Mini-demo cards fade up one by one when the client switches.
- **Exception, showcase animations:** the "How it works" step illustrations and the mini-demo hover video are demos, not UI feedback, so they run slower (about 2.8s per step, `--slow: 2`, soft fades). They autoplay once when scrolled into view, replay on re-entry or hover, and never loop. The 150–250ms rule still applies to every control.
- Dots and grid never move.
- Everything off under `prefers-reduced-motion`.

## Responsive

| Width | Changes |
| --- | --- |
| ≤ 1080px | How it works: 3 columns |
| ≤ 960px | Hero, close-ups and FAQ stack to one column |
| ≤ 720px | Nav links hidden; hero buttons full width; navy panel radius 24px; steps 2 columns |
| ≤ 420px | Steps 1 column |

## Content to supply

- [x] Product tour video, under a minute (16:9), `public/media/remake-tour.mp4`
- [ ] Trend clips for the mini demo (9:16), or keep generic thumbnails
- [ ] 5 step screenshots (4:3)
- [ ] 3 close-up screenshots (4:3), one showing the manager review on a phone
- [ ] Agency quote + permission (Daphne at Mercif or the UNSW founder)
- [ ] Final copy for all sections (current copy is a draft from `landing-page-flow.md`)
- [ ] Real Contact email, Privacy and Terms pages

## Open design decisions

1. **Logo.** None yet; a text wordmark stands in.
2. **Video wall.** Option 08 (a navy band full of trend clips) could replace the dots in the hero once real clips exist.
3. **Log in screen** still uses the older landing styles.
4. **"Approve with changes"** appears in close-up 2, but the app only has approve and "Not this one" today.
5. **App vs website.** The app still uses its own monochrome tokens. Decide whether the app moves to this palette too.

## Change log

- **30 Oct 2026, v2.1.** Added saturated mustard (`#F2B705`) as a second accent beside violet, for winners and the "New" pill.
- **30 Oct 2026, whole app.** Login screen and every app screen moved onto the design system (`theme-remake.css`): navy search hero with dots instead of the sky, Newsreader headings, mono labels, blue main buttons, mustard breakout badges, navy video stand-ins. The rotating headline and bobbing icons were removed (nothing loops).
- **30 Oct 2026, v2.1 build.** Landing page rebuilt to this spec: navy hero and final panels with dots, grid behind How it works, night bands for the comparison and stance, mustard on the winning pick and the "New" pill. The tour video placeholder is light so it does not sit navy-on-navy under the hero. On phones the comparison table fits the screen and drops the ticks.
- **30 Oct 2026, v2.** Switched from ivory + evergreen to Classic + Night Shift (navy, blue, sky; Newsreader, Inter, Geist Mono). Added the page-rhythm rules for dots and grid. Research and the ten options: https://claude.ai/artifact/TBDzgQgCWHGmypcNCV9fyR
- **30 Oct 2026, v1.** First spec: ivory paper, evergreen accent, Sentient + Inter. Replaced by v2.

## Files

- Page: `app/trend-finder/src/components/landing/LandingAltitude.tsx`
- App styles: `app/trend-finder/src/styles/theme-remake.css` (loaded last; maps app tokens to the design system)
- Styles: `app/trend-finder/src/styles/landing-remake.css` (classes start with `rk-`; v2.1 tokens)
- Demo entry: `app/trend-finder/src/components/LoginScreen.tsx` ("Try the demo" signs in as a team member)
- Style guide behind the images: `docs/design-review/landing-style-guide.html`
