import styles from './StatusPill.module.css'

/**
 * A RECORDED status. Rule 3 of the Evidence Invariant.
 *
 * Solid tint, solid border, settled appearance. This is what a complete
 * record looks like — including a complete *negative* record, which is the
 * distinction the whole product turns on:
 *
 *   NO KNOWN ALLERGIES — recorded 12/03/2026     ← recorded, settled, green
 *   ALLERGIES NOT RECORDED                       ← unrecorded, hatched
 *
 * Never use this for something nobody has looked at. That is <Unrecorded>.
 */

export type StatusTone = 'positive' | 'caution' | 'critical' | 'info' | 'brand'

export interface StatusPillProps {
  tone: StatusTone
  /** The status itself: "GIVEN", "FALLS RISK — HIGH", "NOT GIVEN". */
  label: string
  /**
   * Author and timestamp, or whatever completes the record. Always visible,
   * never hover-only. PRD §3.6.
   */
  detail?: string
  /** Fill the cell rather than sit inline. For the MAR grid. */
  block?: boolean
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: styles.positive,
  caution: styles.caution,
  critical: styles.critical,
  info: styles.info,
  brand: styles.brand,
}

export function StatusPill({ tone, label, detail, block = false }: StatusPillProps) {
  const className = [styles.pill, TONE_CLASS[tone], block ? styles.block : '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className={className} data-state="recorded" data-tone={tone}>
      <span>{label}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
    </span>
  )
}
