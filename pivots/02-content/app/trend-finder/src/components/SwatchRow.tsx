import { useEffect, useState } from 'react'

// One colour from a frame: a swatch and its hex. Click copies the hex.
export function SwatchChip({ hex }: { hex: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = window.setTimeout(() => setState('idle'), 1400)
    return () => window.clearTimeout(t)
  }, [state])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <button type="button" className="sb-swatch" title={`Copy ${hex}`} aria-label={`Copy colour ${hex}`} onClick={() => void copy()}>
      {/* The swatch colour is data from the image, passed as a variable; the theme colours stay in the stylesheet. */}
      <span className="sb-swatch-dot" style={{ '--sw': hex } as React.CSSProperties} aria-hidden="true" />
      <span className="sb-swatch-hex">{state === 'copied' ? 'Copied' : state === 'failed' ? "Can't copy" : hex}</span>
    </button>
  )
}

export function SwatchRow({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null
  return (
    <div className="sb-swatches" role="group" aria-label="Colours in this frame">
      {colors.map((c) => (
        <SwatchChip key={c} hex={c} />
      ))}
    </div>
  )
}
