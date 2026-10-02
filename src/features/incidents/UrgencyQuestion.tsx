import { useTerms } from '@/app/session/use-term'
import { SectionHeading, type HeadingLevel } from './SectionHeading'
import styles from './incidents.module.css'

/**
 * Whether this one cannot wait its turn, and why.
 *
 * **Refusable, because a correction may arrive on an incident that was raised
 * and then stood down.** `raiseUrgency` refuses a re-raise — the union holds
 * one raise and one answer rather than a chain — so a form that accepted
 * typing here would throw on save after somebody had written a reason.
 * `refusedReason` says so instead, in front of a control that is not offered.
 */
/**
 * Why a stood-down urgency cannot be raised again, said once.
 *
 * Both the page section and the correction modal refuse this, and they were
 * refusing it in two separately typed sentences — one owner, because two
 * copies of a refusal drift and the one that goes stale is whichever nobody
 * is looking at.
 */
export const NO_RE_RAISE =
  'This was raised and answered. Raising it again would overwrite who stood it down and why, so the record keeps both as they are.'

export function UrgencyQuestion({
  urgentBecause,
  onUrgentBecause,
  refusedReason,
  level = 'h2',
}: {
  urgentBecause: string
  onUrgentBecause: (value: string) => void
  /** Why this cannot be raised at all, where that is the case. */
  refusedReason?: string
  level?: HeadingLevel
}) {
  const terms = useTerms()

  if (refusedReason !== undefined) {
    return (
      <section className={styles.section} data-section="urgency">
        <SectionHeading level={level}>Does this need attention now?</SectionHeading>
        <p className={styles.footState} data-urgency-refused>
          {refusedReason}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.section} data-section="urgency">
      <SectionHeading level={level}>Does this need attention now?</SectionHeading>
      <p className={styles.sectionNote}>
        Every incident goes to a {terms.manager.one} unacknowledged. This says yours
        should not wait its turn, and it shows up on the incident as something owed.
      </p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Why it cannot wait</span>
        <textarea
          className={styles.input}
          rows={2}
          value={urgentBecause}
          data-urgent-because
          placeholder="Leave blank unless it genuinely cannot wait."
          onChange={(event) => onUrgentBecause(event.target.value)}
        />
        <span className={styles.hint}>
          A reason, not a tick: &ldquo;needs attention now&rdquo; with nothing behind it
          tells a {terms.manager.one} to hurry and not what about.
        </span>
      </label>
    </section>
  )
}
