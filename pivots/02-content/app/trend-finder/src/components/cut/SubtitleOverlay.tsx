import type { SubtitleStyle } from '../../lib/grading'

// The words of one cue, laid over a 9:16 box in the size, position and background of the burn-in.
// Sizes come from the --sub-* tokens, which follow the 1080x1920 numbers in backend/subtitles.py.
export function SubtitleOverlay({ text, style }: { text: string | null; style: SubtitleStyle }) {
  return (
    <div className="gr-sub-layer" data-size={style.size} data-pos={style.position} data-box={style.box ? 'on' : 'off'} aria-hidden="true">
      {text && <span className="gr-sub-text">{text}</span>}
    </div>
  )
}
