import { held, type SessionHolding } from './session-holding'
import { decisionFor } from './notification-store'
import type {
  CarePlanDomainId,
  Incident,
  IncidentId,
  IsoDateTime,
  PostIncidentReviewFlag,
  PostIncidentReviewTarget,
  ResidentId,
  RiskTemplateId,
  StaffRef,
} from '../types'
import { subjectResidentId } from '../types'
import { incidents as fixtureIncidents } from '../fixtures/incidents'

/**
 * Post-incident review flags cleared during this session. PRD §6.5, §6.6.
 *
 * **The only write in this build that discharges an obligation rather than
 * creating a record.** A care note is written, a dose is signed for, a
 * handover is signed — each of those adds something. This one settles a claim
 * another screen is already making: the incident detail says two reviews are
 * owed, and if a re-score cannot clear them that screen stays wrong. An
 * obligation that has been met still rendering as outstanding is the invariant
 * failing in the mirror.
 *
 * Same discipline as `mar-store` and `note-store`: in memory, never touching
 * the fixtures, gone on reload — and the confirmation says so.
 */

/**
 * What was flagged, as one string.
 *
 * A flag points at a risk assessment **or** a care plan domain, and the two
 * are cleared by different work — a re-score in Phase 5, a finalised domain
 * review in Phase 6. One store handles both rather than a second mechanism
 * appearing alongside it: they are the same obligation with different work
 * behind them, and two stores would mean two undo behaviours and two ways for
 * lateness to be lost.
 */
export type ClearableTarget =
  | { kind: 'risk_assessment'; templateId: RiskTemplateId }
  | { kind: 'care_plan_domain'; domainId: CarePlanDomainId }

const targetId = (target: ClearableTarget | PostIncidentReviewTarget) =>
  target.kind === 'risk_assessment' ? target.templateId : target.domainId

/** One clearing, keyed by the incident and the thing that was flagged. */
const key = (
  incidentId: IncidentId,
  target: ClearableTarget | PostIncidentReviewTarget,
) => `${incidentId}|${target.kind}|${targetId(target)}`

interface Clearing {
  incidentId: IncidentId
  target: ClearableTarget
  by: StaffRef
  at: IsoDateTime
}

const cleared = new Map<string, Clearing>()

/**
 * What one act of clearing touched, so it can be undone as one act.
 *
 * A re-score that closed two reviews has to undo both — undoing half would
 * leave the record saying a review was done that was not.
 */
export interface ClearingToken {
  id: string
  keys: string[]
}

let sequence = 0

/**
 * Clears every open flag for this resident and template.
 *
 * All of them together, not just the oldest: two incidents that both flagged
 * falls recorded the same obligation twice, and leaving one open would ask for
 * the same work again.
 */
export function clearReviewFlags(input: {
  residentId: ResidentId
  target: ClearableTarget
  by: StaffRef
  at: IsoDateTime
}): ClearingToken {
  const keys: string[] = []

  for (const incident of fixtureIncidents) {
    if (subjectResidentId(incident) !== input.residentId) continue

    for (const flag of incident.reviewFlags) {
      if (flag.target.kind !== input.target.kind) continue
      if (targetId(flag.target) !== targetId(input.target)) continue
      // Only what is genuinely open. Re-clearing a completed flag would
      // overwrite whoever actually did the work.
      if (flag.state.kind !== 'awaiting') continue
      if (cleared.has(key(incident.id, input.target))) continue

      cleared.set(key(incident.id, input.target), {
        incidentId: incident.id,
        target: input.target,
        by: input.by,
        at: input.at,
      })
      keys.push(key(incident.id, input.target))
    }
  }

  sequence += 1
  return { id: `clearing-${sequence}`, keys }
}

/**
 * Puts them back.
 *
 * Undoable within the session for the same reason marking a note reviewed is:
 * there is no backend to correct a mis-click, and **this one closes a clinical
 * obligation rather than recording an observation** — the cost of getting it
 * wrong falls on whoever later believes the review happened.
 */
export function undoClearing(token: ClearingToken): void {
  for (const entry of token.keys) cleared.delete(entry)
}

/** Every incident, with this session's clearings applied. */
export function patchedIncidents(): Incident[] {
  /*
   * Read through this session's notification decisions as well as its cleared
   * flags. A decision recorded on the incident screen that the next read did
   * not see would leave the screen saying nobody had decided, immediately
   * after somebody did.
   */
  const withDecisions = fixtureIncidents.map((incident) => {
    const decision = decisionFor(incident.id)
    return decision === undefined ? incident : { ...incident, notification: decision }
  })

  if (cleared.size === 0) return withDecisions

  return withDecisions.map((incident) => {
    const touched = incident.reviewFlags.some((flag) =>
      cleared.has(key(incident.id, flag.target)),
    )
    if (!touched) return incident

    return {
      ...incident,
      reviewFlags: incident.reviewFlags.map((flag) => patch(incident.id, flag)),
    }
  })
}

function patch(
  incidentId: IncidentId,
  flag: PostIncidentReviewFlag,
): PostIncidentReviewFlag {
  const entry = cleared.get(key(incidentId, flag.target))
  if (!entry || flag.state.kind !== 'awaiting') return flag

  /*
   * `dueBy` is carried through untouched, and nothing records "this was late".
   *
   * Lateness is derived from `completed.at > dueBy` at the point of reading,
   * so it stays true rather than being true until somebody does the work.
   * Storing a flag would have been storing the shadow of a fact rather than
   * the fact — and the shadow is what an overwrite loses.
   */
  return {
    ...flag,
    state: { kind: 'completed', completed: { by: entry.by, at: entry.at } },
  }
}

/** Test hook. Nothing in the app calls this. */
/** What this store would lose. */
export function reviewFlagHoldings(): SessionHolding[] {
  return held('post-incident review flags you closed', cleared.size)
}

export function resetSessionReviewFlags(): void {
  cleared.clear()
  sequence = 0
}
