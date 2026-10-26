import { useState } from 'react'
import type { Query } from '../state'
import { formats, videos } from '../data/sample'
import { focusFirstSuggestion } from '../lib/suggest'
import { PlatformToggles } from './PlatformToggles'
import { Suggestions } from './Suggestions'
import { ClientChips } from './ClientChips'
import type { PulseInfo } from './ClientChips'
import type { ChipGroup } from '../lib/clientChips'
import { VoiceButton } from './VoiceButton'

interface Props {
  query: Query
  setQuery: (q: Query) => void
  onSearch: (text: string) => void
  clientName: string
  // Live mode searches real TikTok videos; otherwise the sample tofu data.
  live: boolean
  clientExamples: string[]
  error: string | null
  // Client-specific chips: trending now, fits the audience, more like saved ideas.
  chipGroups: ChipGroup[]
  pulse: PulseInfo
  onRefreshPulse: () => void
}

// Sample mode only: show that questions and video links work too.
const sampleExtras = ['why is crispy tofu trending?', 'https://www.tiktok.com/@smallkitchen.sample/video/crispy-tofu']

export function SearchScreen(props: Props) {
  const { query, setQuery, onSearch, clientName, live, error } = props
  const [listening, setListening] = useState(false)

  return (
    <section className="search-screen">
      <div className="search-intro">
        <span className="eyebrow">{clientName} · Search</span>
        <h1>Find videos that are working right now</h1>
        <p className="lede">
          {live
            ? 'Type what this client is about. We search TikTok live, rank videos by how far they beat the account’s size, and show which sounds and hashtags keep coming up.'
            : 'Type a niche or ask a question in plain words. We search Instagram and TikTok, rank videos from small accounts with big views, and show which formats are spreading.'}
        </p>
      </div>

      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(query.keyword)
        }}
      >
        <div className="search-on">
          <span className="field-label">Search on</span>
          <PlatformToggles
            selected={query.platforms}
            onChange={(platforms) => setQuery({ ...query, platforms })}
            showSoon
            live={live}
          />
        </div>

        <label htmlFor="keyword" className="sr-only">
          Search a niche, ask a question, or paste a video link
        </label>
        <div className="search-row">
          <div className="search-input">
            <input
              id="keyword"
              value={query.keyword}
              onChange={(e) => setQuery({ ...query, keyword: e.target.value })}
              onKeyDown={focusFirstSuggestion}
              placeholder={
                listening
                  ? 'Listening… say what you want to find'
                  : live
                    ? `e.g. ${props.clientExamples[0] ?? 'tofu recipe'}`
                    : 'e.g. tofu, a question, or a TikTok / Reel link'
              }
              autoFocus
            />
            <VoiceButton
              onText={(text) => setQuery({ ...query, keyword: text })}
              onDone={onSearch}
              onListeningChange={setListening}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!query.keyword.trim()}>
            {/https?:\/\//.test(query.keyword) ? 'Find more like this' : 'Find trending videos'}
          </button>
        </div>

        <Suggestions
          text={live ? '' : query.keyword}
          formats={formats}
          videos={videos}
          inputId="keyword"
          onRefine={(value) => setQuery({ ...query, keyword: value })}
          onAsk={onSearch}
          fallback={
            <ClientChips
              clientName={clientName}
              groups={props.chipGroups}
              pulse={props.pulse}
              onPick={onSearch}
              onRefresh={props.onRefreshPulse}
              extra={
                live ? null : (
                  <div className="chip-group">
                    <span className="chip-group-title">You can also</span>
                    <div className="chip-row">
                      {sampleExtras.map((ex) => (
                        <button key={ex} type="button" className="example" onClick={() => onSearch(ex)}>
                          {ex.startsWith('http') ? 'Paste a TikTok link (example)' : `Ask: ${ex}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              }
            />
          }
        />
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        {live
          ? 'Live TikTok search. Each new search costs a few cents of Apify credit; repeats within 24 hours are free.'
          : 'Sample data covers one niche for now: tofu. Add an Apify key to turn on live TikTok search (see README).'}
      </p>
    </section>
  )
}
