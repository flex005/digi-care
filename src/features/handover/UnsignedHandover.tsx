import type { HandoverSession } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { SHIFT_NAMES } from '@/lib/shift'
import { formatDate } from '@/lib/format'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './handover.module.css'

/**
 * An earlier handover that never got both signatures. The Stale state, PRD
 * §6.3: "a previous shift's handover the outgoing staff signed and the
 * incoming staff never did — a state a three-status model with a single
 * signature cannot represent."
 *
 * **Hatched, because a missing countersignature is an omission.** It read as
 * amber prose before, which is the treatment for something recorded and
 * needing attention. Nothing was recorded. Somebody handed a home over and
 * there is no evidence anybody took it, and that is a hole in the record
 * rather than a warning inside one — Rule 2, and Rule 3 in the same breath.
 *
 * The half that *was* signed is stated in full, author and timestamp
 * included, because it is a complete record and the reader needs to know
 * which end of the handover is missing. A gap that does not say which half is
 * absent sends somebody to ask both shifts.
 */
export function UnsignedHandover({ session }: { session: HandoverSession }) {
  const format = useSiteFormat()

  const outgoingShift = SHIFT_NAMES[session.outgoingShift].toLowerCase()
  const incomingShift = SHIFT_NAMES[session.incomingShift].toLowerCase()
  const when = `${formatDate(session.date)}, ${outgoingShift} to ${incomingShift}`

  // Three ways a handover can be short of a signature, and they are three
  // different failures. One label across all three would lose the worst of
  // them inside the mildest, which is the blank-cell bug wearing a word.
  const { missing, detail } =
    session.outgoing.kind === 'signed' && session.incoming.kind === 'not_signed'
      ? {
          missing: 'never countersigned',
          detail: `Handed over by ${session.outgoing.by.displayName} at ${format.time(session.outgoing.at)}, and never accepted by the ${incomingShift} shift. Somebody handed over; nobody recorded receiving it.`,
        }
      : session.outgoing.kind === 'not_signed' && session.incoming.kind === 'signed'
        ? {
            missing: 'never handed over',
            detail: `Accepted by ${session.incoming.by.displayName} at ${format.time(session.incoming.at)}, but the ${outgoingShift} shift never signed to say what they were handing over. The incoming shift has a record of taking something nobody described.`,
          }
        : {
            missing: 'neither shift signed',
            detail: `Neither the ${outgoingShift} shift nor the ${incomingShift} shift signed. There is no record that this shift change was handed over or taken.`,
          }

  return (
    <li
      className={styles.unsignedRow}
      data-unsigned={session.id}
      data-missing={missing}
    >
      <Unrecorded variant="row" label={`${when}, ${missing}`} detail={detail} />
    </li>
  )
}
