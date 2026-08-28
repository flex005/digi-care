import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  IsoDate,
  SiteId,
  StaffId,
  StaffMember,
  StaffRef,
  StaffRole,
  StaffStanding,
} from '../types'
import {
  staff,
  staffAdebayo,
  staffAdeyinka,
  staffBennett,
  staffDeactivated,
  staffOkonkwo,
  staffPatel,
} from '../fixtures/organisation'
import { daysAgo, toIsoDate } from '../fixtures/generate'

/**
 * The team, and whether each person can still get in. PRD §6.7, Phase 14.
 *
 * **Standing lives here, never on the record.** A `StaffRef` is snapshotted
 * into every care note, dose and signature so records outlive access; standing
 * changes and the snapshot must not. Everything that renders "(no longer has
 * access)" beside an author reads it from here, at render time.
 */

const ASHGROVE = new Set<StaffId>([staffPatel.id])

/**
 * Who has access, and who does not.
 *
 * Four standings, all four reached: Joseph Whitfield left, Folake Adebayo is
 * suspended pending a review, and Laura Bennett is on the team with access
 * never set up — a gap rather than a decision, and the one that takes the
 * hatch. Everybody else has access.
 *
 * Dates are relative to the fixture instant, like every other fixture date,
 * so "suspended 11 days ago" stays true rather than drifting into history.
 */
const STANDINGS: Partial<Record<StaffId, StaffStanding>> = {
  [staffDeactivated.id]: {
    kind: 'no_longer_has_access',
    on: toIsoDate(daysAgo(23)),
    reason: 'left the service',
    by: staffOkonkwo,
  },
  [staffAdebayo.id]: {
    kind: 'suspended',
    on: toIsoDate(daysAgo(11)),
    reason: 'suspended pending a review',
    by: staffOkonkwo,
  },
  [staffBennett.id]: {
    kind: 'never_given_access',
    addedOn: toIsoDate(daysAgo(38)),
    addedBy: staffOkonkwo,
  },
  /*
   * The same standing, two days old. Both an invitation somebody can still
   * accept and one that ran out a month ago, so the invitation screen's two
   * states are each reachable from a fresh load.
   */
  [staffAdeyinka.id]: {
    kind: 'never_given_access',
    addedOn: toIsoDate(daysAgo(2)),
    addedBy: staffOkonkwo,
  },
}

const DEFAULT_STANDING = (since: IsoDate): StaffStanding => ({
  kind: 'has_access',
  since,
  grantedBy: staffOkonkwo,
})

/**
 * Built from the fixtures rather than being them.
 *
 * `setStanding` writes onto the member objects, so this array is the session's
 * copy and `fromFixtures` is how it is rebuilt when a session ends. Mapping
 * afresh matters: a shallow copy would share the member objects and a sign-out
 * would leave every standing change in place.
 */
const fromFixtures = (): StaffMember[] =>
  staff.map((ref) => ({
    id: ref.id,
    ref,
    role: ref.role,
    siteId: ASHGROVE.has(ref.id) ? 'site-ashgrove-lodge' : 'site-rosewood-court',
    standing: STANDINGS[ref.id] ?? DEFAULT_STANDING(toIsoDate(daysAgo(880))),
  }))

let members: StaffMember[] = fromFixtures()

/** Everybody who appears on a record here, ordered by name and only by name. */
export function teamMembers(): StaffMember[] {
  return [...members].sort((a, b) => a.ref.fullName.localeCompare(b.ref.fullName))
}

export function memberById(id: string): StaffMember | undefined {
  return members.find((member) => member.id === id)
}

export function standingOf(id: StaffId): StaffStanding | undefined {
  return members.find((member) => member.id === id)?.standing
}

/**
 * How a standing reads in a sentence, as against on its own chip.
 *
 * Two forms with one owner, the same shape `INCIDENT_TYPES` uses: "No longer
 * has access" is right on a chip in a column and wrong appended to a name, and
 * a `.toLowerCase()` at the call site is the tidying transformation §8 names.
 *
 * `has_access` has no suffix at all. Somebody who can still get in is the
 * unremarkable case, and annotating every author with "(has access)" would be
 * noise on every record in the product.
 */
const SUFFIX: Record<StaffStanding['kind'], string> = {
  has_access: '',
  no_longer_has_access: ' (no longer has access)',
  suspended: ' (access suspended)',
  never_given_access: ' (never had access)',
}

/**
 * A name as it should read on a record today.
 *
 * **Derived, never snapshotted.** `StaffRef.isActive` used to carry this, which
 * made it a fact about now stored in a record about then: reactivate somebody
 * and every historic note would still have called them deactivated.
 *
 * Somebody who is not on the team at all — a name on an old record and nothing
 * else — reads as themselves rather than as a gap. The record is the evidence
 * that they existed; the team list is not.
 */
export function staffLabel(ref: StaffRef): string {
  const standing = standingOf(ref.id)
  return standing === undefined
    ? ref.displayName
    : `${ref.displayName}${SUFFIX[standing.kind]}`
}

/** The same, for a full name — headers and confirmations rather than records. */
export function staffFullLabel(ref: StaffRef): string {
  const standing = standingOf(ref.id)
  return standing === undefined
    ? ref.fullName
    : `${ref.fullName}${SUFFIX[standing.kind]}`
}

