import { useEffect, useState } from 'react'
import { PresetPicker } from '../PresetPicker'
import { areas, t } from '../../lib/i18n'
import type { Key } from '../../lib/i18n'
import type { GradePreset } from '../../lib/grading'
import { getGrades, previewUrl } from '../../lib/grading'

interface Props {
  ideaId: string
  value: string
  onChange: (grade: string) => void
  // Whether any shot has a chosen take, which the preview frame is taken from.
  hasTake: boolean
  disabled?: boolean
}

type Show = 'both' | 'before' | 'after'
const showOptions = (): { id: Show; label: string }[] => [
  { id: 'both', label: t('cut.grade.both') },
  { id: 'before', label: t('cut.grade.original') },
  { id: 'after', label: t('cut.grade.withLook') },
]

type Frame = { state: 'loading' } | { state: 'ready'; src: string } | { state: 'error'; message: string }

// The colour look: a chip per preset, and a before/after picture of one frame of the first chosen take.
export function GradePicker({ ideaId, value, onChange, hasTake, disabled }: Props) {
  const [presets, setPresets] = useState<GradePreset[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let live = true
    setFailed(null)
    getGrades().then(
      (p) => live && setPresets(p),
      (e: Error) => live && setFailed(e.message),
    )
    return () => {
      live = false
    }
  }, [tries])

  if (failed) {
    return (
      <div className="gr-grade">
        <p className="error" role="alert">
          {failed}{' '}
          <button type="button" className="link-btn" onClick={() => setTries((n) => n + 1)}>
            {t('cut.common.retry')}
          </button>
        </p>
      </div>
    )
  }
  if (!presets) {
    return (
      <div className="gr-grade" aria-busy="true">
        <span className="small">{t('cut.grade.label')}</span>
        <div className="chip-row">
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className="cchip cchip-skeleton gr-skeleton-chip" />
          ))}
        </div>
      </div>
    )
  }

  // The server names the looks in English; known ones are shown in the active language.
  const look = (p: GradePreset) => ({ ...p, label: (`cut.look.${p.id}` in areas.cut.en ? t(`cut.look.${p.id}` as Key) : p.label) })
  const shown = presets.map(look)
  const chosen = shown.find((p) => p.id === value)
  return (
    <div className="gr-grade">
      <PresetPicker label={t('cut.grade.label')} options={shown} value={value} onChange={onChange} disabled={disabled} />
      {value === 'none' ? (
        <p className="muted small">{t('cut.grade.none')}</p>
      ) : !hasTake ? (
        <p className="muted small">{t('cut.grade.needTake')}</p>
      ) : (
        <BeforeAfter key={`${ideaId}:${value}`} ideaId={ideaId} preset={value} label={chosen?.label ?? value} />
      )}
    </div>
  )
}

function BeforeAfter({ ideaId, preset, label }: { ideaId: string; preset: string; label: string }) {
  const [frame, setFrame] = useState<Frame>({ state: 'loading' })
  const [show, setShow] = useState<Show>('both')
  const [tries, setTries] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    let objectUrl: string | null = null
    setFrame({ state: 'loading' })
    void (async () => {
      try {
        const r = await fetch(previewUrl(ideaId, preset), { signal: ac.signal })
        if (!r.ok) {
          const b = await r.json().catch(() => null)
          throw new Error(b?.error ?? t('cut.grade.previewFail'))
        }
        objectUrl = URL.createObjectURL(await r.blob())
        if (ac.signal.aborted) URL.revokeObjectURL(objectUrl)
        else setFrame({ state: 'ready', src: objectUrl })
      } catch (e) {
        if (!ac.signal.aborted) setFrame({ state: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      ac.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [ideaId, preset, tries])

  if (frame.state === 'error') {
    return (
      <p className="error" role="alert">
        {frame.message}{' '}
        <button type="button" className="link-btn" onClick={() => setTries((n) => n + 1)}>
          {t('cut.common.tryAgain')}
        </button>
      </p>
    )
  }

  return (
    <div className="gr-compare-wrap">
      <PresetPicker label={t('cut.grade.show')} options={showOptions()} value={show} onChange={(id) => setShow(id as Show)} />
      <div className="gr-compare" data-show={show} aria-busy={frame.state === 'loading'}>
        {(['before', 'after'] as const).map((side) => (
          <figure key={side} className="gr-pane" data-side={side}>
            <div
              className={`gr-frame${frame.state === 'loading' ? ' is-loading' : ''}`}
              role="img"
              aria-label={side === 'before' ? t('cut.grade.beforeAria') : t('cut.grade.afterAria', { label })}
              style={frame.state === 'ready' ? ({ '--gr-img': `url("${frame.src}")` } as React.CSSProperties) : undefined}
            />
            <figcaption className="small">{side === 'before' ? t('cut.grade.original') : label}</figcaption>
          </figure>
        ))}
      </div>
      {frame.state === 'loading' && (
        <p className="muted small" role="status">
          {t('cut.grade.making')}
        </p>
      )}
    </div>
  )
}
