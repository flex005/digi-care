import type { DocumentId, Resident } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'

/**
 * What points at a document. PRD §6.6f.
 *
 * **The broken-reference relationship, seen from the other end.** The library
 * already answers "this module says a document exists and it does not"; this
 * answers "if this document went, what would break". They are one relationship
 * read in two directions, and the second is what makes a viewer worth opening
 * rather than a picture of a page.
 *
 * Derived from the records themselves rather than stored on the document. A
 * list kept on the document would be a second copy of the same fact, and the
 * two would disagree the first time a resuscitation decision changed.
 */
export interface DocumentReferrer {
  /** What holds it, in words a reader recognises on a screen. */
  label: string
  /** Where the record lives, so the rail links rather than names. */
  to: string
}

export function documentReferrers(
  id: DocumentId,
  residents: Resident[],
): DocumentReferrer[] {
  const found: DocumentReferrer[] = []

  for (const resident of residents) {
    const who = resident.preferredName

    const dnar = resident.resuscitation
    if (dnar.kind === 'dnar_in_place' && dnar.documentId === id) {
      found.push({
        label: `Future plans, ${who}'s resuscitation decision`,
        to: `/residents/${resident.id}/future-plans`,
      })
      // The badge on the profile header reads the same decision, so removing
      // the document breaks two things a reader meets in different places.
      found.push({
        label: `Profile header, ${who}'s DNAR badge`,
        to: `/residents/${resident.id}`,
      })
    }

    /*
     * `futurePlans.resuscitation` is not asked here. It is the same decision as
     * `resident.resuscitation` — the fixture builds the one from the other —
     * and counting it again would have made one record read as two things
     * relying on the document. The rail's claim is about what would break if
     * the document went, and two readings of one field break together.
     */

    const lpa = resident.importantPeople.lpaHolder
    if (lpa.kind === 'recorded' && lpa.value.documentId === id) {
      found.push({
        label: `Important people, ${who}'s lasting power of attorney`,
        to: `/residents/${resident.id}/important-people`,
      })
    }

    for (const type of CONSENT_TYPES) {
      const consent = resident.consents[type.id]
      // Only a decision carries an authority: `not_sought` and `pending` have
      // nobody to name, and that is the type saying so rather than an omission.
      if (consent.kind !== 'given' && consent.kind !== 'refused') continue
      const authority = consent.by
      if (authority.kind === 'lpa_holder' && authority.documentId === id) {
        found.push({
          label: `Consent, ${type.name} for ${who}`,
          to: `/residents/${resident.id}/consent`,
        })
      }
    }
  }

  return found
}
