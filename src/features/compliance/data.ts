import type {
  Activity,
  CareNote,
  DocumentRecord,
  Goal,
  Incident,
  IsoDateTime,
  Resident,
  Site,
  StockCount,
} from '@/data/types'
import {
  getActivities,
  getCareNotesForSite,
  getGoalsBySite,
  getIncidents,
  getOmissions,
  getRegister,
  getSiteDocuments,
  type Omission,
} from '@/data/access/client'
import { boardFor, type HandoverBoard } from '@/data/access/handover-store'
import { projectReviews, type Projection } from '@/features/reviews/projection'

/**
 * Everything the compliance checks read, gathered once.
 *
 * **One read, joined here**, for the reason the omissions read is joined:
 * thirty checks each fetching their own slice would settle at thirty different
 * moments, and a panel whose figures were taken seconds apart is a panel whose
 * arithmetic cannot be reproduced.
 */
export interface ComplianceData {
  site: Site
  now: IsoDateTime
  residents: Resident[]
  omissions: Omission[]
  /** Doses due in the omissions window. Rule 4's denominator for that check. */
  dosesDue: number
  incidents: Incident[]
  stockCounts: StockCount[]
  documents: DocumentRecord[]
  goals: Goal[]
  activities: Activity[]
  notes: CareNote[]
  reviews: Projection
  handover: HandoverBoard | undefined
}

/** How far back the medication omission rate looks. Invented; see §9.2b. */
export const OMISSION_WINDOW_DAYS = 7

export async function loadCompliance(
  site: Site,
  now: IsoDateTime,
): Promise<ComplianceData> {
  const since = new Date(
    new Date(now).getTime() - OMISSION_WINDOW_DAYS * 86_400_000,
  ).toISOString() as IsoDateTime

  const [omissions, incidents, register, documents, goals, activities, notes] =
    await Promise.all([
      getOmissions(site.id, since),
      getIncidents(site.id),
      getRegister(site.id),
      getSiteDocuments(site.id),
      getGoalsBySite(site.id),
      getActivities(site.id),
      getCareNotesForSite(site.id),
    ])

  return {
    site,
    now,
    residents: incidents.residents,
    omissions: omissions.omissions,
    dosesDue: omissions.dueInRange,
    incidents: incidents.incidents,
    stockCounts: register.counts,
    documents: documents.documents,
    goals: goals.goals,
    activities: activities.activities,
    notes,
    reviews: projectReviews(incidents.residents, now),
    handover: boardFor(site.id),
  }
}
