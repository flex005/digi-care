import type { IsoDateTime, Resident, StaffId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { careNotes } from '@/data/fixtures/care-notes'
import { fellDueAt, marRecordsAll } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { documents } from '@/data/fixtures/documents'
import type { Term, Vocabulary } from '@/lib/vocabulary'
import { moduleName } from '@/app/nav-items.icons'

/**
 * What one person has recorded, most recent first. PRD §6.7, Phase 14.
 *
 * **A list, and deliberately not a count.** There is no rota and no shift
 * record in this build, so a count of what somebody recorded has no honest
 * denominator — and a bare count beside another person's bare count is a
 * ranking whether or not anybody sorted it. Not ordering the list does not
 * prevent that; it only stops us doing it for them.
 *
 * Every entry links to the record itself, so this is a way into the record
 * rather than a receipt for having worked.
 */
export interface StaffAct {
  id: string
  at: IsoDateTime
  /**
   * The module, in the sidebar's words.
   *
   * **Read from `nav-items.icons.ts` through `moduleName`, not restated.**
   * This field held its own copies of the five names, with a comment saying
   * the nav declaration owned them — which was true while every label was
   * fixed. Two of the five now take a configured term, so a copy here would
   * have gone on saying "Care Plans" beside a sidebar reading "Care & Support
   * Plans", and nothing would have failed.
   */
  module: string
  /** What they did, naming the subject. */
  what: string
  to: string
}

const nameOf = (residentId: string, term: Term) =>
  residents.find((resident) => resident.id === residentId)?.fullLegalName ??
  `a ${term.one} not on file`

/** How many entries a detail screen shows. A list, not an archive. */
export const RECENT_ACTS = 12

export function staffActivity(staffId: StaffId, terms: Vocabulary): StaffAct[] {
  const acts: StaffAct[] = []

  for (const note of careNotes) {
    if (note.recordedBy.id !== staffId) continue
    acts.push({
      id: `note-${note.id}`,
      at: note.recordedAt,
      module: moduleName('/care-notes', terms),
      what: `Wrote a care note about ${nameOf(note.residentId, terms.subject)}`,
      to: `/residents/${note.residentId}/notes/${note.id}`,
    })
  }

  for (const record of marRecordsAll) {
    if (record.state.kind !== 'given') continue
    if (record.state.givenBy.id !== staffId) continue
    const when = fellDueAt(record)
    if (when === 'not_due') continue
    acts.push({
      id: `dose-${record.medicationId}-${record.date}-${record.roundTime}`,
      at: record.state.givenAt,
      module: moduleName('/medications', terms),
      what: `Gave the ${record.roundTime} round for ${nameOf(record.residentId, terms.subject)}`,
      to: `/residents/${record.residentId}/medications`,
    })
  }

  for (const resident of residents) {
    acts.push(...assessmentActs(resident, staffId, terms))
    acts.push(...carePlanActs(resident, staffId, terms))
  }

  for (const document of documents) {
    if (document.filedBy.id !== staffId) continue
    if (document.owner.kind !== 'resident') continue
    acts.push({
      id: `document-${document.id}`,
      // instant-ok: a filing date ordered against instants, never rendered as a time
      at: `${document.filedOn}T12:00:00.000Z` as IsoDateTime,
      module: moduleName('/documents', terms),
      what: `Filed ${document.title} for ${nameOf(document.owner.residentId, terms.subject)}`,
      to: `/residents/${document.owner.residentId}/documents`,
    })
  }

  return acts.sort((a, b) => b.at.localeCompare(a.at))
}

function assessmentActs(
  resident: Resident,
  staffId: StaffId,
  terms: Vocabulary,
): StaffAct[] {
  const acts: StaffAct[] = []
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    const status = resident.risks[template.id]
    if (status?.kind !== 'assessed') continue
    if (status.assessedBy.id !== staffId) continue
    acts.push({
      id: `risk-${resident.id}-${template.id}`,
      at: status.assessedAt,
      module: moduleName('/risk-assessments', terms),
      what: `Assessed ${template.name.toLowerCase()} for ${resident.fullLegalName}: ${status.level.replace(/_/g, ' ')}`,
      to: `/residents/${resident.id}/risk-assessments`,
    })
  }
  return acts
}

function carePlanActs(
  resident: Resident,
  staffId: StaffId,
  terms: Vocabulary,
): StaffAct[] {
  const acts: StaffAct[] = []
  for (const domain of resident.carePlan) {
    if (domain.versions.kind !== 'finalised') continue
    for (const [index, version] of domain.versions.history.entries()) {
      if (version.finalisedBy.id !== staffId) continue
      acts.push({
        id: `plan-${resident.id}-${domain.domainId}-${index}`,
        // instant-ok: a finalisation date ordered against instants, never rendered as a time
        at: `${version.finalisedOn}T12:00:00.000Z` as IsoDateTime,
        module: moduleName('/care-plans', terms),
        what: `Finalised version ${index + 1} of a ${terms.carePlan.one} domain for ${resident.fullLegalName}`,
        to: `/residents/${resident.id}/care-plan/${domain.domainId}`,
      })
    }
  }
  return acts
}
