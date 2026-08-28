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
 * **The denominator is not on the card face.** That is a deliberate departure
 * from Rule 4 — "no bare counts, anywhere" — made by Frank explicitly on
 * 20/08/2026 after being asked to confirm it, and recorded in PROGRESS.md
 * rather than absorbed quietly.
 *
 * What holds the claim together instead: the section is headed "Figures for
 * <site>", each card's `VisuallyHidden` claim states the figure, its
 * denominator and its site in one sentence, and the table's own caption below
 * reads "16 of 28 residents at Rosewood Court". The denominator is on the
 * screen; it is no longer beside the number.
 *
 * This is the one place on the screen where a bare number is easiest to reach
 * for — a big figure on a card looks finished without one — so if a future
 * card is added here, the denominator belongs in its accessible claim whatever
 * the face shows.
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
        /** The bottom line: the movement, or the coverage when there is none. */
        let footer: string
        let spoken: string

        switch (aggregate.kind) {
          case 'measured':
            figure = <span className={styles.tileValue}>{aggregate.value}</span>
            footer = change === null ? '' : changeLabel(change, period.phrase)
            // Spoken, not shown: the denominator lives here now. See above.
            spoken =
              `${source.label}: ${aggregate.value} ${
                source.kind === 'census'
                  ? 'residents'
                  : `of ${aggregate.coverage.covered} ${source.denominatorNoun}`
              } at ${siteLabel}.` + (footer ? ` ${footer}.` : '')
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
            footer = `${aggregate.coverage.covered} of ${aggregate.coverage.total} ${source.denominatorNoun}`
            spoken = `${source.label}: insufficient evidence. ${aggregate.missingDescription} ${footer} at ${siteLabel}.`
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

            <span className={styles.tileFigure}>{figure}</span>

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
