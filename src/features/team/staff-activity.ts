import type { IsoDateTime, Resident, StaffId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { careNotes } from '@/data/fixtures/care-notes'
import { fellDueAt, marRecordsAll } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { documents } from '@/data/fixtures/documents'

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
  /** The module, in the sidebar's words. */
  module: string
  /** What they did, naming the subject. */
  what: string
  to: string
}

const nameOf = (residentId: string) =>
  residents.find((resident) => resident.id === residentId)?.fullLegalName ??
  'a resident not on file'

/** How many entries a detail screen shows. A list, not an archive. */
export const RECENT_ACTS = 12

export function staffActivity(staffId: StaffId): StaffAct[] {
  const acts: StaffAct[] = []

  for (const note of careNotes) {
    if (note.recordedBy.id !== staffId) continue
    acts.push({
      id: `note-${note.id}`,
      at: note.recordedAt,
      module: 'Care Notes',
      what: `Wrote a care note about ${nameOf(note.residentId)}`,
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
      module: 'Medications',
      what: `Gave the ${record.roundTime} round for ${nameOf(record.residentId)}`,
      to: `/residents/${record.residentId}/medications`,
    })
  }

  for (const resident of residents) {
    acts.push(...assessmentActs(resident, staffId))
    acts.push(...carePlanActs(resident, staffId))
  }

  for (const document of documents) {
    if (document.filedBy.id !== staffId) continue
    if (document.owner.kind !== 'resident') continue
    acts.push({
      id: `document-${document.id}`,
      // instant-ok: a filing date ordered against instants, never rendered as a time
      at: `${document.filedOn}T12:00:00.000Z` as IsoDateTime,
      module: 'Documents',
      what: `Filed ${document.title} for ${nameOf(document.owner.residentId)}`,
      to: `/residents/${document.owner.residentId}/documents`,
    })
  }

  return acts.sort((a, b) => b.at.localeCompare(a.at))
}

function assessmentActs(resident: Resident, staffId: StaffId): StaffAct[] {
  const acts: StaffAct[] = []
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    const status = resident.risks[template.id]
    if (status?.kind !== 'assessed') continue
    if (status.assessedBy.id !== staffId) continue
    acts.push({
      id: `risk-${resident.id}-${template.id}`,
      at: status.assessedAt,
      module: 'Risk Assessments',
      what: `Assessed ${template.name.toLowerCase()} for ${resident.fullLegalName}: ${status.level.replace(/_/g, ' ')}`,
      to: `/residents/${resident.id}/risk-assessments`,
    })
  }
  return acts
}

function carePlanActs(resident: Resident, staffId: StaffId): StaffAct[] {
  const acts: StaffAct[] = []
  for (const domain of resident.carePlan) {
    if (domain.versions.kind !== 'finalised') continue
    for (const [index, version] of domain.versions.history.entries()) {
      if (version.finalisedBy.id !== staffId) continue
      acts.push({
        id: `plan-${resident.id}-${domain.domainId}-${index}`,
        // instant-ok: a finalisation date ordered against instants, never rendered as a time
        at: `${version.finalisedOn}T12:00:00.000Z` as IsoDateTime,
        module: 'Care Plans',
        what: `Finalised version ${index + 1} of a care plan domain for ${resident.fullLegalName}`,
        to: `/residents/${resident.id}/care-plan/${domain.domainId}`,
      })
    }
  }
  return acts
}
