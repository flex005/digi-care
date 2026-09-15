import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import { familyMembers as seeded } from '@/data/fixtures/family'
import { ACCESS_LEVELS, type FamilyAccessLevel, type FamilyMember } from '../types'
import type { IsoDateTime, ResidentId, StaffRef } from '../types'

/**
 * Who a family has named to see a resident's updates. AM v2.0 FAM-01,
 * Phase 21, given its own module in Phase 26.
 *
 * **The basis for access is not held here.** That is the resident's
 * `family_portal` consent, recorded through the capacity gate like every other
 * consent. Recording the basis here as well would be two places holding one
 * fact, and the one that goes stale is whichever the reader is looking at.
 *
 * **There is no `invited` state.** AM v2.0 has one, and it implies an email in
 * flight and a status that turns Active. Nothing is sent and nothing can
 * activate, so the state would be permanent and its name a promise. See
 * `family-statement.ts`.
 *
 * **Fixtures plus this session's writes**, the shape the activity store
 * settled. Until Phase 26 the list started empty on every load, so a screen
 * counting residents with nobody named would have read the whole population
 * every time — a figure that cannot fall, which a reader cannot tell from a
 * broken one.
 */

export { ACCESS_LEVELS }
export type { FamilyAccessLevel, FamilyMember }

/**
 * What a new family member is offered first. AM v2.0 SETT-01, Phase 22.
 *
 * **A claim about the future, and the only Family Portal setting that is
 * one.** A default applies to the next decision and touches no existing one:
 * every member already named carries the level they were granted, and changing
 * this moves none of them. So it needs no second rendering rule and no pair.
 *
 * The site-wide on/off switch AM v2.0 also asks for is refused, and the reason
 * is the opposite of this: it would make every recorded consent unusable from
 * a screen that looks like preferences, which is worse than a dead control.
 */
let defaultLevel: FamilyAccessLevel = 'basic'

export const defaultAccessLevel = (): FamilyAccessLevel => defaultLevel

export function setDefaultAccessLevel(level: FamilyAccessLevel): void {
  defaultLevel = level
  defaultChanges += 1
}

let defaultChanges = 0

const added: FamilyMember[] = []
/** Fixture members somebody removed in this session. The fixtures never move. */
const removed = new Set<string>()
/**
 * **Never `added.length`.** Ids were built from the length of the list, so
 * removing somebody and naming somebody else produced a second person with an
 * id already in use — and Remove then took away whichever of the two came
 * first. A counter only ever goes up, and the `s` marks a session record so it
 * can never collide with a fixture id either.
 */
let issued = 0
let grants = 0
let removals = 0

export const familyFor = (residentId: ResidentId): FamilyMember[] => [
  ...seeded.filter(
    (member) => member.residentId === residentId && !removed.has(member.id),
  ),
  ...added.filter((member) => member.residentId === residentId),
]

/** Everybody named at any resident, for the module screen. */
export const allFamilyMembers = (): FamilyMember[] => [
  ...seeded.filter((member) => !removed.has(member.id)),
  ...added,
]

export function grantAccess(input: {
  residentId: ResidentId
  name: string
  relationship: string
  /** Blank is recorded as nobody having taken one, never as an empty string. */
  email: string
  level: FamilyAccessLevel
  by: StaffRef
}): FamilyMember {
  if (input.name.trim() === '' || input.relationship.trim() === '')
    throw new Error(
      'A family member is a person and a relationship. "Next of kin" with no name is not somebody anybody can ring, and a name with no relationship is not a basis for showing them a care record.',
    )
  issued += 1
  const at = appNow().toISOString() as IsoDateTime
  const member: FamilyMember = {
    id: `fam-s-${String(issued).padStart(3, '0')}`,
    residentId: input.residentId,
    name: input.name.trim(),
    relationship: input.relationship.trim(),
    email:
      input.email.trim() === ''
        ? { kind: 'unrecorded' }
        : {
            kind: 'recorded',
            value: input.email.trim(),
            recordedBy: input.by,
            recordedAt: at,
          },
    level: input.level,
    by: input.by,
    at,
  }
  added.push(member)
  grants += 1
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
  const at = added.findIndex((member) => member.id === id)
  if (at !== -1) {
    added.splice(at, 1)
    removals += 1
    return
  }
  if (seeded.some((member) => member.id === id)) {
    if (!removed.has(id)) {
      removed.add(id)
      removals += 1
    }
    return
  }
  throw new Error(`No family member with id ${id}`)
}

export function familyAccessHoldings(): SessionHolding[] {
  return [
    ...held('family members you gave access to', grants),
    ...held('family members you removed', removals),
    ...held('changes to the default access level', defaultChanges),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionFamilyAccess(): void {
  added.length = 0
  removed.clear()
  issued = 0
  grants = 0
  removals = 0
  defaultLevel = 'basic'
  defaultChanges = 0
}
