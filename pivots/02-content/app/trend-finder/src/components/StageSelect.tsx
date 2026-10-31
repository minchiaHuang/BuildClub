import type { SavedIdea, Stage } from '../types'
import { STAGES, STAGE_LABEL, moveTo, stageOf } from '../lib/stage'

interface Props {
  idea: SavedIdea
  // What the plan is called on screen, for the label.
  name: string
  onChange: (patch: Partial<SavedIdea>) => void
}

// Moves an approved plan between Ready to film, Filming, Editing and Posted. Shows nothing for any other plan.
export function StageSelect({ idea, name, onChange }: Props) {
  const stage = stageOf(idea)
  if (!stage) return null
  return (
    <select
      className="stage-select"
      aria-label={`Stage for ${name}`}
      value={stage}
      onChange={(e) => {
        const patch = moveTo(idea, e.target.value as Stage)
        if (patch) onChange(patch)
      }}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  )
}
