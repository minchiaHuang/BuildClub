interface Props {
  kind: 'stuck' | 'overdue'
  days: number
}

// "Stuck 4 days" or "Overdue 2 days". The word is always there; the colour only backs it up.
export function FlagBadge({ kind, days }: Props) {
  const word = kind === 'stuck' ? 'Stuck' : 'Overdue'
  return (
    <span className={`flag-badge flag-badge-${kind}`}>
      {word} {days} {days === 1 ? 'day' : 'days'}
    </span>
  )
}
