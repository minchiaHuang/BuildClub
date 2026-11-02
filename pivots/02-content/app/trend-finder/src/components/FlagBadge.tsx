import { tp } from '../lib/i18n'

interface Props {
  kind: 'stuck' | 'overdue'
  days: number
}

// "Stuck 4 days" or "Overdue 2 days". The word is always there; the colour only backs it up.
export function FlagBadge({ kind, days }: Props) {
  return (
    <span className={`flag-badge flag-badge-${kind}`}>
      {kind === 'stuck' ? tp('find.flag.stuck', days) : tp('find.flag.overdue', days)}
    </span>
  )
}
