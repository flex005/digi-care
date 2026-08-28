import type {
  BodyRegionId,
  Incident,
  IncidentAct,
  IncidentId,
  IncidentLocation,
  IncidentSeverityId,
  IncidentTypeId,
  ImmediateResponse,
  IsoDateTime,
  ManagerReview,
  PostIncidentReviewFlag,
  ResidentId,
  StaffRef,
} from '../types'
import { COMMUNAL_AREAS, subjectResidentId } from '../types'
import { NOW, atTime, daysAgo, makeRandom, toIsoDateTime } from './generate'
import {
  carersAndSeniors,
  staffDeactivated,
  staffHalloran,
  staffNwosu,
  staffOkonkwo,
} from './organisation'
import { GAP_RESIDENTS, residents } from './residents'
import { OKAFOR_MORPHINE, hasStockDiscrepancy, stockCounts } from './medications'

/**
 * Incidents. PRD §5.2, §5.3, §6.5.
 *
 * 90 days, about 45 incidents across 32 residents. Falls commonest, near
 * misses next, most acknowledged and closed — with four or five left
 * unacknowledged so the queue on `/incidents` is a queue rather than an
 * illustration of one.
 *
 * **Three deliberate gaps sit on top of that**, each pinned by identity so a
 * guard asserts *these* rather than counting anything the generator might also
 * produce:
 *
 *   · one reported and never acknowledged, older than any of the others;
 *   · one closed with the notification decision never made;
 *   · one where notification was recorded as required and never made.
 *
 * The third is the sharpest of the three. `not_yet_decided` is a decision
 * nobody has taken; `required_not_yet_notified` is a duty somebody accepted
 * and did not discharge, and there is nothing in the record to prove
 * otherwise.
 */

const HOURS = 3_600_000

const act = (by: StaffRef, at: Date): IncidentAct => ({ by, at: toIsoDateTime(at) })

/**
 * `hours` after `at`, and **never after now**.
 *
 * The first version of this generator could close an incident in the future:
 * an incident two days old could acquire an acknowledgement, a review and a
 * closure spanning up to 87 hours, landing a day and a half from now. A record
 * signed at a time that has not happened is not a thin fixture, it is an
 * impossible one.
 */
const after = (at: Date, hours: number) => {
  const moved = new Date(at.getTime() + hours * HOURS)
  return moved.getTime() > NOW.getTime() ? new Date(NOW.getTime()) : moved
}

/**
 * What each type usually does to somebody.
 *
 * **A near miss is `no_harm` by definition, and that is a definition rather
 * than a fixture convenience.** A near miss that caused harm is not a near
 * miss; it is the incident it nearly was, and it should be recorded as that
 * type. The generator cannot produce a harmful one because the product should
 * not be able to hold one.
 */
const SEVERITY_BY_TYPE: Record<IncidentTypeId, IncidentSeverityId[]> = {
  fall_witnessed: ['no_harm', 'low_harm', 'low_harm', 'moderate_harm'],
  fall_unwitnessed: ['low_harm', 'low_harm', 'moderate_harm', 'severe_harm'],
  medication_error: ['no_harm', 'no_harm', 'low_harm'],
  medication_stock_discrepancy: ['no_harm'],
  injury_unexplained: ['low_harm', 'moderate_harm'],
  behaviour: ['no_harm', 'low_harm'],
  absconding: ['no_harm', 'low_harm', 'moderate_harm'],
  choking: ['low_harm', 'moderate_harm', 'severe_harm'],
  pressure_ulcer_acquired: ['moderate_harm', 'severe_harm'],
  safeguarding_concern: ['no_harm', 'low_harm', 'moderate_harm'],
  equipment_failure: ['no_harm', 'no_harm', 'low_harm'],
  near_miss: ['no_harm'],
}

/** How often each type comes up. Falls commonest, near misses next. */
const TYPE_WEIGHTS: [IncidentTypeId, number][] = [
  ['fall_witnessed', 9],
  ['fall_unwitnessed', 6],
  ['near_miss', 8],
  ['medication_error', 4],
  ['behaviour', 4],
  ['equipment_failure', 3],
  ['injury_unexplained', 3],
  ['absconding', 2],
  ['safeguarding_concern', 2],
  ['pressure_ulcer_acquired', 2],
  ['choking', 1],
]

const TYPE_POOL: IncidentTypeId[] = TYPE_WEIGHTS.flatMap(([type, weight]) =>
  Array.from({ length: weight }, () => type),
)

