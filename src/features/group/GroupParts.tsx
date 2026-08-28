import { formatCount } from '@/lib/format'
import type { SiteCounts, Tone } from './group-figures'
import styles from './group.module.css'

/**
 * The analytical pieces of All homes. PRD §6.7, Phase 15.
 *
 * **Every figure is a count with its denominator, and none of them is green.**
 * A count needs no population floor, which is what lets a four-resident home
 * sit in the same strip as a twenty-eight-resident one without either being
 * hidden inside a rate. Nothing here is reassuring by design: a home with
 * nothing outstanding renders plainly, because it has not achieved anything,
 * it is simply the ordinary state.
 */

export interface GroupTotals {
  residents: number
  /** The smallest home, which is what a group rate would hide. */
  smallest: number
  rows: { id: string; label: string; note: string; value: number; tone: Tone }[]
}

/**
 * Every home's counts, added up, with the denominators added up too.
 *
 * The rows are summed by id rather than by position, so a home missing a row
 * cannot silently shift another home's figure into its place.
 */
export function groupTotals(cards: SiteCounts[]): GroupTotals {
  const residents = cards.reduce((running, card) => running + card.residents, 0)
  const byId = new Map<string, GroupTotals['rows'][number]>()

  for (const card of cards) {
    for (const row of card.rows) {
      const held = byId.get(row.id)
      if (held === undefined) {
        byId.set(row.id, { ...row, note: denominatorOf(row.note) })
        continue
      }
      held.value += row.value
      held.note = addDenominators(held.note, denominatorOf(row.note))
      // The louder tone wins: a group figure must not read calmer than the
      // worst home inside it.
      if (row.tone === 'critical') held.tone = 'critical'
      else if (row.tone === 'caution' && held.tone === 'calm') held.tone = 'caution'
    }
  }

  return {
    residents,
    smallest: cards.length === 0 ? 0 : Math.min(...cards.map((card) => card.residents)),
    rows: [...byId.values()],
  }
}

/**
 * The denominator inside a home's note, added across homes.
 *
 * The note reads "of 4,912 due in 30 days"; two homes make "of 5,279 due in 30
 * days". Parsed rather than recomputed, because the figure and the words that
 * qualify it are written together by whoever owns that row, and pulling them
 * apart here would be a second copy of the wording.
 */
const NUMBER = /(\d[\d,]*)/

function denominatorOf(note: string): string {
  return note
}

function addDenominators(a: string, b: string): string {
  const left = a.match(NUMBER)
  const right = b.match(NUMBER)
  if (!left || !right) return a
  const sum = Number(left[1]!.replace(/,/g, '')) + Number(right[1]!.replace(/,/g, ''))
  return a.replace(NUMBER, formatCount(sum))
}

/**
 * One figure, its denominator, and nothing else.
 *
 * `of` is required. A count with no denominator is the figure this product
 * refuses everywhere else, and a metric card is the easiest place in a build
 * for one to appear.
 */
export function Metric({
  label,
  value,
  of,
  tone = 'calm',
  site,
}: {
  label: string
  value: number
  of: string
  tone?: Tone
  site?: string
}) {
  return (
    <div
      className={styles.metric}
      data-metric={label}
      data-tone={tone}
      {...(site ? { 'data-metric-site': site } : {})}
    >
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue} data-numeric>
        {formatCount(value)}
      </p>
      <p className={styles.metricOf}>{of}</p>
    </div>
  )
}
