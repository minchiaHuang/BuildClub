import type { ReactNode } from 'react'

// Search-page hero: the design system's navy panel with dots (styles in theme-remake.css).
// Static on purpose: the design system says nothing loops.
// `children` is the search box, placed in the middle of the hero.
export function AltitudeHero({ clientName, children }: { clientName: string; children?: ReactNode }) {
  return (
    <header className="alt-hero">
      <div className="alt-hero-inner">
        <h1>What should {clientName} <em>film</em> next?</h1>
        <p className="alt-lede">Search TikTok for a topic. We show first the videos that got far more views than their account usually gets, so you can copy what is already working.</p>
        {children && <div className="alt-search">{children}</div>}
      </div>
    </header>
  )
}
