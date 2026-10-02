import styles from './ReadOnlyHere.module.css'

/**
 * A viewer who may read this record and may not write to it, told so.
 *
 * **One owner, because the sentence is the enforcement being visible.** This
 * product's permission enforcement is UI-only — no store checks a level — so a
 * control that is simply absent is indistinguishable from a feature nobody
 * built. `ManagerReviewForm` has said this properly since Phase 20 and
 * `UrgencySection` copied it; twenty-six other write controls said nothing at
 * all, and the few that did gate returned `null`.
 *
 * **Not the hatch, and not an error.** Nothing is missing from the record and
 * nothing has gone wrong: this viewer is reading a complete record through a
 * role that does not write to it. §1's recorded-negative rule applied to a
 * permission — it renders quietly, the way `Settled` does, rather than wearing
 * the treatment reserved for a gap.
 *
 * **It names the role and the act**, because "you do not have permission" tells
 * a reader nothing they can act on. "Your role is Auditor, which reads
 * medication records and does not sign for a dose" tells them both why and
 * what would be needed.
 */
export function ReadOnlyHere({
  roleName,
  act,
  subject = 'this record',
}: {
  /** The viewer's role, as the permission table names it. */
  roleName: string
  /** What the role may not do, as a verb phrase: "sign for a dose". */
  act: string
  /** What it may read, as a noun phrase: "medication records". */
  subject?: string
}) {
  return (
    <p className={styles.refusal} data-read-only-here>
      Your role is {roleName}, which reads {subject} and does not {act}.
    </p>
  )
}
