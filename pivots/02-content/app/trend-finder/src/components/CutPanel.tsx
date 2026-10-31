import { useEffect, useRef, useState } from 'react'
import type { IdeaStatus } from '../types'
import type { CutState } from '../lib/cut'
import { SPEEDS, canStartCut, checkMusic, deleteMusic, formatDuration, getCut, pollCut, putMusic, startCut } from '../lib/cut'
import { formatSize } from '../lib/takes'

interface Props {
  ideaId: string
  status: IdeaStatus
  shotCount: number
  // Shots (of shotCount) that have a chosen take.
  shotsDone: number
  // Bumped whenever the takes change, so a finished cut can be checked for staleness without a reload.
  takesRevision?: number
}

const speedLabel = (s: number) => (s === 1 ? 'Normal' : `${s}x`)
const isActive = (c: CutState | null) => c?.status === 'queued' || c?.status === 'running'

// "Make the video": joins the chosen takes of an approved plan into one publishable 9:16 MP4.
export function CutPanel({ ideaId, status, shotCount, shotsDone, takesRevision = 0 }: Props) {
  const [cut, setCut] = useState<CutState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Bumped to (re)load the state and resume polling when it is still active.
  const [loadKey, setLoadKey] = useState(0)
  const [speed, setSpeed] = useState(1.1)
  const speedSynced = useRef(false) // the picker follows the loaded cut once, then the user's choice
  const [licensed, setLicensed] = useState(false)
  const [musicBusy, setMusicBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoadError(null)
    void (async () => {
      try {
        const state = await getCut(ideaId, shotCount)
        if (ac.signal.aborted) return
        setCut(state)
        if (!speedSynced.current && state.status !== 'none' && SPEEDS.includes(state.speed)) setSpeed(state.speed)
        speedSynced.current = true
        if (isActive(state)) await pollCut(ideaId, (s) => setCut(s), { signal: ac.signal })
      } catch (e) {
        if (!ac.signal.aborted) setLoadError((e as Error).message)
      }
    })()
    return () => ac.abort()
  }, [ideaId, loadKey, shotCount])

  // Re-read the state (for `stale`) when the takes change, unless a job is active and already being polled.
  const activeRef = useRef(false)
  activeRef.current = isActive(cut)
  useEffect(() => {
    if (takesRevision > 0 && !activeRef.current) setLoadKey((k) => k + 1)
  }, [takesRevision])

  const approved = status === 'approved'
  const active = isActive(cut)
  const output = cut?.output
  if (!approved && !output && !active) return null

  const ready = canStartCut({ status, shotsDone, shotsTotal: shotCount, active })

  const start = async () => {
    setError(null)
    setStarting(true)
    try {
      setCut(await startCut(ideaId, shotCount, speed))
      setLoadKey((k) => k + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const music = async (action: () => Promise<CutState>) => {
    setError(null)
    setMusicBusy(true)
    try {
      const res = await action()
      // Merge only the music: the job state may have moved on since this request started.
      setCut((prev) => (prev ? { ...prev, music: res.music, stale: res.stale } : res))
      // Each upload needs a fresh license confirmation.
      setLicensed(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setMusicBusy(false)
    }
  }

  const upload = (file: File) => {
    const problem = checkMusic(file)
    if (problem) return setError(problem)
    void music(() => putMusic(ideaId, file))
  }

  return (
    <section className="block cut-panel">
      <h3>Make the video</h3>

      {approved && !ready && !active && (
        <p className="muted small">
          Choose a take for every shot first ({shotsDone} of {shotCount}).
        </p>
      )}

      {approved && (
        <div className="cut-options">
          <label className="cut-speed">
            <span className="small">Speed</span>
            <select value={speed} disabled={active} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {speedLabel(s)}
                </option>
              ))}
            </select>
          </label>

          <div className="cut-music">
            <span className="small">Add music (optional)</span>
            {cut?.music ? (
              <div className="cut-music-file">
                <span className="take-name" title={cut.music.name}>
                  {cut.music.name}
                </span>
                <span className="muted small">{formatSize(cut.music.size)}</span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={active || musicBusy} onClick={() => void music(() => deleteMusic(ideaId))}>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <label className="cut-license small">
                  <input type="checkbox" checked={licensed} disabled={active} onChange={(e) => setLicensed(e.target.checked)} />
                  <span>I own this music or have the license to use it in this video.</span>
                </label>
                <label className={`btn btn-ghost btn-sm take-add${!licensed || active || musicBusy ? ' is-disabled' : ''}`} aria-disabled={!licensed || active || musicBusy}>
                  {musicBusy ? 'Uploading…' : 'Choose a music file'}
                  <input
                    type="file"
                    hidden
                    accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,.mp3,.m4a,.wav"
                    disabled={!licensed || active || musicBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) upload(file)
                    }}
                  />
                </label>
              </>
            )}
          </div>

          {cut?.status !== 'failed' && (
            <button type="button" className="btn btn-primary" disabled={!ready || starting || musicBusy} onClick={() => void start()}>
              Make the video
            </button>
          )}
        </div>
      )}

      {active && cut && (
        <div className="cut-progress" role="status">
          <progress value={cut.progress} max={1} />
          <span className="muted small">{cut.step}</span>
        </div>
      )}

      {cut?.status === 'failed' && (
        <div className="cut-failed">
          <p className="error" role="alert">
            {cut.error}
          </p>
          {approved && (
            <button type="button" className="btn btn-primary" disabled={!ready || starting || musicBusy} onClick={() => void start()}>
              Try again
            </button>
          )}
        </div>
      )}

      {loadError && (
        <p className="error" role="alert">
          {loadError}{' '}
          <button type="button" className="link-btn" onClick={() => setLoadKey((k) => k + 1)}>
            Retry
          </button>
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {output && (
        <div className="cut-output">
          {cut?.stale && <p className="small">The takes or music changed after this was made. Make it again.</p>}
          <video key={output.url} controls playsInline preload="metadata" src={output.url} />
          <div className="cut-output-meta">
            <a className="btn btn-ghost btn-sm" href={`${output.url}${output.url.includes('?') ? '&' : '?'}download=1`} download>
              Download
            </a>
            <span className="muted small">
              {formatDuration(output.durationSec)} · {formatSize(output.size)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
