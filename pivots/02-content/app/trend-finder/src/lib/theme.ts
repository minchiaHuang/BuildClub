export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_KEY = 'remake.theme'
export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']

// Anything that is not a known choice (missing, junk, storage blocked) means follow the OS.
export function parseTheme(raw: unknown): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readTheme(store: Store | null = defaultStore()): ThemeChoice {
  try {
    return parseTheme(store?.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

export function writeTheme(choice: ThemeChoice, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(THEME_KEY, choice)
  } catch {
    /* private window or blocked storage: the choice just won't persist */
  }
}

// System removes the attribute, so the CSS falls back to prefers-color-scheme.
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}
