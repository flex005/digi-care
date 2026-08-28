import { held, type SessionHolding } from './session-holding'
import type { IncidentAct, IncidentId, NotificationDecision, StaffRef } from '../types'
import { now } from '../fixtures/clock'

/**
 * Whether the CQC has to be told, decided in this session. PRD §6.5.
 *
 * **A decision is required either way, and "not required" is one of them.**
 * The incident screen offered three buttons and none of them did anything, so
 * a duty the whole panel exists to track could be read, judged and then not
 * recorded: the screen said "nobody has decided either way" whatever anybody
 * clicked.
 *
 * Every member carries who decided and when, because a regulatory decision
 * with no name against it is a note rather than a record. "Not required" also
 * carries its reason, which is the whole difference between a judgement and a
 * blank.
 *
 * In memory and nowhere else, like every other write in this build.
 */
const decisions = new Map<IncidentId, NotificationDecision>()

/** What this store would lose. */
export function notificationHoldings(): SessionHolding[] {
  return held('CQC notification decisions you made', decisions.size)
}

/** Emptied on sign out, and by tests. */
export function resetSessionNotifications(): void {
  decisions.clear()
}

const act = (by: StaffRef): IncidentAct => ({
  by,
  at: now().toISOString() as IncidentAct['at'],
})

/** The CQC must be told, and nobody has told them yet. */
export function decideRequired(id: IncidentId, by: StaffRef): NotificationDecision {
  const decision: NotificationDecision = {
    kind: 'required_not_yet_notified',
    decided: act(by),
  }
  decisions.set(id, decision)
  return decision
}

/**
 * The CQC does not need to be told, and here is why.
 *
 * The reason is required by the type and by this function: a "not required"
 * with no reason is indistinguishable from nobody having thought about it,
 * which is the one thing the undecided state exists to be.
 */
export function decideNotRequired(
  id: IncidentId,
  reason: string,
  by: StaffRef,
): NotificationDecision {
  if (reason.trim() === '') {
    throw new Error('A notification decision of "not required" has to say why.')
  }
  const decision: NotificationDecision = {
    kind: 'not_required',
    decided: act(by),
    reason: reason.trim(),
  }
  decisions.set(id, decision)
  return decision
}

/** Told, with the CQC's own reference so somebody can find it again. */
export function recordNotified(
  id: IncidentId,
  reference: string,
  by: StaffRef,
  decided: IncidentAct,
): NotificationDecision {
  if (reference.trim() === '') {
    throw new Error('A notification has to carry the reference the CQC gave it.')
  }
  const decision: NotificationDecision = {
    kind: 'notified',
    decided,
    notified: act(by),
    reference: reference.trim(),
  }
  decisions.set(id, decision)
  return decision
}

/** The decision taken this session, if one was. */
export const decisionFor = (id: IncidentId): NotificationDecision | undefined =>
  decisions.get(id)

export const decidedThisSession = (): number => decisions.size
