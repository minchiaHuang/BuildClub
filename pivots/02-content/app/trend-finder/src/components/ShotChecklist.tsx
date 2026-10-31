import { useEffect, useState } from 'react'
import type { IdeaStatus, Shot } from '../types'
import type { Take } from '../lib/takes'
import { canEdit, checkFile, checklistProgress, chooseTake, deleteTake, formatSize, listTakes, takesByShot, uploadTake } from '../lib/takes'

interface Props {
  ideaId: string
  status: IdeaStatus
  shots: Shot[]
  // Called whenever the loaded takes change: how many shots have a chosen take.
  onProgress?: (done: number) => void
}

// Per-shot filming checklist: upload real takes for each shot, watch them, pick the one to use.
export function ShotChecklist({ ideaId, status, shots, onProgress }: Props) {
  const [takes, setTakes] = useState<Take[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  // Shots with an upload still running; several shots can upload at once.
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set())
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listTakes(ideaId)
      .then((t) => live && setTakes(t))
      .catch(() => live && setLoadError(true))
    return () => {
      live = false
    }
  }, [ideaId])

  const shotCount = shots.length
  useEffect(() => {
    if (takes) onProgress?.(checklistProgress(shotCount, takes).done)
  }, [takes, shotCount, onProgress])

  const editable = canEdit(status)
  if (!editable && (!takes || takes.length === 0) && !loadError) return null

  const setError = (shot: number, text?: string) =>
    setErrors((e) => {
      const next = { ...e }
      if (text) next[shot] = text
      else delete next[shot]
      return next
    })

  const run = async (shot: number, action: () => Promise<Take[]>) => {
    setError(shot)
    try {
      setTakes(await action())
    } catch (e) {
      setError(shot, (e as Error).message)
    }
  }

  const upload = async (shot: number, file: File) => {
    const problem = checkFile(file)
    if (problem) return setError(shot, problem)
    setError(shot)
    setBusy((b) => new Set(b).add(shot))
    try {
      const added = await uploadTake(ideaId, shot, file)
      // Add to the list as it is now: choices and deletes made during a long upload must not be undone.
      setTakes((prev) => [...(prev ?? []), added])
    } catch (e) {
      setError(shot, (e as Error).message)
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(shot)
        return next
      })
    }
  }

  const { done, total } = checklistProgress(shots.length, takes ?? [])
  const grouped = takesByShot(takes ?? [], shots.length)

  return (
    <section className="block shot-checklist">
      <div className="shot-checklist-head">
        <h3>Shot checklist</h3>
        {takes && (
          <span className="muted small">
            {done} of {total} shots have a take
          </span>
        )}
      </div>
      {!editable && (
        <p className="muted small">Reopened for edits. Takes are kept and can be changed again once the plan is approved.</p>
      )}
      {loadError && (
        <p className="error" role="alert">
          Couldn't load the takes.
        </p>
      )}
      {takes && (
        <ol className="shot-checklist-list">
          {shots.map((s, i) => (
            <li key={i}>
              <div className="shot-checklist-shot">
                <span className="shot-checklist-n">{i + 1}.</span>
                <div>
                  {s.time && <span className="shot-time">[{s.time}]</span>} {s.shot}
                  {s.text && <span className="shot-text">Text on screen: "{s.text}"</span>}
                </div>
              </div>
              {grouped[i].length > 0 && (
                <ul className="take-list">
                  {grouped[i].map((t) => (
                    <li key={t.id} className={t.chosen ? 'take is-chosen' : 'take'}>
                      <video controls preload="metadata" playsInline src={t.url} />
                      <span className="take-name" title={t.name}>
                        {t.name}
                      </span>
                      <span className="muted small">{formatSize(t.size)}</span>
                      {t.chosen && <span className="take-chosen">Chosen</span>}
                      {editable &&
                        (confirmDelete === t.id ? (
                          <span className="take-actions">
                            <span className="small">Delete this take?</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setConfirmDelete(null)
                                void run(i, () => deleteTake(ideaId, t.id))
                              }}
                            >
                              Delete
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                              Keep
                            </button>
                          </span>
                        ) : (
                          <span className="take-actions">
                            {!t.chosen && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run(i, () => chooseTake(ideaId, t.id))}>
                                Use this take
                              </button>
                            )}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(t.id)}>
                              Delete
                            </button>
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
              {editable && (
                <label className={`btn btn-ghost btn-sm take-add${busy.has(i) ? ' is-busy' : ''}`} aria-disabled={busy.has(i)}>
                  {busy.has(i) ? 'Uploading…' : 'Add take'}
                  <input
                    type="file"
                    hidden
                    accept="video/mp4,video/quicktime,.mp4,.mov"
                    disabled={busy.has(i)}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) void upload(i, file)
                    }}
                  />
                </label>
              )}
              {errors[i] && (
                <p className="error" role="alert">
                  {errors[i]}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
