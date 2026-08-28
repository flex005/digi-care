import type { DocumentId, IsoDate, ResidentId, SiteId, StaffRef } from './primitives'

/**
 * Documents — PRD §6.7.
 *
 * The library is one thing with seven sections, not seven folders. Nothing in
 * this module models a folder, a path or a tree, because a document does not
 * sit anywhere: it belongs to a resident or to the home, and it is *about*
 * one of seven things.
 */

/**
 * The seven categories, in the order an emergency needs them.
 *
 * **Order is the finding.** Legal and authority is first because a DNAR
 * nobody can produce in ninety seconds is a DNAR that gets overridden;
 * photographs are last because nothing turns on producing one quickly.
 * Alphabetical would put Assessments first and Photographs fifth, which is a
 * filing clerk's order rather than a nurse's.
 */
export type DocumentCategoryId =
  | 'legal_authority'
  | 'identity_admission'
  | 'health_clinical'
  | 'assessments_care_planning'
  | 'consent_records'
  | 'correspondence'
  | 'photographs_media'

/**
 * Whether the document stops being valid, and when.
 *
 * **`does_not_expire` is a recorded decision, not a missing date.** Somebody
 * has to have said a document is permanent, and an empty date field cannot
 * say it — which is the whole reason this is a union rather than
 * `expiresOn?: IsoDate`. The two would be indistinguishable in storage and
 * opposite in meaning: one is a considered judgement with a name against it,
 * the other is a document nobody has looked at.
 *
 * `not_recorded` takes the hatch. It is not a milder version of an expiry
 * date — it is the absence of the fact an expiry date is made of.
 */
export type ExpiryDecision =
  | { kind: 'expires'; on: IsoDate }
  | { kind: 'does_not_expire'; decidedBy: StaffRef; on: IsoDate }
  | { kind: 'not_recorded' }

/**
 * What is known about the file itself.
 *
 * **There is no file in this build**, and the type says so rather than
 * inventing a URL that 404s. `described` is a fixture document whose format
 * and size are known; `not_retrievable` is one added this session, whose
 * details are in memory and whose bytes were never anywhere.
 *
 * Format is text on the screen — "PDF · 1.2 MB" — never a format glyph. A
 * glyph tells a reader nothing about whether the thing opens.
 */
export type FileFacts =
  | { kind: 'described'; format: string; bytes: number }
  | { kind: 'not_retrievable'; format: string }

/** Who a document belongs to. Never inferred — the subject is asked first. */
export type DocumentOwner =
  { kind: 'resident'; residentId: ResidentId } | { kind: 'site'; siteId: SiteId }

export interface DocumentRecord {
  id: DocumentId
  owner: DocumentOwner
  category: DocumentCategoryId
  /** What the document is, in words a reader recognises on a list. */
  title: string
  file: FileFacts
  expiry: ExpiryDecision
  filedBy: StaffRef
  filedOn: IsoDate
}

/**
 * Where a document id came from when the document is not on file.
 *
 * A reference that resolves to nothing is a finding, so it carries enough to
 * act on: which module holds the id, and what that module says about the
 * decision the missing document records.
 */
export interface DocumentReference {
  id: DocumentId
  category: DocumentCategoryId
  /** What the missing document is: "DNAR form". */
  title: string
  /** Where the id is held: "Future Plans". */
  origin: string
  /** What the referring record says: "signed 17/05/2025 by Dr O. Balogun". */
  detail: string
}

/**
 * One line of a category.
 *
 * A broken reference is a row rather than a footnote, because it is a document
 * the record says exists. It renders hatched and unlinked — never a link that
 * fails on click, and never silence.
 */
export type LibraryRow =
  | { kind: 'document'; document: DocumentRecord }
  | { kind: 'referenced_not_on_file'; reference: DocumentReference }

/**
 * What a category with nothing in it means.
 *
 * **Empty is not always emptiness.** A category nothing implies anything about
 * is quietly empty. A category another module's record says should hold
 * something is a gap: the care record asserts the document exists, and the
 * library cannot produce it. Those are opposite states and the same blank
 * space, which is the invariant applied one level up from a field.
 */
export type CategoryState =
  | { kind: 'filled'; rows: [LibraryRow, ...LibraryRow[]] }
  | { kind: 'empty' }
  | {
      kind: 'expected_but_empty'
      /** What the other module says exists: "A DNAR has been in place since 17/05/2025". */
      missing: string
      /** Why that matters here, in the reader's terms. */
      because: string
    }
