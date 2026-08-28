import type { CheckReading, PanelVerdict, Rating } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import styles from './compliance.module.css'

const RATING_LABEL: Record<Rating, string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
}

/**
 * The banner that sits on every compliance screen.
 *
 * **Two placeholders declared in one sentence**, the same treatment the risk
 * instrument carries: the mapping of evidence to Key Questions is not derived
 * from CQC's published framework, and the rating takes the worst of the
 * checks rather than weighting them. Both are developers' answers to a
 * regulator's question.
 */
export function PlaceholderBanner({ what }: { what: 'screen' | 'pack' }) {
  return (
    <div className={styles.banner} data-placeholder-banner data-state="unrecorded">
      {what === 'pack'
        ? 'This is a contents list, not a document. The mapping of evidence to Key Questions is not derived from CQC’s published framework and is a placeholder.'
        : 'This mapping of evidence to Key Questions is not derived from CQC’s published framework, and the rating combines checks by taking the worst of them. Both are placeholders.'}{' '}
      No regulatory conclusion should be drawn from anything on this screen.
    </div>
  )
}

/**
 * A rating, or the statement that there is no rating to give.
 *
 * **Insufficient Evidence is not a fourth colour.** Green, amber and red are
 * findings; this is the absence of one, so it takes the unrecorded treatment
 * and states its coverage where a rating would be. Its home was designed
 * before Phase 0 and this is the first screen built for it.
 */
export function PanelRating({ verdict }: { verdict: PanelVerdict }) {
  if (verdict.kind === 'insufficient_evidence') {
    return (
      <span data-rating="insufficient_evidence">
        <Unrecorded
          variant="chip"
          label="Insufficient evidence"
          detail={`${formatCount(verdict.usable)} of ${formatCount(verdict.total)} checks can support a figure`}
        />
      </span>
    )
  }

  /*
   * The rating names the check it came from. "Red — worst of nine checks" on
   * five panels tells a reader nothing; "Red — doses with a record against
   * them" tells them where to go.
   */
  return (
    <span className={styles.rating} data-rating={verdict.rating}>
      <span className={styles.ratingLabel}>{RATING_LABEL[verdict.rating]}</span>
      <span className={styles.ratingDetail} data-driver={verdict.driver.id}>
        {verdict.driver.name}, {verdict.driver.detail}
      </span>
    </span>
  )
}

/**
 * How much of a panel can support a figure at all.
 *
 * Two segments rather than a percentage, because the second segment is the
 * finding: a bar that is half grey says something a number cannot.
 */
export function CoverageBar({ verdict }: { verdict: PanelVerdict }) {
  const usable = verdict.total === 0 ? 0 : (verdict.usable / verdict.total) * 100

  return (
    <div className={styles.coverageBar} data-coverage-bar>
      <span className={styles.coverageTrack}>
        <span className={styles.coverageUsable} style={{ width: `${usable}%` }} />
        <span className={styles.coverageThin} style={{ width: `${100 - usable}%` }} />
      </span>
      {/*
       * The bar and the sentence are one thing and have one owner. The bar
       * alone is a proportion with no denominator, which is the figure this
       * product refuses everywhere else; the overview had grown its own copy
       * of both, and two renderings of one concept is the same defect as one
       * rendering of two.
       */}
      <span className={styles.coverageText} data-coverage-text>
        <span data-numeric>{formatCount(verdict.usable)}</span> of{' '}
        <span data-numeric>{formatCount(verdict.total)}</span> checks can support a
        figure
      </span>
    </div>
  )
}

/**
 * A check nothing in this product records.
 *
 * **Its own treatment, deliberately inert** — solid, plain-bordered, no
 * pattern. The hatch means "a gap somebody can close" and Insufficient
 * Evidence already occupies it; a third meaning on one pattern would break it
 * for the other two. Nothing on any screen closes this one, and giving it the
 * hatch would send a manager looking for a screen that does not exist.
 */
export function NotHeldHere({
  statement,
  compact = false,
}: {
  statement: string
  compact?: boolean
}) {
  return (
    <span className={styles.notHeld} data-not-held>
      <span className={styles.notHeldLabel}>Not held here</span>
      {compact ? null : <span className={styles.notHeldDetail}>{statement}</span>}
    </span>
  )
}

/** What a check found: a figure with its rating, or the reason there is none. */
export function CheckFigure({ reading }: { reading: CheckReading }) {
  if (reading.kind === 'insufficient') {
    return (
      <span data-check-figure="insufficient">
        <Unrecorded
          variant="chip"
          label="Insufficient evidence"
          detail={reading.aggregate.missingDescription}
        />
      </span>
    )
  }

  return (
    <span className={styles.checkFigure} data-check-figure={reading.rating}>
      <span className={styles.checkValue} data-numeric>
        {formatCount(reading.aggregate.value)}%
      </span>
      <span className={styles.checkRating}>{RATING_LABEL[reading.rating]}</span>
      <span className={styles.checkCoverage}>
        {formatCount(reading.aggregate.coverage.covered)} of{' '}
        {formatCount(reading.aggregate.coverage.total)}
      </span>
    </span>
  )
}
