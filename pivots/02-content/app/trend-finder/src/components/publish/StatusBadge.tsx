import type { BadgeKind } from '../../lib/publish'

// A post's state as a word with a colour behind it: draft, queued, simulated, failed.
export function StatusBadge({ label, kind }: { label: string; kind: BadgeKind }) {
  return <span className={`pill pill-${kind} pub-badge`}>{label}</span>
}
