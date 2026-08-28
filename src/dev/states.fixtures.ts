import type {
  Aggregate,
  AllergyStatus,
  CarePlanDomainStatus,
  AnyConsent,
  CapacityAssessment,
  CapacityAssessmentId,
  ResidentId,
  EolcStatus,
  IsolationStatus,
  MarCellState,
  MarWitness,
  MoodRecord,
  PhotoStatus,
  Recorded,
  RecordedList,
  ResuscitationStatus,
  ReviewState,
  RiskStatus,
  SupportLevel,
} from '@/data/types'
import samplePhoto from './sample-photo.svg'
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
      value: 'Penicillin · anaphylaxis',
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
      score: { kind: 'scored', value: 15 },
      assessedAt: '2026-07-02T10:15:00+01:00',
      assessedBy: staffNwosu,
      reviewState: { kind: 'scheduled', dueOn: '2026-10-02' },
    },
    {
      kind: 'assessed',
      level: 'moderate',
      score: { kind: 'scored', value: 45 },
      assessedAt: '2026-06-18T14:40:00+01:00',
      assessedBy: staffHalloran,
      reviewState: { kind: 'due', dueOn: '2026-08-18' },
    },
    {
      kind: 'assessed',
      level: 'high',
      score: { kind: 'scored', value: 70 },
      assessedAt: '2026-05-30T08:05:00+01:00',
      assessedBy: staffOkonkwo,
      reviewState: { kind: 'overdue', dueOn: '2026-07-30', daysOverdue: 20 },
    },
    {
      // Assessed without a number. Choking, behaviour, environmental risk and
      // COSHH record findings and reach a level without arithmetic — a state
      // the badge and the profile have to render, so it needs a fixture here
      // as much as any other (§8).
      kind: 'assessed',
      level: 'high',
      score: { kind: 'unscored' },
      assessedAt: '2026-05-20T09:30:00+01:00',
      assessedBy: staffHalloran,
      reviewState: { kind: 'scheduled', dueOn: '2026-11-20' },
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
      against: { kind: 'due_on', dueOn: '2026-08-04' },
      nextDueOn: '2026-10-31',
    },
    // The same record done late. Lateness is derived from `completedOn >
    // dueOn`, so it survives the completion rather than being erased by it —
    // and both cases need a fixture, or the screen is reviewed against one.
    {
      kind: 'completed',
      completedOn: '2026-07-31',
      completedBy: staffHalloran,
      against: { kind: 'due_on', dueOn: '2026-07-08' },
      nextDueOn: '2026-10-31',
    },
    // Done, and it had never been scheduled. There was no date to be late
    // against, and inventing one would produce a lateness nobody can check.
    {
      kind: 'completed',
      completedOn: '2026-07-31',
      completedBy: staffHalloran,
      against: { kind: 'never_scheduled' },
      nextDueOn: '2026-10-31',
    },
  ],
}

// ---------------------------------------------------------------------------
// ConsentStatus — six outcomes, every one with an author
// ---------------------------------------------------------------------------

/**
 * The two capacity findings, for the states below.
 *
 * `covers: {}` is the widest form — an assessment assignable wherever any
 * consent type is expected. Recording goes through `ConsentStatus<K>`, which
 * is where the scope rule bites; these exist to be *read*.
 */
const HAS_CAPACITY: CapacityAssessment<never> = {
  id: 'cap-states-0001' as CapacityAssessmentId,
  residentId: 'res-adeyemi' as ResidentId,
  finding: { kind: 'has_capacity' },
  covers: {},
  assessedOn: '2026-03-15',
  assessedBy: staffOkonkwo,
  note: 'Explained it, asked her to tell me back what it meant, and she did.',
}

