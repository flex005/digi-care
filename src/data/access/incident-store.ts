import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  FamilyTold,
  Incident,
  IncidentAct,
  IncidentEdited,
  IncidentEvidence,
  IncidentId,
  IncidentLocation,
  IncidentSeverityId,
  IncidentStatus,
  IncidentSubject,
  IncidentTypeId,
  IncidentUrgency,
  ImmediateResponse,
  InjuryMap,
  WitnessRecord,
  IsoDateTime,
  ManagerReview,
  SiteId,
  StaffRef,
} from '../types'

/**
 * Acknowledging an incident, and what the manager concluded. Phase 20.
 *
 * **The reporter's record and the manager's are two records by two people, and
 * this store never touches the first.** `ImmediateResponse.immediateAction` is
 * what the person who was there wrote at the time; `ManagerReview.actionsTaken`
 * is what somebody concluded later. The type has said so since Phase 4 and a
 * write path is where that quietly stops being true — one patch that spreads
 * over the whole incident, one helper that "fills in" a blank from the other
 * field, and the record now attributes one person's account to another.
 *
 * So the patch is typed to the manager's fields only. There is no way to reach
 * `response` from here, which is stronger than remembering not to.
 *
 * **Everything is in memory and nothing is merged into the fixtures.** The
 * overlay is applied at read time, the same shape `resident-store` uses.
 */

interface Edit {
  status?: IncidentStatus
  urgency?: IncidentUrgency
  review?: Partial<ManagerReview>
  familyTold?: FamilyTold
  correction?: ReporterCorrection
  edited?: IncidentEdited
}

/**
 * What an admin may change about the reporter's own account.
 *
 * **Its own patch type, deliberately kept apart from `Edit` above.** That one
 * is typed to the manager's fields so a review can never reach what the
 * reporter wrote — the protection this file's docblock describes, and it is
 * still intact for that path. This is a second, narrower door with its own
 * key: admin-gated, stamped, and unable to touch the manager's review.
 *
 * It overwrites in place and the original is not kept. That is a decision
 * taken knowingly against what this module otherwise protects; the reasoning
 * is in PROGRESS.md so it is findable rather than looking like an oversight.
 */
export interface ReporterCorrection {
  type: IncidentTypeId
  severity: IncidentSeverityId
  occurredAt: IsoDateTime
  location: IncidentLocation
  description: string
  immediateAction: string
  /**
   * The two observations a correction may also reach, both carrying the
   * correcting admin's name — see `sameInjuries`/`sameWitnesses` below for
   * why that name is only applied where the fact actually moved.
   *
   * **What a correction still cannot reach**, each for its own reason: the
   * resident it happened to, because changing the subject of a clinical
   * record is a different and graver act than fixing what it says (§2); the
   * evidence, because those are session-only object URLs with nothing to
   * re-attach; and the family decision, which `recordFamilyDecision` already
   * owns on the detail page. And still not `ManagerReview` — that wall is
   * what this type exists to hold.
   */
  injuries: InjuryMap
  witnesses: WitnessRecord
}

/**
 * Whether the correction says anything new about the body map / the witnesses.
 *
 * **A stamp is a claim that somebody observed something.** Re-stamping a
 * field the admin never touched would put their name on an observation they
 * did not make — the same defect as leaving the reporter's name on one they
 * did not make, pointed the other way. A correction to the description must
 * leave both of these exactly as the reporter wrote them, author included.
 *
 * Regions and names compare as **sets**: re-marking the same two regions in
 * the other order, or retyping the same two names swapped, is not a different
 * observation, and treating it as one would re-attribute the record for a
 * reordering nobody can see.
 */
const sameRegions = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000')

function sameInjuries(current: InjuryMap, next: InjuryMap): boolean {
  if (current.kind !== next.kind) return false
  if (current.kind === 'marked' && next.kind === 'marked')
    return sameRegions(current.regions, next.regions)
  return true
}