const DESCRIPTIONS: Record<IncidentTypeId, string[]> = {
  fall_witnessed: [
    'Lowered to the floor beside the bed while being assisted to stand. No loss of consciousness.',
    'Slipped on the way to the bathroom. Carer was in the room and broke the fall.',
    'Went down onto the left side while reaching for the walking frame.',
  ],
  fall_unwitnessed: [
    'Found sitting on the floor beside the armchair. Unable to say what happened.',
    'Heard a noise and found on the bedroom floor. No account of the fall available.',
  ],
  medication_error: [
    'Morning dose signed for on the wrong chart. Both residents checked, no dose given twice.',
    'Dose given forty minutes after the window closed.',
  ],
  medication_stock_discrepancy: [
    'Controlled drug count did not reconcile against the register.',
  ],
  injury_unexplained: [
    'Bruising noticed to the left forearm during personal care. No account of how it happened.',
    'Skin tear found on the right shin at the evening check.',
  ],
  behaviour: [
    'Became distressed in the dining room and pushed a chair over. No contact with anybody.',
    'Refused personal care and struck out at the carer. No injury.',
  ],
  absconding: [
    'Left through the garden door and was found at the end of the drive.',
    'Found in the car park. Returned inside without distress.',
  ],
  choking: ['Coughing and distress during lunch. Cleared after back blows.'],
  pressure_ulcer_acquired: [
    'Grade 2 pressure damage to the sacrum identified at the weekly skin check.',
    'Redness to the left heel that did not blanch, noted during personal care.',
  ],
  safeguarding_concern: [
    'Reported that money was missing from the room. Raised to the manager the same shift.',
    'Disclosed being spoken to sharply by a visitor.',
  ],
  equipment_failure: [
    'Hoist sling stitching found frayed during the morning check. Taken out of use.',
    'Bed rail would not lock. Bed swapped and maintenance called.',
  ],
  near_miss: [
    'Wet floor with no sign out. Noticed and made safe before anybody walked through it.',
    'Bed rail left down overnight. Found at the early check, nobody had moved.',
    'Medication trolley left unlocked for a few minutes in the corridor.',
  ],
}

const INJURY_REGIONS: Record<IncidentTypeId, BodyRegionId[]> = {
  fall_witnessed: ['hip_left', 'hip_right', 'knee_left', 'knee_right', 'elbow_left'],
  fall_unwitnessed: ['head', 'shoulder_right', 'hip_right', 'forearm_left'],
  medication_error: [],
  medication_stock_discrepancy: [],
  injury_unexplained: ['forearm_left', 'shin_right', 'upper_arm_right'],
  behaviour: [],
  absconding: [],
  choking: [],
  pressure_ulcer_acquired: ['sacrum', 'heel_left', 'heel_right'],
  safeguarding_concern: [],
  equipment_failure: [],
  near_miss: [],
}

const ROOT_CAUSES = [
  'Walking frame was out of reach at the time.',
  'Footwear was not fastened correctly.',
  'Call bell was within reach but not used.',
  'Night lighting in the room was not switched on.',
  'Staffing was one carer short on the late shift.',
]

const ACTIONS = [
  'Checked over by the senior on duty. Observations taken and recorded.',
  'GP contacted the same day and advice recorded in the care notes.',
  'Family informed the same shift.',
  'Equipment removed from use and replaced.',
]

const PREVENTIVE = [
  'Walking frame position added to the personal care routine.',
  'Night lighting to be left on. Added to the handover.',
  'Sensor mat in place beside the bed.',
  'Skin check moved to twice daily.',
]

const recorded = (value: string, by: StaffRef, at: Date) =>
  ({ kind: 'recorded', value, recordedBy: by, recordedAt: toIsoDateTime(at) }) as const

/** The domains and templates a type obliges somebody to re-check on closure. */
const REVIEW_TARGETS: Record<IncidentTypeId, PostIncidentReviewFlag['target'][]> = {
  fall_witnessed: [
    { kind: 'risk_assessment', templateId: 'falls' },
    { kind: 'care_plan_domain', domainId: 'mobility' },
  ],
  fall_unwitnessed: [
    { kind: 'risk_assessment', templateId: 'falls' },
    { kind: 'care_plan_domain', domainId: 'mobility' },
  ],
  medication_error: [{ kind: 'care_plan_domain', domainId: 'medication' }],
  medication_stock_discrepancy: [{ kind: 'care_plan_domain', domainId: 'medication' }],
  injury_unexplained: [{ kind: 'risk_assessment', templateId: 'pressure_ulcer' }],
  behaviour: [{ kind: 'care_plan_domain', domainId: 'cognitive' }],
  absconding: [{ kind: 'care_plan_domain', domainId: 'cognitive' }],
  choking: [
    { kind: 'risk_assessment', templateId: 'nutrition' },
    { kind: 'care_plan_domain', domainId: 'nutrition' },
  ],
  pressure_ulcer_acquired: [
    { kind: 'risk_assessment', templateId: 'pressure_ulcer' },
    { kind: 'care_plan_domain', domainId: 'personal_care' },
  ],
  safeguarding_concern: [{ kind: 'care_plan_domain', domainId: 'social_emotional' }],
  equipment_failure: [{ kind: 'risk_assessment', templateId: 'moving_handling' }],
  near_miss: [],
}

const IMMEDIATE_ACTIONS: Record<string, string> = {
  fall_witnessed:
    'Stayed with them on the floor and checked for pain before moving. Senior called.',
  fall_unwitnessed:
    'Did not move them. Checked responsiveness and called the senior on duty.',
  medication_error: 'Stopped, checked both charts against the MAR, told the senior.',
  medication_stock_discrepancy: 'Recounted with the witness and told the manager.',
  injury_unexplained: 'Cleaned and dressed the area. Body map completed.',
  behaviour: 'Gave them space, moved others away, stayed within sight.',
  absconding: 'Went after them and walked back with them. Told the senior.',
  choking: 'Back blows until it cleared. Stayed with them and monitored breathing.',
  pressure_ulcer_acquired: 'Repositioned, dressed the area and told the senior.',
  safeguarding_concern: 'Wrote down what was said and raised it to the manager.',
  equipment_failure: 'Took it out of use, labelled it and told maintenance.',
  near_miss: 'Made it safe straight away and told the senior.',
}

