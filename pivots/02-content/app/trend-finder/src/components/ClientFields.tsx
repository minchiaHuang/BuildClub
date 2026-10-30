import { useState } from 'react'
import type { Client } from '../types'
import { formats } from '../data/sample'

// Everything a format can need, so the agency can tick what this client can't do.
const allNeeds = [...new Set(formats.flatMap((f) => f.needs))]
const allAudiences = [...new Set(formats.flatMap((f) => f.audiences))]

// The editable fields of a client, shared by the Settings screen and the "Add client" form.
export function ClientFields({ client, onChange }: { client: Client; onChange: (patch: Partial<Client>) => void }) {
  const toggleCannot = (need: string) =>
    onChange({
      cannot: client.cannot.includes(need) ? client.cannot.filter((n) => n !== need) : [...client.cannot, need],
    })

  return (
    <>
      <div className="settings-grid">
        <label className="field">
          <span className="field-label">Client name</span>
          <input id="client-name" value={client.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">What they sell</span>
          <input id="client-niche" value={client.niche} onChange={(e) => onChange({ niche: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Main audience</span>
          <input
            id="client-audience"
            list="audience-options"
            value={client.audience}
            onChange={(e) => onChange({ audience: e.target.value })}
          />
          <datalist id="audience-options">
            {allAudiences.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <div className="field field-wide">
          <label className="field-label" htmlFor="client-topics">
            Topics to watch
          </label>
          <TopicTags topics={client.topics ?? []} onChange={(topics) => onChange({ topics })} />
          <span className="small muted">
            Press Enter to add each one. The first topic is checked on TikTok once a day for the "Trending now" chips.
          </span>
        </div>
        <label className="field field-wide">
          <span className="field-label">Starter searches (comma-separated)</span>
          <input
            id="client-examples"
            value={client.examples.join(', ')}
            onChange={(e) => onChange({ examples: e.target.value.split(',').map((t) => t.trimStart()) })}
            onBlur={(e) => onChange({ examples: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
        </label>
        <label className="field">
          <span className="field-label">Videos per month</span>
          <input
            id="client-target"
            type="number"
            min={1}
            max={60}
            value={client.monthlyTarget}
            onChange={(e) => onChange({ monthlyTarget: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>

      <fieldset className="cannot">
        <legend>
          <h3>What this client can't do</h3>
          <span className="small muted">Ticked items flag videos as hard to film for this client.</span>
        </legend>
        <div className="cannot-list">
          {allNeeds.map((need) => (
            <label key={need} className="check">
              <input type="checkbox" checked={client.cannot.includes(need)} onChange={() => toggleCannot(need)} />
              {need}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

// One tag per topic: Enter or a comma adds what was typed, Backspace on an empty box takes off the last one.
function TopicTags({ topics, onChange }: { topics: string[]; onChange: (topics: string[]) => void }) {
  const [text, setText] = useState('')
  const add = (typed: string[], rest = '') => {
    const next = [...topics]
    for (const t of typed.map((x) => x.trim())) if (t && !next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t)
    if (next.length > topics.length) onChange(next)
    setText(rest)
  }

  return (
    <div className="topic-tags">
      {topics.map((t) => (
        <span key={t} className="q-chip q-chip-topic">
          {t}
          <button
            type="button"
            className="q-chip-x"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(topics.filter((x) => x !== t))}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        id="client-topics"
        value={text}
        placeholder={topics.length ? 'Add another topic' : 'e.g. sydney nightclub'}
        // A pasted "a, b, c" becomes three tags.
        onChange={(e) => {
          const parts = e.target.value.split(',')
          if (parts.length > 1) add(parts.slice(0, -1), parts[parts.length - 1].trimStart())
          else setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Enter adds a tag here; it must not submit the form around it.
            e.preventDefault()
            add([text])
          } else if (e.key === 'Backspace' && !text && topics.length) onChange(topics.slice(0, -1))
        }}
        // A topic typed but not yet added still counts when the box is left.
        onBlur={() => add([text])}
      />
    </div>
  )
}
