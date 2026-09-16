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
 * **A member is a list of revisions rather than a set of fields**, which is
 * the care plan's shape and is here for the same reason. Correcting a mistyped
 * email by removing somebody and naming them again would discard who granted
 * the access and when — the record of the decision, not a detail of it. So an
 * edit appends: the original recording stays first, and every later revision
 * carries its own author, instant, and which fields it touched.
 *
 * **The access level appends rather than replaces, and that is the one field
 * where it matters.** A mistyped email was never true, so correcting it leaves
 * nothing behind worth keeping. A level *was* true for a period, and the
 * disclosure log records what was shared during it — so "was she on Basic when
 * that note was shared?" is answerable only while the earlier level is still
 * on the record. Holding every field in one revision list gives that for free
 * and leaves no way for a level history and a current level to disagree.
 */
export type FamilyAccessLevel = 'full' | 'basic'

/** A field somebody can change after the access was first recorded. */
export type FamilyField = 'name' | 'relationship' | 'email' | 'level'

export interface FamilyRevision {
  name: string
  relationship: string
  /**
   * How to reach them, and **a union rather than a string**, because an empty
   * string would make "nobody has taken an address" and "they have no email"
   * the same fact. Nothing in this build sends to it: it is a contact detail
   * on a record, the way a next of kin's telephone number is.
   */
  email: Recorded<string>
  level: FamilyAccessLevel
  /** Who wrote this revision, and when. Every record here carries its author. */
  by: StaffRef
  at: IsoDateTime
  /**
   * What this revision changed. **Empty on the first one**, which recorded the
   * access rather than changing it — and empty is a fact about that revision,
   * not a gap: nothing preceded it to differ from.
   */
  changed: FamilyField[]
}

export interface FamilyMember {
  id: string
  residentId: ResidentId
  /** Oldest first, never empty. The first is the recording; the last is now. */
  revisions: [FamilyRevision, ...FamilyRevision[]]
}

/** What this member's details are now: the newest revision. */
export const currentDetails = (member: FamilyMember): FamilyRevision =>
  member.revisions[member.revisions.length - 1]!

/** Who recorded the access and when. This never moves, whatever is corrected. */
export const recordedAccess = (member: FamilyMember): FamilyRevision =>
  member.revisions[0]

/**
 * Every level this access has stood at, oldest first, each with who set it.
 *
 * Derived rather than stored: a second list would be a second owner of one
 * fact, and the two would drift the first time an edit wrote one of them.
 */
export function levelHistory(member: FamilyMember): FamilyRevision[] {
  return member.revisions.filter(
    (revision, index) =>
      index === 0 || revision.level !== member.revisions[index - 1]!.level,
  )
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

export const levelLabel = (level: FamilyAccessLevel): string =>
  ACCESS_LEVELS.find((entry) => entry.id === level)!.label
