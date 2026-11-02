import { t, tp } from '../../lib/i18n'

// "just now", "12 minutes ago", "3 hours ago", "2 days ago": when the daily TikTok check last ran.
export function checkedWhen(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return t('find.checked.justNow')
  if (mins < 60) return tp('find.checked.minutes', mins)
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return tp('find.checked.hours', hrs)
  const days = Math.round(hrs / 24)
  return tp('find.checked.days', days)
}
