import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import { familyMembers as seeded } from '@/data/fixtures/family'
import {
  ACCESS_LEVELS,
  currentDetails,
  levelLabel,
  type FamilyAccessLevel,
  type FamilyField,
  type FamilyMember,
  type FamilyRevision,
} from '../types'
import type { IsoDateTime, ResidentId, StaffRef } from '../types'

/**
 * Who a family has named to see a resident's updates. AM v2.0 FAM-01,
 * Phase 21, its own module in Phase 26, corrections in Phase 27.
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
 * settled: the fixtures are never mutated, so a removal is a note that this
 * session removed it, and a correction is a revision appended beside it.
 */

export { ACCESS_LEVELS, currentDetails, levelLabel }
export type { FamilyAccessLevel, FamilyMember, FamilyRevision }

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
/** Revisions written this session, against fixture members and new ones alike. */
const appended = new Map<string, FamilyRevision[]>()
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
let corrections = 0

/** A member as it stands: what the fixture holds, plus this session's edits. */
function asItStands(member: FamilyMember): FamilyMember {
  const extra = appended.get(member.id)
  if (extra === undefined || extra.length === 0) return member
  return { ...member, revisions: [...member.revisions, ...extra] }
}

export const familyFor = (residentId: ResidentId): FamilyMember[] => [
  ...seeded
    .filter((member) => member.residentId === residentId && !removed.has(member.id))
    .map(asItStands),
  ...added.filter((member) => member.residentId === residentId).map(asItStands),
]

/** Everybody named at any resident, for the module screen. */
export const allFamilyMembers = (): FamilyMember[] => [
  ...seeded.filter((member) => !removed.has(member.id)).map(asItStands),
  ...added.map(asItStands),
]

export const memberById = (id: string): FamilyMember | undefined =>
  allFamilyMembers().find((member) => member.id === id)

const emailOf = (
  email: string,
  by: StaffRef,
  at: IsoDateTime,
): FamilyRevision['email'] =>
  email.trim() === ''
    ? { kind: 'unrecorded' }
    : { kind: 'recorded', value: email.trim(), recordedBy: by, recordedAt: at }

const emailValue = (email: FamilyRevision['email']): string =>
  email.kind === 'recorded' ? email.value : ''

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
    revisions: [
      {
        name: input.name.trim(),
        relationship: input.relationship.trim(),
        email: emailOf(input.email, input.by, at),
        level: input.level,
        by: input.by,
        at,
        // The first revision recorded the access; it changed nothing.
        changed: [],
      },
    ],
  }
  added.push(member)
  grants += 1
  return member
}

/**
 * Correct what is on the record, keeping who recorded it and when.
 *
 * **Remove-and-re-add is not a correction.** It discards the original grant —
 * who decided this family member may see a resident's record, and when — which
 * is the record of the decision rather than a detail of it. So an edit
 * appends: the recording stays first, and this revision carries its own
 * author, instant, and the fields it touched.
 *
 * **The level appends rather than replaces, and it is the one field where that
 * matters.** A mistyped email was never true, so nothing is lost by correcting
 * it. A level *was* true for a period, and the disclosure log records what was
 * shared during it, so the earlier level has to stay readable.
 *
 * **An edit that changes nothing is refused** rather than stored: a revision
 * saying somebody rewrote a record into exactly what it already said is a
 * record of an act that did not happen, the same reason sharing twice is
 * refused.
 */
export function editMember(
  id: string,
  input: {
    name: string
    relationship: string
    email: string
    level: FamilyAccessLevel
    by: StaffRef
  },
): FamilyMember {
  const member = memberById(id)
  if (member === undefined) throw new Error(`No family member with id ${id}`)
  if (input.name.trim() === '' || input.relationship.trim() === '')
    throw new Error(
      'A family member is a person and a relationship, after a correction as much as before one.',
    )

  const at = appNow().toISOString() as IsoDateTime
  const now = currentDetails(member)
  const email = emailOf(input.email, input.by, at)

  const changed: FamilyField[] = []
  if (input.name.trim() !== now.name) changed.push('name')
  if (input.relationship.trim() !== now.relationship) changed.push('relationship')
  if (emailValue(email) !== emailValue(now.email)) changed.push('email')
  if (input.level !== now.level) changed.push('level')

  if (changed.length === 0)
    throw new Error(
      'Nothing about this family member changed. An edit that rewrites a record into what it already said is a record of an act that did not happen.',
    )

  const revision: FamilyRevision = {
    name: input.name.trim(),
    relationship: input.relationship.trim(),
    /*
     * An untouched email keeps the instant it was taken rather than being
     * re-stamped with this correction's. Who took an address and when is a
     * fact about that address, and correcting somebody's relationship does not
     * make it newly true.
     */
    email: changed.includes('email') ? email : now.email,
    level: input.level,
    by: input.by,
    at,
    changed,
  }
  appended.set(id, [...(appended.get(id) ?? []), revision])
  corrections += 1
  return memberById(id)!
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
    appended.delete(id)
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
    ...held('family members whose details you corrected', corrections),
    ...held('family members you removed', removals),
    ...held('changes to the default access level', defaultChanges),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionFamilyAccess(): void {
  added.length = 0
  removed.clear()
  appended.clear()
  issued = 0
  grants = 0
  removals = 0
  corrections = 0
  defaultLevel = 'basic'
  defaultChanges = 0
}
