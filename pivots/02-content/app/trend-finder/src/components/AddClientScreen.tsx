import { useState } from 'react'
import { formats } from '../data/sample'
import { useApp } from '../lib/appContext'

interface Props {
  // Ids already in use, so the new client's id is unique.
  takenIds: string[]
  // Called with the new client's id once it's saved.
  onCreated: (clientId: string) => void
  onCancel: () => void
}

// Same lists as client settings.
const allNeeds = [...new Set(formats.flatMap((f) => f.needs))]
const allAudiences = [...new Set(formats.flatMap((f) => f.audiences))]

const splitList = (text: string) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

// "Mia's Bakery" -> "mias-bakery", with -2, -3 added if that id is taken.
function newId(name: string, taken: string[]) {
  const base =
    name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'client'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

// The add-client form: the same fields as client settings, saved in one go.
export function AddClientScreen({ takenIds, onCreated, onCancel }: Props) {
  const { addClient } = useApp()
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [audience, setAudience] = useState('')
  const [topics, setTopics] = useState('')
  const [examples, setExamples] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState(8)
  const [cannot, setCannot] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const nameMissing = !name.trim()

  const toggleCannot = (need: string) =>
    setCannot((prev) => (prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (nameMissing) {
      document.getElementById('new-client-name')?.focus()
      return
    }
    const topicList = splitList(topics)
    const id = newId(name, takenIds)
    addClient({
      id,
      name: name.trim(),
      niche: niche.trim(),
      audience: audience.trim(),
      monthlyTarget,
      // With no starter searches, the topics (or what they sell) give the search page something to start from.
      examples: splitList(examples).length ? splitList(examples) : topicList.length ? topicList : splitList(niche),
      topics: topicList,
      cannot,
      memory: [],
    })
    onCreated(id)
  }

  return (
    <form className="settings add-client" onSubmit={save} noValidate>
      <header className="page-head">
        <span className="eyebrow">Add client</span>
        <h1>Add a client</h1>
        <p className="muted">Only the name is needed now. You can change everything later in client settings.</p>
      </header>

      <div className="settings-grid">
        <label className="field">
          <span className="field-label">Client name</span>
          <input
            id="new-client-name"
            value={name}
            placeholder="e.g. Mia's Bakery"
            aria-invalid={tried && nameMissing}
            aria-describedby={tried && nameMissing ? 'new-client-name-error' : undefined}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {tried && nameMissing && (
            <span id="new-client-name-error" className="field-error">
              Add the client's name.
            </span>
          )}
        </label>
        <label className="field">
          <span className="field-label">What they sell</span>
          <input id="new-client-niche" value={niche} placeholder="e.g. sourdough and cakes" onChange={(e) => setNiche(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Main audience</span>
          <input id="new-client-audience" list="new-audience-options" value={audience} onChange={(e) => setAudience(e.target.value)} />
          <datalist id="new-audience-options">
            {allAudiences.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="field field-wide">
          <span className="field-label">Topics to watch (comma-separated)</span>
          <input
            id="new-client-topics"
            value={topics}
            placeholder="e.g. sourdough, bakery tour"
            onChange={(e) => setTopics(e.target.value)}
          />
          <span className="small muted">The first topic is checked on TikTok once a day for the "Trending now" chips.</span>
        </label>
        <label className="field field-wide">
          <span className="field-label">Starter searches (comma-separated)</span>
          <input
            id="new-client-examples"
            value={examples}
            placeholder="e.g. bread making asmr, cake decorating"
            onChange={(e) => setExamples(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Videos per month</span>
          <input
            id="new-client-target"
            type="number"
            min={1}
            max={60}
            value={monthlyTarget}
            onChange={(e) => setMonthlyTarget(Math.max(1, Number(e.target.value) || 1))}
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
              <input type="checkbox" checked={cannot.includes(need)} onChange={() => toggleCannot(need)} />
              {need}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Save and find ideas
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
