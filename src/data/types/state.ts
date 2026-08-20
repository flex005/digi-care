/**
 * The state primitives — where the Evidence Invariant lives in code.
 * PRD §5.1, reproduced exactly.
 *
 * A blank on screen does not tell you whether the answer is "no" or "nobody
 * has looked yet". In a regulated care record those are opposites. Every type
 * below is a closed discriminated union with an explicit unrecorded member,
 * so the compiler refuses to build a screen that forgot that case.
 *
 * There are no optional properties here, no `| null`, no `| undefined`. If a
 * value can be absent, that absence is a named member of the union with its
 * own meaning — `not_assessed`, `no_decision_recorded`, `not_sought`,
 * `required_not_recorded`, `never_scheduled`. CLAUDE.md §1.
 */

import type {
  ConsentMethod,
  DocumentId,
  IsoDate,
  IsoDateTime,
  StaffRef,
} from './primitives'

/** The general shape. Every clinical status follows it. */
export type Recorded<T> =
  | { kind: 'unrecorded' }
  | { kind: 'recorded'; value: T; recordedBy: StaffRef; recordedAt: IsoDateTime }

/**
 * Risk — absence of a badge is never silence. reviewState is the single
 * source of truth for review timing; there is no separate reviewDue field.
 */
export type RiskLevel = 'low' | 'moderate' | 'high'

export type RiskStatus =
  | { kind: 'not_assessed' }
  | {
      kind: 'assessed'
      level: RiskLevel
      score: number
      assessedAt: IsoDateTime
      assessedBy: StaffRef
      reviewState: ReviewState
    }

/**
 * Resuscitation — three states, and "no decision recorded" is one of them.
 * signedBy is a plain string, not StaffRef: a DNAR is signed by a clinician
 * who is often not a member of staff in this system.
 */
export type ResuscitationStatus =
  | { kind: 'no_decision_recorded' }
  | {
      kind: 'dnar_in_place'
      signedBy: string
      signedOn: IsoDate
      documentId: DocumentId
    }
  | { kind: 'for_resuscitation'; recordedBy: StaffRef; recordedAt: IsoDateTime }

/**
 * MAR cell — five states, no nulls, no optionals.
 * Witness and escalation are their own unions: on a controlled drug, an absent
 * witness must distinguish "not required" from "required and not recorded".
 */
export type MarWitness =
  | { kind: 'not_required' }
  | { kind: 'required_not_recorded' }
  | { kind: 'witnessed'; by: StaffRef }

export type MarEscalation =
  { kind: 'not_escalated' } | { kind: 'escalated'; at: IsoDateTime }

export type MarCellState =
  | { kind: 'not_due' }
  | { kind: 'due'; windowOpensAt: IsoDateTime; windowClosesAt: IsoDateTime }
  | { kind: 'given'; givenAt: IsoDateTime; givenBy: StaffRef; witness: MarWitness }
  | {
      kind: 'not_given'
      reason: NotGivenReason
      note: string | ''
      recordedAt: IsoDateTime
      recordedBy: StaffRef
    }
  | { kind: 'omitted'; dueAt: IsoDateTime; escalation: MarEscalation }

export type NotGivenReason =
  | 'resident_refused'
  | 'resident_asleep'
  | 'medication_unavailable'
  | 'resident_in_hospital'
  | 'other'

/** Reviews. */
export type ReviewState =
  | { kind: 'never_scheduled' }
  | { kind: 'scheduled'; dueOn: IsoDate }
  | { kind: 'due'; dueOn: IsoDate }
  | { kind: 'overdue'; dueOn: IsoDate; daysOverdue: number }
  | {
      kind: 'completed'
      completedOn: IsoDate
      completedBy: StaffRef
      nextDueOn: IsoDate
    }

/**
 * Consent — six outcomes, none of them blank. Every recorded outcome carries
 * its author: refusal, withdrawal and best-interest decisions are the most
 * legally consequential of them, per §3.6.
 */
export type ConsentStatus =
  | { kind: 'not_sought' }
  | { kind: 'pending'; requestedOn: IsoDate; requestedBy: StaffRef }
  | { kind: 'consented'; method: ConsentMethod; on: IsoDate; by: StaffRef }
  | { kind: 'refused'; on: IsoDate; note: string; recordedBy: StaffRef }
  | {
      kind: 'withdrawn'
      on: IsoDate
      note: string
      previouslyConsentedOn: IsoDate
      recordedBy: StaffRef
    }
  | {
      kind: 'best_interest'
      decidedOn: IsoDate
      /** Non-empty: a best-interest decision reached without consulting
       *  anybody is not a best-interest decision. Mental Capacity Act 2005. */
      consulted: [string, ...string[]]
      rationale: string
      decidedBy: StaffRef
    }
