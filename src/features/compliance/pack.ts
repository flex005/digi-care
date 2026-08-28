import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'
import { brokenReferences } from '@/features/documents/library'
import { formatCount } from '@/lib/format'
import type { ComplianceData } from './data'
import { KEY_QUESTIONS } from './key-questions'

/**
 * The inspection pack's manifest, derived rather than written.
 *
 * **Three lists, and the second and third are different kinds of absence.** A
 * gap the home can close names the screen that closes it; a thing this product
 * does not hold names the Key Question it belongs to and nothing else, because
 * there is nowhere in here to send anybody.
 */
export interface PackEntry {
  id: string
  what: string
  count: string
}

export interface PackGap extends PackEntry {
  /** Where the gap is closed. Every one of these is a real route. */
  to: string
  where: string
}

export interface PackAbsence {
  id: string
  statement: string
  /** Which Key Question would have rested on it. */
  where: string
}

export interface PackContents {
  holds: PackEntry[]
  gaps: PackGap[]
  notHeld: PackAbsence[]
}

export function packContents(data: ComplianceData): PackContents {
  const residents = data.residents.length

  let assessed = 0
  let finalised = 0
  let sought = 0
  for (const resident of data.residents) {
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      if (resident.risks[template.id]?.kind === 'assessed') assessed += 1
    }
    for (const domain of resident.carePlan) {
      if (domain.versions.kind === 'finalised') finalised += 1
    }
    for (const type of CONSENT_TYPES) {
      if (resident.consents[type.id].kind !== 'not_sought') sought += 1
    }
  }

  const templates = residents * RISK_ASSESSMENT_TEMPLATES.length
  const domains = residents * CARE_PLAN_DOMAINS.length
  const consents = residents * CONSENT_TYPES.length

  const undecided = data.incidents.filter(
    (incident) => incident.notification.kind === 'not_yet_decided',
  ).length

  const broken = data.residents.reduce((running, resident) => {
    const mine = data.documents.filter(
      (record) =>
        record.owner.kind === 'resident' && record.owner.residentId === resident.id,
    )
    return running + brokenReferences(resident, mine).length
  }, 0)

  const noExpiry = data.documents.filter(
    (record) => record.expiry.kind === 'not_recorded',
  ).length

  const holds: PackEntry[] = [
    {
      id: 'mar',
      what: 'Medication administration records with every signature',
      count: `${formatCount(data.dosesDue)} doses in the window`,
    },
    {
      id: 'cd-register',
      what: 'Controlled drug register with every count and both signatures',
      count: `${formatCount(data.stockCounts.length)} counts`,
    },
    {
      id: 'incidents',
      what: 'Incident reports with manager review and notification decisions',
      count: formatCount(data.incidents.length),
    },
    {
      id: 'risk-assessments',
      what: 'Risk assessments with scores, bands and interventions',
      count: `${formatCount(assessed)} of ${formatCount(templates)}`,
    },
    {
      id: 'care-plans',
      what: 'Care plans with version history and signatures',
      count: `${formatCount(finalised)} of ${formatCount(domains)} domains`,
    },
    {
      id: 'consents',
      what: 'Consent records with the capacity assessment behind each one',
      count: `${formatCount(sought)} of ${formatCount(consents)}`,
    },
    {
      id: 'care-notes',
      what: 'Care notes with authorship and the flag-then-review trail',
      count: formatCount(data.notes.length),
    },
    {
      id: 'documents',
      what: 'The document library with expiry decisions',
      count: `${formatCount(data.documents.length)} on file`,
    },
  ]

  const gaps: PackGap[] = [
    {
      id: 'risks-never-assessed',
      what: 'Risk assessments never completed',
      count: `${formatCount(templates - assessed)} of ${formatCount(templates)}`,
      to: '/risk-assessments',
      where: 'Risk Assessments',
    },
    {
      id: 'plans-never-written',
      what: 'Care plan domains never written',
      count: `${formatCount(domains - finalised)} of ${formatCount(domains)}`,
      to: '/care-plans',
      where: 'Care Plans',
    },
    {
      id: 'consents-never-sought',
      what: 'Consents never sought',
      count: `${formatCount(consents - sought)} of ${formatCount(consents)}`,
      to: '/consent',
      where: 'Consent',
    },
    {
      id: 'notifications-undecided',
      what: 'Incidents with no notification decision',
      count: `${formatCount(undecided)} of ${formatCount(data.incidents.length)}`,
      to: '/compliance/notifications',
      where: 'Statutory notifications',
    },
    {
      id: 'documents-referenced',
      what: 'Documents a record references and nobody uploaded',
      count: formatCount(broken),
      to: '/documents',
      where: 'Documents',
    },
    {
      id: 'documents-no-expiry',
      what: 'Documents with no expiry decision',
      count: `${formatCount(noExpiry)} of ${formatCount(data.documents.length)}`,
      to: '/documents/expiry',
      where: 'Expiry tracking',
    },
  ]

  /*
   * Read from the same declaration the panels use, never a second list. Two
   * lists of what this product does not hold would drift, and the one on this
   * screen would be the one nobody noticed had gone stale.
   */
  const notHeld: PackAbsence[] = KEY_QUESTIONS.flatMap((question) =>
    question.checks
      .filter((check) => check.kind === 'not_held')
      .map((check) => ({
        id: check.id,
        statement: check.kind === 'not_held' ? check.statement : '',
        where: question.name,
      })),
  )

  return { holds, gaps, notHeld }
}
