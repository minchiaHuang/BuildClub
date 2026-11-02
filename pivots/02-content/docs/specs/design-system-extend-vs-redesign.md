# Design system: extend or redesign for the Remake production screens

Date: 2026-11-02. Author: W0. Paths are relative to `pivots/02-content/app/trend-finder/` unless they start with `docs/`.

## Verdict: EXTEND

The four new screens (script and storyboard, subtitles and grading, production board, publishing) are cards, lists, badges, pickers and a stepper. The merged design system already has all the surface, type, colour, radius and layering tokens for that, in light and dark, and its board and card patterns are close to what the hub needs. No screen needs a canvas, a new colour model or a heavier chrome. What is missing is about eight small components and a handful of tokens, which add on top; nothing existing has to change. A redesign would throw away tokens that PR #12 just unified and that every current screen reads.

## What exists and can be reused

| Need | Reuse | Where |
| --- | --- | --- |
| Surfaces, text, lines, scrim, focus ring | `--bg --surface --surface-2/3 --fg --muted --line --line-strong --frost --scrim --focus-ring` | `src/styles/tokens.css:4-14`, remapped by the Remake layer in `src/styles/theme-remake.css:21-70` |
| Brand colours | `--blue` (the one main action), `--violet` (icons, active nav), `--mustard` (winner), `--navy` | `src/styles/theme-remake.css:21-37`; usage rules in the header comment, lines 1-9 |
| Status colours with soft fills | `--early/-soft` (ok), `--rising/-soft` (waiting), `--no/-soft` (bad), `--late/-soft` (neutral) | `src/styles/tokens.css:25-38`, remapped in `src/styles/theme-remake.css:47-57` |
| Dark mode | Token values change inside `@media (prefers-color-scheme: dark)`; rules never branch on theme | `src/styles/theme-remake.css:76-106`, `src/styles/tokens.css:137-177` |
| Type, space, radius, z-index, motion scales | `--text-*`, `--space-*`, `--radius-*`, `--z-*`, `--dur-*`, `--ease`, `--duration-pulse` | `src/styles/tokens.css:41-123`; fonts `--font-serif`, `--font-mono` in `src/styles/theme-remake.css:36-37` |
| Buttons, inputs, icon button | `.btn .btn-primary .btn-ghost .btn-sm`, `.icon-btn`, form controls | `src/styles/components.css:14-60` |
| Chips and pills | `.chip-group .chip-row`, `.pill .pill-ok .pill-wait .pill-no .pill-btn`, `.stage-pill` | `src/styles/components.css:71-74,112-128` |
| Skeleton shimmer | `.cchip-skeleton` + `@keyframes pulse` | `src/styles/components.css:87` |
| Progress ring (SVG) | `ProgressRing` | `src/components/ProgressRing.tsx`, `src/styles/approvals.css:5-14` |
| Board, drag, cards | `ShortlistBoard`, `PlanColumn`, `PlanCard` (dnd-kit), `.plans-board .plans-col .plans-card`, mobile snap to one column at 760 px | `src/components/ShortlistBoard.tsx`, `src/components/plans/*.tsx`, `src/styles/plans-board.css:5-20` |
| Stage model | `Stage` has 4 values (`approved, filming, editing, posted`); `STAGES`, `STAGE_LABEL`, `moveTo`, `StageSelect` | `src/types.ts:134`, `src/lib/stage.ts:1-30`, `src/components/StageSelect.tsx` |
| Page and card layout | `.shell` (264 px sidebar, off-canvas at 860 px), `.main` (max 1240), `.ch-wide`, `.ch-grid` (12 / 6 / 1 columns), `.ch-card` | `src/styles/layout.css:1-30`, `src/styles/client-home.css:3-35` |
| Thumbnail with player | `Thumb` | `src/components/Thumb.tsx` |

Loading order is `src/index.css:1-22`; `theme-remake.css` is loaded near the end and wins, and everything Remake is scoped under `:root[data-ui="altitude"]` (set in `index.html:2`).

## New pieces per screen

All names are proposals; each is a small component plus CSS, no new library.

1. **Script and storyboard**
   - `ShotCard`: a `.ch-card`-style card in a vertical list, not a canvas. Holds the line (台詞), a purpose badge (hook / body / CTA), and the frame.
   - `PurposeBadge`: reuses `.pill` with `--blue-soft` (hook), `--surface-2` (body), `--mustard` + `--on-mustard` (CTA).
   - `RewriteOptions`: three options as a radio-style chip row (reuse `.chip-row`) plus a `.btn-sm .btn-ghost` "Regenerate this shot".
   - `FrameImage`: fixed aspect box (token `--frame-ratio: 9 / 16`) with states empty, loading (skeleton pulse), error (`--no-soft` + retry), ready.
   - `SwatchRow` / `SwatchChip`: a round or rounded swatch showing the hex, with a visible border so a near-white swatch reads on a white card; copy-on-click.
2. **Subtitles and grading**
   - `PresetPicker`: radio chip row, one chip per grade preset, same markup as `.chip-row`; shows a tiny preview swatch.
   - `BeforeAfter`: two stacked frames on 390 px, side by side from 760 px, with a labelled toggle instead of a drag slider (no new dependency).
   - `SubtitleStyleControls`: font-size, position and background-box choices using existing `<select>` and chip controls.
   - `SubtitleOverlay`: positioned text over the player; uses `--sub-*` tokens so the preview and the ffmpeg burn-in config share one set of values.
