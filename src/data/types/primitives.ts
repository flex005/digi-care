/**
 * The base types PRD §5.1 references but does not define.
 *
 * Everything here is invented to support §5.1 and is deliberately minimal.
 * Anything that turns out to need a different shape is a change to a fixture
 * type, which is a stop-and-ask. CLAUDE.md §8.
 */

/**
 * ISO-8601 date, `YYYY-MM-DD`. Storage format only.
 *
 * The template literal is doing real work: it makes `'12/03/2026'` a compile
 * error. UI copy is `DD/MM/YYYY` (PRD §3.6) and that conversion happens at the
 * render boundary, never in the data.
 */
export type IsoDate = `${number}-${number}-${number}`

/** ISO-8601 date and time, 24-hour, with offset or `Z`. */
export type IsoDateTime = `${IsoDate}T${number}:${number}:${number}${string}`

export type OrganisationId = `org-${string}`
export type SiteId = `site-${string}`
export type ResidentId = `res-${string}`
export type StaffId = `staff-${string}`
export type DocumentId = `doc-${string}`
export type IncidentId = `inc-${string}`
export type ActivityId = `act-${string}`
export type CapacityAssessmentId = `cap-${string}`
export type GoalId = `goal-${string}`
export type GoalProgressNoteId = `gpn-${string}`

/**
 * The six roles in the model. PRD §1.
 *
 * **`organisation_admin` was here and is gone, and removing it undid a split
 * rather than taking a decision.** PRD §1's first row reads "Registered
 * Manager / Organisation Admin" — one role with two names — and this union
 * split that row into two members. Nothing anywhere recorded why: no docblock,
 * no PROGRESS entry, no line in any PRD. It appeared in five places, two of
 * them cells in the permission table that gave it `read` on fifteen modules
 * and `approve` on Settings, which is a coherent idea that nobody ever wrote
 * down as one.
 *
 * The third reading, that it was the cross-site Admin, is redundant: AM v2.0's
 * Sandra Chen is an Admin *assigned to five sites*, and multi-site is an
 * assignment rather than a role — the `siteIds` change Phase 18 makes anyway.
 *
 * **Three of the six are not viewers of this platform**, and that is a
 * different fact from what they can do. See `SIGN_IN_ROLES` in
 * `features/team/permissions.ts`, which is the one place that says which.
 */
export type StaffRole =
  | 'registered_manager'
  | 'deputy_manager'
  | 'senior_carer'
  | 'care_worker'
  | 'activities_coordinator'
  | 'auditor'

/**
 * How each role reads on a screen.
 *
 * **One owner, because the first screen to render a role got it wrong.** The
 * staff report mapped five of the seven by hand and printed
 * "activities_coordinator" for another — a machine identifier in a column
 * about a person. A `Record` keyed by the union cannot miss a member: adding a
 * role without naming it is a compile error.
 */
export const STAFF_ROLE_NAMES: Record<StaffRole, string> = {
  registered_manager: 'Registered manager',
  deputy_manager: 'Deputy manager',
  senior_carer: 'Senior carer',
  care_worker: 'Care worker',
  activities_coordinator: 'Activities coordinator',
  auditor: 'Auditor',
}

/**
 * How a staff member appears on a record.
 *
 * A snapshot rather than a live lookup, because records outlive access:
 * fixtures include a record authored by a now-deactivated staff member
 * (PRD §5.3) and it must still render its author. Every clinical record
 * displays its author and timestamp, always visible, never hover-only
 * (PRD §3.6).
 */
export interface StaffRef {
  id: StaffId
  /** As it appears on records: "C. Nwosu". */
  displayName: string
  /** Full name, for headers and detail views. */
  fullName: string
  role: StaffRole
  /** False once deactivated. The record stays; the access does not. */
  isActive: boolean
}

/** How consent was captured. Referenced by ConsentStatus. */
export type ConsentMethod = 'verbal' | 'written' | 'digital_signature'

export interface Site {
  id: SiteId
  organisationId: OrganisationId
  name: string
  /**
   * IANA timezone, e.g. 'Europe/London'. Clinical timestamps for this site's
   * residents render in THIS zone, never the viewer's — a dose given at 08:04
   * here reads 08:04 to an auditor anywhere in the world. PRD §3.6.
   */
  timeZone: string
}

export interface Organisation {
  id: OrganisationId
  name: string
}
