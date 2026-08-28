import type { DocumentCategoryId } from '@/data/types'

/**
 * The seven categories, and the order they render in — always.
 *
 * **The screen iterates this constant, never the data.** A category with
 * nothing in it is listed with what it holds, because absence from a list is
 * the same bug as a blank cell: a library showing four headings tells a reader
 * there are four kinds of document, and it is the three missing headings that
 * carry the finding.
 *
 * **The order is the finding too.** Legal and authority is first because a
 * DNAR nobody can produce in ninety seconds is a DNAR that gets overridden.
 * Photographs are last because nothing turns on producing one quickly.
 * Alphabetical would put Assessments first and Photographs fifth — a filing
 * clerk's order, on a screen a nurse reads under pressure.
 */
export const DOCUMENT_CATEGORIES: {
  id: DocumentCategoryId
  label: string
  /**
   * What belongs here, so an empty section still says what is missing.
   *
   * Written to read mid-sentence — "It holds photographs, video and audio" —
   * rather than capitalised and lowercased at the call site. A `.toLowerCase()`
   * here would turn "DNAR" into "dnar".
   */
  holds: string
}[] = [
  {
    id: 'legal_authority',
    label: 'Legal and authority',
    holds: 'DNAR, ADRT, Lasting Power of Attorney, court orders and deputyship',
  },
  {
    id: 'identity_admission',
    label: 'Identity and admission',
    holds: 'ID, the admission agreement and funding authority',
  },
  {
    id: 'health_clinical',
    label: 'Health and clinical',
    holds: 'GP and hospital letters, discharge summaries and prescriptions',
  },
  {
    id: 'assessments_care_planning',
    label: 'Assessments and care planning',
    holds: 'risk assessments, care plans and reviews',
  },
  {
    id: 'consent_records',
    label: 'Consent records',
    holds: 'signed consent forms and capacity assessments',
  },
  {
    id: 'correspondence',
    label: 'Correspondence',
    holds: 'letters and emails with family and professionals',
  },
  {
    id: 'photographs_media',
    label: 'Photographs and media',
    holds: 'photographs, video and audio of the resident',
  },
]

const BY_ID = new Map(DOCUMENT_CATEGORIES.map((category) => [category.id, category]))

export function categoryLabel(id: DocumentCategoryId): string {
  const category = BY_ID.get(id)
  if (category === undefined) throw new Error(`Unknown document category: ${id}`)
  return category.label
}