/**
 * What the reporter did and who they told.
 *
 * Both contact states reach every member across the set, and `not_required`
 * always carries a reason — a decision without one is indistinguishable from
 * an unmade call, which is the distinction the union exists for.
 */
function responseFor(
  type: IncidentTypeId,
  reporter: StaffRef,
  at: Date,
  roll: number,
): ImmediateResponse {
  const witnessed = type !== 'fall_unwitnessed' && type !== 'injury_unexplained'
  const serious = roll > 6

  return {
    immediateAction: IMMEDIATE_ACTIONS[type] ?? 'Made it safe and told the senior.',
    witnesses: witnessed
      ? {
          kind: 'witnessed',
          people: [rng.pick(carersAndSeniors).displayName],
          recordedBy: reporter,
        }
      : { kind: 'nobody_witnessed', recordedBy: reporter },
    gp:
      roll < 3
        ? { kind: 'not_yet' }
        : roll < 6
          ? {
              kind: 'not_required',
              reason: 'No injury and no change in condition.',
              recordedBy: reporter,
              recordedAt: toIsoDateTime(at),
            }
          : {
              kind: 'contacted',
              at: toIsoDateTime(after(at, 2)),
              by: reporter,
              outcome: 'Advice given: monitor and call back if anything changes.',
            },
    family:
      roll < 2
        ? { kind: 'not_yet' }
        : roll < 5
          ? {
              kind: 'not_required',
              // Points at the standing preference rather than duplicating it.
              reason: 'Family have asked not to be contacted out of hours.',
              recordedBy: reporter,
              recordedAt: toIsoDateTime(at),
            }
          : {
              kind: 'contacted',
              at: toIsoDateTime(after(at, 1)),
              by: reporter,
              outcome: 'Told what happened and what was done.',
            },
    emergencyServices: serious
      ? {
          kind: 'called',
          service: roll > 8 ? 'ambulance_999' : 'nhs_111',
          at: toIsoDateTime(after(at, 0.5)),
          by: reporter,
          outcome:
            roll > 8
              ? 'Ambulance attended and they were checked over here.'
              : 'Advised to monitor and call back if anything changes.',
        }
      : { kind: 'not_called' },
  }
}

const list: Incident[] = []
const rng = makeRandom(0x1c1d0000)

function locationFor(residentId: ResidentId, roll: number): IncidentLocation {
  const resident = residents.find((entry) => entry.id === residentId)
  if (roll < 5 && resident?.room.kind === 'recorded') {
    return { kind: 'resident_room', room: resident.room.value }
  }
  return { kind: 'communal', area: rng.pick(COMMUNAL_AREAS).id }
}

/**
 * Flags raised by closing an incident.
 *
 * Historical ones are **completed**, because 90 days in which no
 * post-incident review ever finished is a home that does not exist. The recent
 * ones are still awaiting, and whether they are overdue is derived from
 * `dueBy` rather than stored.
 */
function flagsFor(
  type: IncidentTypeId,
  closedAt: Date,
  by: StaffRef,
  completed: boolean,
): PostIncidentReviewFlag[] {
  return REVIEW_TARGETS[type].map((target) => ({
    target,
    raised: act(by, closedAt),
    /*
     * **A deadline is not an act, so it is not clamped to now.**
     *
     * This was `after(closedAt, 48)`, and `after` exists to stop a *signature*
     * landing in the future — correctly, because nobody can sign at a time
     * that has not happened. Applied to a deadline it did the opposite of its
     * job: every flag raised in the last 48 hours had its due time dragged
     * back to this instant, so the whole set read as overdue and
     * `FLAG_STILL_IN_TIME` was not still in time.
     *
     * The guard that should have caught it passed on the boundary — `dueBy <
     * now` is false when they are equal, so a flag with zero seconds left
     * counted as one somebody could still do on time. It is now asserted with
     * hours to spare rather than at the tie.
     */
    dueBy: toIsoDateTime(new Date(closedAt.getTime() + 48 * HOURS)),
    state: completed
      ? ({
          kind: 'completed' as const,
          completed: act(rng.pick(carersAndSeniors), after(closedAt, rng.int(2, 40))),
        } as const)
      : ({ kind: 'awaiting' as const } as const),
  }))
}

const emptyReview: ManagerReview = {
  rootCause: { kind: 'unrecorded' },
  actionsTaken: { kind: 'unrecorded' },
  preventiveMeasures: { kind: 'unrecorded' },
}

let sequence = 0
const nextId = (): IncidentId => {
  sequence += 1
  return `inc-${String(sequence).padStart(3, '0')}` as IncidentId
}

// ---------------------------------------------------------------------------
// The generated body of the log
// ---------------------------------------------------------------------------

