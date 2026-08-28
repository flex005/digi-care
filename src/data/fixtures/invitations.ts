import type { IsoDate, StaffId, StaffRef } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'

/**
 * An invitation somebody has not accepted yet. PRD §6.7.
 *
 * **The expiry is required, and it is the point of the type.** An invitation
 * with no expiry is a permanent open door: a link that grants access to every
 * resident's clinical record, sent to an address somebody typed, working for
 * ever. There is no member for "does not expire", because there is no
 * legitimate case for one.
 *
 * **Built for the people the team already holds as `never_given_access`**,
 * rather than invented. That standing is somebody on the team whose access was
 * never set up, which is exactly who an invitation is for — and it means the
 * invitation screen and the team screen cannot disagree about who is waiting.
 */
export interface Invitation {
  staffId: StaffId
  invitedBy: StaffRef
  invitedOn: IsoDate
  /** Never optional. See above. */
  expiresOn: IsoDate
}

/** How long an invitation is good for. One owner, so both sides read it. */
export const INVITATION_DAYS = 7

/**
 * Everybody waiting on one.
 *
 * Derived from the team rather than listed, so somebody added to the team
 * without access appears here without anybody remembering to add them.
 */
export function invitations(): Invitation[] {
  return teamMembers().flatMap((member) => {
    const standing = member.standing
    if (standing.kind !== 'never_given_access') return []
    return [
      {
        staffId: member.id,
        invitedBy: standing.addedBy,
        invitedOn: standing.addedOn,
        expiresOn: expiryOf(standing.addedOn),
      },
    ]
  })
}

export function invitationFor(staffId: string): Invitation | undefined {
  return invitations().find((entry) => entry.staffId === staffId)
}

/**
 * When an invitation stops working.
 *
 * `INVITATION_DAYS` after it was sent, computed here so the invitation screen
 * and anything that checks whether one has lapsed read the same rule rather
 * than each restating the arithmetic.
 */
function expiryOf(invitedOn: IsoDate): IsoDate {
  const sent = new Date(`${invitedOn}T00:00:00.000Z`)
  sent.setUTCDate(sent.getUTCDate() + INVITATION_DAYS)
  return sent.toISOString().slice(0, 10) as IsoDate
}

/**
 * Whether an invitation has run out, against a day the caller names.
 *
 * The day is an argument rather than read from a clock, so a test can hold it
 * still and a screen can pass the site's day rather than the viewer's.
 */
export const invitationHasExpired = (invitation: Invitation, today: IsoDate): boolean =>
  invitation.expiresOn < today
