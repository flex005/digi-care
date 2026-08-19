import type {
  Aggregate,
  ConsentStatus,
  MarCellState,
  MarWitness,
  Recorded,
  ResuscitationStatus,
  ReviewState,
  RiskStatus,
} from '@/data/types'
import {
  staffDeactivated,
  staffHalloran,
  staffNwosu,
  staffOkonkwo,
} from '@/data/fixtures/organisation'

/**
 * Every state of every status primitive, for /dev/states.
 *
 * `ByKind<T>` is the point of this file. It maps a union to an object whose
 * keys are exactly that union's `kind` values, so if a member is ever added to
 * a status union, THIS FILE STOPS COMPILING until the new member has an
 * example here — and therefore until it is rendered on the kitchen sink.
 *
 * That is the same guarantee assertNever gives inside a component, applied to
 * the review surface: a state cannot be added to the system without becoming
 * visible on the page we use to check the Evidence Invariant.
 */
export type ByKind<T extends { kind: string }> = {
  [K in T['kind']]: Array<Extract<T, { kind: K }>>
}

// ---------------------------------------------------------------------------
// Recorded<T> — the general shape
// ---------------------------------------------------------------------------

export const recordedStates: ByKind<Recorded<string>> = {
  unrecorded: [{ kind: 'unrecorded' }],
  recorded: [
    {
      kind: 'recorded',
      value: 'Penicillin — anaphylaxis',
      recordedBy: staffOkonkwo,
      recordedAt: '2026-03-12T09:20:00Z',
    },
    {
      // A recorded NEGATIVE. Complete, settled, and not the same as a gap.
      kind: 'recorded',
      value: 'No known allergies',
      recordedBy: staffNwosu,
      recordedAt: '2026-03-12T11:05:00Z',
    },
  ],
}

// ---------------------------------------------------------------------------
// RiskStatus
// ---------------------------------------------------------------------------

export const riskStates: ByKind<RiskStatus> = {
  not_assessed: [{ kind: 'not_assessed' }],
  assessed: [
    {
      kind: 'assessed',
      level: 'low',
      score: 15,
      assessedAt: '2026-07-02T10:15:00+01:00',
      assessedBy: staffNwosu,
      reviewState: { kind: 'scheduled', dueOn: '2026-10-02' },
    },
    {
      kind: 'assessed',
      level: 'moderate',
      score: 45,
      assessedAt: '2026-06-18T14:40:00+01:00',
      assessedBy: staffHalloran,
      reviewState: { kind: 'due', dueOn: '2026-08-18' },
    },
    {
      kind: 'assessed',
      level: 'high',
      score: 70,
      assessedAt: '2026-05-30T08:05:00+01:00',
      assessedBy: staffOkonkwo,
      reviewState: { kind: 'overdue', dueOn: '2026-07-30', daysOverdue: 20 },
    },
  ],
}

// ---------------------------------------------------------------------------
// ResuscitationStatus
// ---------------------------------------------------------------------------

export const resuscitationStates: ByKind<ResuscitationStatus> = {
  no_decision_recorded: [{ kind: 'no_decision_recorded' }],
  dnar_in_place: [
    {
      kind: 'dnar_in_place',
      signedBy: 'Dr S. Achebe, GP',
      signedOn: '2026-02-04',
      documentId: 'doc-dnar-0041',
    },
  ],
  for_resuscitation: [
    {
      kind: 'for_resuscitation',
      recordedBy: staffOkonkwo,
      recordedAt: '2026-04-22T16:30:00+01:00',
    },
  ],
}

// ---------------------------------------------------------------------------
// MarWitness — the three states a second signature can be in
// ---------------------------------------------------------------------------

export const witnessStates: ByKind<MarWitness> = {
  not_required: [{ kind: 'not_required' }],
  required_not_recorded: [{ kind: 'required_not_recorded' }],
  witnessed: [{ kind: 'witnessed', by: staffHalloran }],
}

// ---------------------------------------------------------------------------
// MarCellState — five, with every sub-state expanded
// ---------------------------------------------------------------------------

