import type {
  Activity,
  ActivityId,
  AttendanceState,
  DidNotAttendReasonId,
  Invitation,
  Joiner,
  ResidentId,
  SiteId,
} from '../types'
import { carersAndSeniors, sites } from './organisation'
import { residents } from './residents'
import { atTime, daysAgo, daysAhead, makeRandom, toIsoDateTime } from './generate'

/**
 * Activities and who came. PRD §6.7, Phase 9.
 *
 * Its own random stream, seeded independently, so adding a session cannot move
 * a care note or a medication round.
 *
 * **The spread is invented and named**, like every other proportion nobody has
 * reviewed yet. What it has to produce is all four session states — a session
 * nobody wrote up is the lead finding, and one that never occurs makes the
 * screen unreviewable.
 */

const rng = makeRandom(0xac21f000)

/** Of sessions that have happened, how many nobody wrote up at all. */
const UNRECORDED = 0.28
/** Of the rest, how many were only partly recorded. */
const PARTLY = 0.3
/** Of an invitation list, roughly how many actually came. */
const ATTENDED = 0.72
/** How often somebody wandered in who was not invited. */
const HAS_JOINER = 0.22

const CATALOGUE: { name: string; place: string; description: string; hour: number }[] =
  [
    {
      name: 'Knitting group',
      place: 'Craft room',
      description:
        'Knitting and crochet in the craft room. Wool and needles provided. Tea at 15:00.',
      hour: 14,
    },
    {
      name: 'Chair exercises',
      place: 'Main lounge',
      description:
        'Seated exercises to music, half an hour, everybody at their own pace.',
      hour: 10,
    },
    {
      name: 'Music and memories',
      place: 'Main lounge',
      description: 'Songs from the forties and fifties, with the words printed large.',
      hour: 14,
    },
    {
      name: 'Gardening club',
      place: 'Garden',
      description:
        'Potting and weeding in the raised beds. Gloves and stools provided.',
      hour: 11,
    },
    {
      name: 'Film afternoon',
      place: 'Main lounge',
      description: 'A film chosen by vote the week before, with subtitles on.',
      hour: 15,
    },
    {
      name: 'Quiz',
      place: 'Dining room',
      description: 'Teams of four, questions read aloud twice, no writing needed.',
      hour: 14,
    },
    {
      name: 'Church service',
      place: 'Quiet lounge',
      description:
        'A short service led by the visiting chaplain. All denominations welcome.',
      hour: 10,
    },
    {
      name: 'Family visiting tea',
      place: 'Main lounge',
      description: 'Tea and cake with family, in the lounge rather than in rooms.',
      hour: 15,
    },
    {
      name: 'Hairdresser',
      place: 'Salon',
      description: 'The visiting hairdresser. Appointments booked in advance.',
      hour: 9,
    },
  ]

const DECLINE_NOTES: Record<DidNotAttendReasonId, string[]> = {
  declined: ['Said she was tired.', 'Said he would rather stay in his room.'],
  unwell: ['Chesty and stayed in bed.', 'Not feeling well after lunch.'],
  off_site: ['At a hospital appointment.', 'Out with family for the afternoon.'],
  asleep: ['Asleep in the chair and we left her.', 'Still asleep at the start.'],
  other: ['Physiotherapist arrived at the same time.', 'Waiting for a phone call.'],
}

const JOINER_NOTES = [
  'Came in from the lounge and stayed.',
  'Heard the music and joined halfway through.',
  'Walked past, was invited in and sat down.',
]

/** Somebody who did not come, with a reason. A recorded negative needs one. */
function didNotAttend(at: Date): AttendanceState {
  const reason = rng.pick(DID_NOT_ATTEND_REASON_IDS)
  return {
    kind: 'did_not_attend',
    reason,
    note: rng.pick(DECLINE_NOTES[reason]),
    recordedBy: rng.pick(carersAndSeniors),
    recordedAt: toIsoDateTime(at),
  }
}

