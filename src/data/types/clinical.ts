/**
 * The Phase 1 status unions. Same discipline as `state.ts`: every one is
 * closed, every one has an explicit unrecorded member, none has an optional
 * property or a `| null`. CLAUDE.md §1.
 *
 * Each also has an entry in `src/dev/states.fixtures.ts`, so adding a member
 * to any of them breaks the build until it is rendered on `/dev/states`.
 */

import type { CarePlanDomainId } from './reference'
import type { IsoDate, IsoDateTime, StaffRef } from './primitives'

/**
 * A list that can be absent, empty by decision, or present.
 *
 * The third shape of the Evidence Invariant, after `Recorded<T>` and the
 * bespoke unions. A bare `T[]` cannot tell "nobody recorded who is involved"
 * from "somebody asked and there is nobody" — an empty array is exactly the
 * ambiguity `AllergyStatus` was split into three members to remove, and it
 * came back through the arrays after being driven out of the scalars.
 *
 * `Recorded<T[]>` does not fix it: an empty array inside a `recorded` wrapper
 * reintroduces the same ambiguity one level down. Hence three explicit
 * members, and `items` typed non-empty so `recorded` cannot be empty.
 *
 * `none_involved` carries an author because **"we asked, there is no LPA" is a
 * positive claim somebody made** — the same reason a recorded "No known
 * allergies" carries one, and the same reason it must look settled rather than
 * unfinished (Rule 3).
 */
export type RecordedList<T> =
  | { kind: 'not_recorded' }
  | { kind: 'none_involved'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'recorded'
      /** Non-empty by construction: `recorded` with nothing in it is a lie. */
      items: [T, ...T[]]
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

/**
 * Allergies. Three states, not `Recorded<Allergy[]>`.
 *
 * An empty array standing for "confirmed none known" is exactly the subtlety
 * this product exists to eliminate — it would put the most consequential
 * distinction in the product one `.length` check away from being lost. PRD
 * §6.2 wants three visibly different things, so there are three members:
 *
 *   ALLERGIES: penicillin                      critical — a finding
 *   NO KNOWN ALLERGIES — recorded 12/03/2026   positive — a recorded NEGATIVE
 *   ALLERGIES NOT RECORDED                     hatched  — nobody has asked
 */
export interface Allergy {
  substance: string
  reaction: string
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis'
}

export type AllergyStatus =
  | { kind: 'not_recorded' }
  | { kind: 'none_known'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'allergies'
      /** Non-empty: this member asserts allergies exist, so listing none
       *  would contradict it. Use `none_known` for a recorded negative. */
      items: [Allergy, ...Allergy[]]
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

/**
 * End of life care. `not_applicable` is a recorded clinical decision — a
 * manager looked and concluded EOLC does not apply — and is not the same as
 * nobody having looked.
 *
 * Rendered with --status-info, deliberately departing from source PRD §16.3's
 * grey: grey is reserved system-wide for unrecorded, so a recorded EOLC in
 * grey would read as "nobody has looked". Recorded in PROGRESS.md.
 */
export type EolcStatus =
  | { kind: 'not_recorded' }
  | { kind: 'not_applicable'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'in_place'
      startedOn: IsoDate
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

/** Infection control isolation. */
export type IsolationStatus =
  | { kind: 'not_recorded' }
  | { kind: 'not_isolating'; recordedBy: StaffRef; recordedAt: IsoDateTime }
  | {
      kind: 'isolating'
      reason: string
      since: IsoDate
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

/**
 * How much support a resident needs in a care plan domain. Source PRD §16.2.
 * `not_assessed` is a real member: "Independent" and "nobody has assessed
 * them" are opposite claims about a person's safety.
 */
export type SupportLevel =
  | { kind: 'not_assessed' }
  | { kind: 'independent' }
  | { kind: 'prompting_only' }
  | { kind: 'partial_assistance' }
  | { kind: 'full_assistance' }

/** Care plan domain progress. Source PRD §3. */
export type CarePlanDomainStatus =
  | { kind: 'not_started' }
  | { kind: 'in_progress'; updatedBy: StaffRef; updatedAt: IsoDateTime }
  | {
      kind: 'complete'
      finalisedBy: StaffRef
      finalisedOn: IsoDate
      nextReviewOn: IsoDate
    }
  | {
      kind: 'review_due'
      finalisedBy: StaffRef
      finalisedOn: IsoDate
      dueOn: IsoDate
      daysOverdue: number
    }

export interface CarePlanDomainRecord {
  domainId: CarePlanDomainId
  status: CarePlanDomainStatus
  supportLevel: SupportLevel
  /** Plain-language summary shown read-only on the Needs tab. */
  summary: string
}

/**
 * A resident's photograph.
 *
 * §2.4 makes the photo a control against wrong-subject writes, so its absence
 * is worth showing rather than papering over with an anonymous silhouette.
 * `not_on_file` renders an initials monogram — which is what the system
 * genuinely shows when there is no photograph, not a stand-in for one.
 */
export type PhotoStatus =
  | { kind: 'not_on_file' }
  | { kind: 'on_file'; url: string; uploadedBy: StaffRef; uploadedAt: IsoDateTime }

/**
 * The five-point mood scale from the care note composer. Source PRD §16.
 * Each point carries a word, never a face alone — an icon-only mood scale is
 * unreadable to a screen reader and ambiguous to everyone else.
 */
export type MoodScore = 1 | 2 | 3 | 4 | 5

export type MoodRecord =
  | { kind: 'not_recorded' }
  | {
      kind: 'recorded'
      score: MoodScore
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }

export const MOOD_LABELS: Record<MoodScore, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Settled',
  4: 'Good',
  5: 'Very good',
}
