import type { StaffStanding } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import styles from './team.module.css'

/**
 * Whether somebody can get in, and who decided. PRD §6.7, Phase 14.
 *
 * **Four members, and only one is quiet.** Having access is unremarkable and
 * renders as plain text. The two that took a decision render settled, with
 * when, why and who — a decision is a record, not a flag. And never having
 * been given access takes the hatch, because somebody who appears on the
 * record and was never set up is a gap rather than a decision anybody made.
 */
export function Standing({ standing }: { standing: StaffStanding }) {
  switch (standing.kind) {
    case 'has_access':
      return (
        <span className={styles.standingQuiet} data-standing="has_access">
          <span className={styles.standingLabel}>Has access</span>
          <span className={styles.standingDetail}>
            since {formatDate(standing.since)} · {standing.grantedBy.displayName}
          </span>
        </span>
      )
    case 'no_longer_has_access':
      return (
        <span className={styles.standingSettled} data-standing="no_longer_has_access">
          <span className={styles.standingLabel}>No longer has access</span>
          <span className={styles.standingDetail}>
            {formatDate(standing.on)} · {standing.reason} · {standing.by.displayName}
          </span>
        </span>
      )
    case 'suspended':
      return (
        <span className={styles.standingCaution} data-standing="suspended">
          <span className={styles.standingLabel}>Suspended</span>
          <span className={styles.standingDetail}>
            {formatDate(standing.on)} · {standing.reason} · {standing.by.displayName}
          </span>
        </span>
      )
    case 'never_given_access':
      return (
        <span data-standing="never_given_access">
          <Unrecorded
            variant="chip"
            label="Never given access"
            detail={`on the team since ${formatDate(standing.addedOn)}, added by ${standing.addedBy.displayName}, and never set up`}
          />
        </span>
      )
  }
}

/**
 * What this product does not hold about a person.
 *
 * **The same treatment as the compliance panel's**, deliberately: solid, plain
 * border, no pattern, because pattern means a gap somebody can close and
 * nothing on any screen closes this one.
 *
 * It sits **above** the activity, not below it. A page of what somebody
 * recorded reads as the beginning of a performance record unless it is told
 * otherwise first, and a note underneath would be a caveat on a page the
 * reader has already interpreted.
 */
const NOT_HELD = [
  'Supervision',
  'Appraisal',
  'Training and competency',
  'Induction',
  'Disciplinary record',
]

export function NotAPerformanceRecord() {
  return (
    <div className={styles.notHeld} data-not-held>
      <p className={styles.notHeldTitle}>This is not a performance record</p>
      <p className={styles.notHeldBody}>
        diGi-Care does not hold supervision, appraisal, training or induction. They live
        in whatever the home uses for staff records.
      </p>
      <ul className={styles.notHeldList}>
        {NOT_HELD.map((item) => (
          <li key={item} className={styles.notHeldItem} data-not-held-item={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