const DID_NOT_ATTEND_REASON_IDS: DidNotAttendReasonId[] = [
  'declined',
  'unwell',
  'off_site',
  'asleep',
  'other',
]

const list: Activity[] = []
let sequence = 0

for (const site of sites) {
  const here = residents.filter((resident) => resident.siteId === site.id)
  if (here.length === 0) continue

  /*
   * Three weeks back and one forward, so the calendar has a past to show a
   * finding in and a future to show a plan in.
   */
  for (let dayOffset = -20; dayOffset <= 7; dayOffset += 1) {
    const sessionsToday = rng.int(0, 2)
    for (let index = 0; index < sessionsToday; index += 1) {
      const entry = rng.pick(CATALOGUE)
      const day = dayOffset < 0 ? daysAgo(-dayOffset) : daysAhead(dayOffset)
      const startsAt = atTime(day, entry.hour, 0)
      const endsAt = new Date(startsAt.getTime() + 90 * 60_000)
      const inFuture = startsAt.getTime() > Date.now()

      sequence += 1
      const invitedPeople = rng
        .sample(here, Math.min(here.length, rng.int(6, 20)))
        .map((resident) => resident.id)

      /*
       * A future session has nobody recorded and that is not a gap — nothing
       * has happened yet. A past one is unrecorded, partly recorded, or done.
       */
      const roll = rng.int(1, 100)
      const state = inFuture
        ? 'planned'
        : roll <= UNRECORDED * 100
          ? 'unrecorded'
          : roll <= (UNRECORDED + PARTLY) * 100
            ? 'partly'
            : 'done'

      const recordedAt = new Date(endsAt.getTime() + 30 * 60_000)
      const invited: Invitation[] = invitedPeople.map((residentId, position) => {
        const answered =
          state === 'done' ||
          (state === 'partly' && position < Math.ceil(invitedPeople.length * 0.6))
        if (!answered) return { residentId, attendance: { kind: 'not_recorded' } }
        return {
          residentId,
          attendance: rng.chance(ATTENDED)
            ? {
                kind: 'attended',
                recordedBy: rng.pick(carersAndSeniors),
                recordedAt: toIsoDateTime(recordedAt),
              }
            : didNotAttend(recordedAt),
        }
      })

      const joined: Joiner[] =
        state !== 'planned' && state !== 'unrecorded' && rng.chance(HAS_JOINER)
          ? joinersFor(here, invitedPeople, recordedAt)
          : []

      list.push({
        id: `act-${sequence.toString().padStart(4, '0')}` as ActivityId,
        /*
         * Every generated session is planned. A cancelled one is something
         * somebody does during a session of the product, and seeding one here
         * would put a cancellation in the record with an invented reason
         * against a made-up name — the fixtures are messy on purpose about
         * gaps, not about decisions nobody took.
         */
        standing: { kind: 'planned' },
        siteId: site.id,
        name: entry.name,
        description: entry.description,
        startsAt: toIsoDateTime(startsAt),
        endsAt: toIsoDateTime(endsAt),
        place: entry.place,
        plannedBy: rng.pick(carersAndSeniors),
        plannedAt: toIsoDateTime(daysAgo(rng.int(4, 30), startsAt)),
        invited,
        joined,
      })
    }
  }
}

function joinersFor(
  here: typeof residents,
  invitedPeople: ResidentId[],
  at: Date,
): Joiner[] {
  const invitedSet = new Set(invitedPeople)
  const others = here.filter((resident) => !invitedSet.has(resident.id))
  if (others.length === 0) return []
  return rng.sample(others, rng.int(1, 2)).map((resident) => ({
    residentId: resident.id,
    note: rng.pick(JOINER_NOTES),
    recordedBy: rng.pick(carersAndSeniors),
    recordedAt: toIsoDateTime(at),
  }))
}

export const activities: Activity[] = list

export function activitiesForSite(siteId: SiteId): Activity[] {
  return activities.filter((activity) => activity.siteId === siteId)
}

export function activityById(id: ActivityId): Activity | undefined {
  return activities.find((activity) => activity.id === id)
}
