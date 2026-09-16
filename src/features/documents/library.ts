import type {
  CategoryState,
  DocumentCategoryId,
  DocumentRecord,
  DocumentReference,
  IsoDate,
  LibraryRow,
  Resident,
} from '@/data/types'
import { medicationsFor } from '@/data/fixtures/medications'
import { referencedIds } from '@/data/fixtures/documents'
import { formatDate } from '@/lib/format'
import { DOCUMENT_CATEGORIES, categoryLabel } from './categories'
import { countExpiry, type ExpiryCounts } from './expiry'

/**
 * A resident's library: the seven categories, always all seven, in order.
 *
 * The screen renders what this returns and nothing else, so a category cannot
 * be omitted by a component that had no rows to draw.
 */
export interface ResidentLibrary {
  categories: {
    id: DocumentCategoryId
    label: string
    holds: string
    state: CategoryState
  }[]
  /** Documents actually on file, which is what the three findings count. */
  onFile: DocumentRecord[]
  counts: ExpiryCounts
}

/**
 * Ids other modules hold that resolve to nothing.
 *
 * **A reference that resolves to nothing is a finding, not a dead link.** The
 * care record asserts the document exists; the library cannot produce it. A
 * link that fails on click tells the reader the system is broken, and silence
 * tells them nothing at all — both are worse than the hatch that says which
 * document, which module claims it, and what that module says about it.
 */
export function brokenReferences(
  resident: Resident,
  onFile: DocumentRecord[],
): DocumentReference[] {
  const have = new Set(onFile.map((document) => document.id))
  const broken: DocumentReference[] = []

  for (const reference of referencedIds(resident)) {
    if (have.has(reference.id)) continue
    broken.push({
      ...reference,
      ...originOf(resident, reference.id),
    })
  }

  return broken
}

/**
 * Which module holds an id, and what it says about the decision behind it.
 *
 * The detail never repeats the title — the row already carries it, and
 * "Medications holds doc-… — Prescription — Lansoprazole, recorded as
 * scanned" printed the same six words three times in one row.
 */
function originOf(resident: Resident, id: string): { origin: string; detail: string } {
  const resuscitation = resident.futurePlans.resuscitation
  if (resuscitation.kind === 'dnar_in_place' && resuscitation.documentId === id) {
    return {
      origin: 'Future Plans',
      detail: `signed ${formatDate(resuscitation.signedOn)} by ${resuscitation.signedBy}`,
    }
  }

  const adrt = resident.futurePlans.adrt
  if (adrt.kind === 'recorded' && adrt.value.value.documentId === id) {
    return {
      origin: 'Future Plans',
      detail: `signed ${formatDate(adrt.value.signedOn)} by ${adrt.value.signedBy.displayName}`,
    }
  }

  const lpa = resident.importantPeople.lpaHolder
  if (lpa.kind === 'recorded' && lpa.value.documentId === id) {
    return { origin: 'Important People', detail: `held by ${lpa.value.name}` }
  }

  for (const medication of medicationsFor(resident.id)) {
    const scan = medication.prescriptionDocument
    if (scan.kind !== 'on_file' || scan.documentId !== id) continue
    return {
      origin: 'Medications',
      detail: `recorded as scanned by ${scan.scannedBy.displayName} on ${formatDate(scan.scannedOn)}`,
    }
  }

  return { origin: 'the care record', detail: 'nothing else is recorded about it' }
}

/**
 * Whether another module's record says this category should not be empty.
 *
 * **Empty is not always emptiness.** Every case here is derived from a record
 * somebody else made, never remembered by whoever wrote this screen: an
 * admission that happened, a consent taken in writing, a care plan somebody
 * finalised, a withdrawal that counted what it could not undo. Each of those
 * asserts a piece of paper exists. Where the library has nothing in that
 * category, the two records disagree, and the disagreement is the finding.
 */
