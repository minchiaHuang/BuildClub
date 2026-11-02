import { PresetPicker } from '../PresetPicker'
import { t } from '../../lib/i18n'
import type { SubtitleStyle, SubSize, SubPosition, ZonePlatform } from '../../lib/grading'
import { SubtitleOverlay } from './SubtitleOverlay'
import { SafeZoneLayer, SafeZoneToggle } from './SafeZones'

const sizes = () => [
  { id: 'S', label: t('cut.subs.small') },
  { id: 'M', label: t('cut.subs.medium') },
  { id: 'L', label: t('cut.subs.large') },
]
const positions = () => [
  { id: 'bottom', label: t('cut.subs.bottom') },
  { id: 'middle', label: t('cut.subs.middle') },
]

interface Props {
  burn: boolean
  style: SubtitleStyle
  onBurn: (on: boolean) => void
  onStyle: (s: SubtitleStyle) => void
  disabled?: boolean
  // Shown on the sample frame when there is no video yet to preview on.
  showSample: boolean
  zone: ZonePlatform | null
  onZone: (z: ZonePlatform | null) => void
}

// "Burn subtitles into the video" and how the words look.
export function SubtitleControls({ burn, style, onBurn, onStyle, disabled, showSample, zone, onZone }: Props) {
  return (
    <div className="gr-subs">
      <label className="gr-switch">
        <input type="checkbox" role="switch" checked={burn} disabled={disabled} onChange={(e) => onBurn(e.target.checked)} />
        <span className="gr-switch-track" aria-hidden="true" />
        <span>{t('cut.subs.burn')}</span>
        <span className="small gr-switch-state">{burn ? t('cut.subs.on') : t('cut.subs.off')}</span>
      </label>
      {burn && (
        <div className="gr-style">
          <div className="gr-style-controls">
            <PresetPicker label={t('cut.subs.size')} options={sizes()} value={style.size} disabled={disabled} onChange={(id) => onStyle({ ...style, size: id as SubSize })} />
            <PresetPicker label={t('cut.subs.position')} options={positions()} value={style.position} disabled={disabled} onChange={(id) => onStyle({ ...style, position: id as SubPosition })} />
            <label className="check small">
              <input type="checkbox" checked={style.box} disabled={disabled} onChange={(e) => onStyle({ ...style, box: e.target.checked })} />
              <span>{t('cut.subs.box')}</span>
            </label>
            <SafeZoneToggle zone={zone} style={style} onZone={onZone} />
          </div>
          {showSample && (
            <div className="gr-sample" role="img" aria-label={t('cut.subs.sampleAria')}>
              <SubtitleOverlay text={t('cut.subs.sample')} style={style} />
              {zone && <SafeZoneLayer platform={zone} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