export function hasAccess(id: StaffId): boolean {
  return standingOf(id)?.kind === 'has_access'
}

/**
 * Standing changed during this session, in memory and nowhere else.
 *
 * The fixtures are never mutated, for the reason every other store gives: the
 * guards in `fixtures.test.ts` must keep testing the fixtures rather than
 * whatever the last click did.
 */
export function setStanding(id: StaffId, standing: StaffStanding): StaffMember {
  const member = members.find((entry) => entry.id === id)
  if (member === undefined) throw new Error(`No staff member with id ${id}`)
  member.standing = standing
  standingChanges += 1
  return member
}

/** Access decisions taken this session, counted for the sign-out list. */
let standingChanges = 0

/**
 * What this store would lose.
 *
 * An access change is somebody's ability to get in, decided by a named person
 * with a reason. It is the least record-shaped thing on the loss list and one
 * of the most consequential.
 */
export function teamHoldings(): SessionHolding[] {
  return [
    ...held('people you put on the team', added),
    ...held('access decisions you made', standingChanges),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionTeam(): void {
  members = fromFixtures()
  added = 0
  standingChanges = 0
}

// ---------------------------------------------------------------------------
// Adding, inviting and removing. Session only, and the fixtures are untouched.
// ---------------------------------------------------------------------------

let added = 0

/**
 * Put somebody on the team.
 *
 * **They arrive with no access, and that is a state rather than a step
 * skipped.** `never_given_access` carries who added them and when, so a person
 * on the list nobody has set up reads as a gap somebody can close instead of
 * as a quiet default. Granting access is a second act, by a named person, and
 * `inviteMember` is where it happens.
 */
export function addMember(input: {
  fullName: string
  role: StaffRole
  siteId: SiteId
  addedBy: StaffRef
}): StaffMember {
  added += 1
  const id = `staff-added-${String(added).padStart(3, '0')}` as StaffId
  const ref: StaffRef = {
    id,
    fullName: input.fullName.trim(),
    displayName: shortName(input.fullName.trim()),
    role: input.role,
    /*
     * How they appeared on a record at the moment it was written. Somebody
     * just added has written nothing, so this is true of every record they go
     * on to make, and it is the standing rather than this flag that answers
     * whether they can get in.
     */
    isActive: true,
  }
  const member: StaffMember = {
    id,
    ref,
    role: input.role,
    siteId: input.siteId,
    standing: {
      kind: 'never_given_access',
      addedOn: today(),
      addedBy: input.addedBy,
    },
  }
  members.push(member)
  return member
}

/**
 * Grant access, which is what an invitation does in a build with no email.
 *
 * There is no message to send and no inbox to send it to, so this records the
 * decision rather than pretending to deliver one. The screen says as much.
 */
export function inviteMember(id: StaffId, by: StaffRef): StaffMember {
  return setStanding(id, { kind: 'has_access', since: today(), grantedBy: by })
}

export function suspendMember(id: StaffId, reason: string, by: StaffRef): StaffMember {
  return setStanding(id, { kind: 'suspended', on: today(), reason, by })
}

/**
 * Take somebody off the team list.
 *
 * **Only somebody added this session.** Records outlive access (§6.7): every
 * note, dose and signature carries a `StaffRef` snapshot, and removing a
 * person who appears on any of them would leave those records naming somebody
 * the team list says does not exist. Removing access is the act for a real
 * member, and it is not the same act.
 */
export function removeMember(id: StaffId): void {
  const index = members.findIndex((member) => member.id === id)
  if (index === -1) throw new Error(`No staff member with id ${id}`)
  if (!isAddedThisSession(id)) {
    throw new Error(
      'Somebody who appears on the record cannot be deleted, because the records that name them would outlive the deletion. Remove their access instead.',
    )
  }
  members.splice(index, 1)
}

export const isAddedThisSession = (id: StaffId): boolean =>
  String(id).startsWith('staff-added-')

const today = (): IsoDate => appNow().toISOString().slice(0, 10) as IsoDate

/** "Chinelo Nwosu" becomes "C. Nwosu", the way every record shows a name. */
function shortName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return fullName
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`
}

// ---------------------------------------------------------------------------
// Signing identity
// ---------------------------------------------------------------------------

/**
 * The code a member of staff types to sign something.
 *
 * **A signature has to establish who, not that somebody clicked.** The round
 * already asked for four digits and checked only that four had been typed,
 * which proves a person was standing there and nothing about which person: on
 * a shared trolley that is the shared-login failure with a keypad in front of
 * it.
 *
 * Derived from the staff id rather than stored, because this build has no
 * accounts and no secrets to keep. It is deliberately *not* a security
 * mechanism and the screen says so: what it buys is that a signature carries
 * an identifier that belongs to one person and can be checked against them,
 * which is what an audit trail needs.
 */
export function signingCodeFor(id: StaffId): string {
  let hash = 0
  for (const character of String(id)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return String(hash % 10_000).padStart(4, '0')
}

/** Whether this code belongs to this person. */
export const signingCodeMatches = (id: StaffId, code: string): boolean =>
  code.trim() === signingCodeFor(id)
