import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import { activities as fixtureActivities } from '@/data/fixtures/activities'
import type {
  Activity,
  ActivityId,
  ActivityStanding,
  IsoDateTime,
  SiteId,
  StaffRef,
} from '../types'

/**
 * Planning, changing and cancelling a session. AM v2.0 ACT-01, Phase 20.
 *
 * **Cancelling never removes an attendance record**, and that is the whole of
 * the design here. AM v2.0 says a confirmation asks before removing partially
 * recorded attendance; this build does not remove it and the confirmation says
 * what stays instead. Somebody wrote that a resident came, with their name and
 * the time on it, and a later decision about the session does not make that
 * untrue — a cancellation that discarded them would be a record editing
 * itself, which is the shape consent withdrawal refused for the same reason.
 *
 * So `cancel` writes a standing beside the record and touches neither
 * `invited` nor `joined`. There is no code path from here to either.
 *
 * **Edits are field by field on a session, never a re-save of the whole
 * thing.** A session edited by replacing it loses whoever planned it and when,
 * which is the attribution every record in this build carries.
 */

interface Edit {
  name?: string
  place?: string
  startsAt?: IsoDateTime
  endsAt?: IsoDateTime
  standing?: ActivityStanding
}

const edits = new Map<ActivityId, Edit>()
const added: Activity[] = []
let planned = 0
let changed = 0
let cancelled = 0

/** The session as it stands: fixture, plus whatever this session wrote. */
export function withActivityEdits(activity: Activity): Activity {
  const edit = edits.get(activity.id)
  if (edit === undefined) return activity
  return {
    ...activity,
    name: edit.name ?? activity.name,
    place: edit.place ?? activity.place,
    startsAt: edit.startsAt ?? activity.startsAt,
    endsAt: edit.endsAt ?? activity.endsAt,
    standing: edit.standing ?? activity.standing,
  }
}

/** Every session at a site, the fixtures' and this session's, as they stand. */
export function activitiesAt(siteId: SiteId): Activity[] {
  return [...fixtureActivities, ...added]
    .filter((activity) => activity.siteId === siteId)
    .map(withActivityEdits)
}

export const addedThisSession = (id: ActivityId): boolean =>
  added.some((activity) => activity.id === id)

export const changedThisSession = (id: ActivityId): boolean => edits.has(id)

/**
 * A new session.
 *
 * **Invited is the denominator and it is asked for here**, because a session
 * planned for nobody makes every figure about it meaningless: "0 of 0 came"
 * and "nobody was asked" are different facts and the first reads as the
 * second. The form gates on at least one.
 */
export function planSession(input: {
  siteId: SiteId
  name: string
  description: string
  place: string
  startsAt: IsoDateTime
  endsAt: IsoDateTime
  residentIds: string[]
  by: StaffRef
}): Activity {
  if (input.residentIds.length === 0)
    throw new Error(
      'A session with nobody invited has no denominator: every figure about it would divide by nobody, and "nobody came" would be indistinguishable from "nobody was asked".',
    )

  const activity: Activity = {
    id: `act-session-${String(added.length + 1).padStart(3, '0')}` as ActivityId,
    standing: { kind: 'planned' },
    siteId: input.siteId,
    name: input.name,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    place: input.place,
    plannedBy: input.by,
    plannedAt: appNow().toISOString() as IsoDateTime,
    invited: input.residentIds.map((residentId) => ({
      residentId: residentId as Activity['invited'][number]['residentId'],
      attendance: { kind: 'not_recorded' },
    })),
    joined: [],
  }
  added.push(activity)
  planned += 1
  return activity
}

/** Change what a session is or where it is. Never who planned it. */
export function editSession(id: ActivityId, fields: Omit<Edit, 'standing'>): void {
  edits.set(id, { ...edits.get(id), ...fields })
  changed += 1
}

/**
 * Call it off, with a reason, keeping everything already recorded.
 *
 * Refuses an empty reason rather than storing one: a cancelled session whose
 * reason is blank is a decision with nobody's account of it, and the screen
 * would render a gap nobody can close because the moment has passed.
 */
export function cancelSession(
  activity: Activity,
  reason: string,
  by: StaffRef,
): ActivityStanding {
  if (reason.trim() === '')
    throw new Error(
      'A cancellation carries a reason. Without one the record says a session did not happen and nothing about why, which is the question anybody reading it back has.',
    )
  if (activity.standing.kind === 'cancelled')
    throw new Error(
      `${activity.name} was already cancelled by ${activity.standing.by.fullName}. A second cancellation would overwrite the first reason.`,
    )

  const standing: ActivityStanding = {
    kind: 'cancelled',
    reason: reason.trim(),
    by,
    at: appNow().toISOString() as IsoDateTime,
  }
  edits.set(activity.id, { ...edits.get(activity.id), standing })
  cancelled += 1
  return standing
}

export function activityHoldings(): SessionHolding[] {
  return [
    ...held('sessions you planned', planned),
    ...held('sessions you changed', changed),
    ...held('sessions you cancelled', cancelled),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionActivities(): void {
  edits.clear()
  added.length = 0
  planned = 0
  changed = 0
  cancelled = 0
}