// Thirty-four generated, plus eleven pinned, for the ~45 across 90 days §5.2
// asks for. The pinned ones are counted in deliberately: they are incidents in
// the home, not extras on top of it.
for (let index = 0; index < 34; index += 1) {
  const daysBack = rng.int(2, 89)
  const occurredAt = atTime(daysAgo(daysBack), rng.int(6, 22), rng.int(0, 59))
  /*
   * Shared out to match the resident population, and **decided by index rather
   * than by a coin**.
   *
   * A flat pick gave Ashgrove eleven of fifty-three. Weighting it by
   * probability gave nine of thirty-four, because a one-in-eight chance drawn
   * thirty-four times lands two and a half standard deviations out often
   * enough to matter — a fixture is generated once, so "usually about right"
   * is not a property it has.
   *
   * **The thin site is a fixture with a job**: it is where Insufficient
   * Evidence and thin-denominator behaviour get tested in Phase 12, and an
   * over-represented Ashgrove softens exactly the case it exists to make.
   */
  const atThinSite = index % 8 === 3
  const pool = residents.filter((person) =>
    atThinSite
      ? person.siteId === 'site-ashgrove-lodge'
      : person.siteId !== 'site-ashgrove-lodge',
  )
  const resident = rng.pick(pool)
  const type = rng.pick(TYPE_POOL)
  const reporter = rng.pick(carersAndSeniors)
  const reportedAt = after(occurredAt, rng.int(1, 3) / 4)

  /*
   * Most are acknowledged and closed, and the ones still moving are recent.
   *
   * **Every workflow state has to be reachable**, which the first version of
   * this generator did not manage: `closed = daysBack > 6 || chance(0.6)` left
   * `under_review` with no fixture at all and `open` with exactly one, so two
   * of the four states the log filters on rendered to nobody (§8).
   */
  const stage =
    daysBack > 12 ? 'closed' : rng.pick(['closed', 'closed', 'under_review', 'open'])
  const closed = stage === 'closed'
  const acknowledgedAt = after(reportedAt, rng.int(1, 6))
  const manager = rng.chance(0.6) ? staffOkonkwo : staffHalloran
  const reviewStartedAt = after(acknowledgedAt, rng.int(2, 20))
  const closedAt = after(reviewStartedAt, rng.int(6, 60))

  const regions = INJURY_REGIONS[type]
  const severity = rng.pick(SEVERITY_BY_TYPE[type])

  /*
   * A faulty hoist found during a check, or a trolley noticed before anybody
   * reached it, happened to nobody — and attaching it to whichever resident
   * was nearest would be a worse record than attaching it to none.
   *
   * A positive claim, carrying the name of whoever made it, so the screen can
   * say "no resident involved" rather than leave a reader to infer it from an
   * empty field.
   */
  const involvesNobody =
    (type === 'equipment_failure' || type === 'near_miss') && rng.chance(0.55)

  list.push({
    id: nextId(),
    siteId: resident.siteId,
    subject: involvesNobody
      ? { kind: 'no_resident_involved', recordedBy: reporter }
      : { kind: 'resident', residentId: resident.id },
    type,
    severity,
    occurredAt: toIsoDateTime(occurredAt),
    location: locationFor(resident.id, rng.int(0, 9)),
    description: rng.pick(DESCRIPTIONS[type]),
    reported: act(reporter, reportedAt),
    response: responseFor(type, reporter, reportedAt, rng.int(0, 9)),
    status: closed
      ? {
          kind: 'closed',
          acknowledged: act(manager, acknowledgedAt),
          reviewStarted: act(manager, reviewStartedAt),
          closed: act(manager, closedAt),
        }
      : stage === 'under_review'
        ? {
            kind: 'under_review',
            acknowledged: act(manager, acknowledgedAt),
            reviewStarted: act(manager, reviewStartedAt),
          }
        : { kind: 'open', acknowledged: act(manager, acknowledgedAt) },
    injuries:
      regions.length === 0
        ? { kind: 'no_injuries_found', recorded: act(reporter, reportedAt) }
        : {
            kind: 'marked',
            regions: [rng.pick(regions)],
            recorded: act(reporter, reportedAt),
          },
    review: closed
      ? {
          rootCause: recorded(rng.pick(ROOT_CAUSES), manager, closedAt),
          actionsTaken: recorded(rng.pick(ACTIONS), manager, closedAt),
          preventiveMeasures: recorded(rng.pick(PREVENTIVE), manager, closedAt),
        }
      : stage === 'under_review'
        ? {
            // Part-recorded, which is the ordinary state of a review in
            // progress and the one a screen written only against empty and
            // complete would never meet (§8).
            ...emptyReview,
            actionsTaken: recorded(rng.pick(ACTIONS), manager, reviewStartedAt),
          }
        : emptyReview,
    notification:
      severity === 'severe_harm' || type === 'safeguarding_concern'
        ? {
            kind: 'notified',
            decided: act(manager, after(closedAt, -2)),
            notified: act(staffOkonkwo, after(closedAt, -1)),
            reference: `CQC-${String(2000 + index)}`,
          }
        : closed
          ? {
              kind: 'not_required',
              decided: act(manager, closedAt),
              reason:
                'No harm requiring notification, and no allegation of abuse or neglect.',
            }
          : { kind: 'not_yet_decided' },
    reviewFlags: closed ? flagsFor(type, closedAt, manager, daysBack > 10) : [],
    origin: { kind: 'reported' },
  })
}

// ---------------------------------------------------------------------------
// The queue — four reported and never acknowledged
// ---------------------------------------------------------------------------

/**
 * The oldest unacknowledged incident, pinned.
 *
 * Held by identity so the guard asserts this one rather than counting, and
 * placed further back than the others so the log's ordering has something
 * unambiguous to put first.
 */
export const UNACKNOWLEDGED_INCIDENT = 'inc-901' as IncidentId

