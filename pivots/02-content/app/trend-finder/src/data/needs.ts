// What a video can need that a small business or startup filming its own product or place may not have.
// The client form ticks these as "can't do", and the breakdown step picks from the same list
// (backend/analyze.py DEFAULT_NEEDS), so a ticked item flags the videos that need it.
export const GENERIC_NEEDS = [
  'Someone willing to be on camera',
  'A tripod or a second person filming',
  'Studio or ring lighting',
  'Permission to film at a specific location',
  'A finished product ready to show',
  'People willing to be filmed on the street',
  'A busy public spot',
]
