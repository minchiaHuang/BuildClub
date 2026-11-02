import type { Video } from '../types'
import type { Interpretation } from './parseQuery'
import type { FormatTrend } from './metrics'
import { byFollowers, meanScore } from './metrics'
import { t, tp } from './i18n'
import { beatUsualAverage, spreadSentence } from '../components/find/words'

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
    .map((tr) => {
      const vids = results.filter((v) => v.formatId === tr.format.id)
      const avg = meanScore(vids)
      return { t: tr, vids, avg }
    })
    .filter((r) => r.vids.length > 0)
    .sort((a, b) => b.vids.length * b.avg - a.vids.length * a.avg)

  const lead = ranked[0]
  const forWho = interp.audience ? t('find.answer.forWho', { audience: interp.audience }) : ''
  const q = interp.text.trim().toLowerCase()
  const lines: string[] = []

  if (q.startsWith('why')) {
    lines.push(
      t('find.answer.why', { count: lead.vids.length, total: results.length, name: lead.t.format.name, avg: beatUsualAverage(lead.avg, lead.vids.some(byFollowers)) }),
      `${lead.t.format.why.hook} ${lead.t.format.why.first3s}`,
      t('find.answer.stillCatching', { sentence: spreadSentence(lead.t) }),
    )
  } else if (/^(is|are|does|do|should|can|could|will)\b/.test(q)) {
    const early = lead.t.stage === 'early' || lead.t.stage === 'rising'
    lines.push(
      t('find.answer.formatLine', { verdict: early ? t('find.answer.yes') : t('find.answer.no'), name: lead.t.format.name, sentence: lowerFirst(spreadSentence(lead.t)) }),
      t('find.answer.newest', { n: lead.t.newestDays }),
    )
  } else {
    lines.push(t('find.answer.working', { forWho }))
    ranked.slice(0, 3).forEach((r, i) => {
      lines.push(t('find.answer.item', { i: i + 1, name: r.t.format.name, sentence: lowerFirst(spreadSentence(r.t)), videos: tp('find.answer.videos', r.vids.length), avg: beatUsualAverage(r.avg, r.vids.some(byFollowers)) }))
    })
  }

  return { lines, basis: t('find.answer.basis', { n: results.length }) }
}
