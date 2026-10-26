import type { Video } from '../types'
import type { Interpretation } from './parseQuery'
import type { FormatTrend } from './metrics'
import { outlierScore, plural, stageText, times } from './metrics'

// Lowercase the first letter only, so platform names keep their capitals mid-sentence.
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export interface Answer {
  lines: string[]
  basis: string
}

// A short written answer for question searches, built only from the results on screen.
// Template-based for now; an AI call can replace it later with the same inputs.
export function buildAnswer(interp: Interpretation, results: Video[], trends: FormatTrend[]): Answer | null {
  if (!interp.isQuestion || results.length === 0 || trends.length === 0) return null

  const ranked = trends
    .map((t) => {
      const vids = results.filter((v) => v.formatId === t.format.id)
      const avg = vids.reduce((s, v) => s + outlierScore(v), 0) / Math.max(vids.length, 1)
      return { t, vids, avg }
    })
    .filter((r) => r.vids.length > 0)
    .sort((a, b) => b.vids.length * b.avg - a.vids.length * a.avg)

  const lead = ranked[0]
  const forWho = interp.audience ? ` for ${interp.audience}` : ''
  const q = interp.text.trim().toLowerCase()
  const lines: string[] = []

  if (q.startsWith('why')) {
    lines.push(
      `Mostly the format. ${lead.vids.length} of the ${results.length} matching videos use "${lead.t.format.name}", averaging ${times(lead.avg)} their account's usual views.`,
      `${lead.t.format.why.hook} ${lead.t.format.why.first3s}`,
      `Where it stands: ${lowerFirst(stageText(lead.t))}.`,
    )
  } else if (/^(is|are|does|do|should|can|could|will)\b/.test(q)) {
    const early = lead.t.stage === 'early' || lead.t.stage === 'rising'
    lines.push(
      `${early ? 'Yes, there is still room.' : 'Probably late.'} "${lead.t.format.name}" is ${lead.t.stage === 'one-off' ? 'a one-off' : lead.t.stage}: ${lowerFirst(stageText(lead.t))}.`,
      `The newest matching video was posted ${lead.t.newestDays} days ago.`,
    )
  } else {
    lines.push(`What's working${forWho} right now:`)
    ranked.slice(0, 3).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.t.format.name}: ${lowerFirst(stageText(r.t))} (${plural(r.vids.length, 'video')}, about ${times(r.avg)} usual views).`)
    })
  }

  return { lines, basis: `Written from the ${results.length} sample videos below` }
}
