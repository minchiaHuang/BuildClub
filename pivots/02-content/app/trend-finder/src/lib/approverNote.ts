import type { Client, Format } from '../types'
import { inLang, t, type Lang } from './i18n.ts'
import { clientFit } from './metrics.ts'

// The default "Why it fits <client>" note. What gets saved is always built in English, because the approver's
// review link is English-only; the editor shows the draft in the UI language until it is sent.
export const approverNote = (client: Client, format: Format, lang: Lang): string =>
  inLang(lang, () => t('plan.screen.defaultNote', { audience: client.audience.toLowerCase(), fit: clientFit(format, client).text }))
