import { useState } from 'react'
import { THEME_CHOICES, applyTheme, readTheme, writeTheme, type ThemeChoice } from '../lib/theme'

const themeLabel: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' }

function ThemeSetting() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme())
  const pick = (c: ThemeChoice) => {
    setChoice(c)
    writeTheme(c)
    applyTheme(c)
  }
  return (
    <div className="theme-seg" role="radiogroup" aria-label="Theme">
      {THEME_CHOICES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={choice === c} className={choice === c ? 'on' : ''} onClick={() => pick(c)}>
          {themeLabel[c]}
        </button>
      ))}
    </div>
  )
}

// App-wide settings for this browser, as opposed to the per-client Brief. Each topic is its own section;
// a Language section is planned to sit beside Appearance.
export function PreferencesScreen() {
  return (
    <section className="settings">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">These apply to this browser only.</p>
      </header>
      <fieldset className="cannot prefs-section">
        <legend>
          <h3>Appearance</h3>
          <span className="small muted">System follows your device. Light and Dark stay as you set them.</span>
        </legend>
        <ThemeSetting />
      </fieldset>
    </section>
  )
}
