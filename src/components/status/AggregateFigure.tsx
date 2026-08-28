import type { Aggregate } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatCount } from '@/lib/format'
import { Unrecorded } from './Unrecorded'
import styles from './AggregateFigure.module.css'

/**
 * Every metric, RAG status, dashboard tile and report figure in the product.
 * Rule 4, PRD §2.2 and §5.1.
 *
 * No bare counts. No bare percentages. Anywhere. The denominator is not an
 * optional prop and there is no variant of this component that omits it:
 *
 *   not "3 incidents"      but "3 incidents — across 32 residents"
 *   not "92% compliance"   but "92% — 46 of 50 expected notes"
 *
 * Where coverage is too thin to support a judgement, the figure is replaced
 * by Insufficient Evidence in the unrecorded treatment — which is NOT a
 * milder Red. Red is a finding; this is the absence of one, and it never
 * renders in a RAG hue. PRD §2.3.
 *
 * `value` is the number as displayed: unit 'percentage' with value 92 renders
 * "92%", unit 'count' with value 3 renders "3".
 */

export interface AggregateFigureProps {
  /** What is being measured: "Care note compliance", "Incidents this month". */
  caption: string
  aggregate: Aggregate
  /**
   * What the denominator counts, for the coverage sentence:
   * "expected notes", "residents". Rule 4 wants the units named.
   */
  denominatorNoun: string
  /**
   * Three forms, because a set of figures read together has a shape and the
   * layout should carry it rather than leaving the reader to work it out.
   *
   *   lead        the display figure: the number somebody came for.
   *   supporting  the same card, a step down. Context beside a lead figure.
   *   inline      not a card at all — the figure stated in a line, above the
   *               list it counts.
   *
   * `inline` is a form rather than a demotion. On a queue the count *is* the
   * lead fact, but a display card for it puts a large number beside half a
   * screen of nothing and pushes the rows it describes below the fold — on a
   * screen whose whole job is being scanned. So the fact stays the fact and
   * the shape changes.
   *
   * Rule 3b, applied to figures: on a handover, "6 not reviewed" is the only
   * number still fixable before signing, and urgent, needs-attention and
   * all-well are what it sits among; four equal display figures make the
   * reader do the ranking. The denominator survives in all three forms,
   * because Rule 4 is not a matter of emphasis.
   */
  emphasis?: 'lead' | 'supporting' | 'inline' | 'banner'
  /**
   * A sentence under the coverage line, for a figure that needs one — what
   * the number can still be changed by, what it excludes, what it is for.
   *
   * Never the denominator. That is `denominatorNoun`'s job and it is not
   * optional; this is for a claim the denominator cannot make on its own.
   */
  note?: string
  /** `banner` only. Right-aligned, level with the figure. */
  action?: React.ReactNode
  /**
   * `inline` only. A qualifier the figure carries on the same line, after a
   * middot: "oldest first", "night shift". It replaces the full stop, so the
   * line stays one statement rather than becoming two sentences the reader
   * has to join up.
   *
   * Two or three words. Anything that needs a sentence is not a qualifier.
   */
  qualifier?: string
}

export function AggregateFigure({
  caption,
  aggregate,
  denominatorNoun,
  emphasis = 'lead',
  note,
  qualifier,
  action,
}: AggregateFigureProps) {
  if (emphasis === 'inline' && aggregate.kind === 'measured') {
    return (
      <p className={styles.inline} data-emphasis="inline">
        <span className={styles.inlineValue} data-numeric>
          {formatCount(aggregate.value)}
          {aggregate.unit === 'percentage' ? '%' : ''}
        </span>{' '}
        {caption}
        {', '}
        {/* "across", not "of", and the difference is Rule 4 rather than
            style: a note count is not a subset of a resident count, and "42
            notes by K. Osei, of 28 residents" states a ratio that does not
            exist. Same wording as the card form, so the two cannot disagree
            about what the denominator means. */}
        {aggregate.unit === 'percentage'
          ? `${formatCount(aggregate.coverage.covered)} of ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`
          : `across ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`}
        {qualifier ? ` · ${qualifier}` : '.'}
      </p>
    )
  }

  if (emphasis === 'banner' && aggregate.kind === 'measured') {
    return (
      <div className={styles.banner} data-emphasis="banner">
        <span className={styles.bannerValue} data-numeric>
          {formatCount(aggregate.value)}
          {aggregate.unit === 'percentage' ? '%' : ''}
        </span>
        <span className={styles.bannerText}>
          <span className={styles.bannerCaption}>
            {caption}
            {', '}
            {aggregate.unit === 'percentage'
              ? `${formatCount(aggregate.coverage.covered)} of ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`
              : `across ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`}
          </span>
          {note ? <span className={styles.bannerNote}>{note}</span> : null}
        </span>
        {action ? <span className={styles.bannerAction}>{action}</span> : null}
      </div>
    )
  }

  switch (aggregate.kind) {
    case 'insufficient_evidence':
      return (
        <div className={styles.figure} data-emphasis={emphasis}>
          <span className={styles.caption}>{caption}</span>
          <Unrecorded
            variant="panel"
            label="Insufficient evidence"
            detail={`${aggregate.missingDescription} ${formatCount(aggregate.coverage.covered)} of ${formatCount(aggregate.coverage.total)} ${denominatorNoun} have any data.`}
          />
          {note ? <span className={styles.note}>{note}</span> : null}
        </div>
      )

    case 'measured':
      return (
        <div className={styles.figure} data-emphasis={emphasis}>
          <span className={styles.caption}>{caption}</span>
          <span className={styles.value} data-numeric>
            {formatCount(aggregate.value)}
            {aggregate.unit === 'percentage' ? '%' : ''}
          </span>
          <span className={styles.coverage}>
            {aggregate.unit === 'percentage'
              ? `${formatCount(aggregate.coverage.covered)} of ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`
              : `across ${formatCount(aggregate.coverage.total)} ${denominatorNoun}`}
          </span>
          {note ? <span className={styles.note}>{note}</span> : null}
        </div>
      )

    default:
      return assertNever(aggregate)
  }
}