const unacknowledged: {
  id: IncidentId
  residentId: string
  type: IncidentTypeId
  severity: IncidentSeverityId
  daysBack: number
  hour: number
  reporter: StaffRef
}[] = [
  {
    id: UNACKNOWLEDGED_INCIDENT,
    residentId: GAP_RESIDENTS.noFallsAssessment,
    type: 'fall_unwitnessed',
    severity: 'moderate_harm',
    daysBack: 5,
    hour: 3,
    reporter: staffNwosu,
  },
  {
    id: 'inc-902' as IncidentId,
    residentId: GAP_RESIDENTS.admittedYesterday,
    type: 'near_miss',
    severity: 'no_harm',
    daysBack: 2,
    hour: 21,
    reporter: staffHalloran,
  },
  {
    id: 'inc-903' as IncidentId,
    residentId: GAP_RESIDENTS.staleCarePlanDomain,
    type: 'behaviour',
    severity: 'low_harm',
    daysBack: 1,
    hour: 14,
    reporter: staffNwosu,
  },
  {
    id: 'inc-904' as IncidentId,
    residentId: GAP_RESIDENTS.withdrawnPhotographyConsent,
    type: 'equipment_failure',
    severity: 'no_harm',
    daysBack: 1,
    hour: 8,
    reporter: staffHalloran,
  },
]

for (const entry of unacknowledged) {
  const resident = residents.find((person) => person.id === entry.residentId)
  if (!resident) continue
  const occurredAt = atTime(daysAgo(entry.daysBack), entry.hour, 20)
  const regions = INJURY_REGIONS[entry.type]

  list.push({
    id: entry.id,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: entry.type,
    severity: entry.severity,
    occurredAt: toIsoDateTime(occurredAt),
    location: locationFor(resident.id, 0),
    description: rng.pick(DESCRIPTIONS[entry.type]),
    reported: act(entry.reporter, after(occurredAt, 0.5)),
    response: responseFor(entry.type, entry.reporter, occurredAt, 4),
    // Nobody has picked it up. Not a milder "open" — open means somebody took
    // it on, and this is the state the log exists to surface.
    status: { kind: 'reported_not_acknowledged' },
    injuries:
      regions.length === 0
        ? { kind: 'no_injuries_found', recorded: act(entry.reporter, occurredAt) }
        : {
            kind: 'marked',
            regions: [regions[0]!],
            recorded: act(entry.reporter, occurredAt),
          },
    review: emptyReview,
    notification: { kind: 'not_yet_decided' },
    reviewFlags: [],
    origin: { kind: 'reported' },
  })
}

// ---------------------------------------------------------------------------
// The two states the body map and the location field exist for
// ---------------------------------------------------------------------------

/**
 * A fall reported with no injury check recorded at all.
 *
 * **The reason `InjuryMap` has three members and not an array.** "No injuries
 * found" is somebody having looked; this is nobody having looked, and an empty
 * list cannot tell the two apart. On an unwitnessed fall it is the more
 * serious of the two by some way.
 */
export const NO_INJURY_CHECK = 'inc-930' as IncidentId

/** And one where nobody recorded where it happened. */
export const NO_LOCATION_RECORDED = 'inc-931' as IncidentId

{
  const resident = residents.find(
    (person) => person.id === GAP_RESIDENTS.noResuscitationDecision,
  )!
  const occurredAt = atTime(daysAgo(3), 2, 15)
  list.push({
    id: NO_INJURY_CHECK,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: 'fall_unwitnessed',
    severity: 'moderate_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: {
      kind: 'resident_room',
      room:
        'room' in resident && resident.room.kind === 'recorded'
          ? resident.room.value
          : 'not recorded',
    },
    description:
      'Found on the bedroom floor at the night check. Unable to say what happened.',
    reported: act(staffNwosu, after(occurredAt, 0.5)),
    response: responseFor('fall_unwitnessed', staffNwosu, occurredAt, 9),
    status: { kind: 'open', acknowledged: act(staffHalloran, after(occurredAt, 4)) },
    // Nobody has completed the body map. Not "no injuries" — nobody looked.
    injuries: { kind: 'not_recorded' },
    review: emptyReview,
    notification: { kind: 'not_yet_decided' },
    reviewFlags: [],
    origin: { kind: 'reported' },
  })
}

{
  const resident = residents.find(
    (person) => person.id === GAP_RESIDENTS.flaggedAndCorrectionNote,
  )!
  const occurredAt = atTime(daysAgo(9), 16, 45)
  const closedAt = after(occurredAt, 50)
  list.push({
    id: NO_LOCATION_RECORDED,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: 'injury_unexplained',
    severity: 'low_harm',
    occurredAt: toIsoDateTime(occurredAt),
    // Never recorded, and it is the field the review needed most: an
    // unexplained injury with no place attached to it cannot be investigated.
    location: { kind: 'not_recorded' },
    description:
      'Bruising noticed to the left forearm during personal care. No account of how it happened.',
    reported: act(staffNwosu, after(occurredAt, 0.5)),
    response: responseFor('injury_unexplained', staffNwosu, occurredAt, 3),
    status: {
      kind: 'closed',
      acknowledged: act(staffOkonkwo, after(occurredAt, 3)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 22)),
      closed: act(staffOkonkwo, closedAt),
    },
    injuries: {
      kind: 'marked',
      regions: ['forearm_left'],
      recorded: act(staffNwosu, occurredAt),
    },
    review: {
      rootCause: { kind: 'unrecorded' },
      actionsTaken: recorded(
        'Body map completed and photographs taken with consent. Family informed.',
        staffOkonkwo,
        closedAt,
      ),
      preventiveMeasures: { kind: 'unrecorded' },
    },
    notification: {
      kind: 'not_required',
      decided: act(staffOkonkwo, closedAt),
      reason: 'No allegation of abuse and no harm requiring notification.',
    },
    reviewFlags: flagsFor('injury_unexplained', closedAt, staffOkonkwo, false),
    origin: { kind: 'reported' },
  })
}

