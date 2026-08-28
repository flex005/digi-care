import type { IsoDate, IsoDateTime, ResidentId, SiteId, StaffRef } from './primitives'
import type { Shift } from './resident'

/**
 * Shift handover. PRD §6.3.
 *
 * > all residents with status All Well / Needs Attention / Urgent, plus
 * > **Not Reviewed** as a fourth, hatched state, because a resident nobody
 * > looked at is not "All Well". Dual signature, outgoing and incoming.
 *
 * The fourth state is the whole reason this screen is in the phase. A
 * three-state handover has no way to say "we ran out of time and never got to
 * Mrs Adeyemi", so the pressure at 19:58 is to mark her All Well and go home.
 * That is not a UI problem downstream of a data model; it IS the data model,
 * and `not_reviewed` being a member rather than an absence is what removes the
 * option.
 */

export type HandoverId = `handover-${string}`

/**
 * `needs_attention` and `urgent` carry a non-empty note by construction.
 *
 * A status that says somebody needs attention without saying what for is a
 * bare claim, and the incoming shift cannot act on it. It is the same failure
 * as a count with no denominator: a signal with nothing behind it.
 */
export type HandoverStatus =
  | { kind: 'not_reviewed' }
  | { kind: 'all_well'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'needs_attention'
      note: string
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }
  | { kind: 'urgent'; note: string; recordedBy: StaffRef; recordedAt: IsoDateTime }

/**
 * One half of the dual signature.
 *
 * Unsigned is a named member, not a missing timestamp. An unsigned handover is
 * a shift change nobody accepted responsibility for, and that has to be
 * visible on the screen rather than inferred from a blank.
 */
export type HandoverSignature =
  | { kind: 'not_signed' }
  | {
      kind: 'signed'
      by: StaffRef
      at: IsoDateTime
      /**
       * What was true when they signed, so the signature cannot be read as
       * more than it was. Signing a handover with six residents nobody looked
       * at does not mean "all well"; it means "handed over, with six holes",
       * and the record says which.
       */
      reviewed: number
      notReviewed: number
    }

export interface HandoverEntry {
  residentId: ResidentId
  status: HandoverStatus
}

export interface HandoverSession {
  id: HandoverId
  siteId: SiteId
  date: IsoDate
  /** The shift handing over, and the one taking it. */
  outgoingShift: Shift
  incomingShift: Shift
  outgoing: HandoverSignature
  incoming: HandoverSignature
  /**
   * Only the residents somebody has said something about.
   *
   * The screen iterates the site's residents and looks each one up here; it
   * never iterates this and calls that the list. A resident missing from it is
   * `not_reviewed`, which is a true statement about them and the one the
   * fourth state exists to make.
   */
  entries: HandoverEntry[]
}
