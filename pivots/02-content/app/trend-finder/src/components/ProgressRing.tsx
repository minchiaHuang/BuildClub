// Small SVG ring for a monthly target. The fill grows in once on mount (CSS), then follows the value.
export function ProgressRing({
  value,
  size = 28,
  stroke = 4,
  tone,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'behind'
}) {
  const r = (size - stroke) / 2
  const pct = Math.max(0, Math.min(100, value))
  return (
    <svg
      className={`ring ${tone ? `ring-${tone}` : ''} ${pct === 0 ? 'ring-empty' : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        pathLength={100}
        style={{ '--ring-offset': 100 - pct } as React.CSSProperties}
      />
    </svg>
  )
}
