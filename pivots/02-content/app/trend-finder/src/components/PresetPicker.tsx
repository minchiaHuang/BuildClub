import { useId } from 'react'

export interface PresetOption {
  id: string
  label: string
}

interface Props {
  // Visible group label (kept for screen readers when `hideLabel` is set).
  label: string
  options: PresetOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  hideLabel?: boolean
}

// A row of single-choice chips (radio buttons underneath, so arrow keys and screen readers work).
// Shared by the colour looks and the subtitle style choices.
export function PresetPicker({ label, options, value, onChange, disabled, hideLabel }: Props) {
  const name = useId()
  return (
    <fieldset className="chip-group preset-picker" disabled={disabled}>
      <legend className={hideLabel ? 'sr-only' : 'chip-group-title'}>{label}</legend>
      <div className="chip-row">
        {options.map((o) => (
          <label key={o.id} className={`preset-chip${o.id === value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={o.id} checked={o.id === value} onChange={() => onChange(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