const LACKS_CAPACITY: CapacityAssessment<never> = {
  id: 'cap-states-0002' as CapacityAssessmentId,
  residentId: 'res-adeyemi' as ResidentId,
  finding: {
    kind: 'lacks_capacity',
    diagnosticTest: 'Moderate vascular dementia, diagnosed 2023.',
    functionalTest:
      'Could repeat the options back but could not hold them together long enough to compare.',
  },
  covers: {},
  assessedOn: '2026-04-09',
  assessedBy: staffOkonkwo,
  note: 'Went through it twice with a break. Daughter present for the second conversation.',
}

export const consentStates: ByKind<AnyConsent> = {
  not_sought: [{ kind: 'not_sought' }],
  pending: [{ kind: 'pending', requestedOn: '2026-08-14', requestedBy: staffOkonkwo }],
  given: [
    {
      kind: 'given',
      method: 'digital_signature',
      on: '2026-03-15',
      recordedBy: staffOkonkwo,
      by: { kind: 'the_resident', assessment: HAS_CAPACITY },
    },
  ],
  refused: [
    // The resident's own refusal — a record of a choice, not a finding.
    {
      kind: 'refused',
      on: '2026-05-06',
      note: 'Said no, and said why: she does not want her picture anywhere.',
      recordedBy: staffNwosu,
      by: { kind: 'the_resident', assessment: HAS_CAPACITY },
    },
    /*
     * A best-interests decision that concluded **no**.
     *
     * The state the old six-member union could not express: `best_interest`
     * implied a positive by omission, so a process that decided *against*
     * something had nowhere to go.
     */
    {
      kind: 'refused',
      on: '2026-04-09',
      note: 'Decided against on his behalf after consulting the family and the GP.',
      recordedBy: staffOkonkwo,
      by: {
        kind: 'best_interests',
        assessment: LACKS_CAPACITY,
        consulted: ['Dr S. Achebe', 'Daughter, Grace Adeyemi', 'Social worker'],
        rationale: 'Weighed up and agreed it would not be in his best interests.',
      },
    },
  ],
  withdrawn: [
    {
      kind: 'withdrawn',
      on: '2026-07-21',
      note: 'Asked for her photographs to stop being taken.',
      previouslyGivenOn: '2026-01-19',
      recordedBy: staffOkonkwo,
      by: { kind: 'the_resident', assessment: HAS_CAPACITY },
      remains: [
        {
          name: 'Photographs on file',
          explanation: 'Taken while consent stood, and still in the record.',
          count: { kind: 'counted', value: 14 },
        },
        {
          name: "Photographs on the home's noticeboards",
          explanation: 'Physical prints in the corridors.',
          count: { kind: 'not_counted' },
        },
      ],
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
      missingDescription: 'Falls risk assessments are largely incomplete:',
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

// ---------------------------------------------------------------------------
// Phase 1 unions
// ---------------------------------------------------------------------------

export const allergyStates: ByKind<AllergyStatus> = {
  not_recorded: [{ kind: 'not_recorded' }],
  none_known: [
    {
      // A recorded NEGATIVE. Somebody asked, and the answer was none. This is
      // a complete clinical record and must look settled.
      kind: 'none_known',
      recordedBy: staffOkonkwo,
      recordedAt: '2026-03-12T11:05:00Z',
    },
  ],
  allergies: [
    {
      kind: 'allergies',
      items: [
        { substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'anaphylaxis' },
        {
          substance: 'Codeine',
          reaction: 'Nausea and confusion',
          severity: 'moderate',
        },
      ],
      recordedBy: staffOkonkwo,
      recordedAt: '2026-03-12T09:20:00Z',
    },
  ],
}

export const eolcStates: ByKind<EolcStatus> = {
  not_recorded: [{ kind: 'not_recorded' }],
  not_applicable: [
    {
      kind: 'not_applicable',
      recordedBy: staffOkonkwo,
      recordedAt: '2026-05-02T10:00:00+01:00',
    },
  ],
  in_place: [
    {
      kind: 'in_place',
      startedOn: '2026-07-14',
      recordedBy: staffHalloran,
      recordedAt: '2026-07-14T09:30:00+01:00',
    },
  ],
}

export const isolationStates: ByKind<IsolationStatus> = {
  not_recorded: [{ kind: 'not_recorded' }],
  not_isolating: [
    {
      kind: 'not_isolating',
      recordedBy: staffNwosu,
      recordedAt: '2026-08-18T07:15:00+01:00',
    },
  ],
  isolating: [
    {
      kind: 'isolating',
      reason: 'Suspected norovirus',
      since: '2026-08-17',
      recordedBy: staffNwosu,
      recordedAt: '2026-08-17T22:40:00+01:00',
    },
  ],
}

export const supportLevelStates: ByKind<SupportLevel> = {
  not_assessed: [{ kind: 'not_assessed' }],
  independent: [{ kind: 'independent' }],
  prompting_only: [{ kind: 'prompting_only' }],
  partial_assistance: [{ kind: 'partial_assistance' }],
  full_assistance: [{ kind: 'full_assistance' }],
}

export const domainStatusStates: ByKind<CarePlanDomainStatus> = {
  not_started: [{ kind: 'not_started' }],
  in_progress: [
    {
      kind: 'in_progress',
      updatedBy: staffHalloran,
      updatedAt: '2026-08-11T14:20:00+01:00',
    },
  ],
  complete: [
    {
      kind: 'complete',
      finalisedBy: staffOkonkwo,
      finalisedOn: '2026-06-30',
      nextReviewOn: '2026-12-30',
    },
  ],
  review_due: [
    {
      // PRD §5.3 gap 7 shape: finalised 14 months ago and never reviewed.
      kind: 'review_due',
      finalisedBy: staffHalloran,
      finalisedOn: '2025-06-19',
      dueOn: '2026-06-19',
      daysOverdue: 62,
    },
  ],
}

export const moodStates: ByKind<MoodRecord> = {
  not_recorded: [{ kind: 'not_recorded' }],
  recorded: [
    {
      kind: 'recorded',
      score: 1,
      recordedBy: staffNwosu,
      recordedAt: '2026-08-19T09:00:00+01:00',
    },
    {
      kind: 'recorded',
      score: 3,
      recordedBy: staffNwosu,
      recordedAt: '2026-08-19T09:00:00+01:00',
    },
    {
      kind: 'recorded',
      score: 5,
      recordedBy: staffNwosu,
      recordedAt: '2026-08-19T09:00:00+01:00',
    },
  ],
}

/**
 * Both photo branches. No resident in the fixtures has a photograph on file,
 * so without this the `on_file` path would be dead code that nobody ever
 * looked at until the day real images arrived.
 */
export const photoStates: ByKind<PhotoStatus> = {
  not_on_file: [{ kind: 'not_on_file' }],
  on_file: [
    {
      kind: 'on_file',
      url: samplePhoto,
      uploadedBy: staffOkonkwo,
      uploadedAt: '2026-04-02T13:10:00+01:00',
    },
  ],
}

/**
 * The third general shape, after `Recorded<T>` and the bespoke unions.
 *
 * `none_involved` is the member that earns the type: "we asked, and there is
 * nobody" is a positive claim with an author, and it must look settled rather
 * than unfinished — the same treatment as a recorded "No known allergies", for
 * the same reason.
 */
export const recordedListStates: ByKind<RecordedList<string>> = {
  not_recorded: [{ kind: 'not_recorded' }],
  none_involved: [
    {
      kind: 'none_involved',
      recordedBy: staffOkonkwo,
      recordedAt: '2026-07-06T10:15:00+01:00',
    },
  ],
  recorded: [
    {
      kind: 'recorded',
      items: ['Hypertension', 'Atrial fibrillation'],
      recordedBy: staffOkonkwo,
      recordedAt: '2026-07-06T10:15:00+01:00',
    },
  ],
}