function sameWitnesses(current: WitnessRecord, next: WitnessRecord): boolean {
  if (current.kind !== next.kind) return false
  if (current.kind === 'witnessed' && next.kind === 'witnessed')
    return sameRegions(current.people, next.people)
  return true
}

const edits = new Map<IncidentId, Edit>()
let acknowledged = 0
let reviewed = 0
let closed = 0
let familyDecided = 0
let corrected = 0
let urgencyRaised = 0
let urgencyStoodDown = 0

/**
 * Incidents reported in this session.
 *
 * **The form had nowhere to put one until now.** `ReportIncidentRoute`
 * collected a complete, validated incident and its button did nothing: no
 * handler, no create path in this store, no test driving a submission. A whole
 * form handing everything it gathered to nothing, which is §8's "a field that
 * accepts input and hands it to nothing" at the size of a screen.
 *
 * In memory for the session like every other write here, and read through
 * `patchedIncidents` so the log, the dashboard count and the sidebar badge all
 * see a new one without any of them being told about this list.
 */
const reported: Incident[] = []

/**
 * Never reused, even though nothing removes a reported incident.
 *
 * A counter off `reported.length` is the family-access defect §8 records: name
 * two, remove one, name another, and the third carries an id the first still
 * holds. There is no removal here today and this costs nothing to be right
 * about.
 */
let minted = 0

const act = (by: StaffRef): IncidentAct => ({
  by,
  at: appNow().toISOString() as IsoDateTime,
})

/** The incident as it stands, fixtures plus whatever this session wrote. */
export function withIncidentEdits(incident: Incident): Incident {
  const edit = edits.get(incident.id)
  if (edit === undefined) return incident
  return {
    ...incident,
    status: edit.status ?? incident.status,
    // Not handled here at all until now, so an urgency written to this store
    // would have been dropped on the way back out.
    urgency: edit.urgency ?? incident.urgency,
    review: { ...incident.review, ...edit.review },
    familyTold: edit.familyTold ?? incident.familyTold,
    ...(edit.correction === undefined
      ? {}
      : {
          type: edit.correction.type,
          severity: edit.correction.severity,
          occurredAt: edit.correction.occurredAt,
          location: edit.correction.location,
          description: edit.correction.description,
          injuries: edit.correction.injuries,
          response: {
            ...incident.response,
            immediateAction: edit.correction.immediateAction,
            witnesses: edit.correction.witnesses,
          },
          edited: edit.edited ?? incident.edited,
        }),
  }
}

export const editedThisSession = (id: IncidentId): boolean => edits.has(id)

/** What the reporter gathered. The store stamps the rest. */
export interface IncidentReport {
  siteId: SiteId
  subject: IncidentSubject
  type: IncidentTypeId
  severity: IncidentSeverityId
  occurredAt: IsoDateTime
  location: IncidentLocation
  description: string
  response: ImmediateResponse
  injuries: InjuryMap
  evidence: IncidentEvidence[]
  urgency: IncidentUrgency
  familyTold: FamilyTold
}

/**
 * Reporting one, which is the act this module was missing.
 *
 * It arrives `reported_not_acknowledged` with nothing reviewed and nothing
 * decided, because that is what a new incident is: somebody wrote it down and
 * nobody has picked it up. Every later state is reached through the acts that
 * already exist.
 */
export function reportIncident(report: IncidentReport, by: StaffRef): Incident {
  minted += 1
  const incident: Incident = {
    ...report,
    id: `inc-session-${String(minted)}` as IncidentId,
    reported: act(by),
    status: { kind: 'reported_not_acknowledged' },
    review: {
      rootCause: { kind: 'unrecorded' },
      actionsTaken: { kind: 'unrecorded' },
      preventiveMeasures: { kind: 'unrecorded' },
    },
    notification: { kind: 'not_yet_decided' },
    reviewFlags: [],
    origin: { kind: 'reported' },
    edited: { kind: 'not_edited' },
  }
  reported.push(incident)
  return incident
}

/** Everything reported this session, for the read every screen goes through. */
export const reportedThisSession = (): Incident[] => [...reported]

