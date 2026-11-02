import type { CSSProperties } from 'react'
import { PresetPicker } from '../PresetPicker'
import type { SubtitleStyle, ZonePlatform } from '../../lib/grading'
import { FRAME_W, SAFE_ZONES, zoneWarning } from '../../lib/grading'

const PLATFORMS = (Object.keys(SAFE_ZONES) as ZonePlatform[]).map((id) => ({ id, label: SAFE_ZONES[id].label }))

// Translucent areas a platform's own interface covers, over the 9:16 preview. Preview only: never in the video.
export function SafeZoneLayer({ platform }: { platform: ZonePlatform }) {
  const z = SAFE_ZONES[platform]
  // Pixels of the 1080-wide frame as container-width units, like the subtitle sizes.
  const cq = (px: number) => `${((px / FRAME_W) * 100).toFixed(2)}cqw`
  return (
    <div className="gr-zones" aria-hidden="true" style={{ '--gr-zt': cq(z.top), '--gr-zb': cq(z.bottom), '--gr-zr': cq(z.right) } as CSSProperties}>
      <div className="gr-zone gr-zone-top">
        <span>{z.topLabel}</span>
      </div>
      <div className="gr-zone gr-zone-bottom">
        <span>{z.bottomLabel}</span>
      </div>
      <div className="gr-zone gr-zone-right">
        <span>{z.rightLabel}</span>
      </div>
    </div>
  )
}

interface Props {
  zone: ZonePlatform | null
  style: SubtitleStyle
  onZone: (z: ZonePlatform | null) => void
}

export function SafeZoneToggle({ zone, style, onZone }: Props) {
  const warning = zone ? zoneWarning(zone, style) : null
  return (
    <div className="gr-zone-controls">
      <label className="check small">
        <input type="checkbox" checked={zone !== null} onChange={(e) => onZone(e.target.checked ? 'tiktok' : null)} />
        <span>Show safe zones</span>
      </label>
      {zone && (
        <>
          <PresetPicker label="Platform" options={PLATFORMS} value={zone} onChange={(id) => onZone(id as ZonePlatform)} />
          <p className="muted small">Preview only, never added to the video. Areas are approximate.</p>
          {warning && (
            <p className="small gr-zone-warning" role="status">
              <strong>Heads up:</strong> {warning}
            </p>
          )}
        </>
      )}
    </div>
  )
}
