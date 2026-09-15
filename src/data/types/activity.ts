import type {
  ActivityId,
  IsoDateTime,
  ResidentId,
  SiteId,
  StaffRef,
} from './primitives'

/**
 * Activities. PRD §6.7, Phase 9.
 *
 * **The first module whose subject is a group rather than a resident**, and
 * that changes the shape of the failure §2.4 exists to prevent. You do not
 * pick the wrong person from a list; you slip a row on a grid, and Doris is
 * marked present while Beryl is marked absent. Which is why every row on the
 * recording grid carries its own resident identity — §2.4 applied per row.
 */

/**
 * Why somebody did not come.
 *
 * A recorded negative needs a reason for the same reason a not-given dose
 * does: "did not attend" without one is indistinguishable from nobody having
 * looked, and the whole point of the third state is that those are different.
 */
export const DID_NOT_ATTEND_REASONS = [
  { id: 'declined', name: 'Declined' },
  { id: 'unwell', name: 'Unwell' },
  { id: 'off_site', name: 'Off site' },
  { id: 'asleep', name: 'Asleep' },
  { id: 'other', name: 'Other: say why' },
] as const

export type DidNotAttendReasonId = (typeof DID_NOT_ATTEND_REASONS)[number]['id']

/**
 * Whether one invited resident came. **This module's MAR cell.**
 *
 * Three states, and the third is the one that matters:
 *
 *  - `attended` — a recorded positive.
 *  - `did_not_attend` — a **recorded negative**, and it looks settled. "Doris
 *    declined, she said she was tired" is a complete record of a person
 *    exercising a choice, not a failure of anybody's.
 *  - `not_recorded` — the gap, and it takes the hatch.
 *
 * Exactly the distinction `not_given` and `omitted` draw on a MAR chart, for
 * exactly the same reason: **zero attended says nobody came; nothing recorded
 * says nobody wrote it down**, and a screen that renders them alike is the
 * blank that means two things.
 */
export type AttendanceState =
  | { kind: 'not_recorded' }
  | { kind: 'attended'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'did_not_attend'
      reason: DidNotAttendReasonId
      /** Required where the reason is `other`; the record says why. */
      note: string
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

/** One person on the invitation list, and whether anybody said if they came. */
export interface Invitation {
  residentId: ResidentId
  attendance: AttendanceState
}

/**
 * Somebody who joined without being invited.
 *
 * **Their own member rather than a late addition to the invitation list.**
 * People wander into the lounge and join in, and that is worth recording — but
 * adding them retroactively would rewrite the plan to say they were always
 * expected, which is a record editing itself to look tidier.
 *
 * The attendance denominator stays the invitation list and says so. "12 of 18
 * invited attended, 4 not recorded, and 2 who were not invited joined" is
 * three facts and all three are true.
 */
export interface Joiner {
  residentId: ResidentId
  /** How they came to be there. "Came in from the lounge and stayed." */
  note: string
  recordedBy: StaffRef
  recordedAt: IsoDateTime
}

/**
 * Whether a session is still going ahead. Phase 20.
 *
 * **Cancelling keeps every attendance already recorded, and the type is what
 * says so.** A cancellation that discarded them would be a record editing
 * itself: somebody wrote that Emmanuel came to the gardening club, with their
 * name and the time on it, and a later decision about the session does not
 * make that untrue. It is the shape consent withdrawal settled on — a
 * withdrawal supersedes a consent and never erases it — and the reason is the
 * same, that the earlier record is evidence of what somebody did.
 *
 * So there is no `cancelled` variant that drops `joined`. There is a standing
 * beside it, and the screens render the pair.
 *
 * **The reason is required and never a code.** AM v2.0's ACT-01 asks for one,
 * and a cancelled session with no reason is the same shape as a removed
 * access with none: a record whose reason says where somebody clicked.
 */
export type ActivityStanding =
  | { kind: 'planned' }
  | {
      kind: 'cancelled'
      /** In words: "the minibus did not arrive". */
      reason: string
      by: StaffRef
      at: IsoDateTime
    }

export interface Activity {
  id: ActivityId
  standing: ActivityStanding
  siteId: SiteId
  name: string
  description: string
  startsAt: IsoDateTime
  endsAt: IsoDateTime
  place: string
  plannedBy: StaffRef
  plannedAt: IsoDateTime
  /**
   * Everybody it was planned for. **The denominator for every figure about
   * this session**, because counting attendees would make a session nobody
   * came to look the same as a session nobody wrote up.
   */
  invited: Invitation[]
  joined: Joiner[]
}
