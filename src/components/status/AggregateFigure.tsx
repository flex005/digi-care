import type { Aggregate } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
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
}

export function AggregateFigure({
  caption,
  aggregate,
  denominatorNoun,
}: AggregateFigureProps) {
  switch (aggregate.kind) {
    case 'insufficient_evidence':
      return (
        <div className={styles.figure}>
          <span className={styles.caption}>{caption}</span>
          <Unrecorded
            variant="panel"
            label="Insufficient evidence"
            detail={`${aggregate.missingDescription} ${aggregate.coverage.covered} of ${aggregate.coverage.total} ${denominatorNoun} have any data.`}
          />
        </div>
      )

    case 'measured':
      return (
        <div className={styles.figure}>
          <span className={styles.caption}>{caption}</span>
          <span className={styles.value}>
            {aggregate.value}
            {aggregate.unit === 'percentage' ? '%' : ''}
          </span>
          <span className={styles.coverage}>
            {aggregate.unit === 'percentage'
              ? `${aggregate.coverage.covered} of ${aggregate.coverage.total} ${denominatorNoun}`
              : `across ${aggregate.coverage.total} ${denominatorNoun}`}
          </span>
        </div>
      )

    default:
      return assertNever(aggregate)
  }
}
