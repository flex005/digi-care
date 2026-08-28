import { Unrecorded } from './Unrecorded'
import styles from './Settled.module.css'

/**
 * A resident nobody has ever written a care note about.
 *
 * **One concept, one label, one treatment.** It was rendering in five places
 * with three different labels — "No care note recorded", "Never written up",
 * and a plain sentence on the handover — plus four different supporting lines
 * saying the same thing four ways. A reader who learns what the hatch means on
 * one screen should not have to learn a second vocabulary on the next.
 *
 * The label is "Never written up" because that is what somebody in a care home
 * says out loud. "No care note recorded" is the more literal phrase and reads
 * as a systems message; this is a statement about a person.
 *
 * No detail line. Every one it carried — "not once, ever", "nobody has written
 * this resident up, not once" — restated the label at greater length, on rows
 * where the same sentence appeared beneath every hatched cell.
 *
 * `quiet` is the handover's variant, and it is the one deliberate exception to
 * the single treatment. The row there is already hatched by "Not reviewed",
 * and a second hatch on the same row is noise rather than emphasis — the
 * distinction that row is drawing is between six unreviewed residents, not
 * between recorded and unrecorded. It is the same words, stated plainly.
 */
export function NeverWrittenUp({
  variant = 'badge',
}: {
  variant?: 'badge' | 'panel' | 'chip' | 'quiet'
}) {
  if (variant === 'quiet') {
    return <span className={styles.label}>Never written up</span>
  }
  return <Unrecorded variant={variant} label="Never written up" />
}
