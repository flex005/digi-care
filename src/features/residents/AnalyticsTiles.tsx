import { assertNever } from '@/lib/assert-never'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { VisuallyHidden } from '@/components/primitives'
import { buildAnalyticsTiles, type AnalyticsPeriod } from './analytics-tiles'
import type { ResidentSummary } from '@/data/access/client'
import { LIST_CLOCK } from './list-clock'
import styles from './residents.module.css'

/**
 * The figures for the active site.
 *
 * **Read-only.** They were buttons that filtered the table; they are not any
 * more. Filtering now lives entirely in the row beneath, where a reader can
 * see every narrowing at once instead of inferring it from which card is lit.
 *
 * Nothing here is green. These exist to find problems, not to congratulate,
 * so a zero is a quiet zero and a movement is a signed number rather than a
 * coloured arrow — the sign is the carrier, and it survives greyscale.
 *
 * The change figure is **reconstructed, never estimated**: every record that
 * closes a gap carries the instant it was written, and care notes hold 90 days
 * of history, so the same question can be asked of a past instant. Where the
 * present figure cannot be computed the change is omitted rather than shown as
 * zero — a movement between two unknowns is not a number.
 *
 * The site name is not printed on each card. It is in the header above, is now
 * the only control that scopes this screen, and repeating it five times said
 * less than it cost. It stays in each card's accessible name, so a reader who
 * cannot see the header still gets the whole claim.
 *
 * **The denominator sits inline with the figure**, small, immediately after it:
 * "16" then "of 28". It is not a separate line and it is not optional. A count
 * on its own is the bug Rule 4 exists to prevent, and this is the one place on
 * the screen where a bare number would be easiest to reach for — a big figure
 * on a card looks finished without one.
 *
 * The census card is the exception, and only because its figure IS the
 * population: "28 residents" has nothing to be out of. Its scope is the
 * section heading, which names the site.
 */

export interface AnalyticsTilesProps {
  /** Everyone at the active site. */
  atSite: ResidentSummary[]
  siteLabel: string
  period: AnalyticsPeriod
}

function changeLabel(change: number, phrase: string): string {
  if (change === 0) return `No change ${phrase}`
  // An explicit sign, because "3" and "−3" are opposite findings and the
  // difference must not rest on a colour.
  return `${change > 0 ? '+' : '−'}${Math.abs(change)} ${phrase}`
}

export function AnalyticsTiles({ atSite, siteLabel, period }: AnalyticsTilesProps) {
  const tiles = buildAnalyticsTiles(atSite, LIST_CLOCK, period)

  return (
    <section className={styles.tiles} aria-label={`Figures for ${siteLabel}`}>
      {tiles.map(({ source, aggregate, excludedReason, change }) => {
        let figure: React.ReactNode
        /** Inline with the figure. Empty only for the census, which is one. */
        let denominator: string
        /** The bottom line: the movement, or the coverage when there is none. */
        let footer: string
        let spoken: string

        switch (aggregate.kind) {
          case 'measured':
            figure = <span className={styles.tileValue}>{aggregate.value}</span>
            denominator =
              source.kind === 'census'
                ? ''
                : `of ${aggregate.coverage.covered} ${source.denominatorNoun}`
            footer = change === null ? '' : changeLabel(change, period.phrase)
            spoken =
              `${source.label} — ${aggregate.value} ${denominator || 'residents'} at ${siteLabel}.` +
              (footer ? ` ${footer}.` : '')
            break

          case 'insufficient_evidence':
            // Not a milder zero. The absence of a finding, in the unrecorded
            // treatment, never in a RAG hue. PRD §2.3.
            figure = (
              <Unrecorded
                variant="chip"
                label="Insufficient evidence"
                detail={aggregate.missingDescription}
              />
            )
            denominator = ''
            footer = `${aggregate.coverage.covered} of ${aggregate.coverage.total} ${source.denominatorNoun}`
            spoken = `${source.label} — insufficient evidence. ${aggregate.missingDescription} ${footer} at ${siteLabel}.`
            break

          default:
            return assertNever(aggregate)
        }

        return (
          <div key={source.id} className={styles.tile}>
            <span className={styles.tileHead}>
              <span className={styles.tileLabel}>{source.label}</span>
              <span className={styles.tileIcon} aria-hidden="true">
                <Icon name={source.icon} size={16} />
              </span>
            </span>

            <span className={styles.tileFigure}>
              {figure}
              {denominator ? (
                <span className={styles.tileOf}>{denominator}</span>
              ) : null}
            </span>

            <span className={styles.tileFooter}>
              {footer ? <span className={styles.tileChange}>{footer}</span> : null}
              {excludedReason ? (
                <span className={styles.tileExcluded}>{excludedReason}</span>
              ) : null}
            </span>

            {/* The whole claim in one sentence, including the site the visible
                card leaves to the header. */}
            <VisuallyHidden>{spoken}</VisuallyHidden>
          </div>
        )
      })}
    </section>
  )
}
