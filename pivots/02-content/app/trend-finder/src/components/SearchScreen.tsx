import type { Platform } from '../types'
import type { Query } from '../state'
import { clients } from '../data/sample'
import { platformName } from '../lib/metrics'

export interface Attachment {
  name: string
  url: string
}

interface Props {
  query: Query
  setQuery: (q: Query) => void
  onSearch: (text: string) => void
  attachment: Attachment | null
  setAttachment: (a: Attachment | null) => void
}

const allPlatforms: Platform[] = ['instagram', 'tiktok']

const examples = [
  'tofu',
  'tofu desserts for busy mums',
  'why is crispy tofu trending?',
  'tofu taste tests on TikTok this week',
  'https://www.tiktok.com/@smallkitchen.sample/video/crispy-tofu',
]

export function SearchScreen({ query, setQuery, onSearch, attachment, setAttachment }: Props) {
  const attach = (file: File) => {
    setAttachment({ name: file.name || 'screenshot.png', url: URL.createObjectURL(file) })
    // An old link in the box would compete with the screenshot, so clear it.
    if (/https?:\/\//.test(query.keyword)) setQuery({ ...query, keyword: '' })
  }

  const togglePlatform = (p: Platform) => {
    const has = query.platforms.includes(p)
    const next = has ? query.platforms.filter((x) => x !== p) : [...query.platforms, p]
    if (next.length) setQuery({ ...query, platforms: next })
  }

  return (
    <section className="search-screen">
      <div className="search-intro">
        <span className="eyebrow">Step 1 · Search</span>
        <h1>Find videos that are working right now</h1>
        <p className="lede">
          Type a niche or ask a question in plain words. We search Instagram and TikTok, rank videos from small
          accounts with big views, and show which formats are spreading.
        </p>
      </div>

      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(query.keyword)
        }}
      >
        <label htmlFor="keyword" className="field-label">
          Search a niche, ask a question, or paste a video link
        </label>
        <div className="search-row">
          <div className="search-input">
            {attachment && (
              <span className="attach-chip">
                <img src={attachment.url} alt="" />
                {attachment.name}
                <button type="button" className="q-chip-x" aria-label="Remove screenshot" onClick={() => setAttachment(null)}>
                  ✕
                </button>
              </span>
            )}
            <input
              id="keyword"
              value={query.keyword}
              onChange={(e) => setQuery({ ...query, keyword: e.target.value })}
              onPaste={(e) => {
                const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
                if (file) {
                  e.preventDefault()
                  attach(file)
                }
              }}
              placeholder={attachment ? 'Press Find to see more like this' : 'e.g. tofu, a question, or a TikTok / Reel link'}
              autoFocus
            />
            <label className="attach-btn" title="Attach a screenshot of a video">
              <input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) attach(file)
                  e.target.value = ''
                }}
              />
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.4 11.6-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></svg>
              <span className="sr-only">Attach a screenshot</span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary">
            {attachment || /https?:\/\//.test(query.keyword) ? 'Find more like this' : 'Find trending videos'}
          </button>
        </div>

        <div className="search-options">
          <fieldset className="chip-group">
            <legend className="field-label">Platforms</legend>
            {allPlatforms.map((p) => (
              <button
                type="button"
                key={p}
                className={`chip ${query.platforms.includes(p) ? 'chip-on' : ''}`}
                aria-pressed={query.platforms.includes(p)}
                onClick={() => togglePlatform(p)}
              >
                {platformName[p]}
              </button>
            ))}
            <button type="button" className="chip" disabled title="Coming later">
              YouTube Shorts · soon
            </button>
          </fieldset>

          <label className="select-field">
            <span className="field-label">Posted in</span>
            <select id="days" value={query.days} onChange={(e) => setQuery({ ...query, days: Number(e.target.value) })}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>

          <label className="select-field">
            <span className="field-label">Video length</span>
            <select
              id="length"
              value={query.maxLength}
              onChange={(e) => setQuery({ ...query, maxLength: Number(e.target.value) })}
            >
              <option value={0}>Any length</option>
              <option value={15}>Under 15 sec</option>
              <option value={30}>Under 30 sec</option>
              <option value={60}>Under 60 sec</option>
            </select>
          </label>

          <label className="select-field">
            <span className="field-label">For client</span>
            <select id="client" value={query.clientId} onChange={(e) => setQuery({ ...query, clientId: e.target.value })}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div className="examples">
        <span className="field-label">Try:</span>
        {examples.map((ex) => (
          <button key={ex} type="button" className="example" onClick={() => onSearch(ex)}>
            {ex.startsWith('http') ? 'Paste a TikTok link (example)' : ex}
          </button>
        ))}
      </div>

      <p className="hint">Sample data covers one niche for now: tofu.</p>
    </section>
  )
}
