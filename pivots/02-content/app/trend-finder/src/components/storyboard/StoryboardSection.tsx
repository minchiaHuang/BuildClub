import { useCallback, useEffect, useRef, useState } from 'react'
import type { Shot } from '../../types'
import {
  EditedLine,
  editLine,
  makeFrame,
  mergeFrame,
  mergeScript,
  mergeShotScript,
  paletteFromImage,
  purposeFor,
  setPalette,
  writeScript,
  writeShotScript,
} from '../../lib/storyboard'
import { ShotItem } from './ShotItem'
import type { Busy } from './ShotItem'

interface Props {
  ideaId: string
  shots: Shot[]
  // False when the plan is approved or waiting: everything shows, nothing changes.
  editable: boolean
  // Saves the shots through the plan's normal save path.
  onShots: (next: Shot[]) => void
}

type View = 'cards' | 'table'
const VIEW_KEY = 'remake.storyboard-view'
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'
  } catch {
    return 'cards'
  }
}

// The plan is saved a moment after each change; the generate routes read the saved plan, so wait for it.
const SAVE_SETTLE_MS = 800
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function StoryboardSection({ ideaId, shots, editable, onShots }: Props) {
  const [view, setViewState] = useState<View>(readView)
  const [busy, setBusy] = useState<Record<number, Exclude<Busy, undefined>>>({})
  const [scriptBusy, setScriptBusy] = useState(false)
  const [scriptErrors, setScriptErrors] = useState<Record<number, string>>({})
  const [frameErrors, setFrameErrors] = useState<Record<number, string>>({})
  const [confirm, setConfirm] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')

  // Always the newest shots, including results that arrived since the last render.
  const latest = useRef(shots)
  const lastChange = useRef(0)
  useEffect(() => {
    latest.current = shots
  }, [shots])
  const apply = useCallback(
    (change: (s: Shot[]) => Shot[]) => {
      const next = change(latest.current)
      latest.current = next
      lastChange.current = Date.now()
      onShots(next)
    },
    [onShots],
  )
  const settle = async () => {
    const wait = SAVE_SETTLE_MS - (Date.now() - lastChange.current)
    if (wait > 0) await sleep(wait)
  }
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // The choice just isn't remembered.
    }
  }
  const mark = (i: number, kind: Exclude<Busy, undefined> | null) =>
    setBusy((b) => {
      const next = { ...b }
      if (kind) next[i] = kind
      else delete next[i]
      return next
    })
  const setError = (set: typeof setScriptErrors, i: number, text?: string) =>
    set((e) => {
      const next = { ...e }
      if (text) next[i] = text
      else delete next[i]
      return next
    })

  const total = shots.length
  const anyLine = shots.some((s) => s.line?.trim())
  const anyBusy = scriptBusy || Object.keys(busy).length > 0

  const writeAll = async () => {
    setProblem('')
    setNotice('')
    setScriptBusy(true)
    try {
      // Plans still on the suggested shots have none of their own saved yet; save them first so the server sees them.
      apply((s) => s.map((x, i) => ({ ...x, purpose: x.purpose ?? purposeFor(i, s.length) })))
      await settle()
      const res = await writeScript(ideaId)
      const kept = latest.current.filter((s) => s.edited).length
      apply((s) => mergeScript(s, res.shots))
      setNotice(
        `${res.source === 'demo' ? 'Sample script written' : 'Script written'}.${kept ? ` ${kept} edited ${kept === 1 ? 'line was' : 'lines were'} kept.` : ''}`,
      )
    } catch (e) {
      setProblem((e as Error).message)
    } finally {
      setScriptBusy(false)
    }
  }

  const rewrite = async (i: number, force: boolean) => {
    setConfirm(null)
    setError(setScriptErrors, i)
    mark(i, 'script')
    try {
      await settle()
      const res = await writeShotScript(ideaId, i, force)
      apply((s) => mergeShotScript(s, i, res))
    } catch (e) {
      if (e instanceof EditedLine) setConfirm(i)
      else setError(setScriptErrors, i, (e as Error).message)
    } finally {
      mark(i, null)
    }
  }
  const askRewrite = (i: number) => {
    if (latest.current[i]?.edited) setConfirm(i)
    else void rewrite(i, false)
  }

  const frame = async (i: number) => {
    setError(setFrameErrors, i)
    mark(i, 'frame')
    try {
      await settle()
      const s = latest.current[i]
      const res = await makeFrame(ideaId, i, { line: s?.line, purpose: s?.purpose ?? purposeFor(i, latest.current.length) })
      apply((cur) => mergeFrame(cur, i, res.frameImage))
    } catch (e) {
      setError(setFrameErrors, i, (e as Error).message)
    } finally {
      mark(i, null)
    }
  }

  const loaded = (i: number, img: HTMLImageElement) => {
    if (!editable || latest.current[i]?.palette?.length) return
    const colors = paletteFromImage(img)
    if (colors.length > 0) apply((s) => setPalette(s, i, colors))
  }

  if (!editable && !anyLine && !shots.some((s) => s.frameImage)) return null

  const items = shots.map((s, i) => (
    <ShotItem
      key={i}
      shot={s}
      index={i}
      total={total}
      layout={view === 'table' ? 'row' : 'card'}
      editable={editable}
      busy={busy[i]}
      frameError={frameErrors[i]}
      scriptError={scriptErrors[i]}
      confirming={confirm === i}
      onLine={(line) => apply((cur) => editLine(cur, i, line))}
      onRewrite={() => askRewrite(i)}
      onConfirmRewrite={() => void rewrite(i, true)}
      onKeepMine={() => setConfirm(null)}
      onFrame={() => void frame(i)}
      onFrameLoaded={(img) => loaded(i, img)}
    />
  ))

  return (
    <section className="block sb-section" aria-labelledby="sb-title">
      <div className="sb-bar">
        <h3 id="sb-title">Script and storyboard</h3>
        <div className="sb-toggle" role="group" aria-label="Layout">
          <button type="button" className="sb-toggle-btn" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
            Cards
          </button>
          <button type="button" className="sb-toggle-btn" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Script table
          </button>
        </div>
      </div>
      <p className="small muted">
        {editable
          ? 'One line and one frame for each shot. Lines you edit are kept when you rewrite the script.'
          : 'The script and frames for this plan. Take the plan back to change them.'}
      </p>
      {editable && (
        <div className="sb-bar-actions">
          <button type="button" className={`btn btn-sm ${anyLine ? 'btn-ghost' : 'btn-primary'}`} disabled={total === 0 || anyBusy} onClick={() => void writeAll()}>
            {scriptBusy ? 'Writing…' : anyLine ? 'Rewrite the script' : 'Write the script'}
          </button>
          {notice && (
            <span className="small muted" role="status">
              {notice}
            </span>
          )}
        </div>
      )}
      {problem && (
        <p className="sb-error" role="alert">
          {problem}
        </p>
      )}
      {total === 0 ? (
        <p className="small muted">Add shots above, then write the script.</p>
      ) : view === 'table' ? (
        <table className="sb-table">
          <thead>
            <tr>
              <th scope="col">Frame and shot</th>
              <th scope="col">Line</th>
            </tr>
          </thead>
          <tbody>{items}</tbody>
        </table>
      ) : (
        <ol className="sb-cards">{items}</ol>
      )}
    </section>
  )
}
