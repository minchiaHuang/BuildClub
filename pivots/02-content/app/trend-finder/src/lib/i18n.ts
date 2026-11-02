import * as shell from './strings/shell.ts'
import * as home from './strings/home.ts'
import * as find from './strings/find.ts'
import * as plan from './strings/plan.ts'
import * as cut from './strings/cut.ts'

export type Lang = 'en' | 'zh-Hant'

export const LANG_KEY = 'remake.lang'
export const LANGS: Lang[] = ['en', 'zh-Hant']

// Anything that is not a known language (missing, junk, storage blocked) means English.
export function parseLang(raw: unknown): Lang {
  return raw === 'zh-Hant' ? 'zh-Hant' : 'en'
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readLang(store: Store | null = defaultStore()): Lang {
  try {
    return parseLang(store?.getItem(LANG_KEY))
  } catch {
    return 'en'
  }
}

export function writeLang(lang: Lang, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(LANG_KEY, lang)
  } catch {
    /* private window or blocked storage: the choice just won't persist */
  }
}

// The value for <html lang>.
export const htmlLang = (lang: Lang): string => lang

// Per-area dictionaries, exported so the unit test can check each one.
export const areas = { shell, home, find, plan, cut }

const dictEn: Record<string, string> = Object.assign({}, ...Object.values(areas).map((a) => a.en))
const dictZh: Record<string, string> = Object.assign({}, ...Object.values(areas).map((a) => a.zhHant))

type AllEn = typeof shell.en & typeof home.en & typeof find.en & typeof plan.en & typeof cut.en
export type Key = keyof AllEn
// "x.one" / "x.other" pairs, picked by tp(): the base name is "x".
export type PluralKey = Key extends infer K ? (K extends `${infer B}.one` ? B : never) : never

export type Vars = Record<string, string | number>

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

// The language the screen on show is in. The signed-in app sets it; the landing page, sign-in and the
// approver's review link leave it on English, so they never change with the setting.
let active: Lang = 'en'
export const setActiveLang = (lang: Lang): void => {
  active = lang
}
export const getActiveLang = (): Lang => active

// Run fn with another language active, then put the old one back. For text that is stored or shown on an
// English-only screen (e.g. the note on the approver's review link), whatever the UI language is.
export function inLang<T>(lang: Lang, fn: () => T): T {
  const prev = active
  active = lang
  try {
    return fn()
  } finally {
    active = prev
  }
}

function lookup(lang: Lang, key: string): string {
  return (lang === 'zh-Hant' ? dictZh[key] : dictEn[key]) ?? dictEn[key] ?? key
}

// Translate a key. Never call this at module scope: the language can change after the module loads.
export function t(key: Key, vars?: Vars): string {
  return interpolate(lookup(active, key), vars)
}

// Plural: "<base>.one" when n is 1, else "<base>.other". `{n}` is filled in with n.
export function tp(base: PluralKey, n: number, vars?: Vars): string {
  return interpolate(lookup(active, `${base}.${n === 1 ? 'one' : 'other'}`), { n, ...vars })
}
