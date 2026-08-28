/**
 * Organisation, sites and staff. PRD §5.2.
 *
 * 14 staff across the seven roles, including one deactivated — records
 * outlive access (PRD §5.3), and a care note authored by someone who has
 * since left must still render its author.
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
export const staffClarke = makeStaff(
  'r-clarke',
  'R. Clarke',
  'Ruth Clarke',
  'organisation_admin',
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
export const staffAdeyinka = makeStaff(
  'f-adeyinka',
  'F. Adeyinka',
  'Funke Adeyinka',
  'care_worker',
)

export const staff: StaffRef[] = [
  staffAdeyinka,
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
