import { useEffect, useRef, useState } from 'react'
import { READY_TIMEOUT_MS, isPlayerError, parsePlayerMessage } from './tiktokPlayer.ts'

// Listens to one TikTok player iframe. Messages are matched to the iframe by `event.source`.
// Reports ready / muted state and a failure: an onPlayerError, or no onPlayerReady within 6 s of the page loading.
export function useTiktokFrame(frame: HTMLIFrameElement | null, opts: { initialMuted: boolean; onReady?: () => void; onFail?: () => void }) {
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(opts.initialMuted)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const cb = useRef(opts)
  useEffect(() => {
    cb.current = opts
  })

  useEffect(() => {
    if (!frame) return
    const fail = () => {
      window.clearTimeout(timer.current)
      setFailed(true)
      cb.current.onFail?.()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return
      const m = parsePlayerMessage(e.origin, e.data)
      if (!m) return
      if (m.type === 'onPlayerReady') {
        window.clearTimeout(timer.current)
        setReady(true)
        cb.current.onReady?.()
      } else if (m.type === 'onMute' && typeof m.value === 'boolean') setMuted(m.value)
      else if (isPlayerError(m)) fail()
    }
    window.addEventListener('message', onMessage)
    // The 6 s clock starts once the iframe's page has loaded (a lazy iframe off screen has not started yet).
    const onLoad = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(fail, READY_TIMEOUT_MS)
    }
    frame.addEventListener('load', onLoad)
    return () => {
      window.removeEventListener('message', onMessage)
      frame.removeEventListener('load', onLoad)
      window.clearTimeout(timer.current)
    }
  }, [frame])

  return { ready, muted, setMuted, failed }
}