export const marStates: ByKind<MarCellState> = {
  not_due: [{ kind: 'not_due' }],
  due: [
    {
      kind: 'due',
      windowOpensAt: '2026-08-19T08:00:00+01:00',
      windowClosesAt: '2026-08-19T09:00:00+01:00',
    },
  ],
  given: [
    {
      kind: 'given',
      givenAt: '2026-08-19T08:04:00+01:00',
      givenBy: staffNwosu,
      witness: { kind: 'not_required' },
    },
    {
      kind: 'given',
      givenAt: '2026-08-19T08:06:00+01:00',
      givenBy: staffNwosu,
      witness: { kind: 'witnessed', by: staffHalloran },
    },
    {
      // A controlled drug given without its second signature. The record
      // exists but is incomplete, and that is not the same as "no witness
      // was needed".
      kind: 'given',
      givenAt: '2026-08-19T08:09:00+01:00',
      givenBy: staffDeactivated,
      witness: { kind: 'required_not_recorded' },
    },
  ],
  not_given: [
    {
      kind: 'not_given',
      reason: 'resident_refused',
      note: 'Offered again at 08:30, refused again.',
      recordedAt: '2026-08-19T08:04:00+01:00',
      recordedBy: staffNwosu,
    },
    {
      kind: 'not_given',
      reason: 'resident_asleep',
      note: '',
      recordedAt: '2026-08-19T08:12:00+01:00',
      recordedBy: staffNwosu,
    },
    {
      kind: 'not_given',
      reason: 'medication_unavailable',
      note: 'Awaiting delivery from pharmacy.',
      recordedAt: '2026-08-19T08:15:00+01:00',
      recordedBy: staffHalloran,
    },
    {
      kind: 'not_given',
      reason: 'resident_in_hospital',
      note: 'Admitted to Ashgrove General 18/08.',
      recordedAt: '2026-08-19T08:20:00+01:00',
      recordedBy: staffOkonkwo,
    },
    {
      kind: 'not_given',
      reason: 'other',
      note: 'Held pending GP review of dose.',
      recordedAt: '2026-08-19T08:25:00+01:00',
      recordedBy: staffOkonkwo,
    },
  ],
  omitted: [
    {
      kind: 'omitted',
      dueAt: '2026-08-19T08:00:00+01:00',
      escalation: { kind: 'not_escalated' },
    },
    {
      kind: 'omitted',
      dueAt: '2026-08-19T08:00:00+01:00',
      escalation: { kind: 'escalated', at: '2026-08-19T09:04:00+01:00' },
    },
  ],
}

// ---------------------------------------------------------------------------
// ReviewState
// ---------------------------------------------------------------------------

export const reviewStates: ByKind<ReviewState> = {
  never_scheduled: [{ kind: 'never_scheduled' }],
  scheduled: [{ kind: 'scheduled', dueOn: '2026-11-04' }],
  due: [{ kind: 'due', dueOn: '2026-08-19' }],
  overdue: [{ kind: 'overdue', dueOn: '2026-06-14', daysOverdue: 66 }],
  completed: [
    {
      kind: 'completed',
      completedOn: '2026-07-31',
      completedBy: staffHalloran,
      nextDueOn: '2026-10-31',
    },
  ],
}

// ---------------------------------------------------------------------------
// ConsentStatus — six outcomes, every one with an author
// ---------------------------------------------------------------------------

export const consentStates: ByKind<ConsentStatus> = {
  not_sought: [{ kind: 'not_sought' }],
  pending: [{ kind: 'pending', requestedOn: '2026-08-11', requestedBy: staffHalloran }],
  consented: [
    { kind: 'consented', method: 'written', on: '2026-01-19', by: staffOkonkwo },
    { kind: 'consented', method: 'verbal', on: '2026-02-02', by: staffNwosu },
    {
      kind: 'consented',
      method: 'digital_signature',
      on: '2026-03-15',
      by: staffOkonkwo,
    },
  ],
  refused: [
    {
      kind: 'refused',
      on: '2026-05-06',
      note: 'Declined photography for the newsletter.',
      recordedBy: staffNwosu,
    },
  ],
  withdrawn: [
    {
      kind: 'withdrawn',
      on: '2026-07-21',
      note: 'Family requested removal; existing photos still on file.',
      previouslyConsentedOn: '2026-01-19',
      recordedBy: staffOkonkwo,
    },
  ],
  best_interest: [
    {
      kind: 'best_interest',
      decidedOn: '2026-04-09',
      consulted: ['Dr S. Achebe', 'Daughter — Grace Adeyemi', 'Social worker'],
      rationale:
        'Lacks capacity for this decision; photography supports family contact.',
      decidedBy: staffOkonkwo,
    },
  ],
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export const aggregateStates: ByKind<Aggregate> = {
  insufficient_evidence: [
    {
      kind: 'insufficient_evidence',
      coverage: { covered: 4, total: 32 },
      missingDescription: 'Falls risk assessments are largely incomplete —',
    },
  ],
  measured: [
    {
      kind: 'measured',
      unit: 'percentage',
      value: 92,
      coverage: { covered: 46, total: 50 },
    },
    { kind: 'measured', unit: 'count', value: 3, coverage: { covered: 3, total: 32 } },
  ],
}
