import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  IsoDate,
  ResidentAssignment,
  ResidentId,
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
  staffAluko,
  staffOkonkwo,
  staffClarke,
  staffEze,
  staffHalloran,
  staffMarsden,
  staffOgundipe,
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

/**
 * Where each person works, for anybody who is not at Rosewood alone.
 *
 * **A map rather than a set, from Phase 18**, because a member can now be at
 * more than one home. Marie Halloran is the case AM v2.0's TM-04 is about: a
 * deputy manager overseeing both homes, which is the only way that screen has
 * anything to show and the only reason `siteIds` is a list.
 */
const SITES: Partial<Record<StaffId, SiteId[]>> = {
  /*
   * **One home, said explicitly rather than left to the default.** A manager
   * appointed to a single home is the ordinary case and the one with no site
   * switcher; Marie Halloran below covers both, which AM v2.0's TM-04 exists
   * for. Both states have to exist in the fixtures before either is gated, or
   * the rule is written against a branch nobody can reach.
   */
  [staffAluko.id]: ['site-rosewood-court'],
  /*
   * **The Admin administers the organisation, and that is a different fact
   * from who a service is registered to.** Ruth Clarke is Ashgrove's
   * registered manager; Adaeze Okonkwo administers both homes, which is what
   * `siteIds` is for and what the source PRD's group-administrator persona
   * describes. Holding one home would have made the site switcher's rule two
   * rules — more than one home, or a role — and a control whose presence is a
   * fact about the reader rather than about their assignment.
   */
  [staffOkonkwo.id]: ['site-rosewood-court', 'site-ashgrove-lodge'],
  [staffPatel.id]: ['site-ashgrove-lodge'],
  [staffClarke.id]: ['site-ashgrove-lodge'],
  [staffOgundipe.id]: ['site-ashgrove-lodge'],
  [staffHalloran.id]: ['site-rosewood-court', 'site-ashgrove-lodge'],
}

