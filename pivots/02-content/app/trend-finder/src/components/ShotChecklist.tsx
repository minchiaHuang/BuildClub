import { useEffect, useState } from 'react'
import type { IdeaStatus, Shot } from '../types'
import type { Take } from '../lib/takes'
import { t } from '../lib/i18n'
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
        <h3>{t('plan.takes.title')}</h3>
        {takes && (
          <span className="muted small">
            {t('plan.takes.progress', { done, total })}
          </span>
        )}
      </div>
      {!editable && (
        <p className="muted small">{t('plan.takes.reopened')}</p>
      )}
      {loadError && (
        <p className="error" role="alert">
          {t('plan.takes.err.load')}
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
                  {s.text && <span className="shot-text">{t('plan.takes.textOnScreen', { text: s.text })}</span>}
                </div>
              </div>
              {grouped[i].length > 0 && (
                <ul className="take-list">
                  {grouped[i].map((tk) => (
                    <li key={tk.id} className={tk.chosen ? 'take is-chosen' : 'take'}>
                      <video controls preload="metadata" playsInline src={tk.url} />
                      <span className="take-name" title={tk.name}>
                        {tk.name}
                      </span>
                      <span className="muted small">{formatSize(tk.size)}</span>
                      {tk.chosen && <span className="take-chosen">{t('plan.takes.chosen')}</span>}
                      {editable &&
                        (confirmDelete === tk.id ? (
                          <span className="take-actions">
                            <span className="small">{t('plan.takes.deleteQ')}</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setConfirmDelete(null)
                                void run(i, () => deleteTake(ideaId, tk.id))
                              }}
                            >
                              {t('plan.takes.delete')}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                              {t('plan.takes.keep')}
                            </button>
                          </span>
                        ) : (
                          <span className="take-actions">
                            {!tk.chosen && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run(i, () => chooseTake(ideaId, tk.id))}>
                                {t('plan.takes.use')}
                              </button>
                            )}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(tk.id)}>
                              {t('plan.takes.delete')}
                            </button>
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
              {editable && (
                <label className={`btn btn-ghost btn-sm take-add${busy.has(i) ? ' is-busy' : ''}`} aria-disabled={busy.has(i)}>
                  {busy.has(i) ? t('plan.takes.uploading') : t('plan.takes.add')}
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
