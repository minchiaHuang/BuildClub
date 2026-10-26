import { useState } from 'react'
import type { Platform } from '../types'
import type { ChipGroup } from '../lib/clientChips'
import { PlatformToggles } from './PlatformToggles'
import { ClientChips } from './ClientChips'
import type { PulseInfo } from './ClientChips'
import { VoiceButton } from './VoiceButton'

interface Props {
  inputId: string
  value: string
  onValueChange: (text: string) => void
  onSearch: (text: string) => void
  platforms: Platform[]
  onPlatformsChange: (platforms: Platform[]) => void
  live: boolean
  clientName: string
  clientExamples: string[]
  chipGroups: ChipGroup[]
  pulse: PulseInfo
  onRefreshPulse: () => void
  autoFocus?: boolean
}

// The search card used on both the search page and the results page:
// platforms, the search bar (with voice), and one row of "Trending now" chips for the client.
export function SearchBox(p: Props) {
  const [listening, setListening] = useState(false)
  const trending = p.chipGroups.find((g) => g.id === 'trending')
  const oneRow = trending
    ? [trending]
    : [{ id: 'ideas' as const, title: 'Ideas to try', chips: p.clientExamples.slice(0, 5).map((e) => ({ label: e, value: e })) }]

  return (
    <form
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault()
        p.onSearch(p.value)
      }}
    >
      <div className="search-on">
        <span className="field-label">Search on</span>
        <PlatformToggles selected={p.platforms} onChange={p.onPlatformsChange} showSoon live={p.live} />
      </div>

      <label htmlFor={p.inputId} className="sr-only">
        Search a niche, ask a question, or paste a video link
      </label>
      <div className="search-row">
        <div className="search-input">
          <input
            id={p.inputId}
            value={p.value}
            onChange={(e) => p.onValueChange(e.target.value)}
            placeholder={
              listening
                ? 'Listening… say what you want to find'
                : p.live
                  ? `e.g. ${p.clientExamples[0] ?? 'tofu recipe'}`
                  : 'e.g. tofu, a question, or a TikTok / Reel link'
            }
            autoFocus={p.autoFocus}
          />
          <VoiceButton
            onText={p.onValueChange}
            onDone={(text) => {
              p.onValueChange(text)
              p.onSearch(text)
            }}
            onListeningChange={setListening}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!p.value.trim()}>
          {/https?:\/\//.test(p.value) ? 'Find more like this' : 'Find trending videos'}
        </button>
      </div>

      <ClientChips
        clientName={p.clientName}
        groups={oneRow}
        pulse={p.pulse}
        onPick={(value) => {
          p.onValueChange(value)
          p.onSearch(value)
        }}
        onRefresh={p.onRefreshPulse}
      />
    </form>
  )
}
