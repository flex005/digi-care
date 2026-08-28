import type { Activity, IsoDateTime } from '@/data/types'
import { assertNever } from '@/lib/assert-never'

/**
 * What state a session is in, derived. PRD §6.7, Phase 9.
 *
 * **Four states, and only one is a gap.** That distinction is the module:
 *
 *  - `planned` — it has not happened yet. Nobody has failed to record
 *    anything, so it takes a dashed purple border rather than the hatch.
 *    Planned is not a gap.
 *  - `unrecorded` — it happened and nobody wrote up a single person. The
 *    hatch, and the lead finding.
 *  - `partly_recorded` — some answered, some not. Caution: there is work left
 *    and somebody can still do it.
 *  - `fully_recorded` — every invited resident has an answer. Quiet, because
 *    recorded and unremarkable renders quietly (§3b) and a week of green would
 *    drown the sessions that are the reason to open this screen.
 *
 * Nothing here is stored. A session's state is arithmetic over its invitation
 * list and the clock, and a stored one would be right when it was written.
 */
export type SessionState =
  | { kind: 'planned'; invited: number }
  | { kind: 'unrecorded'; invited: number }
  | { kind: 'partly_recorded'; recorded: number; invited: number }
  | { kind: 'fully_recorded'; attended: number; invited: number }

export function sessionState(activity: Activity, now: IsoDateTime): SessionState {
  const invited = activity.invited.length
  if (activity.startsAt > now) return { kind: 'planned', invited }

  const recorded = activity.invited.filter(
    (entry) => entry.attendance.kind !== 'not_recorded',
  ).length

  if (recorded === 0) return { kind: 'unrecorded', invited }
  if (recorded < invited) return { kind: 'partly_recorded', recorded, invited }

  return {
    kind: 'fully_recorded',
    attended: activity.invited.filter((entry) => entry.attendance.kind === 'attended')
      .length,
    invited,
  }
}

/**
 * The four figures a session reports, every one over the invitation list.
 *
 * **The denominator is who was invited, never who came.** Counting attendees
 * would make a session nobody came to read the same as a session nobody wrote
 * up — and those are the two things this module exists to tell apart.
 *
 * `joined` sits outside the four deliberately: somebody who was not invited is
 * not part of a denominator built from the invitation list, and folding them
 * in would make the figures describe a plan that was never made.
 */
export interface Tally {
  invited: number
  attended: number
  didNotAttend: number
  notRecorded: number
  joined: number
}

export function tally(activity: Activity): Tally {
  let attended = 0
  let didNotAttend = 0
  let notRecorded = 0

  for (const entry of activity.invited) {
    switch (entry.attendance.kind) {
      case 'attended':
        attended += 1
        break
      case 'did_not_attend':
        didNotAttend += 1
        break
      case 'not_recorded':
        notRecorded += 1
        break
      default:
        assertNever(entry.attendance)
    }
  }

  return {
    invited: activity.invited.length,
    attended,
    didNotAttend,
    notRecorded,
    joined: activity.joined.length,
  }
}

/** The sessions that happened and nobody wrote up. The lead finding. */
export function unrecordedSessions(
  activities: Activity[],
  now: IsoDateTime,
): Activity[] {
  return activities.filter(
    (activity) => sessionState(activity, now).kind === 'unrecorded',
  )
}
