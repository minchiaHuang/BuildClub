import { useState } from 'react'
import { formats } from '../data/sample'
import { useApp } from '../lib/appContext'
import { t } from '../lib/i18n'
import { needLabel } from '../lib/needs'

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
        <span className="eyebrow">{t('home.addClient.eyebrow')}</span>
        <h1>{t('home.addClient.title')}</h1>
        <p className="muted">{t('home.addClient.intro')}</p>
      </header>

      <div className="settings-grid">
        <label className="field">
          <span className="field-label">{t('home.client.fieldName')}</span>
          <input
            id="new-client-name"
            value={name}
            placeholder={t('home.addClient.namePlaceholder')}
            aria-invalid={tried && nameMissing}
            aria-describedby={tried && nameMissing ? 'new-client-name-error' : undefined}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {tried && nameMissing && (
            <span id="new-client-name-error" className="field-error">
              {t('home.addClient.nameError')}
            </span>
          )}
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldNiche')}</span>
          <input id="new-client-niche" value={niche} placeholder={t('home.addClient.nichePlaceholder')} onChange={(e) => setNiche(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldAudience')}</span>
          <input id="new-client-audience" list="new-audience-options" value={audience} onChange={(e) => setAudience(e.target.value)} />
          <datalist id="new-audience-options">
            {allAudiences.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="field field-wide">
          <span className="field-label">{t('home.client.fieldTopics')}</span>
          <input
            id="new-client-topics"
            value={topics}
            placeholder={t('home.addClient.topicsPlaceholder')}
            onChange={(e) => setTopics(e.target.value)}
          />
          <span className="small muted">{t('home.client.topicsHelp')}</span>
        </label>
        <label className="field field-wide">
          <span className="field-label">{t('home.client.fieldExamples')}</span>
          <input
            id="new-client-examples"
            value={examples}
            placeholder={t('home.addClient.examplesPlaceholder')}
            onChange={(e) => setExamples(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('home.client.fieldTarget')}</span>
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
          <h3>{t('home.client.cannotTitle')}</h3>
          <span className="small muted">{t('home.client.cannotHelp')}</span>
        </legend>
        <div className="cannot-list">
          {allNeeds.map((need) => (
            <label key={need} className="check">
              <input type="checkbox" checked={cannot.includes(need)} onChange={() => toggleCannot(need)} />
              {needLabel(need)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {t('home.addClient.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('home.addClient.cancel')}
        </button>
      </div>
    </form>
  )
}
