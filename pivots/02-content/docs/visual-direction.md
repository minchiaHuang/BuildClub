# Trend Finder: visual direction

The brief every agent works from when restyling `app/trend-finder`. Decided 27 Oct 2026.

## Direction: calm canvas, loud content

Clean and restrained, in the spirit of Apple's product pages. The interface stays quiet so the TikTok videos and their scores stand out. Interaction is small, fast and useful, never decoration.

Who it's for: agency marketers scanning dozens of videos a day (Daphene at Mercif), and an approver checking plans on a phone (Annie).

## Decisions

| Area | Decision |
| --- | --- |
| Type | **Inter** for everything (Google Fonts, weights 400/500/600/700). Headings large and tight (letter-spacing about -0.02em). No monospace uppercase labels; eyebrows become small grey sentence-case text. Numbers that matter use `font-variant-numeric: tabular-nums`. |
| Colour | Near-white canvas (`#fafafa`-ish) with white surfaces in light mode; near-black (`#0b0b0c`-ish) in dark mode. **Keep the green accent** (current `#1f6f5c`), used only for primary buttons, focus and key numbers. Status colours (early, rising, peaked, approved, not approved, hot) stay, but softer and only where they carry meaning. |
| Surfaces | Fewer borders. Cards use a soft shadow plus a hairline border at most. Radius: 12px small, 16px cards, 20px large panels, 999px pills. Sticky bars use a frosted background (`backdrop-filter: blur`). |
| Density | Airy on search, plan and Annie's review. The results grid stays dense enough to compare many videos at a glance. |
| Motion | 150–300ms, ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Movement is small (a few px, or scale 0.98 to 1). Everything respects `prefers-reduced-motion: reduce`. Nothing animates on every render, only on entrance or interaction. |
| Dark mode | Supported, from the same tokens. Check both. |

## Interactive touches (the shortlist)

- Results: hovering a tile previews it (gentle zoom on sample thumbnails; real preview for live videos). The "usual → this video" score grows in as a bar. The save star pops when toggled. Shimmer placeholders while live search loads.
- Video panel and plan: the drawer opens smoothly from the tile. Stats count up once on open. Frosted sticky plan bar. "Copy brief" turns into a check when copied.
- Annie's review: swipe right to approve, left to send back, with the buttons kept. A decided card animates away. Monthly target as a progress ring.
- App-wide: smooth screen changes (View Transitions API where supported), and keyboard shortcuts (J/K next and previous video, S save, P plan, Esc close).

## Rules for agents

- Keep the product's words, flow and behaviour. This is a visual pass; don't rename things or change what buttons do.
- Use the tokens; don't hard-code colours, radii or durations in component CSS.
- Stay inside the files you were given. If you need a shared change (a token, a shared component), report it instead of making it.
- Keyboard focus must stay visible. Text contrast at least 4.5:1.
- Run `npx tsc -b` and `npx eslint src` in `app/trend-finder` before handing back.
