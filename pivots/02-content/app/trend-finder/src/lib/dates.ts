const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The one way a day is written on screen: "31 Oct", with the year when it isn't this year. Takes the "YYYY-MM-DD"
// of a due date or a timestamp (a posted date).
export function formatDay(when: string | number): string {
  const m = typeof when === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(when) : null
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(when)
  if (Number.isNaN(d.getTime())) return String(when)
  const year = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`
}

// Whole days from today (local midnight) to a "YYYY-MM-DD" due date: negative once it has passed.
export function daysFromToday(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return 0
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() - today.getTime()) / 86_400_000)
}

// "Due 31 Oct", or "Overdue · due 28 Oct" once the day has passed. `late` is true only then.
export function dueLabel(iso: string): { text: string; late: boolean } {
  const late = daysFromToday(iso) < 0
  return { text: late ? `Overdue · due ${formatDay(iso)}` : `Due ${formatDay(iso)}`, late }
}
