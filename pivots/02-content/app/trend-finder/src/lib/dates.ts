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