/**
 * One incident under review, and one closed inside its 48 hours.
 *
 * **Pinned rather than left to the seed.** Both states were reachable only by
 * accident: `under_review` landed on exactly one incident and would have
 * vanished on a reseed, and an *awaiting* review flag that is **not yet
 * overdue** rendered to nobody at all — every flag in flight was already past
 * its deadline, so the screen could only ever show the late version of the
 * state. A generator that reaches a state one time in fifty is a generator
 * that will stop reaching it.
 */
export const UNDER_REVIEW_INCIDENT = 'inc-940' as IncidentId

/** Closed yesterday; its 48 hours have not run out. */
export const FLAG_STILL_IN_TIME = 'inc-941' as IncidentId

{
  const resident = residents.find(
    (person) => person.id === GAP_RESIDENTS.medicationOmissions,
  )!
  const occurredAt = atTime(daysAgo(6), 7, 30)
  list.push({
    id: UNDER_REVIEW_INCIDENT,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: 'medication_error',
    severity: 'low_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: { kind: 'communal', area: 'corridor' },
    description:
      'Morning dose signed for on the wrong chart. Both residents checked, no dose given twice.',
    reported: act(staffNwosu, after(occurredAt, 0.5)),
    response: responseFor('medication_error', staffNwosu, occurredAt, 1),
    status: {
      kind: 'under_review',
      acknowledged: act(staffOkonkwo, after(occurredAt, 2)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 26)),
    },
    injuries: { kind: 'no_injuries_found', recorded: act(staffNwosu, occurredAt) },
    // Part-recorded: the actions are in, the root cause is not. The ordinary
    // shape of a review in progress, and the one a screen written only against
    // empty and complete would never meet (§8).
    review: {
      rootCause: { kind: 'unrecorded' },
      actionsTaken: recorded(
        'Both charts checked against the MAR. No dose given twice. Senior informed.',
        staffOkonkwo,
        after(occurredAt, 26),
      ),
      preventiveMeasures: { kind: 'unrecorded' },
    },
    notification: { kind: 'not_yet_decided' },
    reviewFlags: [],
    origin: { kind: 'reported' },
  })
}

{
  const resident = residents.find((person) => person.id === GAP_RESIDENTS.dnarInPlace)!
  const occurredAt = atTime(daysAgo(1), 9, 10)
  const closedAt = after(occurredAt, 5)
  list.push({
    id: FLAG_STILL_IN_TIME,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: 'fall_witnessed',
    severity: 'no_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: { kind: 'communal', area: 'lounge' },
    description:
      'Lowered to the floor beside the armchair while being assisted to stand. No loss of consciousness.',
    reported: act(staffHalloran, after(occurredAt, 0.25)),
    response: responseFor('fall_witnessed', staffHalloran, occurredAt, 5),
    status: {
      kind: 'closed',
      acknowledged: act(staffOkonkwo, after(occurredAt, 1)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 2)),
      closed: act(staffOkonkwo, closedAt),
    },
    injuries: { kind: 'no_injuries_found', recorded: act(staffHalloran, occurredAt) },
    review: {
      rootCause: recorded(
        'Walking frame was out of reach at the time.',
        staffOkonkwo,
        closedAt,
      ),
      actionsTaken: recorded(
        'Checked over by the senior on duty. Observations taken and recorded.',
        staffOkonkwo,
        closedAt,
      ),
      preventiveMeasures: recorded(
        'Walking frame position added to the personal care routine.',
        staffOkonkwo,
        closedAt,
      ),
    },
    notification: {
      kind: 'not_required',
      decided: act(staffOkonkwo, closedAt),
      reason: 'No harm requiring notification, and no allegation of abuse or neglect.',
    },
    // Raised on closure and still inside its 48 hours — a review somebody owes
    // and can still do on time, which is a different thing to show than one
    // already missed.
    reviewFlags: flagsFor('fall_witnessed', closedAt, staffOkonkwo, false),
    origin: { kind: 'reported' },
  })
}

/**
 * The other half of awaiting: a review nobody did inside its 48 hours.
 *
 * **Pinned because it stopped existing once a real defect was fixed.** Every
 * flag's `dueBy` was being clamped to now, so the whole set read as overdue
 * and this state came free; with the clamp gone, the only naturally overdue
 * flag in the fixtures points at a risk assessment, and no care plan domain
 * owed a late review at all. The screen that says "it will still read as
 * closed late" had nothing to say it about.
 *
 * On the resident whose mobility plan is already two months past its own
 * review date, because that is what this actually looks like: a home that
 * closed an incident, flagged the plan, and did not go back to it.
 */
export const FLAG_REVIEW_OVERDUE = 'inc-942' as IncidentId

