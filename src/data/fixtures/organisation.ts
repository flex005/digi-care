/**
 * Phase 0 fixtures — only what the app shell needs to render honestly.
 *
 * The 32 residents, 14 staff and 90 days of history described in PRD §5.2
 * land with Phase 1, messy by design. Fixtures stay messy on purpose: missing
 * assessments, omissions, thin sites. The gaps are the test. CLAUDE.md §6.
 */

import type { Organisation, Site, StaffRef } from '../types'

export const organisation: Organisation = {
  id: 'org-thornfield',
  name: 'Thornfield Care Group',
}

/**
 * Two sites. Ashgrove is deliberately small so every dashboard and report is
 * exercised against a thin dataset — it is where Key Questions will render
 * Insufficient Evidence. PRD §5.2, §5.3.
 */
export const sites: Site[] = [
  {
    id: 'site-rosewood-court',
    organisationId: 'org-thornfield',
    name: 'Rosewood Court',
  },
  {
    id: 'site-ashgrove-lodge',
    organisationId: 'org-thornfield',
    name: 'Ashgrove Lodge',
  },
]

/**
 * Enough staff to author the records shown on /dev/states.
 *
 * `staffDeactivated` exists from the start because records outlive access
 * (PRD §5.3): a record authored by a now-deactivated staff member must still
 * render its author.
 */
export const staffNwosu: StaffRef = {
  id: 'staff-c-nwosu',
  displayName: 'C. Nwosu',
  fullName: 'Chidinma Nwosu',
  role: 'senior_carer',
  isActive: true,
}

export const staffOkonkwo: StaffRef = {
  id: 'staff-a-okonkwo',
  displayName: 'A. Okonkwo',
  fullName: 'Adaeze Okonkwo',
  role: 'registered_manager',
  isActive: true,
}

export const staffHalloran: StaffRef = {
  id: 'staff-m-halloran',
  displayName: 'M. Halloran',
  fullName: 'Marie Halloran',
  role: 'deputy_manager',
  isActive: true,
}

/** Deactivated. Their records remain, and remain attributed. PRD §5.3. */
export const staffDeactivated: StaffRef = {
  id: 'staff-j-whitfield',
  displayName: 'J. Whitfield',
  fullName: 'Joseph Whitfield',
  role: 'care_worker',
  isActive: false,
}

export const staff: StaffRef[] = [
  staffOkonkwo,
  staffHalloran,
  staffNwosu,
  staffDeactivated,
]
