import type { ReactNode } from 'react'
import { t } from '../../lib/i18n'

// Search-page hero: the design system's navy panel with dots (styles in theme-remake.css).
// Static on purpose: the design system says nothing loops.
// `children` is the search box, placed in the middle of the hero.
export function AltitudeHero({ clientName, children }: { clientName: string; children?: ReactNode }) {
  return (
    <header className="alt-hero">
      <div className="alt-hero-inner">
        <h1>{t('shell.hero.titleBefore', { name: clientName })}<em>{t('shell.hero.titleEm')}</em>{t('shell.hero.titleAfter')}</h1>
        <p className="alt-lede">{t('shell.hero.lede')}</p>
        {children && <div className="alt-search">{children}</div>}
      </div>
    </header>
  )
}
