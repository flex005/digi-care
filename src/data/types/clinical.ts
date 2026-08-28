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
import type { CompletedAgainst, ReviewState } from './state'

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

/**
 * Care plan domain progress. Source PRD §3.
 *
 * **No "due soon" member, deliberately.** That is not a recorded fact — nobody
 * wrote it down and it changes on its own as the clock moves — so it is
 * derived from `nextReviewOn` for display in
 * `features/care-plan/review-timing.ts`. A union member asserts something
 * about the record; this is arithmetic on a date the record already holds.
 *
 * This is **not** an inconsistency with `ReviewState`, which does have `due`
 * and `overdue` as members. That union describes a *review's* own scheduling
 * lifecycle — never scheduled, scheduled, due, overdue, completed — where each
 * member is something somebody did or did not do. This one describes **the
 * plan**, not the review of it. Two different things, correctly at different
 * granularities; do not reconcile them.
 */
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

/**
 * One finalised version of a care plan domain.
 *
 * **A care plan is revised; a care note is corrected.** Those are different
 * models and the difference is not stylistic. A note is somebody's account of
 * a moment, so editing it rewrites what they saw — corrections are linked
 * notes and the original stays. A care plan is a current instruction staff
 * follow today, so there has to be exactly one current version and the
 * previous one becomes history rather than a mistake.
 *
 * **A draft is not a version.** An unfinalised edit becomes history only on
 * signing, because a diff showing changes nobody agreed to is a history of
 * intentions rather than of instructions — and what the history is for is what
 * staff were told to follow. One consequence, and it is correct: an abandoned
 * draft leaves no trace. Nobody followed it.
 */
export interface CarePlanVersion {
  /**
   * What this person needs, **in their own words**. Source PRD §3.3.
   *
   * First person — "I need a hand to stand up from the chair" — because a care
   * plan written about somebody in clinical language is a document they cannot
   * recognise themselves in.
   */
  currentNeeds: string
  /** Also theirs. "I like to be up and dressed before breakfast." */
  preferences: string
  /**
   * What staff will do about it — the one field written in the second person
   * about staff rather than the first person about the resident.
   */
  agreedActions: string
  finalisedBy: StaffRef
  finalisedOn: IsoDate
}

/**
 * The review of a whole care plan — the meeting, not the plan.
 *
 * **Its own type, because it is the only review of a *set*.** A risk
 * assessment review looks at one assessment and a domain review at one domain;
 * this one looks at ten domains at once, and the thing that has to survive it
 * is what was still missing when somebody signed it off.
 *
 * ## Why `completed` carries what was outstanding
 *
 * The handover signature pattern exactly (`HandoverSignature`). Signing a
 * handover with six residents nobody looked at is permitted and records the
 * counts, so the signature can never later read as covering more than it did.
 *
 * The same three options existed here and two of them are wrong. **Refusing to
 * complete** while a domain is unwritten would mean the meeting happened and
 * the system holds no evidence of it — and a review meeting happens *because*
 * there are gaps, so refusing is refusing to record the normal case.
 * **Permitting it silently** would let "care plan reviewed" sit over three
 * domains nobody has written, which is the collapse this build exists to
 * prevent. Storing the gaps at the moment of signing is the only version that
 * is still true afterwards.
 *
 * `outstanding` is a union rather than an array that might be empty, because
 * an empty array would mean either "the plan was complete" or "nobody recorded
 * what was outstanding" — the blank that means two things, inside the very
 * field that exists to stop one.
 *
 * The domains are **named, not counted**. A figure says how much was missing;
 * the names say what.
 */
export type CarePlanReviewState =
  | Exclude<ReviewState, { kind: 'completed' }>
  | {
      kind: 'completed'
      completedOn: IsoDate
      completedBy: StaffRef
      against: CompletedAgainst
      nextDueOn: IsoDate
      outstanding:
        | { kind: 'none_outstanding' }
        | {
            kind: 'outstanding'
            domains: [CarePlanDomainId, ...CarePlanDomainId[]]
          }
    }

/**
 * The written part of a plan: a version without its signature.
 *
 * Declared once and derived from `CarePlanVersion`, because three things need
 * exactly these three fields and no others — the editor's boxes, the draft, and
 * the diff. A second hand-written copy of the list is how a fourth field ends
 * up in two of them and not the third.
 */
export type CarePlanText = Pick<
  CarePlanVersion,
  'currentNeeds' | 'preferences' | 'agreedActions'
>

export interface CarePlanDomainRecord {
  domainId: CarePlanDomainId
  status: CarePlanDomainStatus
  supportLevel: SupportLevel
  /** Plain-language summary shown read-only on the Needs tab. */
  summary: string
  /**
   * Every finalised version, oldest first, **current last**.
   *
   * Non-empty where the domain has ever been finalised and absent where it has
   * not — so "complete implies at least one version" is held by the compiler
   * rather than checked at a call site.
   */
  versions:
    | { kind: 'never_finalised' }
    | { kind: 'finalised'; history: [CarePlanVersion, ...CarePlanVersion[]] }
  /**
   * An edit somebody started and has not signed.
   *
   * Separate from the versions because it is not one yet. It is what
   * `in_progress` means, and abandoning it removes it without touching the
   * history.
   */
  draft:
    | { kind: 'none' }
    | {
        kind: 'draft'
        currentNeeds: string
        preferences: string
        agreedActions: string
        updatedBy: StaffRef
        updatedAt: IsoDateTime
      }
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
