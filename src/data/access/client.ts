/**
 * The data access layer. PRD §3.1.
 *
 * Every read is promise-shaped, so the day a real API arrives these function
 * bodies change and no component does. No state management library, no
 * data-fetching library, no localStorage — in-memory only, and fixtures reset
 * on reload, which is correct and intended (PRD §3.6).
 */

import type {
  CareNote,
  Medication,
  Organisation,
  Resident,
  ResidentId,
  Site,
  SiteId,
  StaffRef,
} from '../types'
import { organisation, sites, staff } from '../fixtures/organisation'
import { residents, residentById, residentsBySite } from '../fixtures/residents'
import { careNotesFor, latestNoteFor } from '../fixtures/care-notes'
import {
  dueWithinTwoHours,
  medicationsFor,
  type MarRecord,
} from '../fixtures/medications'

/** Stand-in for network latency, so Loading is a state we actually see. */
const LATENCY_MS = 120

function resolve<T>(value: T): Promise<T> {
  return new Promise((done) => {
    setTimeout(() => done(value), LATENCY_MS)
  })
}

function reject(message: string): Promise<never> {
  return new Promise((_, fail) => {
    setTimeout(() => fail(new Error(message)), LATENCY_MS)
  })
}

export function getOrganisation(): Promise<Organisation> {
  return resolve(organisation)
}

export function getSites(): Promise<Site[]> {
  return resolve(sites)
}

export function getStaff(): Promise<StaffRef[]> {
  return resolve(staff)
}

export function getResidents(): Promise<Resident[]> {
  return resolve(residents)
}

export function getResidentsBySite(siteId: SiteId): Promise<Resident[]> {
  return resolve(residentsBySite(siteId))
}

/**
 * A resident that does not exist is an error, not an empty result. Returning
 * `undefined` would leave the caller to decide what a missing subject means,
 * and a wrong-subject screen is the second-worst failure available (§2.4).
 */
export function getResident(id: ResidentId): Promise<Resident> {
  const resident = residentById(id)
  if (!resident) return reject(`No resident with id ${id}`)
  return resolve(resident)
}

export function getCareNotes(residentId: ResidentId): Promise<CareNote[]> {
  return resolve(careNotesFor(residentId))
}

/** The most recent note, or nothing — and nothing is a real answer. */
export function getLatestCareNote(residentId: ResidentId): Promise<CareNote | 'none'> {
  return resolve(latestNoteFor(residentId) ?? 'none')
}

export function getMedications(residentId: ResidentId): Promise<Medication[]> {
  return resolve(medicationsFor(residentId))
}

export function getMedicationsDueSoon(residentId: ResidentId): Promise<MarRecord[]> {
  return resolve(dueWithinTwoHours(residentId))
}

/**
 * What the residents list needs, in one read rather than 33.
 *
 * `latestNote` is `'none'`, never `undefined` — "this resident has never been
 * written up" is a real answer and one the list exists to surface, so it
 * cannot be the same shape as "we did not fetch it".
 */
export interface ResidentSummary {
  resident: Resident
  latestNote: CareNote | 'none'
}

/**
 * Everything the profile header needs, in one read. PRD §6.2, §16.3.
 *
 * Bundled rather than fetched per-panel because the header is a single
 * subject statement: a version of it where the name has loaded but the
 * allergies have not is a header that can be misread, and §2.4 makes
 * misreading the subject the second-worst failure available.
 */
export interface DueMedication {
  medication: Medication
  record: MarRecord
}

export interface ResidentProfile {
  resident: Resident
  /** The resident's own site — whose timezone their records render in. */
  site: Site
  latestNote: CareNote | 'none'
  /** Empty is a real answer: nothing is due. The header says so in words. */
  dueSoon: DueMedication[]
}

export function getResidentProfile(id: ResidentId): Promise<ResidentProfile> {
  const resident = residentById(id)
  if (!resident) return reject(`No resident with id ${id}`)

  const site = sites.find((entry) => entry.id === resident.siteId)
  if (!site) return reject(`Resident ${id} belongs to an unknown site`)

  const byId = new Map(medicationsFor(resident.id).map((med) => [med.id, med]))
  const dueSoon = dueWithinTwoHours(resident.id).flatMap((record) => {
    const medication = byId.get(record.medicationId)
    return medication ? [{ medication, record }] : []
  })

  return resolve({
    resident,
    site,
    latestNote: latestNoteFor(resident.id) ?? 'none',
    dueSoon,
  })
}

export function getResidentSummaries(
  scope: SiteId | 'all',
): Promise<ResidentSummary[]> {
  const inScope = scope === 'all' ? residents : residentsBySite(scope)
  return resolve(
    inScope.map((resident) => ({
      resident,
      latestNote: latestNoteFor(resident.id) ?? 'none',
    })),
  )
}
