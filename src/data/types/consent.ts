import type { ConsentTypeId } from './reference'
import type {
  CapacityAssessmentId,
  DocumentId,
  IsoDate,
  ResidentId,
  StaffRef,
} from './primitives'
import type { ConsentMethod } from './resident'

/**
 * Consent, and the capacity that authorises it. PRD §6.7, Phase 10.
 *
 * ## Two axes, because they answer different questions
 *
 * The old union had six members and five of them said **what was decided**
 * while one said **who decided it**. `best_interest` sitting beside
 * `consented` was the tell, and the gap it left is the argument: **a
 * best-interests process that concludes *no* is a real and common outcome that
 * the old type could not express.** `best_interest` implied a positive by
 * omission — a blank meaning two things, inside the field built to prevent one.
 *
 * So: an outcome, and where a decision exists, an authority.
 *
 * `not_sought` and `pending` carry no authority, and that is not an omission.
 * Nothing has been decided, so there is nobody who decided it, and the screen
 * renders that as the hatch rather than as a blank.
 */

/**
 * The Mental Capacity Act's two stages. **Both, or it is not an assessment.**
 *
 * "Lacks capacity" with no impairment recorded and no functional finding is a
 * conclusion without a test, and the type refuses it.
 */
export type CapacityFinding =
  | { kind: 'has_capacity' }
  | {
      kind: 'lacks_capacity'
      /** Stage 1: the impairment of, or disturbance in, mind or brain. */
      diagnosticTest: string
      /** Stage 2: which part of deciding they cannot do, because of it. */
      functionalTest: string
    }

/**
 * One capacity assessment, and the decisions it was made about.
 *
 * **Decision-specific, and never general.** The MCA asks whether this person
 * has capacity for *this* decision at *this* time. One assessment may cover
 * several decisions made in the same conversation — "I assessed her capacity
 * to consent to care, medication and data sharing on 12/03" is a true sentence
 * and a lawful one — but it can never be a standing claim about a person.
 *
 * `covers` is a map rather than a list **so the compiler can hold the rule**.
 * A consent of type `K` requires an authority carrying a
 * `CapacityAssessment<K>`, and an assessment whose `covers` lacks `K` is not
 * assignable to it. An assessment naming three types, and somebody recording a
 * fourth consent against it, does not compile.
 */
export interface CapacityAssessment<S extends ConsentTypeId = ConsentTypeId> {
  id: CapacityAssessmentId
  residentId: ResidentId
  finding: CapacityFinding
  /** The decisions this assessment was made about. Never empty, never general. */
  covers: { readonly [K in S]: true }
  assessedOn: IsoDate
  assessedBy: StaffRef
  /** What was said and seen. A record of the conversation, not a conclusion. */
  note: string
}

/**
 * Who decided, and on what basis.
 *
 * Three, and the third is why `LpaType` was worth modelling: **only a
 * health-and-welfare LPA can consent to care.** A financial LPA consenting to
 * photography is a real-world error, and the screen does not offer the
 * authority where there is no health-and-welfare LPA on record — it says why
 * rather than presenting it and failing on submit.
 */
export type DecisionAuthority<T extends ConsentTypeId = ConsentTypeId> =
  | { kind: 'the_resident'; assessment: CapacityAssessment<T> }
  | {
      kind: 'best_interests'
      assessment: CapacityAssessment<T>
      /** Non-empty: a best-interests decision reached without consulting
       *  anybody is not a best-interests decision. Mental Capacity Act 2005. */
      consulted: [string, ...string[]]
      rationale: string
    }
  | {
      kind: 'lpa_holder'
      assessment: CapacityAssessment<T>
      who: string
      documentId: DocumentId
    }

/**
 * How many of something still exists after a withdrawal.
 *
 * **`not_counted` is a real member.** Nobody knowing how many photographs are
 * on the corridor noticeboards is not the same as there being none, and a zero
 * there would be a figure nobody measured — the fallback this product exists to
 * refuse.
 */
export type EffectCount =
  | { kind: 'counted'; value: number }
  | { kind: 'not_counted' }
  /** A separate consent that this withdrawal does not touch. */
  | { kind: 'unchanged' }

/**
 * Something a withdrawal does not undo.
 *
 * **Data, not prose.** A sentence cannot be asserted against, so a withdrawal
 * that forgot to mention the photographs would look identical to one that did
 * — the product's own failure inside the dialog written to prevent it. Each
 * effect is a row the confirmation renders and a test can name.
 */
export interface DownstreamEffect {
  name: string
  explanation: string
  count: EffectCount
}

export type ConsentStatus<T extends ConsentTypeId = ConsentTypeId> =
  | { kind: 'not_sought' }
  | { kind: 'pending'; requestedOn: IsoDate; requestedBy: StaffRef }
  | {
      kind: 'given'
      on: IsoDate
      method: ConsentMethod
      recordedBy: StaffRef
      by: DecisionAuthority<T>
    }
  | {
      kind: 'refused'
      on: IsoDate
      /** What they said. A refusal is a record, not a failure. */
      note: string
      recordedBy: StaffRef
      by: DecisionAuthority<T>
    }
  | {
      kind: 'withdrawn'
      on: IsoDate
      note: string
      previouslyGivenOn: IsoDate
      recordedBy: StaffRef
      by: DecisionAuthority<T>
      /** What withdrawing did not undo, as it stood at the moment of signing. */
      remains: DownstreamEffect[]
    }

/**
 * A consent read rather than recorded.
 *
 * `covers: {}` is satisfied by every assessment, so this is the widest form —
 * what a badge or a list takes when it does not know which type it is looking
 * at. **Recording still goes through `ConsentStatus<K>`**, which is where the
 * scope rule bites; this alias exists so reading does not have to carry a type
 * parameter it has no use for.
 */
export type AnyConsent = ConsentStatus<never>

/** The eight consents a resident holds, each knowing its own type. */
export type ConsentRecord = { [K in ConsentTypeId]: ConsentStatus<K> }
