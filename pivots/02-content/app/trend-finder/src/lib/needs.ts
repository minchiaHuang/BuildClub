import { t } from './i18n.ts'
import type { Key } from './i18n.ts'

// The "what a video needs" items come from the sample formats and are stored in English (a client's
// can't-film list holds them). Only their display is translated; anything unknown shows as written.
const NEED_KEYS: Record<string, Key> = {
  'A kitchen': 'shell.need.kitchen',
  'An overhead phone mount': 'shell.need.phoneMount',
  'People willing to be filmed on the street': 'shell.need.streetPeople',
  'A busy public spot': 'shell.need.publicSpot',
  'A blender': 'shell.need.blender',
  'Permission to film in a supermarket': 'shell.need.supermarket',
  'A confident presenter': 'shell.need.presenter',
}

export const needLabel = (need: string): string => (need in NEED_KEYS ? t(NEED_KEYS[need]) : need)