3. **Production board (hub)**
   - Extend, don't replace, `ShortlistBoard`: stages become 選題 → 腳本 → 分鏡 → 拍攝 → 剪輯 → 發佈. The current type has four values (`src/types.ts:134`), so W3 adds the new stages and keeps a migration for the old ones.
   - `StepProgress`: 6-step indicator, a segmented bar (6 equal segments) on cards and a labelled stepper on the video page. Reuses the `ProgressRing` approach (SVG or CSS only).
   - `FlagBadge`: `stuck` (`--rising`) and `overdue` (`--no`), always shown with a word, never colour alone (rule in `src/styles/theme-remake.css:7-8`).
   - Six columns do not fit side by side at 1440 px in a 1240 px `.main`; keep the existing horizontal scroll with `grid-auto-columns: minmax(272px, 1fr)` (`src/styles/plans-board.css:6-9`) and the one-column snap at 760 px.
4. **Publishing**
   - `PlatformPublishRow`: platform logo (`PlatformLogo` in `src/components/PlatformToggles.tsx`), `StatusBadge` (draft, queued, published, failed, mapped to `.pill-wait/-ok/-no`), and a `.btn-sm` action.
   - `ResultsEntry`: manual number inputs for views and likes, saved per platform; results feed the Find ideas / ideas view through the existing `ideasSync` path (`src/lib/ideasSync.ts`) so the two views stay consistent.
   - Fake publish is a clearly labelled provider interface so Ayrshare can replace it later; the UI must not say "published" for the fake.

Shared tokens to add (names only, values chosen by the owner of the first screen that needs them): `--frame-ratio`, `--swatch-size`, `--swatch-ring`, `--step-gap`, `--step-done`, `--step-current`, `--flag-stuck`, `--flag-overdue`, `--sub-size-*`, `--sub-bg`.

## Gaps and conflicts to watch

- **Two layers, one name.** Older docs describe a monochrome, Apple-grey system (`docs/design-system.md`, `docs/visual-direction.md`, `src/styles/tokens.css`). What ships is the Remake layer: blue / violet / mustard, Newsreader headings, 12 px cards, no shadow unless floating (`src/styles/theme-remake.css:1-9`). `docs/design-system.md` has not caught up. New screens follow `theme-remake.css`, and W-owners update `docs/design-system.md` when they add a token.
- **Status pills.** Home deliberately uses no status pills (`src/styles/client-home.css:1-5`) while the board uses count badges. Stuck / overdue flags are the only new badge exception on the hub; use them sparingly.
- **Dark vs light.** The app follows `prefers-color-scheme`. The storyboard frame and the grading preview are images, so they will not change with the theme; surround them with `--surface-2` so both themes read. Subtitle preview must use its own explicit foreground and background tokens, not `--fg/--bg`.
- **Density at 390 px.** `.main` pads to 16 px (`src/styles/layout.css:4`); `.shell` collapses at 860 px. A shot card with line, three rewrites, frame and swatches is tall: on phones stack frame above text, show rewrites as a wrapped chip row, and keep one primary action per card. Tap targets at least 40 px (existing `.icon-btn` is 34 px, so use `.btn-sm` for new actions).
- **Boards.** The Plans board already uses `contain: inline-size` so it never widens the page (`src/styles/plans-board.css:10-11`). Any wide strip (swatches, stepper, six columns) must do the same.
- **CJK.** Stage names are Chinese. `--font-serif` (Newsreader) and Inter have no CJK glyphs, so the Remake stack falls back to the system font. Add `"PingFang TC", "Noto Sans TC"` to the stack in one place if the UI shows Chinese labels, rather than per screen.

## Rules for W1 to W4

1. **No new UI dependencies.** `@dnd-kit/core` is the only UI library (`package.json`). Steppers, swatches, before/after and previews are plain React and CSS.
2. **Tokens.** Only use tokens from `theme-remake.css` and `tokens.css`. A new token goes in `src/styles/theme-remake.css` (inside `:root[data-ui="altitude"]`, with its dark value in the dark block) and is documented in `docs/design-system.md`. Never hard-code a colour, radius or duration in a component file.
3. **Files.** One new stylesheet per screen, named like the existing ones (`src/styles/storyboard.css`, `grading.css`, `production-board.css`, `publish.css`), imported at the end of `src/index.css` after `plans-board.css`, scoped under `:root[data-ui="altitude"]`. Shared pieces (`StepProgress`, `SwatchChip`, `FlagBadge`, `FrameImage`, `PresetPicker`) go in `src/components/` with styles in `src/styles/components.css`, and the first worker to need one builds it; the others import it. W1 owns `SwatchChip` and `FrameImage`; W3 owns `StepProgress` and `FlagBadge`.
4. **Naming.** Class names are lower-case with a screen prefix (`.sb-shot`, `.gr-preset`, `.pb-card`, `.pub-row`); component files are PascalCase; no inline colour styles.
5. **Words with colour.** Every status colour comes with text. Sentence case labels.
6. **Both widths and both themes.** Check 1440 px and 390 px, light and dark, with no horizontal page scroll, before handing over. Respect `prefers-reduced-motion` (`src/styles/base.css:37-44`); nothing loops except the existing skeleton pulse.
7. **Cost and secrets.** The image generation and publish providers sit behind a backend interface with a fake default; the UI never holds keys.

## Not checked

- The gap diagram (`.archify/.../shortvideo-gap.html`) was only opened, not read in full; the screen list in the brief was used instead.
- The target storyboard mock (claude.ai artifact) was not read, so exact layout of the shot card is a proposal.
- Nothing was rendered in a browser; widths and dark-mode notes come from reading CSS.
