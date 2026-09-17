/**
 * Organisation, sites and staff. PRD §5.2.
 *
 * Every role in the model is held by at least one of them, including one
 * deactivated — records outlive access (PRD §5.3), and a care note authored by
 * somebody who has since left must still render its author.
 *
 * **The count is not written here, and that is the point.** It said "14 across
 * the seven roles", then 15, and was wrong both times: a docblock cannot
 * derive a number and nothing makes it fall when the list grows. It went stale
 * again in Phase 29 when a second deputy manager landed. The property worth
 * stating is the one a guard can hold, and two do: `fixtures.test.ts` counts
 * the list itself, and `authority.test.tsx` holds that no role is left without
 * somebody.
 */

import type { Organisation, Site, StaffRef } from '../types'

export const organisation: Organisation = {
  id: 'org-thornfield',
  name: 'Thornfield Care Group',
}

/**
 * Two sites. Ashgrove is deliberately small so every dashboard and report is
 * exercised against a thin dataset — it is where Key Questions render
 * Insufficient Evidence. PRD §5.2, §5.3.
 *
 * Both carry an IANA timezone. Clinical timestamps for a site's residents
 * render in THAT zone, never the viewer's. PRD §3.6.
 */
export const sites: Site[] = [
  {
    id: 'site-rosewood-court',
    organisationId: 'org-thornfield',
    name: 'Rosewood Court',
    timeZone: 'Europe/London',
  },
  {
    id: 'site-ashgrove-lodge',
    organisationId: 'org-thornfield',
    name: 'Ashgrove Lodge',
    timeZone: 'Europe/London',
  },
]

const makeStaff = (
  id: string,
  displayName: string,
  fullName: string,
  role: StaffRef['role'],
  isActive = true,
): StaffRef => ({
  id: `staff-${id}`,
  displayName,
  fullName,
  role,
  isActive,
})

export const staffOkonkwo = makeStaff(
  'a-okonkwo',
  'A. Okonkwo',
  'Adaeze Okonkwo',
  'registered_manager',
)
export const staffHalloran = makeStaff(
  'm-halloran',
  'M. Halloran',
  'Marie Halloran',
  'deputy_manager',
)
/*
 * **The second manager, and the commoner case.** Marie Halloran covers both
 * homes, which is real and is what AM v2.0's TM-04 exists for. A deputy
 * appointed to one home is the ordinary arrangement, and until Phase 29 the
 * fixtures had nobody in it — so the state where a manager has one home and no
 * site switcher could not be reached, reviewed or gated. A branch no fixture
 * reaches is a branch nobody has seen.
 *
 * **Deliberately not in `managers` below.** That list is the pool fixture
 * generation draws record authors from, so adding her would rewrite who
 * recorded every consent, document, goal and review in the build, without a
 * single record having changed. She is a member of the team, not a name the
 * generator reaches for.
 */
export const staffAluko = makeStaff(
  'd-aluko',
  'D. Aluko',
  'Deborah Aluko',
  'deputy_manager',
)
export const staffNwosu = makeStaff(
  'c-nwosu',
  'C. Nwosu',
  'Chidinma Nwosu',
  'senior_carer',
)

/** Deactivated. Their records remain, and remain attributed. PRD §5.3. */
export const staffDeactivated = makeStaff(
  'j-whitfield',
  'J. Whitfield',
  'Joseph Whitfield',
  'care_worker',
  false,
)

export const staffAdebayo = makeStaff(
  'f-adebayo',
  'F. Adebayo',
  'Folake Adebayo',
  'senior_carer',
)
/**
 * The registered manager at Ashgrove Lodge.
 *
 * **She was the only `organisation_admin`, and that role turned out to be an
 * undocumented split of this one.** Collapsing it left her needing a role, and
 * a second registered manager at Rosewood would be wrong on the facts: a
 * service is registered to one. Ashgrove had no manager at all and one care
 * worker, which was a fixture wrong on the facts in the other direction, so
 * she is Ashgrove's. It also gives Phase 18 a second governance user to assign
 * sites to, which is the work that needs one.
 */
