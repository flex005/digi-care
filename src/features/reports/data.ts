import type {
  Activity,
  CareNote,
  DocumentRecord,
  Incident,
  IsoDateTime,
  Resident,
  Site,
  StaffRef,
  StockCount,
} from '@/data/types'
import {
  getActivities,
  getCareNotesForSite,
  getIncidents,
  getRegister,
  getSiteDocuments,
  getStaff,
} from '@/data/access/client'
import {
  fellDueAt,
  marRecordsAll,
  medicationsFor,
  type MarRecord,
} from '@/data/fixtures/medications'
import type { Medication } from '@/data/types'
import { projectReviews, type Projection } from '@/features/reviews/projection'

/**
 * Everything the eight reports read, gathered once. Phase 13.
 *
 * **One read, one instant**, for the reason the compliance bundle gives: a
 * report comparing two periods must take both from the same read, or the
 * comparison is between two moments as well as two periods.
 */
export interface ReportData {
  site: Site
  now: IsoDateTime
  residents: Resident[]
  staff: StaffRef[]
  /** Every MAR cell at this site, whatever state it is in. */
  marRecords: MarRecord[]
  medications: Medication[]
  incidents: Incident[]
  stockCounts: StockCount[]
  notes: CareNote[]
  activities: Activity[]
  documents: DocumentRecord[]
  reviews: Projection
}

export async function loadReportData(
  site: Site,
  now: IsoDateTime,
): Promise<ReportData> {
  const [incidents, register, documents, activities, notes, staff] = await Promise.all([
    getIncidents(site.id),
    getRegister(site.id),
    getSiteDocuments(site.id),
    getActivities(site.id),
    getCareNotesForSite(site.id),
    getStaff(),
  ])

  const residents = incidents.residents
  const here = new Set(residents.map((resident) => resident.id))

  return {
    site,
    now,
    residents,
    staff,
    marRecords: marRecordsAll.filter((record) => here.has(record.residentId)),
    medications: residents.flatMap((resident) => medicationsFor(resident.id)),
    incidents: incidents.incidents,
    stockCounts: register.counts,
    notes,
    activities: activities.activities,
    documents: documents.documents,
    reviews: projectReviews(residents, now),
  }
}

export { fellDueAt }
