import { useState } from 'react'
import type { Client, Format, SavedIdea, Video } from '../types'
import { compact, outlierScore, times } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  idea: SavedIdea
  video: Video
  format: Format
  client: Client
  onChange: (patch: Partial<SavedIdea>) => void
  onBack: () => void
}

function briefText(idea: SavedIdea, video: Video, format: Format, client: Client) {
  return [
    `RECREATE BRIEF: ${format.name}`,
    `Client: ${client.name}`,
    `Due: ${idea.dueDate}`,
    `Reference: "${video.hook}" by ${video.handle} (${compact(video.views)} views)`,
    '',
    'SHOT LIST',
    ...format.shotList.map((s) => `${s.time}  ${s.shot}${s.text ? `  [Text: "${s.text}"]` : ''}`),
    '',
    `PROPS: ${format.props.join(', ')}`,
    '',
    'NOTES FOR EDITOR',
    idea.notes,
  ].join('\n')
}

export function PlanScreen({ idea, video, format, client, onChange, onBack }: Props) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefText(idea, video, format, client))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <section className="plan">
      <button className="link-btn" onClick={onBack}>
        ← Back to {client.name}
      </button>
      <header className="plan-head">
        <span className="eyebrow">Step 5 · Recreate plan</span>
        <h1>{format.name}</h1>
        <p className="muted">
          For {client.name}. We plan it; your team films it.
        </p>
      </header>

      <div className="plan-grid">
        <aside className="plan-ref">
          <h3>Reference video</h3>
          <Thumb video={video} />
          <span className="small">
            "{video.hook}" · {video.handle}
          </span>
          <span className="small muted">
            {compact(video.views)} views · {times(outlierScore(video))} usual
          </span>
        </aside>

        <div className="plan-main">
          <section className="block">
            <h3>Shot list</h3>
            {format.shotList.length === 0 && (
              <p className="muted small">
                No shot list yet for live videos.{' '}
                {video.url && (
                  <a href={video.url} target="_blank" rel="noreferrer">
                    Watch the reference on TikTok ↗
                  </a>
                )}{' '}
                and write the shots in the notes below.
              </p>
            )}
            <ol className="shots" hidden={format.shotList.length === 0}>
              {format.shotList.map((s) => (
                <li key={s.time}>
                  <span className="shot-time">{s.time}</span>
                  <span>
                    {s.shot}
                    {s.text && <span className="shot-text">Text: "{s.text}"</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="plan-two">
            <section className="block">
              <h3>Props</h3>
              <ul className="tick-list">
                {format.props.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
            <section className="block">
              <h3>You'll need</h3>
              <ul className="tick-list">
                {format.needs.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="block">
            <label htmlFor="editor-notes">
              <h3>Notes for the editor</h3>
            </label>
            <textarea
              id="editor-notes"
              rows={4}
              value={idea.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </section>

          <div className="plan-foot">
            <label className="select-field">
              <span className="field-label">Due date</span>
              <input
                id="due-date"
                type="date"
                value={idea.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
              />
            </label>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={copy}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? "Couldn't copy. Try again" : 'Copy brief for editor'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
