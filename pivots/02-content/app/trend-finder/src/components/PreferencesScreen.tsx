import { useState } from 'react'
import { THEME_CHOICES, applyTheme, readTheme, writeTheme, type ThemeChoice } from '../lib/theme'
import { LANGS, t, type Lang } from '../lib/i18n'
import { useApp } from '../lib/appContext'

const themeLabel = (c: ThemeChoice) => t(`shell.prefs.theme.${c}`)
// Each language is named in itself, so it stays findable if the interface is in the wrong one.
const langLabel: Record<Lang, string> = { en: 'English', 'zh-Hant': '繁體中文' }

function ThemeSetting() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme())
  const pick = (c: ThemeChoice) => {
    setChoice(c)
    writeTheme(c)
    applyTheme(c)
  }
  return (
    <div className="theme-seg" role="radiogroup" aria-label={t('shell.prefs.themeLabel')}>
      {THEME_CHOICES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={choice === c} className={choice === c ? 'on' : ''} onClick={() => pick(c)}>
          {themeLabel(c)}
        </button>
      ))}
    </div>
  )
}

function LanguageSetting() {
  const { lang, setLang } = useApp()
  return (
    <div className="theme-seg two" role="radiogroup" aria-label={t('shell.prefs.languageLabel')}>
      {LANGS.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} lang={l} onClick={() => setLang(l)}>
          {langLabel[l]}
        </button>
      ))}
    </div>
  )
}

// App-wide settings for this browser, as opposed to the per-client Brief. Each topic is its own section.
export function PreferencesScreen() {
  return (
    <section className="settings">
      <header className="page-head">
        <h1>{t('shell.prefs.title')}</h1>
        <p className="muted">{t('shell.prefs.subtitle')}</p>
      </header>
      <fieldset className="cannot prefs-section">
        <legend>
          <h3>{t('shell.prefs.appearance')}</h3>
          <span className="small muted">{t('shell.prefs.appearanceHint')}</span>
        </legend>
        <ThemeSetting />
      </fieldset>
      <fieldset className="cannot prefs-section">
        <legend>
          <h3>{t('shell.prefs.language')}</h3>
          <span className="small muted">{t('shell.prefs.languageHint')}</span>
        </legend>
        <LanguageSetting />
      </fieldset>
    </section>
  )
}
