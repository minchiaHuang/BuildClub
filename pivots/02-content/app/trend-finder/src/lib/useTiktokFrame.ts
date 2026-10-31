import { useEffect, useRef, useState } from 'react'
import { READY_TIMEOUT_MS, currentTimeOf, isPlayerError, parsePlayerMessage } from './tiktokPlayer.ts'

// Listens to one TikTok player iframe. Messages are matched to the iframe by `event.source`.
// Reports ready / muted state and a failure: an onPlayerError, or no onPlayerReady within 6 s of the page loading.
export function useTiktokFrame(frame: HTMLIFrameElement | null, opts: { initialMuted: boolean; armOnMount?: boolean; onReady?: () => void; onFail?: () => void }) {
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(opts.initialMuted)
  const [failed, setFailed] = useState(false)
  // Where the player is now, in seconds; a ref because it changes several times a second and nothing re-renders for it.
  const timeRef = useRef<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  // Ready can arrive before the iframe's load event (the player is script-driven); once it has, never arm the timer again.
  const readyRef = useRef(false)
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
      const at = currentTimeOf(m)
      if (at !== null) timeRef.current = at
      if (m.type === 'onPlayerReady') {
        readyRef.current = true
        window.clearTimeout(timer.current)
        setReady(true)
        cb.current.onReady?.()
      } else if (m.type === 'onMute' && typeof m.value === 'boolean') setMuted(m.value)
      else if (isPlayerError(m)) fail()
    }
    window.addEventListener('message', onMessage)
    // The 6 s clock starts at mount for an eager iframe (so a load that never fires still falls back), or at the iframe's
    // load for a lazy one (off screen it has not started yet). Never once the player is ready.
    const arm = () => {
      if (readyRef.current) return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(fail, READY_TIMEOUT_MS)
    }
    if (cb.current.armOnMount) arm()
    frame.addEventListener('load', arm)
    return () => {
      window.removeEventListener('message', onMessage)
      frame.removeEventListener('load', arm)
      window.clearTimeout(timer.current)
    }
  }, [frame])

  return { ready, muted, setMuted, failed, timeRef }
}