{
  const resident = residents.find(
    (person) => person.id === GAP_RESIDENTS.staleCarePlanDomain,
  )!
  const occurredAt = atTime(daysAgo(4), 16, 20)
  const closedAt = after(occurredAt, 6)
  list.push({
    id: FLAG_REVIEW_OVERDUE,
    siteId: resident.siteId,
    subject: { kind: 'resident', residentId: resident.id },
    type: 'fall_witnessed',
    severity: 'low_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: { kind: 'communal', area: 'dining_room' },
    description:
      'Sat down heavily onto the floor beside the table while reaching for a cup. Assisted up after checks.',
    reported: act(staffNwosu, after(occurredAt, 0.25)),
    response: responseFor('fall_witnessed', staffNwosu, occurredAt, 6),
    status: {
      kind: 'closed',
      acknowledged: act(staffOkonkwo, after(occurredAt, 1)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 3)),
      closed: act(staffOkonkwo, closedAt),
    },
    injuries: { kind: 'no_injuries_found', recorded: act(staffNwosu, occurredAt) },
    review: {
      rootCause: recorded(
        'Reached across the table rather than moving the chair round.',
        staffOkonkwo,
        closedAt,
      ),
      actionsTaken: recorded(
        'Checked for pain and bruising. Observations taken and recorded.',
        staffOkonkwo,
        closedAt,
      ),
      preventiveMeasures: recorded(
        'Chair to be turned towards the table before meals, not reached across.',
        staffOkonkwo,
        closedAt,
      ),
    },
    notification: {
      kind: 'not_required',
      decided: act(staffOkonkwo, closedAt),
      reason: 'No harm requiring notification, and no allegation of abuse or neglect.',
    },
    // Raised on closure four days ago and still awaiting. Past its 48 hours,
    // and it stays past them once somebody does it — lateness is derived from
    // the completion against the deadline, so the work cannot erase it.
    reviewFlags: flagsFor('fall_witnessed', closedAt, staffOkonkwo, false),
    origin: { kind: 'reported' },
  })
}

// ---------------------------------------------------------------------------
// PRD §5.3 — the two notification gaps
// ---------------------------------------------------------------------------

/** Closed, and nobody ever decided whether the CQC had to be told. */
export const CLOSED_WITHOUT_DECISION = 'inc-910' as IncidentId

/** Decided that notification was required, and never made it. */
export const REQUIRED_NEVER_NOTIFIED = 'inc-911' as IncidentId

const okafor = residents.find((person) => person.id === GAP_RESIDENTS.dnarInPlace)!
/**
 * The un-notified safeguarding concern sits at the **default** site.
 *
 * It was on a resident at Ashgrove, where the screen that surfaces it does not
 * look by default — a deliberate gap nobody meets in review is a gap that
 * might as well not be there. Ashgrove is thin so that thin-denominator
 * behaviour gets tested, not so that findings hide in it.
 */
const brennan = residents.find(
  (person) => person.id === GAP_RESIDENTS.staleCarePlanDomain,
)!

{
  const occurredAt = atTime(daysAgo(23), 19, 40)
  const closedAt = after(occurredAt, 70)
  list.push({
    id: CLOSED_WITHOUT_DECISION,
    siteId: okafor.siteId,
    subject: { kind: 'resident', residentId: okafor.id },
    type: 'choking',
    severity: 'moderate_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: { kind: 'communal', area: 'dining_room' },
    description:
      'Coughing and distress during the evening meal. Cleared after back blows. Seen by the GP the following morning.',
    reported: act(staffNwosu, after(occurredAt, 0.25)),
    response: responseFor('choking', staffNwosu, occurredAt, 9),
    status: {
      kind: 'closed',
      acknowledged: act(staffOkonkwo, after(occurredAt, 2)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 20)),
      closed: act(staffOkonkwo, closedAt),
    },
    injuries: { kind: 'no_injuries_found', recorded: act(staffNwosu, occurredAt) },
    review: {
      rootCause: recorded(
        'Meal was not modified to the consistency named in the care plan.',
        staffOkonkwo,
        closedAt,
      ),
      actionsTaken: recorded(
        'GP review the following morning. Kitchen informed the same evening.',
        staffOkonkwo,
        closedAt,
      ),
      preventiveMeasures: recorded(
        'Consistency requirement added to the kitchen board and to the handover.',
        staffOkonkwo,
        closedAt,
      ),
    },
    // Closed with the decision never taken. The incident is settled and the
    // regulatory question was never asked.
    notification: { kind: 'not_yet_decided' },
    reviewFlags: flagsFor('choking', closedAt, staffOkonkwo, true),
    origin: { kind: 'reported' },
  })
}

{
  const occurredAt = atTime(daysAgo(31), 11, 5)
  const closedAt = after(occurredAt, 96)
  list.push({
    id: REQUIRED_NEVER_NOTIFIED,
    siteId: brennan.siteId,
    subject: { kind: 'resident', residentId: brennan.id },
    type: 'safeguarding_concern',
    severity: 'moderate_harm',
    occurredAt: toIsoDateTime(occurredAt),
    location: { kind: 'communal', area: 'lounge' },
    description:
      'Reported that money was missing from the room after a visit. Raised to the manager the same shift.',
    // Records outlive access: the reporter has since been deactivated and the
    // record still carries their name (§5.3).
    reported: act(staffDeactivated, after(occurredAt, 0.5)),
    response: responseFor('safeguarding_concern', staffDeactivated, occurredAt, 7),
    status: {
      kind: 'closed',
      acknowledged: act(staffOkonkwo, after(occurredAt, 3)),
      reviewStarted: act(staffOkonkwo, after(occurredAt, 26)),
      closed: act(staffOkonkwo, closedAt),
    },
    injuries: {
      kind: 'no_injuries_found',
      recorded: act(staffDeactivated, occurredAt),
    },
    review: {
      rootCause: recorded(
        'Visitor access to the room was not supervised and no valuables record was held.',
        staffOkonkwo,
        closedAt,
      ),
      actionsTaken: recorded(
        'Local authority safeguarding team informed by telephone the same day.',
        staffOkonkwo,
        closedAt,
      ),
      // The gap that matters is the notification, not the review.
      preventiveMeasures: recorded(
        'Valuables record opened. Visitor policy reissued to all staff.',
        staffOkonkwo,
        closedAt,
      ),
    },
    /*
     * A duty accepted and never discharged.
     *
     * Different from `not_yet_decided` and worse: somebody looked at this,
     * concluded the CQC had to be told, and there is nothing in the record to
     * show that it happened. An obligation nobody can prove was met.
     */
    notification: {
      kind: 'required_not_yet_notified',
      decided: act(staffOkonkwo, after(occurredAt, 30)),
    },
    reviewFlags: flagsFor('safeguarding_concern', closedAt, staffOkonkwo, true),
    origin: { kind: 'reported' },
  })
}

