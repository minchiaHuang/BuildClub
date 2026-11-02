import type { Shot } from '../../types'
import { purposeFor, purposeLabel } from '../../lib/storyboard'
import { FrameImage } from '../FrameImage'
import { SwatchRow } from '../SwatchRow'
import { t } from '../../lib/i18n'

export type Busy = 'script' | 'frame' | undefined

interface Props {
  shot: Shot
  index: number
  total: number
  layout: 'card' | 'row'
  editable: boolean
  busy: Busy
  frameError?: string
  scriptError?: string
  // The shot has a line the user edited, and a rewrite was asked for: ask before replacing it.
  confirming: boolean
  onLine: (line: string) => void
  onRewrite: () => void
  onConfirmRewrite: () => void
  onKeepMine: () => void
  onFrame: () => void
  onFrameLoaded: (img: HTMLImageElement) => void
}

export function ShotItem(p: Props) {
  const { shot, index, total, layout, editable, busy, frameError, scriptError, confirming } = p
  const n = index + 1
  const purpose = shot.purpose ?? purposeFor(index, total)
  const hasLine = !!shot.line?.trim()
  const lineId = `sb-line-${index}`
  const frame = (
    <FrameImage
      src={shot.frameImage}
      alt={t('plan.sb.frameAlt', { n })}
      busy={busy === 'frame'}
      error={frameError}
      onRetry={editable ? p.onFrame : undefined}
      onLoaded={p.onFrameLoaded}
    />
  )
  const badges = (
    <>
      <span className="sb-no" aria-label={t('plan.sb.shotAria', { n })}>{n}</span>
      <span className={`sb-purpose is-${purpose}`}>{purposeLabel(purpose)}</span>
      {shot.time && <span className="sb-time">{shot.time}</span>}
      {shot.edited && <span className="sb-edited">{t('plan.sb.edited')}</span>}
    </>
  )
  const line = editable ? (
    <div className="sb-line-field">
      <label className="field-label" htmlFor={lineId}>
        {t('plan.sb.lineToSay')}
      </label>
      <textarea
        id={lineId}
        rows={3}
        maxLength={500}
        value={shot.line ?? ''}
        placeholder={t('plan.sb.linePlaceholder')}
        disabled={busy === 'script'}
        onChange={(e) => p.onLine(e.target.value)}
      />
    </div>
  ) : (
    <div className="sb-line-field">
      <span className="field-label">{t('plan.sb.lineToSay')}</span>
      {hasLine ? <p className="sb-line quote">{shot.line}</p> : <p className="small muted">{t('plan.sb.noLine')}</p>}
    </div>
  )
  const options =
    editable && shot.options && shot.options.length > 0 ? (
      <div className="sb-options" role="group" aria-label={t('plan.sb.otherLines', { n })}>
        <span className="field-label">{t('plan.sb.otherWays')}</span>
        <div className="chip-row">
          {shot.options.map((o) => (
            <button key={o} type="button" className="cchip sb-option" aria-pressed={shot.line === o} onClick={() => p.onLine(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
    ) : null
  const ask = confirming ? (
    <div className="sb-confirm" role="alert">
      <span>{t('plan.sb.confirmText')}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={p.onKeepMine}>
        {t('plan.sb.keepMine')}
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={p.onConfirmRewrite}>
        {t('plan.sb.replaceIt')}
      </button>
    </div>
  ) : null
  const actions = editable ? (
    <div className="sb-actions">
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== undefined} onClick={p.onRewrite}>
        {busy === 'script' ? t('plan.sb.rewriting') : t('plan.sb.regenerate')}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== undefined} onClick={p.onFrame}>
        {busy === 'frame' ? t('plan.sb.making') : shot.frameImage ? t('plan.sb.redoFrame') : t('plan.sb.makeFrame')}
      </button>
    </div>
  ) : null
  const err = scriptError ? (
    <p className="sb-error" role="alert">
      {scriptError}
    </p>
  ) : null
  const swatches = shot.palette && shot.palette.length > 0 ? <SwatchRow colors={shot.palette} /> : null

  if (layout === 'row') {
    return (
      <tr className="sb-row">
        <td className="sb-cell-shot">
          <div className="sb-row-frame">{frame}</div>
          <div className="sb-row-text">
            <div className="sb-head">{badges}</div>
            <p className="sb-shot">{shot.shot || t('plan.sb.noDescription')}</p>
          </div>
        </td>
        <td className="sb-cell-line">
          {line}
          {options}
          {ask}
          {actions}
          {err}
          {swatches}
        </td>
      </tr>
    )
  }
  return (
    <li className="sb-card">
      <div className="sb-card-frame">{frame}</div>
      <div className="sb-card-body">
        <div className="sb-head">{badges}</div>
        <p className="sb-shot">{shot.shot || t('plan.sb.noDescription')}</p>
        {line}
        {options}
        {ask}
        {actions}
        {err}
        {swatches}
      </div>
    </li>
  )
}
