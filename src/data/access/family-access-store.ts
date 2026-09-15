import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type { IsoDateTime, ResidentId, StaffRef } from '../types'

/**
 * Who a family has named to see a resident's updates. AM v2.0 FAM-01,
 * Phase 21.
 *
 * **The basis for access is not held here.** That is the resident's
 * `family_portal` consent, recorded through the capacity gate like every other
 * consent, carrying a `DecisionAuthority` that is already exactly AM v2.0's
 * three grounds: the resident, an LPA holder with a health-and-welfare LPA, or
 * a best-interests decision naming who was consulted. Recording the basis here
 * as well would be two places holding one fact, and the one that goes stale is
 * whichever the reader is looking at.
 *
 * What is genuinely new is **who the named people are**, which no existing
 * record holds. So this store keeps a list and nothing else: the person, their
 * relationship, and how much they were granted.
 *
 * **There is no `invited` state.** AM v2.0 has one, and it implies an email in
 * flight and a status that turns Active. Nothing is sent and nothing can
 * activate, so the state would be permanent and its name a promise. See
 * `family-statement.ts`.
 */

export type FamilyAccessLevel = 'full' | 'basic'

export interface FamilyMember {
  id: string
  residentId: ResidentId
  name: string
  /** In words: "daughter", "son-in-law". Never a code. */
  relationship: string
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

const members: FamilyMember[] = []
let granted = 0
let removed = 0

export const familyFor = (residentId: ResidentId): FamilyMember[] =>
  members.filter((member) => member.residentId === residentId)

export function grantAccess(input: {
  residentId: ResidentId
  name: string
  relationship: string
  level: FamilyAccessLevel
  by: StaffRef
}): FamilyMember {
  if (input.name.trim() === '' || input.relationship.trim() === '')
    throw new Error(
      'A family member is a person and a relationship. "Next of kin" with no name is not somebody anybody can ring, and a name with no relationship is not a basis for showing them a care record.',
    )
  const member: FamilyMember = {
    id: `fam-${String(members.length + 1).padStart(3, '0')}`,
    residentId: input.residentId,
    name: input.name.trim(),
    relationship: input.relationship.trim(),
    level: input.level,
    by: input.by,
    at: appNow().toISOString() as IsoDateTime,
  }
  members.push(member)
  granted += 1
  return member
}

/**
 * Take it back.
 *
 * **Removed rather than superseded, and the difference from a disclosure
 * matters.** A note that was shared was seen, so its history is evidence. This
 * list is a statement about who may see things *now*, and nothing here was
 * ever shown to anybody: there is no disclosure to preserve, only a decision
 * that no longer stands.
 */
export function removeAccess(id: string): void {
  const at = members.findIndex((member) => member.id === id)
  if (at === -1) throw new Error(`No family member with id ${id}`)
  members.splice(at, 1)
  removed += 1
}

export function familyAccessHoldings(): SessionHolding[] {
  return [
    ...held('family members you gave access to', granted),
    ...held('family members you removed', removed),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionFamilyAccess(): void {
  members.length = 0
  granted = 0
  removed = 0
}
