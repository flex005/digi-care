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

/** The seven roles in the model. PRD §1. */
export type StaffRole =
  | 'organisation_admin'
  | 'registered_manager'
  | 'deputy_manager'
  | 'senior_carer'
  | 'care_worker'
  | 'activities_coordinator'
  | 'auditor'

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