function patch(id: IncidentId, next: Edit): void {
  edits.set(id, { ...edits.get(id), ...next })
}

/**
 * Somebody has picked this up.
 *
 * **It cannot be un-acknowledged**, which is why it is its own act rather than
 * a field somebody sets. A name against an incident is a person saying they
 * have it; taking that back is not an edit, it is a second fact, and this
 * build has no shape for one because no home has ever needed it.
 */
export function acknowledge(incident: Incident, by: StaffRef): IncidentStatus {
  if (incident.status.kind !== 'reported_not_acknowledged')
    throw new Error(
      `${incident.id} was acknowledged by ${incident.status.acknowledged.by.fullName}.`,
    )
  const status: IncidentStatus = { kind: 'open', acknowledged: act(by) }
  patch(incident.id, { status })
  acknowledged += 1
  return status
}

/** What the manager concluded, field by field, never as one form. */
export function recordReview(
  incident: Incident,
  fields: Partial<ManagerReview>,
  by: StaffRef,
): void {
  if (incident.status.kind === 'reported_not_acknowledged')
    throw new Error(`${incident.id} has not been acknowledged.`)
  patch(incident.id, {
    review: fields,
    status:
      incident.status.kind === 'open'
        ? {
            kind: 'under_review',
            acknowledged: incident.status.acknowledged,
            reviewStarted: act(by),
          }
        : undefined,
  })
  reviewed += 1
}

/**
 * Closing it, which two things have to be true for.
 *
 * **A decision about the CQC, and a root cause.** The first was already the
 * rule and the screen already said it: a decision either way is required, and
 * "not required" is a recorded judgement with a name on it. The second is this
 * phase's, and it is the same argument — an incident closed with no root cause
 * recorded is a home saying it is finished with something it never explained.
 *
 * Both are checked here rather than only on the screen, because a rule that
 * lives in a form is a rule the next form forgets.
 */
export function close(
  incident: Incident,
  by: StaffRef,
  notificationDecided: boolean,
): IncidentStatus {
  if (incident.status.kind !== 'under_review')
    throw new Error(
      `${incident.id} is ${incident.status.kind}. Closing runs through a review: the order is what the status union holds.`,
    )
  if (!notificationDecided)
    throw new Error(
      `Nobody has recorded whether ${incident.id} must be notified to the CQC, and it cannot close without a decision.`,
    )
  if (incident.review.rootCause.kind !== 'recorded')
    throw new Error(`${incident.id} has no root cause recorded.`)

  const status: IncidentStatus = {
    kind: 'closed',
    acknowledged: incident.status.acknowledged,
    reviewStarted: incident.status.reviewStarted,
    closed: act(by),
  }
  patch(incident.id, { status })
  closed += 1
  return status
}

/**
 * Whether the family should be told, decided by whoever decided it last.
 *
 * Deciding is not telling, and the screen says the rest. Changeable after the
 * report because the reporter decided with what they knew at the time.
 */
export function recordFamilyDecision(
  incident: Incident,
  decision: { kind: 'should' } | { kind: 'not'; reason: string },
  by: StaffRef,
): void {
  patch(incident.id, {
    familyTold:
      decision.kind === 'should'
        ? { kind: 'should_be_told', decided: act(by) }
        : { kind: 'not_to_be_told', decided: act(by), reason: decision.reason },
  })
  familyDecided += 1
}

/**
 * Saying an incident needs attention now, after it was filed.
 *
 * **Raising and rewording are the same call and different records.** A first
 * raise stamps `raised` and `worded` with the same act. A reword keeps
 * `raised` exactly as it was and moves `worded` only, which is why the union
 * carries two acts: with one, rewording had to choose between recording who
 * first raised it and who stands behind the words that are there now, and it
 * also reset the only timestamp there was — an urgency raised six hours ago
 * and reworded a minute ago read as a minute old.
 *
 * **It will not re-raise something already stood down.** The union holds one
 * raise and one stand-down, not a chain, so raising again would overwrite the
 * stand-down and erase a judgement somebody recorded — the thing this whole
 * member exists to avoid. Refused here rather than in the screen, because a
 * rule that lives in a form is a rule the next form forgets.
 */
