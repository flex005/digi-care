import { StatusPill, Unrecorded } from '@/components/status'
import { RISK_FLAG_SOURCES } from './risk-flag-sources'
import styles from './residents.module.css'

/**
 * The Risk flags legend. Permanently visible, never behind a tooltip.
 *
 * The column runs on a convention — *anything not shown has been recorded and
 * is unremarkable* — and a convention a reader has to infer is folk knowledge.
 * Folk knowledge is exactly how "no badge" starts meaning "he's fine" to
 * somebody who was never told otherwise, which is PRD §2.1's failure in a new
 * place.
 *
 * So it is stated, on the screen, next to the thing it governs. PRD §6.4 sets
 * the same rule for the MAR legend: "permanently visible above the grid, not
 * hidden behind a tooltip." Hover-only would also put it out of reach of a
 * keyboard user and a screen reader, and CLAUDE.md §6 forbids hover-to-reveal
 * for anything clinical.
 *
 * The samples are the real components rather than mock-ups, so the legend
 * cannot drift from what the column actually renders.
 */
export function RiskFlagsLegend() {
  return (
    <div className={styles.legend} aria-label="Risk flags legend" role="note">
      <p className={styles.legendIntro}>
        <strong>Risk flags</strong> covers{' '}
        {RISK_FLAG_SOURCES.map((source) => source.name.toLowerCase()).join(', ')}. EOLC
        and isolation are on each resident’s profile, where every state is shown.
      </p>
      <ul className={styles.legendItems}>
        <li className={styles.legendItem}>
          <Unrecorded label="Not assessed" />
          <span className={styles.legendText}>
            Nobody has looked. This is a gap, not a reassurance.
          </span>
        </li>
        <li className={styles.legendItem}>
          <StatusPill tone="critical" label="Falls — HIGH" />
          <span className={styles.legendText}>Recorded, and it needs attention.</span>
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendNothing} aria-hidden="true" />
          <span className={styles.legendText}>
            <strong>Not shown</strong> means recorded and unremarkable — never “nobody
            looked”, because every gap above is drawn.
          </span>
        </li>
      </ul>
    </div>
  )
}