/**
 * Who has access, and who does not.
 *
 * Four standings, all four reached: Joseph Whitfield left, Folake Adebayo is
 * suspended pending a review, and four people are on the team with access
 * never set up — a gap rather than a decision, and the one that takes the
 * hatch. Everybody else has access.
 *
 * **Two of those four are governance accounts, and that is the point.** Every
 * screen in Team Management is about people who sign into this platform, and
 * the only outstanding invitations were a care worker's and an activities
 * coordinator's — both users of the Care Worker product. Demonstrating the
 * invitation states with somebody who would accept in a different product is
 * the branch-with-no-fixture problem one level up: the screens worked and
 * nothing they showed could be reviewed.
 *
 * The other two stay, because they are a different thing rather than the same
 * thing done wrong. **Chasing an invitation and accepting one are two acts**:
 * an Admin chases everybody they invited, care workers included, which is what
 * TM-01's pending-invitations banner counts. Only accepting is done in the
 * invitee's own product.
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
  /*
   * The lapsed governance invitation: five weeks, against INVITATION_DAYS of
   * seven. A deputy manager at the second site whose account nobody followed
   * up, which is a finding about the home rather than about the fixture.
   */
  [staffOgundipe.id]: {
    kind: 'never_given_access',
    addedOn: toIsoDate(daysAgo(35)),
    addedBy: staffOkonkwo,
  },
  /* The live one: an auditor invited ahead of an inspection, two days ago. */
  [staffMarsden.id]: {
    kind: 'never_given_access',
    addedOn: toIsoDate(daysAgo(2)),
    addedBy: staffOkonkwo,
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
 * Which care workers have been given which residents.
 *
 * **Three of the five care workers, so all three states are on a fresh load.**
 * Sunita Patel covers the whole of Ashgrove, which is a decision somebody took
 * and carries their name; Ngozi Eze has four named residents; the rest are
 * `never_set`, which is the hatched state and the ordinary one — nobody has
 * been through the team record deciding this.
 *
 * Only care workers appear here. A manager holding an assignment would be a
 * fact about a role that does not take one, and `check-assignment-reach.mjs`
 * holds that as well as holding who may read it.
 */
const ASSIGNMENTS: Partial<Record<StaffId, ResidentAssignment>> = {
  [staffPatel.id]: {
    kind: 'all_residents_at_site',
    decidedBy: staffClarke,
    on: toIsoDate(daysAgo(212)),
  },
  [staffEze.id]: {
    kind: 'assigned',
    residents: [
      'res-okafor' as ResidentId,
      'res-adeyemi' as ResidentId,
      'res-hutchinson' as ResidentId,
      'res-pemberton' as ResidentId,
    ],
    decidedBy: staffOkonkwo,
    on: toIsoDate(daysAgo(64)),
  },
}

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
    siteIds: SITES[ref.id] ?? ['site-rosewood-court'],
    residentAssignment: ASSIGNMENTS[ref.id] ?? { kind: 'never_set' },
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
/**
 * Give somebody residents, or record that they cover the whole home.
 *
 * **The only writer, and the only reader is the staff profile.** Which
 * residents a care worker has been given decides nothing on this platform:
 * care workers do not sign in here, and the scoping it describes happens in
 * the Care Worker product. `check-assignment-reach.mjs` is what keeps it that
 * way, because a gap that acquires a name stops being a gap and becomes a
 * performance record about a person.
 *
 * Throws for a role that does not take one rather than storing it quietly. A
 * manager holding an assignment is a fact about a question nobody asked them,
 * and the guard that checks the fixtures cannot see a write made at runtime.
 */
export function setResidentAssignment(
  id: StaffId,
  assignment: ResidentAssignment,
): StaffMember {
  const member = members.find((entry) => entry.id === id)
  if (member === undefined) throw new Error(`No member of staff with id ${id}`)
  if (member.role !== 'care_worker')
    throw new Error(
      `${member.ref.fullName} is a ${member.role}, and resident assignment is a care worker's. Storing one here would answer a question nobody asked them.`,
    )
  if (assignment.kind === 'assigned' && assignment.residents.length === 0)
    throw new Error(
      'An assignment with no residents in it is `never_set` wearing a decision. Record the decision nobody took as nobody having taken it.',
    )
  member.residentAssignment = assignment
  assignmentChanges += 1
  return member
}

let assignmentChanges = 0

/**
 * Which homes somebody works at. AM v2.0 TM-04, Phase 18.
 *
 * **Never empty.** Somebody on the team record works somewhere, and an empty
 * list would be a third meaning for a field whose job is to say which homes
 * rather than whether any. Removing the last one is refused rather than
 * allowed and rendered as a gap, because it is not a gap: it is a state
 * nothing in the product knows how to read.
 */
export function setSites(id: StaffId, siteIds: SiteId[]): StaffMember {
  const member = members.find((entry) => entry.id === id)
  if (member === undefined) throw new Error(`No member of staff with id ${id}`)
  if (siteIds.length === 0)
    throw new Error(
      `${member.ref.fullName} has to work somewhere. Removing their last home would leave a record nothing on any screen knows how to read; remove their access instead, which is a decision with a name on it.`,
    )
  member.siteIds = [...siteIds]
  siteChanges += 1
  return member
}

let siteChanges = 0

export function teamHoldings(): SessionHolding[] {
  return [
    ...held('people you put on the team', added),
    ...held('access decisions you made', standingChanges),
    /*
     * **On the list because signing out destroys it.** A confirmation that
     * names four kinds of record is read as naming all of them, and the
     * session-losses entry in §8 is about a list built from a source that
     * could not carry the weight. Assignment is a session write like any
     * other; leaving it off would destroy it under a list that never
     * mentioned it.
     */
    ...held('resident assignments you set', assignmentChanges),
    ...held('home assignments you changed', siteChanges),
    ...held('signing codes chosen at setup', codesChosen),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionTeam(): void {
  members = fromFixtures()
  added = 0
  standingChanges = 0
  assignmentChanges = 0
  siteChanges = 0
  codesChosen = 0
  chosenCodes.clear()
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
  /** Every home they are being given, never one. Phase 18. */
  siteIds: SiteId[]
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
    siteIds: input.siteIds,
    /*
     * Never set by adding somebody. Assigning residents is a second act by a
     * named person, the way granting access is: a default here would put a
     * decision nobody took onto a new care worker's record.
     */
    residentAssignment: { kind: 'never_set' },
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
 * which proves a person was standing there and nothing about which person.
 *
 * The argument was written about a shared medication trolley, which is a care
 * worker at the point of administration and belongs to the Care Worker
 * product. It holds here for a different reason and the reason is worth
 * stating rather than inheriting: on this platform the four digits sit in
 * front of a manager countersigning somebody else's round, finalising a care
 * plan domain, and signing a handover. A countersignature that establishes
 * only that somebody was at the keyboard is the thing a countersignature
 * exists to prevent.
 *
 * Derived from the staff id rather than stored, because this build has no
 * accounts and no secrets to keep. It is deliberately *not* a security
 * mechanism and the screen says so: what it buys is that a signature carries
 * an identifier that belongs to one person and can be checked against them,
 * which is what an audit trail needs.
 */
export function signingCodeFor(id: StaffId): string {
  const chosen = chosenCodes.get(id)
  if (chosen !== undefined) return chosen

  let hash = 0
  for (const character of String(id)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return String(hash % 10_000).padStart(4, '0')
}

/**
 * Codes chosen at account setup, for this session only. Phase 19.
 *
 * **This is where the guarantee changes kind, and it is worth naming.** The
 * derived code above is a pure function of the staff id, so no two people can
 * have the same one: "a signature identifies one person" was held by
 * construction. A code somebody chooses can collide with somebody else's, and
 * nothing here prevents it — with one signed-in user that costs nothing, and
 * what has actually changed is that the property stopped being the compiler's
 * and became the deployment's.
 *
 * It is recorded in the handover rather than only here, because a comment is
 * read by somebody already in this file and the person who needs this is
 * whoever picks the build up.
 *
 * The alternative was worse. A PIN chosen at setup and then ignored is a dead
 * control in front of a clinical signature, on the screen where somebody is
 * most entitled to believe the thing they typed matters.
 */
const chosenCodes = new Map<StaffId, string>()

export function setSigningCode(id: StaffId, code: string): void {
  if (!/^\d{4}$/.test(code))
    throw new Error('A signing code is four digits. Anything else is not one.')
  chosenCodes.set(id, code)
  codesChosen += 1
}

/** Whether this person chose their code this session, for a screen that says so. */
export const codeWasChosen = (id: StaffId): boolean => chosenCodes.has(id)

let codesChosen = 0

/** Whether this code belongs to this person. */
export const signingCodeMatches = (id: StaffId, code: string): boolean =>
  code.trim() === signingCodeFor(id)
