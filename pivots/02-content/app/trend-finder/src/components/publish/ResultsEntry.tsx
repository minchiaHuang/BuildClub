import { useState } from 'react'
import { METRIC_FIELDS, METRIC_LABEL, checkMetrics, saveMetrics } from '../../lib/publish'
import type { MetricField, MetricInputs, Snapshot } from '../../lib/publish'
import { compact } from '../../lib/metrics'
import { formatDay } from '../../lib/dates'

interface Props {
  postId: string
  platformName: string
  latest: Snapshot | null
  onSaved: () => void
}

// "12.4k views · 960 likes · 124 comments", leaving out what was not entered.
function snapshotLine(s: Snapshot): string {
  const parts: string[] = []
  for (const f of METRIC_FIELDS) {
    const v = s[f]
    if (v !== null && v !== undefined) parts.push(`${compact(v)} ${f === 'followers' ? 'followers' : f}`)
  }
  return parts.join(' · ')
}

// Numbers typed in by hand for one post. Whole numbers, 0 or more; a blank box is left out.
export function ResultsEntry({ postId, platformName, latest, onSaved }: Props) {
  const [inputs, setInputs] = useState<MetricInputs>({})
  const [errors, setErrors] = useState<Partial<Record<MetricField, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const check = checkMetrics(inputs)
    setErrors(check.errors)
    setFormError(null)
    if (check.empty) return setFormError('Enter at least one number.')
    if (Object.keys(check.errors).length) return
    setSaving(true)
    try {
      await saveMetrics(postId, check.values)
      setInputs({})
      setOpen(false)
      onSaved()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pub-results">
      {latest ? (
        <p className="small pub-latest">
          <strong>Latest numbers:</strong> {snapshotLine(latest)}
          <span className="muted"> · entered {formatDay(latest.fetchedAt * 1000)}</span>
        </p>
      ) : (
        <p className="small muted">No numbers yet.</p>
      )}
      {!open ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          {latest ? 'Update the numbers' : `Add ${platformName} numbers`}
        </button>
      ) : (
        <form className="pub-metrics" onSubmit={(e) => void submit(e)} noValidate>
          <div className="pub-metric-grid">
            {METRIC_FIELDS.map((f) => (
              <label key={f} className="pub-metric">
                <span className="small">{METRIC_LABEL[f]}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={inputs[f] ?? ''}
                  aria-invalid={errors[f] ? true : undefined}
                  aria-describedby={errors[f] ? `${postId}-${f}-err` : undefined}
                  onChange={(e) => setInputs({ ...inputs, [f]: e.target.value })}
                />
                {errors[f] && (
                  <span id={`${postId}-${f}-err`} className="pub-field-error small" role="alert">
                    {errors[f]}
                  </span>
                )}
              </label>
            ))}
          </div>
          {formError && (
            <p className="error small" role="alert">
              {formError}
            </p>
          )}
          <div className="pub-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save numbers'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
