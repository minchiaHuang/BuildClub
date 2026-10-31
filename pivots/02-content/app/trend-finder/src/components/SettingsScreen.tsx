import type { Client, Format, SavedIdea, Video } from '../types'
import { formats } from '../data/sample'
import { ClientMemory } from './ClientMemory'

interface Props {
  client: Client
  onChange: (patch: Partial<Client>) => void
  // For client memory, to name each plan.
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
}

// Everything a format can need, so the agency can tick what this client can't do.
const allNeeds = [...new Set(formats.flatMap((f) => f.needs))]
const allAudiences = [...new Set(formats.flatMap((f) => f.audiences))]

export function SettingsScreen({ client, onChange, ideas, videoById, formatById }: Props) {
  const toggleCannot = (need: string) =>
    onChange({
      cannot: client.cannot.includes(need) ? client.cannot.filter((n) => n !== need) : [...client.cannot, need],
    })

  return (
    <section className="settings">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Client settings</span>
        <h1>About this client</h1>
        <p className="muted">Used for the search suggestions, the "Can they film this?" check and the monthly target. Changes save as you type.</p>
      </header>

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
        <label className="field field-wide">
          <span className="field-label">Topics to watch (comma-separated)</span>
          <input
            id="client-topics"
            value={(client.topics ?? []).join(', ')}
            placeholder="e.g. sydney nightclub, club night"
            onChange={(e) => onChange({ topics: e.target.value.split(',').map((t) => t.trimStart()) })}
            onBlur={(e) => onChange({ topics: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
          <span className="small muted">The first topic is checked on TikTok once a day for the "Trending now" chips.</span>
        </label>
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

      <ClientMemory client={client} ideas={ideas} videoById={videoById} formatById={formatById} />
    </section>
  )
}
