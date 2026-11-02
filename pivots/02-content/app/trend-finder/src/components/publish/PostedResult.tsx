import { useEffect, useState } from 'react'
import { getPublishMode, ideaResultLine } from '../../lib/publish'
import { usePublishSummary } from './usePublishSummary'
import { t } from '../../lib/i18n'

let modeCache: Promise<boolean> | null = null
const loadSimulated = () => (modeCache ??= getPublishMode().then((m) => m.simulated, () => true))

// The result of a posted video on its board card: "12.4k views · 7.7% engagement". When the server only
// simulates posting, the card says so, so a simulated post never reads as a real one.
export function PostedResult({ ideaId }: { ideaId: string }) {
  const summary = usePublishSummary()
  const [simulated, setSimulated] = useState(false)
  useEffect(() => {
    let live = true
    void loadSimulated().then((s) => live && setSimulated(s))
    return () => {
      live = false
    }
  }, [])
  const line = ideaResultLine(summary?.ideas.find((i) => i.ideaId === ideaId))
  if (!line && !simulated) return null
  return (
    <p className="pub-card-result small">
      {simulated && <span className="pill pill-wait pub-badge">{t('cut.common.simulated')}</span>}{' '}
      {line ? (
        <>
          <span className="pb-next-label">{t('cut.pub.result')}</span> {line}
        </>
      ) : (
        <span className="muted">{t('cut.pub.noNumbersShort')}</span>
      )}
    </p>
  )
}
