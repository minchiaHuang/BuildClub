# Trend Finder: implementation plan (Phase 4, awaiting approval)

Date: 28 Oct 2026. Nothing here has been built. Assumes the recommended direction: **Version 2 "The Chart"** for landing and results, with Version 1's cover treatment for the "All videos" view and Version 3's plan tray. See `directions.html` and `audit.md`.

Steps are ordered by impact ÷ effort. Each is one feature branch (`feature/<name>`) and can ship alone. All paths are under `pivots/02-content/app/trend-finder/src/`.

| # | Change | Impact | Effort | Files |
| --- | --- | --- | --- | --- |
| 1 | **Strip the AI tells.** Remove gradient text, CTA glow, spotlight gradients, conic logo, glossy stickers, cloud blobs, hover lifts. | High | S | `styles/theme-midnight.css` (37, 56, 78, 103-123), `styles/landing-midnight.css` (15, 25, 53), `styles/theme-altitude.css` (95-129), `styles/landing-altitude.css` (28, 50, 86), `styles/landing-altitude-sky.css` |
| 2 | **Honest platforms.** Show TikTok only; Instagram as a text "coming soon"; remove YouTube/Reddit/X logos from heroes and toggles. Remove the fake "scanned 1,284,301" stat. | High | S | `components/PlatformToggles.tsx`, `components/themes/*Hero.tsx`, `components/themes/unify/*`, `components/landing/*` |
| 3 | **Cover-first tile.** Multiple on the cover in tabular numerals; usual → this, handle, age, save move to a hover/focus caption (always on for touch via `@media (hover: none)`). | High | M | `components/VideoTile.tsx`, `components/Thumb.tsx`, `styles/search-results.css` (`.tile*`, `.thumb*`) |
| 4 | **Slim query bar on results.** Collapse the search card to one line once results exist; interpretation chip becomes inline editable text. | High | S | `components/SearchBox.tsx`, `components/ResultsScreen.tsx`, `styles/search-results.css` (`.search-box`, `.filters`) |
| 5 | **Patterns as the unit.** Ranked pattern rows (rank, serif name, stage in words, account count, one "why" line, reel of up to 4 posts); "All videos" toggle keeps the flat grid. Uses existing stage and account data only. | Very high | L | `components/ResultsScreen.tsx`, `components/PatternStrip.tsx` (becomes rows), `components/BestVideo.tsx` (folds into row 1), `lib/answer.ts`, new `styles/chart.css` |
| 6 | **Type scale + tokens.** Five-step scale with jobs; Sentient/Georgia display; one highlighter use per screen; remove uppercase eyebrows; reduce radius set. | High | M | `styles/tokens.css`, `styles/base.css`, `styles/theme-unify.css` (eyebrows, pills 116/182/192), `index.html` (font link) |
| 7 | **One shape per meaning.** Filters → text tabs; stage → coloured word; tier pill → typography; "Approved" → corner tick. | Medium | M | `styles/components.css`, `styles/search-results.css`, `components/VideoTile.tsx`, `components/ClientChips.tsx` |
| 8 | **Top bar navigation.** Replace sidebar with a top bar (Chart, Saved, Plans, Approvals, client switcher). | Medium | M | `components/Sidebar.tsx`, `App.tsx`, `styles/layout.css` |
| 9 | **Detail view without nested cards.** Two-column panel: cover + playback left; multiple, comparison bar, shares+saves rate, "why it worked", actions right. | Medium | M | `components/BreakdownPanel.tsx`, `styles/drawer-plan.css` |
| 10 | **Plan tray.** Saved items for this client with monthly progress and "Turn into a plan"; bottom sheet on mobile; undo toast. | Medium | M | new `components/PlanTray.tsx`, `state.ts`, `components/ResultsScreen.tsx`, `styles/drawer-plan.css` |
| 11 | **Hover preview.** 400ms muted autoplay for live videos; zoom for sample; off under reduced motion. | Medium | M | `components/VideoTile.tsx`, `lib/motion.ts` |
| 12 | **States.** Skeletons matching rows/masonry; filter-specific empty state; inline live-search error with retry. | Medium | S | `components/LiveLoading.tsx`, `components/ResultsScreen.tsx` |
| 13 | **Landing.** New hero per Version 2 (chart excerpt, one CTA). Retire Midnight and Unify landings once approved; keep Altitude sunny palette as the base. | Medium | M | `components/landing/*`, `styles/landing-*.css`, `lib/theme.ts`, `components/ThemeSwitcher.tsx` (dev only) |
| 14 | **Mobile pass at 390.** Two-column grid, horizontal filter scroll, query in header. | Medium | S | `styles/search-results.css`, `styles/layout.css` |

Checks per step: `npx tsc -b`, `npx eslint src`, screenshots at 1440 and 390 for light and dark, keyboard walk-through (Tab, Enter, J/K, S, Esc), and `prefers-reduced-motion`. Mirror each UI change to Figma (team practice).

## Decisions needed from the founder
1. Pick a direction (or approve the hybrid recommendation).
2. Retire the three-theme switcher in favour of one identity? (Contradicts nothing in `visual-direction.md`, but it changes the Inter-only type decision there if Version 2 is chosen; that doc would need updating.)
3. Is a "ranked" framing acceptable, given ranks only reflect the best multiple in one search?