export function raiseUrgency(incident: Incident, because: string, by: StaffRef): void {
  if (because.trim() === '')
    throw new Error('Saying an incident is urgent means saying why.')
  if (incident.urgency.kind === 'stood_down')
    throw new Error(
      'This was stood down, and raising it again would erase who stood it down and why.',
    )

  const now = act(by)
  patch(incident.id, {
    urgency: {
      kind: 'needs_attention_now',
      // The original raise survives a reword. Only the wording is re-stamped.
      raised:
        incident.urgency.kind === 'needs_attention_now' ? incident.urgency.raised : now,
      because: because.trim(),
      worded: now,
    },
  })
  urgencyRaised += 1
}

/**
 * Answering a raise rather than deleting it.
 *
 * The record keeps `raised` and `because` in full and adds who stood it down
 * and why beside them, so it says "Amara raised this because X, Chidi stood
 * it down because Y" rather than losing the first half. That is what makes
 * standing down safe where returning to `ordinary` was not: `ordinary` means
 * nobody raised it, and it still does.
 *
 * **Stricter than raising**, because this overrules somebody else's clinical
 * judgement — the screen asks `canApproveIn('/incidents')` where raising asks
 * `canRecordIn`.
 */
export function standDownUrgency(incident: Incident, why: string, by: StaffRef): void {
  if (why.trim() === '') throw new Error('Standing down an urgency means saying why.')
  if (incident.urgency.kind !== 'needs_attention_now')
    throw new Error('Nothing has been raised on this incident to stand down.')

  patch(incident.id, {
    urgency: {
      kind: 'stood_down',
      raised: incident.urgency.raised,
      because: incident.urgency.because,
      stoodDown: act(by),
      why: why.trim(),
    },
  })
  urgencyStoodDown += 1
}

/**
 * An admin correcting the reporter's own account, in place.
 *
 * **The original is not kept, and that is the decision rather than an
 * oversight.** Every other write here adds a record beside what was there; this
 * one overwrites. What cannot be optional is the stamp — a record changed with
 * no trace of who touched it would be worse than one nobody could change.
 */
export function correctReport(
  incident: Incident,
  correction: ReporterCorrection,
  by: StaffRef,
): void {
  if (correction.description.trim() === '')
    throw new Error('An incident cannot be left with no account of what happened.')
  if (correction.immediateAction.trim() === '')
    throw new Error('An incident cannot be left with no account of what was done.')
  patch(incident.id, {
    correction: {
      ...correction,
      description: correction.description.trim(),
      immediateAction: correction.immediateAction.trim(),
      /*
       * The *existing* record where the fact has not moved, so its original
       * author and time survive a correction that was about something else.
       */
      injuries: sameInjuries(incident.injuries, correction.injuries)
        ? incident.injuries
        : correction.injuries,
      witnesses: sameWitnesses(incident.response.witnesses, correction.witnesses)
        ? incident.response.witnesses
        : correction.witnesses,
    },
    edited: { kind: 'edited', edited: act(by) },
  })
  corrected += 1
}

export function incidentHoldings(): SessionHolding[] {
  return [
    ...held('incidents you reported', reported.length),
    ...held('incidents you acknowledged', acknowledged),
    ...held('review findings you recorded', reviewed),
    ...held('incidents you closed', closed),
    ...held('family decisions you recorded', familyDecided),
    ...held('reports you corrected', corrected),
    ...held('incidents you marked urgent', urgencyRaised),
    ...held('urgencies you stood down', urgencyStoodDown),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionIncidents(): void {
  edits.clear()
  reported.length = 0
  minted = 0
  acknowledged = 0
  reviewed = 0
  closed = 0
  familyDecided = 0
  corrected = 0
  urgencyRaised = 0
  urgencyStoodDown = 0
}