export function expectationFor(
  resident: Resident,
  category: DocumentCategoryId,
): { missing: string; because: string } | undefined {
  if (category === 'identity_admission') {
    return {
      missing: `${resident.preferredName} was admitted on ${formatDate(resident.admittedOn)} and nothing is filed here.`,
      because: 'An admission agreement is signed on the day somebody moves in.',
    }
  }

  if (category === 'consent_records') {
    for (const consent of Object.values(resident.consents)) {
      if (consent.kind === 'given' && consent.method === 'written') {
        return {
          missing: `A consent was taken in writing on ${formatDate(consent.on)} and nothing is filed here.`,
          because:
            'The record says a consent form was signed, and it is not filed here.',
        }
      }
    }
    return undefined
  }

  if (category === 'assessments_care_planning') {
    for (const domain of resident.carePlan) {
      if (domain.versions.kind !== 'finalised') continue
      const current = domain.versions.history[domain.versions.history.length - 1]
      if (current === undefined) continue
      return {
        missing: `A care plan was finalised on ${formatDate(current.finalisedOn)} and nothing is filed here.`,
        because: 'The care record says this version exists, and it is not filed here.',
      }
    }
    return undefined
  }

  if (category === 'photographs_media') {
    const photography = resident.consents.photography
    if (photography.kind !== 'withdrawn') return undefined
    for (const effect of photography.remains) {
      if (effect.count.kind !== 'counted' || effect.count.value === 0) continue
      return {
        missing: `${effect.name}: ${effect.count.value} counted when photography consent was withdrawn, and nothing is filed here.`,
        because:
          'If the photographs cannot be found here, nobody can act on the withdrawal.',
      }
    }
    return undefined
  }

  return undefined
}

export function residentLibrary(
  resident: Resident,
  onFile: DocumentRecord[],
  today: IsoDate,
): ResidentLibrary {
  const broken = brokenReferences(resident, onFile)

  const categories = DOCUMENT_CATEGORIES.map((category) => {
    /*
     * A broken reference leads its category. It is the row that needs somebody
     * to do something, and a finding under four settled documents is a finding
     * a reader scrolls past.
     */
    const rows: LibraryRow[] = [
      ...broken
        .filter((reference) => reference.category === category.id)
        .map((reference): LibraryRow => ({
          kind: 'referenced_not_on_file',
          reference,
        })),
      ...onFile
        .filter((document) => document.category === category.id)
        .map((document): LibraryRow => ({ kind: 'document', document })),
    ]

    const [first, ...rest] = rows
    const state: CategoryState =
      first !== undefined
        ? { kind: 'filled', rows: [first, ...rest] }
        : (() => {
            const expectation = expectationFor(resident, category.id)
            return expectation === undefined
              ? { kind: 'empty' }
              : { kind: 'expected_but_empty', ...expectation }
          })()

    return { id: category.id, label: category.label, holds: category.holds, state }
  })

  return { categories, onFile, counts: countExpiry(onFile, today) }
}

/**
 * The organisation library's rows: every category, ordered by what expires
 * soonest — never alphabetically, because the order is the finding.
 *
 * Ties break on documents with no expiry decision at all, then on the label,
 * so the order is stable across runs rather than dependent on sort stability.
 */
export interface OrganisationCategoryRow {
  id: DocumentCategoryId
  label: string
  total: number
  expiring: number
  expired: number
  notRecorded: number
}

export function organisationRows(
  documents: DocumentRecord[],
  today: IsoDate,
): OrganisationCategoryRow[] {
  const rows = DOCUMENT_CATEGORIES.map((category) => {
    const mine = documents.filter((document) => document.category === category.id)
    const counts = countExpiry(mine, today)
    return {
      id: category.id,
      label: categoryLabel(category.id),
      total: counts.total,
      expiring: counts.expiring,
      expired: counts.expired,
      notRecorded: counts.notRecorded,
    }
  })

  return rows.sort((a, b) => {
    const urgency = b.expired + b.expiring - (a.expired + a.expiring)
    if (urgency !== 0) return urgency
    if (b.notRecorded !== a.notRecorded) return b.notRecorded - a.notRecorded
    return a.label.localeCompare(b.label)
  })
}
