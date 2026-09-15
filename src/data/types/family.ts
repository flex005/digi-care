import type { IsoDateTime, ResidentId, StaffRef } from './primitives'
import type { Recorded } from './state'

/**
 * Who a family has named to see a resident's updates. AM v2.0 FAM-01.
 *
 * **The basis for access is not here.** That is the resident's `family_portal`
 * consent, recorded through the capacity gate, carrying a `DecisionAuthority`
 * that is already AM v2.0's three grounds. Holding the basis here as well
 * would be two records of one fact, and the one that goes stale is whichever
 * the reader is looking at.
 *
 * What is genuinely new is **who the named people are**, which no other record
 * holds: the person, their relationship, how to reach them, and how much they
 * were granted.
 */
export type FamilyAccessLevel = 'full' | 'basic'

export interface FamilyMember {
  id: string
  residentId: ResidentId
  name: string
  /** In words: "daughter", "son-in-law". Never a code. */
  relationship: string
  /**
   * How to reach them, and **a union rather than a string**, because an empty
   * string would make "nobody has taken an address" and "they have no email"
   * the same fact. Nothing in this build sends anything to it: it is a contact
   * detail on a record, the way a next of kin's telephone number is, and the
   * screen that collects it says so rather than implying an invitation.
   */
  email: Recorded<string>
  level: FamilyAccessLevel
  /** Who recorded it and when. Every record here carries its author. */
  by: StaffRef
  at: IsoDateTime
}

export const ACCESS_LEVELS: {
  id: FamilyAccessLevel
  label: string
  /** What the Family Portal would show them. A claim about another product. */
  means: string
}[] = [
  {
    id: 'full',
    label: 'Full updates',
    means:
      'The daily summary, care notes a manager has shared, photographs where photography consent is given, and upcoming appointments.',
  },
  {
    id: 'basic',
    label: 'Basic updates',
    means: 'The daily summary, and nothing else.',
  },
]
