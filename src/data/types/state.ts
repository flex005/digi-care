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

import type { DocumentId, IsoDate, IsoDateTime, StaffRef } from './primitives'

/** The general shape. Every clinical status follows it. */
export type Recorded<T> =
  | { kind: 'unrecorded' }
  | { kind: 'recorded'; value: T; recordedBy: StaffRef; recordedAt: IsoDateTime }

/**
 * Risk — absence of a badge is never silence. reviewState is the single
 * source of truth for review timing; there is no separate reviewDue field.
 */
export type RiskLevel = 'low' | 'moderate' | 'high'

/**
 * What an assessment produced, where the instrument produces a number.
 *
 * **Not every risk assessment is scored.** Choking and dysphagia, behaviour
 * support, environmental risk and COSHH record findings and reach a level
 * without arithmetic; falls, pressure ulcer, nutrition, moving and handling
 * and skin integrity are scored instruments.
 *
 * A union rather than an optional number, because `score?: number` would make
 * a missing score mean either "this instrument does not produce one" or
 * "nobody recorded it" — and on a scored instrument the second is a real and
 * different state.
 */
export type RiskScore = { kind: 'scored'; value: number } | { kind: 'unscored' }

export type RiskStatus =
  | { kind: 'not_assessed' }
  | {
      kind: 'assessed'
      /**
       * Reached either way. **An unscored assessment still produces a level** —
       * somebody looked and formed a judgement, and a level is what the badge
       * strip and the profile header read.
       */
      level: RiskLevel
      score: RiskScore
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

/**
 * The running balance of a controlled drug, as the register holds it.
 *
 * **`no_balance_recorded` is a real member, and it is the reason this type
 * exists.** The round derived the balance as `lastCount?.counted ?? 0`, so
 * fifteen of sixteen controlled drugs reported a balance of zero — a clinical
 * figure invented by a fallback, and the exact shape CLAUDE.md §1 names. It
 * also made the reconciliation guard demand a count of −1, which no count can
 * equal, so those doses could not be recorded at all.
 *
 * A balance nobody has counted is not zero. It is not a smaller number and it
 * is not a safer one; it is the absence of a count, and nothing that consumes
 * this type can treat it as arithmetic.
 */
export type StockBalance =
  | { kind: 'no_balance_recorded' }
  | {
      kind: 'counted'
      value: number
      countedAt: IsoDateTime
      countedBy: StaffRef
    }

export type NotGivenReason =
  | 'resident_refused'
  | 'resident_asleep'
  | 'medication_unavailable'
  | 'resident_in_hospital'
  | 'other'

/**
 * A review's own scheduling lifecycle. PRD §6.7.
 *
 * `never_scheduled` is a real member and not a milder "scheduled": a record
 * nobody ever set a date for is the never-assessed shape applied to review
 * itself, and it is the finding the review queue leads on.
 *
 * **`completed` carries what it was completed against, so lateness stays
 * derivable.** Without it, "reviewed on time" and "reviewed three weeks late"
 * are the same record — and a review done late is a real finding about a home,
 * not a detail the completion erases. Same shape as `wasClearedLate` on a
 * post-incident flag: compare the completion against the deadline at the point
 * of reading, and there is nothing to overwrite.
 *
 * It is a union rather than a date because **a review nobody ever scheduled
 * can still be done**, and it had no date to be late against. A plain
 * `dueOn` would have to be invented for that case, and an invented deadline
 * produces a lateness nobody can check — the blank that means two things,
 * inside the field that exists to stop one.
 */

/** What a completed review was completed against. */
export type CompletedAgainst =
  { kind: 'due_on'; dueOn: IsoDate } | { kind: 'never_scheduled' }
export type ReviewState =
  | { kind: 'never_scheduled' }
  | { kind: 'scheduled'; dueOn: IsoDate }
  | { kind: 'due'; dueOn: IsoDate }
  | { kind: 'overdue'; dueOn: IsoDate; daysOverdue: number }
  | {
      kind: 'completed'
      completedOn: IsoDate
      completedBy: StaffRef
      against: CompletedAgainst
      nextDueOn: IsoDate
    }

/*
 * `ConsentStatus` moved to `consent.ts` in Phase 10 and split into two axes.
 *
 * Five of its six members said what was decided and one said who decided it,
 * which are answers to different questions — and the union could not express a
 * best-interests decision that concluded *no*.
 */