export const staffClarke = makeStaff(
  'r-clarke',
  'R. Clarke',
  'Ruth Clarke',
  'registered_manager',
)
export const staffEze = makeStaff('n-eze', 'N. Eze', 'Ngozi Eze', 'care_worker')
export const staffPatel = makeStaff(
  's-patel',
  'S. Patel',
  'Sunita Patel',
  'care_worker',
)
export const staffMorrison = makeStaff(
  'd-morrison',
  'D. Morrison',
  'Douglas Morrison',
  'care_worker',
)
export const staffIbrahim = makeStaff(
  'y-ibrahim',
  'Y. Ibrahim',
  'Yusuf Ibrahim',
  'care_worker',
)
export const staffOsei = makeStaff('k-osei', 'K. Osei', 'Kwame Osei', 'care_worker')
export const staffBennett = makeStaff(
  'l-bennett',
  'L. Bennett',
  'Laura Bennett',
  'activities_coordinator',
)
export const staffFitzgerald = makeStaff(
  'p-fitzgerald',
  'P. Fitzgerald',
  'Peter Fitzgerald',
  'auditor',
)
export const staffAkinyemi = makeStaff(
  't-akinyemi',
  'T. Akinyemi',
  'Tolu Akinyemi',
  'senior_carer',
)
/**
 * Invited this week, and has not accepted yet.
 *
 * **Here because a state nobody can reach on a fresh load is not built.**
 * Laura Bennett has the same standing and was added over a month ago, so her
 * invitation has lapsed — and with only her in the fixtures the live
 * invitation existed solely for somebody who first went to Team and added a
 * person. Two people with the same standing and opposite invitations put both
 * states one URL away; one person could only ever show whichever the fixture
 * instant happened to make true.
 */
/**
 * Ashgrove's deputy manager, invited five weeks ago and never accepted.
 *
 * **A governance account left open, which is the finding a real home has.**
 * The lapsed invitation was Laura Bennett's, an activities coordinator, and
 * she is a user of the Care Worker product: every screen in Team Management is
 * about people who sign in here, so demonstrating the lapsed state with
 * somebody who never would was the branch-with-no-fixture problem one level
 * up. An unaccepted invitation to a deputy manager is a home running a second
 * site with nobody in the deputy's account for over a month.
 */
export const staffOgundipe = makeStaff(
  'b-ogundipe',
  'B. Ogundipe',
  'Bisi Ogundipe',
  'deputy_manager',
)

/**
 * An auditor invited two days ago, ahead of an inspection. The live state.
 *
 * Peter Fitzgerald is the auditor who already has access; this is the second,
 * and the reason there are two is the same reason there were two care workers
 * before: one person can only ever show whichever state the fixture instant
 * happens to make true.
 */
export const staffMarsden = makeStaff(
  'e-marsden',
  'E. Marsden',
  'Eleanor Marsden',
  'auditor',
)

export const staffAdeyinka = makeStaff(
  'f-adeyinka',
  'F. Adeyinka',
  'Funke Adeyinka',
  'care_worker',
)

/**
 * **A senior carer whose invitation ran out.** Added for the Care Worker
 * product: an expired invitation for somebody who would accept it there, so
 * that screen's expired state is reachable. Invited nine days ago, against
 * invitations good for three. Never given access, so never an author on any
 * record, and deliberately not in `carersAndSeniors`.
 */
export const staffPrice = makeStaff(
  'h-price',
  'H. Price',
  'Hannah Price',
  'senior_carer',
)

export const staff: StaffRef[] = [
  staffAluko,
  staffAdeyinka,
  staffOgundipe,
  staffMarsden,
  staffClarke,
  staffOkonkwo,
  staffHalloran,
  staffNwosu,
  staffAdebayo,
  staffAkinyemi,
  staffEze,
  staffPatel,
  staffMorrison,
  staffIbrahim,
  staffOsei,
  staffBennett,
  staffFitzgerald,
  staffDeactivated,
  staffPrice,
]

/** Staff who write care notes and administer medication. */
export const carersAndSeniors: StaffRef[] = [
  staffNwosu,
  staffAdebayo,
  staffAkinyemi,
  staffEze,
  staffPatel,
  staffMorrison,
  staffIbrahim,
  staffOsei,
]

/** Staff who sign off assessments, care plans and reviews. */
export const managers: StaffRef[] = [staffOkonkwo, staffHalloran]
