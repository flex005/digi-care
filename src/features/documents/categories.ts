import type { Vocabulary } from '@/lib/vocabulary'
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
  /**
   * The heading, as a function of the vocabulary.
   *
   * Two of the seven name something configurable — an admission and an
   * assessment — and a module-level string is evaluated before anything can
   * ask what this service calls them.
   */
  label: (terms: Vocabulary) => string
  /**
   * What belongs here, so an empty section still says what is missing.
   *
   * Written to read mid-sentence — "It holds photographs, video and audio" —
   * rather than capitalised and lowercased at the call site. A `.toLowerCase()`
   * here would turn "DNAR" into "dnar".
   */
  holds: (terms: Vocabulary) => string
}[] = [
  {
    id: 'legal_authority',
    /* Four named instruments and two legal terms. Nothing configurable: a DNAR
       is a DNAR whatever a home calls its care plans. */
    label: () => 'Legal and authority',
    holds: () => 'DNAR, ADRT, Lasting Power of Attorney, court orders and deputyship',
  },
  {
    id: 'identity_admission',
    label: (terms) => `Identity and ${terms.admission.one}`,
    holds: (terms) => `ID, the ${terms.admission.one} agreement and funding authority`,
  },
  {
    id: 'health_clinical',
    label: () => 'Health and clinical',
    /* "discharge summaries" is the deferred Discharge term — see
       DEFERRED_TERMS in vocabulary.ts. There is no discharge feature, so a
       control renaming this would change one phrase and nothing else. */
    holds: () => 'GP and hospital letters, discharge summaries and prescriptions',
  },
  {
    id: 'assessments_care_planning',
    label: (terms) => `${terms.assessment.Many} and ${terms.carePlan.one}ning`,
    /* "risk assessments" keeps its words: no form composes behind the
       qualifier, and the module is declared in nav-items.icons.ts. */
    holds: (terms) => `risk assessments, ${terms.carePlan.many} and reviews`,
  },
  {
    id: 'consent_records',
    label: () => 'Consent records',
    /* A capacity assessment is the Mental Capacity Act two-stage
       determination, not an assessment this service names. */
    holds: () => 'signed consent forms and capacity assessments',
  },
  {
    id: 'correspondence',
    label: () => 'Correspondence',
    holds: (terms) => `letters and emails with ${terms.family.many} and professionals`,
  },
  {
    id: 'photographs_media',
    label: () => 'Photographs and media',
    holds: (terms) => `photographs, video and audio of the ${terms.subject.one}`,
  },
]

const BY_ID = new Map(DOCUMENT_CATEGORIES.map((category) => [category.id, category]))

export function categoryLabel(id: DocumentCategoryId, terms: Vocabulary): string {
  const category = BY_ID.get(id)
  if (category === undefined) throw new Error(`Unknown document category: ${id}`)
  return category.label(terms)
}
