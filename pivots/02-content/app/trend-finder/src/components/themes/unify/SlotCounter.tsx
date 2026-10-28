import type { CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../../../lib/motion'

// Slot-machine number: each digit sits in a column of 0-9 that rolls up to its value, staggered.
// Under reduced motion it renders the final number with no roll.
export function SlotCounter({ value }: { value: number }) {
  const reduced = usePrefersReducedMotion()
  const text = value.toLocaleString('en-US')
  if (reduced) return <span className="uh-slot">{text}</span>
  let digitIndex = 0
  return (
    <span className="uh-slot" aria-label={text}>
      {[...text].map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} className="uh-slot-sep" aria-hidden="true">{ch}</span>
        const d = Number(ch)
        const n = digitIndex++
        return (
          <span key={i} className="uh-slot-col" aria-hidden="true">
            <span className="uh-slot-reel" style={{ '--d': d, '--i': n } as CSSProperties}>
              {Array.from({ length: 20 }, (_, k) => <span key={k}>{k % 10}</span>)}
            </span>
          </span>
        )
      })}
    </span>
  )
}
