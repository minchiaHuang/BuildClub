import { setUiTheme, uiThemes, useUiTheme } from '../lib/theme'

// Small floating control for comparing the design directions on the same screens.
export function ThemeSwitcher() {
  const ui = useUiTheme()
  return (
    <div className="ui-switcher" role="group" aria-label="Design direction">
      {uiThemes.map((t) => (
        <button key={t.id} type="button" aria-pressed={ui === t.id} onClick={() => setUiTheme(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
