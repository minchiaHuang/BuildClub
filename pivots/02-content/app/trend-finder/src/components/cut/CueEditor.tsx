import { useState } from 'react'
import type { Cue } from '../../lib/grading'
import { MAX_CUE_TEXT, cuesChanged, formatCueTime, putCues, srtUrl } from '../../lib/grading'

interface Props {
  ideaId: string
  cues: Cue[]
  edited: boolean
  disabled?: boolean
  onSaved: (data: { cues: Cue[]; edited: boolean }) => void
}

// The words of the last video, one row per subtitle. Saved edits are burned in by the next "Make the video".
export function CueEditor({ ideaId, cues, edited, disabled, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const text = (c: Cue) => drafts[c.id] ?? c.text
  const changed = cuesChanged(cues, drafts)
  const empty = cues.some((c) => !text(c).trim())

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await putCues(ideaId, cues.map((c) => ({ id: c.id, text: text(c) })))
      setDrafts({})
      onSaved(res)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="gr-cues">
      <summary>
        Edit the subtitles <span className="muted small">({cues.length})</span>
        {edited && <span className="pill gr-edited">Edited</span>}
      </summary>
      <p className="muted small">
        Your changes are burned in the next time you press "Make the video" with subtitles on. If you change the takes or the speed first, the words are made again from the speech and these edits are lost.
      </p>
      <ol className="gr-cue-list">
        {cues.map((c) => (
          <li key={c.id} className="gr-cue">
            <span className="gr-cue-time small">
              {formatCueTime(c.start)} – {formatCueTime(c.end)}
            </span>
            <input
              type="text"
              value={text(c)}
              maxLength={MAX_CUE_TEXT}
              disabled={disabled || saving}
              aria-label={`Subtitle at ${formatCueTime(c.start)}`}
              aria-invalid={!text(c).trim()}
              onChange={(e) => {
                setSaved(false)
                setDrafts({ ...drafts, [c.id]: e.target.value })
              }}
            />
          </li>
        ))}
      </ol>
      <div className="gr-cue-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={!changed || empty || disabled || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save subtitles'}
        </button>
        <a className="btn btn-ghost btn-sm" href={srtUrl(ideaId)} download>
          Download .srt
        </a>
        {empty && <span className="small gr-cue-note">Every subtitle needs some words.</span>}
        {saved && !changed && (
          <span className="small gr-cue-note" role="status">
            Saved. Make the video again to burn them in.
          </span>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  )
}