// ---------------------------------------------------------------------------
// The controlled drug discrepancy, now a real incident
// ---------------------------------------------------------------------------

/**
 * The incident the register's discrepancy raises. PRD §6.4 → §6.5.
 *
 * It carries both figures, both signatories and the ledger reference, so the
 * register and the log point at each other rather than each holding half the
 * story.
 */
export const STOCK_DISCREPANCY_INCIDENT = 'inc-920' as IncidentId

const discrepancy = stockCounts.find(
  (count) => count.medicationId === OKAFOR_MORPHINE && hasStockDiscrepancy(count),
)

if (discrepancy && discrepancy.entry.kind === 'routine') {
  const countedAt = new Date(discrepancy.countedAt)
  list.push({
    id: STOCK_DISCREPANCY_INCIDENT,
    siteId: okafor.siteId,
    subject: { kind: 'resident', residentId: okafor.id },
    type: 'medication_stock_discrepancy',
    severity: 'no_harm',
    occurredAt: discrepancy.countedAt,
    location: { kind: 'communal', area: 'clinic_room' },
    description: `Controlled drug count did not reconcile. The register expected ${discrepancy.entry.expected} and ${discrepancy.counted} was counted.`,
    reported: act(discrepancy.countedBy, after(countedAt, 0.25)),
    response: responseFor(
      'medication_stock_discrepancy',
      discrepancy.countedBy,
      countedAt,
      0,
    ),
    status: {
      kind: 'open',
      acknowledged: act(staffOkonkwo, after(countedAt, 2)),
    },
    injuries: {
      kind: 'no_injuries_found',
      recorded: act(discrepancy.countedBy, countedAt),
    },
    // Open, and the root cause is genuinely not known yet. This is the state
    // the review screen exists to show as a gap rather than fill in.
    review: emptyReview,
    notification: { kind: 'not_yet_decided' },
    reviewFlags: [],
    origin: {
      kind: 'stock_count',
      medicationId: OKAFOR_MORPHINE,
      countedAt: discrepancy.countedAt,
      expected: discrepancy.entry.expected,
      counted: discrepancy.counted,
      countedBy: discrepancy.countedBy,
      witnessedBy: discrepancy.witnessedBy,
    },
  })
}

export const incidents: Incident[] = list.sort((a, b) =>
  b.occurredAt.localeCompare(a.occurredAt),
)

export function incidentsForSite(siteId: string): Incident[] {
  return incidents.filter((incident) => incident.siteId === siteId)
}

export function incidentsForResident(residentId: ResidentId): Incident[] {
  return incidents.filter((incident) => subjectResidentId(incident) === residentId)
}

export function incidentById(id: IncidentId): Incident | undefined {
  return incidents.find((incident) => incident.id === id)
}

/**
 * Whether a review flag is past its 48 hours.
 *
 * Derived against an instant the caller supplies, never stored and never read
 * off the wall clock in here — a fixture that computes "overdue" at module
 * load is right when it loads and wrong the next morning (§8).
 */
export function flagIsOverdue(flag: PostIncidentReviewFlag, now: IsoDateTime): boolean {
  return flag.state.kind === 'awaiting' && flag.dueBy < now
}

/** Every flag still awaiting a review, across the home. */
export function awaitingReviewFlags(
  siteId: string,
): { incident: Incident; flag: PostIncidentReviewFlag }[] {
  return incidentsForSite(siteId).flatMap((incident) =>
    incident.reviewFlags
      .filter((flag) => flag.state.kind === 'awaiting')
      .map((flag) => ({ incident, flag })),
  )
}

export const GAP_INCIDENT_IDS = {
  reportedNotAcknowledged: UNACKNOWLEDGED_INCIDENT,
  noInjuryCheckRecorded: NO_INJURY_CHECK,
  underReview: UNDER_REVIEW_INCIDENT,
  reviewFlagStillInTime: FLAG_STILL_IN_TIME,
  reviewFlagOverdue: FLAG_REVIEW_OVERDUE,
  noLocationRecorded: NO_LOCATION_RECORDED,
  closedWithoutNotificationDecision: CLOSED_WITHOUT_DECISION,
  notificationRequiredNeverMade: REQUIRED_NEVER_NOTIFIED,
  stockDiscrepancy: STOCK_DISCREPANCY_INCIDENT,
} as const

export { NOW }
