import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  Incident,
  IncidentAct,
  IncidentId,
  IncidentStatus,
  IsoDateTime,
  ManagerReview,
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
  review?: Partial<ManagerReview>
}

const edits = new Map<IncidentId, Edit>()
let acknowledged = 0
let reviewed = 0
let closed = 0

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
    review: { ...incident.review, ...edit.review },
  }
}

export const editedThisSession = (id: IncidentId): boolean => edits.has(id)

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
      `${incident.id} was acknowledged by ${incident.status.acknowledged.by.fullName}. A second acknowledgement would overwrite the first, and who picked it up is the fact the log exists for.`,
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
    throw new Error(
      `${incident.id} has not been acknowledged. A review with nobody's name against the incident is a conclusion from nobody.`,
    )
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
      `Nobody has recorded whether ${incident.id} must be notified to the CQC. A decision either way is required before it closes, and "not required" is a judgement with a name on it.`,
    )
  if (incident.review.rootCause.kind !== 'recorded')
    throw new Error(
      `${incident.id} has no root cause recorded. Closing it would be the home saying it is finished with something it never explained.`,
    )

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

export function incidentHoldings(): SessionHolding[] {
  return [
    ...held('incidents you acknowledged', acknowledged),
    ...held('review findings you recorded', reviewed),
    ...held('incidents you closed', closed),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionIncidents(): void {
  edits.clear()
  acknowledged = 0
  reviewed = 0
  closed = 0
}
