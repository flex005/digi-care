import styles from './Settled.module.css'

/**
 * A recorded fact that is complete and needs nothing doing about it.
 *
 * The third weight in the system, and the one that was missing:
 *
 *   FALLS — HIGH                     <StatusPill>   recorded, act on it
 *   Reviewed 01/08/2026 · next…      <Settled>      recorded, nothing to do
 *   FALLS — NOT ASSESSED             <Unrecorded>   nobody has looked
 *
 * Without this, "recorded and fine" had to borrow the treatment meant for
 * "recorded and urgent", so a completed review shouted as loudly as a missing
 * allergy record — the hierarchy inverted, on the one screen whose entire job
 * is finding neglect.
 *
 * The rule it follows is the corollary of the risk column's:
 *
 *     Not shown means recorded and unremarkable.
 *     Shown but unremarkable should be quiet.
 *
 * **Quiet is not hidden, and this is not for gaps.** It renders the same full
 * record a pill would — author and timestamp included, always visible, never
 * hover-only (PRD §3.6). It is simply not shouted. Anything nobody has looked
 * at goes to <Unrecorded> and stays loud; anything needing action stays a
 * <StatusPill>. Reaching for this to calm down an inconvenient gap is the bug
 * the whole product exists to prevent.
 */

export interface SettledProps {
  /** The fact itself: "Reviewed 01/08/2026", "All assessed — no flags". */
  label: string
  /** What completes the record — next due, author, timestamp. */
  detail?: string
}

export function Settled({ label, detail }: SettledProps) {
  return (
    <span className={styles.settled} data-state="recorded" data-emphasis="settled">
      <span className={styles.label}>{label}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
    </span>
  )
}
