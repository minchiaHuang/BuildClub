import { PresetPicker } from '../PresetPicker'
import type { SubtitleStyle, SubSize, SubPosition, ZonePlatform } from '../../lib/grading'
import { SubtitleOverlay } from './SubtitleOverlay'
import { SafeZoneLayer, SafeZoneToggle } from './SafeZones'

const SIZES = [
  { id: 'S', label: 'Small' },
  { id: 'M', label: 'Medium' },
  { id: 'L', label: 'Large' },
]
const POSITIONS = [
  { id: 'bottom', label: 'Bottom' },
  { id: 'middle', label: 'Middle' },
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
        <span>Burn subtitles into the video</span>
        <span className="small gr-switch-state">{burn ? 'On' : 'Off'}</span>
      </label>
      {burn && (
        <div className="gr-style">
          <div className="gr-style-controls">
            <PresetPicker label="Size" options={SIZES} value={style.size} disabled={disabled} onChange={(id) => onStyle({ ...style, size: id as SubSize })} />
            <PresetPicker label="Position" options={POSITIONS} value={style.position} disabled={disabled} onChange={(id) => onStyle({ ...style, position: id as SubPosition })} />
            <label className="check small">
              <input type="checkbox" checked={style.box} disabled={disabled} onChange={(e) => onStyle({ ...style, box: e.target.checked })} />
              <span>Dark box behind the words</span>
            </label>
            <SafeZoneToggle zone={zone} style={style} onZone={onZone} />
          </div>
          {showSample && (
            <div className="gr-sample" role="img" aria-label="Sample of the subtitle style">
              <SubtitleOverlay text="Your words show up like this" style={style} />
              {zone && <SafeZoneLayer platform={zone} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
