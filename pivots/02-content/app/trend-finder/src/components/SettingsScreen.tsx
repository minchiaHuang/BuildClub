import type { Client, Format, SavedIdea, Video } from '../types'
import { formats } from '../data/sample'
import { t } from '../lib/i18n'
import { ClientMemory } from './ClientMemory'
import { needLabel } from '../lib/needs'

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
        <span className="eyebrow">{t('home.settings.eyebrow', { name: client.name })}</span>
        <h1>{t('home.settings.title')}</h1>
        <p className="muted">{t('home.settings.intro')}</p>
      </header>

      <div className="settings-grid">
        <label className="field">
          <span className="field-label">{t('home.client.fieldName')}</span>
          <input id="client-name" value={client.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldNiche')}</span>
          <input id="client-niche" value={client.niche} onChange={(e) => onChange({ niche: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldAudience')}</span>
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
          <span className="field-label">{t('home.client.fieldTopics')}</span>
          <input
            id="client-topics"
            value={(client.topics ?? []).join(', ')}
            placeholder={t('home.settings.topicsPlaceholder')}
            onChange={(e) => onChange({ topics: e.target.value.split(',').map((t) => t.trimStart()) })}
            onBlur={(e) => onChange({ topics: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
          <span className="small muted">{t('home.client.topicsHelp')}</span>
        </label>
        <label className="field field-wide">
          <span className="field-label">{t('home.client.fieldExamples')}</span>
          <input
            id="client-examples"
            value={client.examples.join(', ')}
            onChange={(e) => onChange({ examples: e.target.value.split(',').map((t) => t.trimStart()) })}
            onBlur={(e) => onChange({ examples: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldTarget')}</span>
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

      {/* The can't-film rules and the decisions behind them, side by side */}
      <div className="brief-pair">
        <fieldset className="cannot">
          <legend>
            <h3>{t('home.client.cannotTitle')}</h3>
            <span className="small muted">{t('home.client.cannotHelp')}</span>
          </legend>
          <div className="cannot-list">
            {allNeeds.map((need) => (
              <label key={need} className="check">
                <input type="checkbox" checked={client.cannot.includes(need)} onChange={() => toggleCannot(need)} />
                {needLabel(need)}
              </label>
            ))}
          </div>
        </fieldset>

        <ClientMemory client={client} ideas={ideas} videoById={videoById} formatById={formatById} />
      </div>
    </section>
  )
}
