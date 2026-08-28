import type {
  CarePlanDomainId,
  Goal,
  GoalEnding,
  GoalId,
  GoalOutcome,
  GoalProgressNote,
  GoalProgressNoteId,
  GoalTarget,
  ResidentId,
  ResidentView,
  StaffRef,
} from '../types'
import {
  carersAndSeniors,
  managers,
  staffHalloran,
  staffNwosu,
  staffOkonkwo,
} from './organisation'
import { residents } from './residents'
import {
  NOW,
  daysAgo,
  daysAhead,
  makeRandom,
  toIsoDate,
  toIsoDateTime,
} from './generate'
import { pronounise, pronounsOf } from './pronouns'

/**
 * Goals and their progress notes. PRD §6.7, Phase 8.
 *
 * Its own random stream, seeded independently of the residents, so adding a
 * goal cannot move a care note or a medication round.
 *
 * **The spread below is invented and named**, like every other proportion in
 * this build that nobody has reviewed yet. A home where every resident has a
 * goal is not a home; a home where nobody does is the state the module exists
 * to surface, and both have to be in the set.
 */

const rng = makeRandom(0x604a1000)

/** How many residents have any goal at all. */
const HAS_ANY_GOAL = 0.72
/** Of those, how the count is spread. */
const GOAL_COUNT_WEIGHTS = [1, 1, 2, 2, 2, 3, 3, 4] as const
/** Of goals that exist, how many have been closed. */
const CLOSED = 0.45
/** Of goals that exist, how many were never given a target date. */
const NO_TARGET_DATE = 0.16
/** Of goals that exist, how many were never filed under a domain. */
const NOT_LINKED = 0.22
/**
 * Roughly how long a resident has to have been here per goal they have.
 *
 * A rate, not a threshold — and deliberately **not** the alert constant, which
 * answers a different question. Goals accumulate; somebody admitted yesterday
 * has not had a goal-setting conversation, and four goals dated before they
 * arrived is not a thin fixture but an impossible one.
 *
 * It also makes "here too briefly to say anything" fall out of the data rather
 * than being asserted on top of it — the same shape as the resident who cannot
 * yet be missing a 48-hour care note.
 */
const DAYS_PER_GOAL = 60

/**
 * A goal somebody could actually have said, and the method that serves it.
 *
 * `{they}` tokens are substituted after the draw, so the stream is untouched
 * and no fixture moves — the same discipline the care note pools use.
 */
interface GoalTemplate {
  domainId: CarePlanDomainId
  statement: string
  whyItMatters: string
  howWeWillKnow: string
}

const TEMPLATES: GoalTemplate[] = [
  {
    domainId: 'mobility',
    statement: 'I want to walk to the dining room without my frame.',
    whyItMatters: 'I do not like arriving after everybody else has started.',
    howWeWillKnow:
      'Walks the corridor to the dining room with a staff member beside them and no frame, three days running.',
  },
  {
    domainId: 'mobility',
    statement: 'I want to get out to the garden on my own.',
    whyItMatters: 'I have always had a garden and I miss being in one.',
    howWeWillKnow: 'Reaches the patio door and the bench unaided, with staff in sight.',
  },
  {
    domainId: 'personal_care',
    statement: 'I want to shower standing up again rather than sitting.',
    whyItMatters: 'Sitting down to wash makes me feel like an old woman.',
    howWeWillKnow:
      'Stands for a full shower with the rail and one staff member present.',
  },
  {
    domainId: 'nutrition',
    statement: 'I want to eat a proper dinner in the dining room every day.',
    whyItMatters: 'Eating on my own in my room is the worst part of the day.',
    howWeWillKnow:
      'Takes the evening meal in the dining room five days out of seven for a month.',
  },
  {
    domainId: 'social_emotional',
    statement: 'I want to go to the gardening group without being asked twice.',
    whyItMatters: 'I enjoy it once I am there. It is getting started that I find hard.',
    howWeWillKnow:
      'Attends the group of {their} own accord on three consecutive weeks.',
  },
  {
    domainId: 'social_emotional',
    statement: 'I want to see my grandchildren here rather than only on the telephone.',
    whyItMatters: 'The telephone is not the same and they are growing up fast.',
    howWeWillKnow: 'A visit takes place in the family room, arranged with the family.',
  },
  {
    domainId: 'communication',
    statement: 'I want to be able to follow what is said at the table.',
    whyItMatters:
      'I stop joining in when I cannot hear, and then people stop asking me.',
    howWeWillKnow:
      'Hearing aid reviewed and worn at mealtimes, and {they} {are} joining conversation.',
  },
  {
    domainId: 'cognitive',
    statement: 'I want to know what day it is without having to ask.',
    whyItMatters: 'Asking makes me feel foolish and I would rather work it out myself.',
    howWeWillKnow:
      'Uses the board in {their} room to answer for {themself} on most mornings.',
  },
  {
    domainId: 'physical_health',
    statement: 'I want to manage the stairs to the first floor lounge.',
    whyItMatters: 'That is where the piano is and I would like to play again.',
    howWeWillKnow:
      'Climbs the flight with the rail and one staff member, twice in a week.',
  },
  {
    domainId: 'continence',
    statement: 'I want to stop needing help at night.',
    whyItMatters: 'I do not like ringing the bell and waking somebody up.',
    howWeWillKnow: 'Uses the toilet unaided on the night check for two weeks running.',
  },
  {
    domainId: 'medication',
    statement: 'I want to take my own tablets from a blister pack.',
    whyItMatters: 'It is one of the last things I did for myself and I want it back.',
    howWeWillKnow:
      'Self-administers from the pack under supervision for a fortnight with no errors.',
  },
  {
    domainId: 'end_of_life',
    statement: 'I want my family to know what I have decided.',
    whyItMatters: 'I do not want them arguing about it when I cannot tell them.',
    howWeWillKnow:
      'A family conversation takes place and the decisions are recorded in the plan.',
  },
]

const PROGRESS_BODIES: string[] = [
  'Managed the first half of the corridor before asking to sit. Pleased with {themself}.',
  'Tried today and stopped early: said {they} {were} tired rather than unsteady.',
  'Better than last week. Did it twice without being prompted.',
  'No progress this week. {They} said {they} did not feel like it and we left it there.',
  'Family joined in and it went well. {They} asked to do it again tomorrow.',
  'Struggled in the evening but managed it in the morning. Worth trying earlier in future.',
  'Asked to have another go without being prompted, which is the first time.',
  'Slower than a fortnight ago. Worth mentioning at the next review.',
]

const CLOSING_NOTES: Record<Exclude<GoalOutcome['kind'], 'open'>, string[]> = {
  achieved: [
    'Managed it on three separate days without prompting. Very pleased.',
    'Reached it a fortnight early and has kept it up since.',
  ],
  not_achieved: [
    'The date came and it had not happened. Still wants it, so a new goal will be set.',
    'Chest infection in the middle of it set everything back and the date passed.',
  ],
  withdrawn_by_resident: [
    'Said {they} had changed {their} mind and would rather not keep trying.',
    'Told us it was making {them} anxious and asked to stop.',
  ],
  stopped_by_service: [
    'Stopped after the physiotherapist advised against it following the fall.',
    'Stopped when the group it depended on was discontinued.',
  ],
}

const DISAGREED_NOTES: string[] = [
  'Said {they} did not think {they} had managed it and did not want it marked done.',
  'Disagreed: said {they} had stopped trying weeks ago and nobody had noticed.',
]

/**
 * What the resident said about the closing decision.
 *
 * **`not_asked` is weighted heaviest on purpose**, because it is what a real
 * record looks like: the person is asked when somebody remembers to ask. It is
 * the state the screen has to render as a gap, so it has to be the common one.
 */
function makeResidentView(pronouns: string): ResidentView {
  const roll = rng.int(1, 100)
  if (roll <= 45) return { kind: 'not_asked' }
  if (roll <= 85) return { kind: 'agreed' }
  return { kind: 'disagreed', note: pronounise(rng.pick(DISAGREED_NOTES), pronouns) }
}

const goalList: Goal[] = []
const progressList: GoalProgressNote[] = []
let sequence = 0

for (const resident of residents) {
  const here = daysBetweenNow(new Date(resident.admittedOn))
  const wanted = rng.pick(GOAL_COUNT_WEIGHTS)
  const drawn = rng.chance(HAS_ANY_GOAL) ? wanted : 0
  // Nobody has more goals than they have had time to set.
  const count = Math.min(drawn, Math.floor(here / DAYS_PER_GOAL))
  const used = new Set<string>()

  for (let index = 0; index < count; index += 1) {
    /*
     * Re-draw on a collision rather than skipping.
     *
     * `continue` on a repeat silently produced fewer goals than the count said
     * — the spread above described a home that the generator was not
     * building, which is the kind of quiet disagreement between an intention
     * and its code that nobody notices until they count.
     */
    let template = rng.pick(TEMPLATES)
    for (let attempt = 0; attempt < 6 && used.has(template.statement); attempt += 1) {
      template = rng.pick(TEMPLATES)
    }
    if (used.has(template.statement)) continue
    used.add(template.statement)

    sequence += 1
    const id = `goal-${sequence.toString().padStart(4, '0')}` as GoalId
    /*
     * Never before they arrived.
     *
     * The first version drew from the last 400 days regardless, which put
     * goals on residents' records dated before their admission — not a thin
     * fixture but an impossible one, and the same class as an incident closed
     * a day and a half from now.
     */
    const setOn = daysAgo(rng.int(20, Math.max(21, Math.min(400, here))))
    const closed = rng.chance(CLOSED)

    /*
     * A target date that has passed with the goal still open is the module's
     * lead finding, so open goals are drawn on both sides of today rather than
     * comfortably ahead of it.
     */
    const target: GoalTarget = rng.chance(NO_TARGET_DATE)
      ? { kind: 'no_target_date' }
      : {
          kind: 'by_date',
          on: toIsoDate(
            rng.chance(0.45) ? daysAgo(rng.int(1, 120)) : daysAhead(rng.int(5, 150)),
          ),
        }

    const outcome = closed
      ? makeClosure(resident.id, setOn, pronounsOf(resident))
      : ({ kind: 'open' } as const)

    goalList.push({
      id,
      residentId: resident.id,
      statement: template.statement,
      whyItMatters: template.whyItMatters,
      howWeWillKnow: pronounise(template.howWeWillKnow, pronounsOf(resident)),
      target,
      domain: rng.chance(NOT_LINKED)
        ? { kind: 'not_linked' }
        : { kind: 'domain', domainId: template.domainId },
      setBy: rng.pick(managers),
      setOn: toIsoDate(setOn),
      outcome,
    })

    /*
     * Progress notes, or none.
     *
     * A goal with none is a real and common state — it is what "nobody has
     * done anything about this" looks like — so it has to be in the set rather
     * than every goal carrying a comfortable trail.
     */
    const notes = rng.int(0, 5)
    for (let entry = 0; entry < notes; entry += 1) {
      const at = daysAgo(rng.int(1, Math.max(2, daysBetweenNow(setOn))))
      progressList.push({
        id: `gpn-${progressList.length + 1}` as GoalProgressNoteId,
        goalId: id,
        body: pronounise(rng.pick(PROGRESS_BODIES), pronounsOf(resident)),
        recordedBy: rng.pick(carersAndSeniors),
        recordedAt: toIsoDateTime(at),
      })
    }
  }
}

function makeClosure(
  _residentId: ResidentId,
  setOn: Date,
  pronouns: string,
): GoalOutcome {
  const roll = rng.int(1, 100)
  const kind: Exclude<GoalOutcome['kind'], 'open'> =
    roll <= 40
      ? 'achieved'
      : roll <= 70
        ? 'not_achieved'
        : roll <= 88
          ? 'withdrawn_by_resident'
          : 'stopped_by_service'

  const ending: GoalEnding = {
    on: toIsoDate(daysAgo(rng.int(1, Math.max(2, daysBetweenNow(setOn) - 1)))),
    by: rng.pick(managers),
    note: pronounise(rng.pick(CLOSING_NOTES[kind]), pronouns),
  }

  /*
   * A withdrawal carries no resident view, and the type is what says so.
   *
   * The draw still happens for it and is thrown away, so adding or removing
   * this branch cannot move any other fixture — skipping a draw shifts
   * everything downstream of it.
   */
  const view = makeResidentView(pronouns)
  if (kind === 'withdrawn_by_resident') return { kind, closed: ending }

  return { kind, closed: { ...ending, residentView: view } }
}

function daysBetweenNow(from: Date): number {
  return Math.round((NOW.getTime() - from.getTime()) / 86_400_000)
}

/**
 * The deliberate cases, pinned rather than left to the draw.
 *
 * Each of these is a state a screen is built against, and each was either
 * absent or down to one instance when the spread was left to chance — which is
 * not a thin fixture, it is a screen reviewed against a state that cannot
 * occur. Pinned here, off the random stream, so a change to the weights above
 * cannot quietly remove one.
 */

/** Somebody who has been here long enough for the alert, with nothing set. */
export const GOAL_GAP_IDS = {
  /** Open, past its date, and nobody has recorded a thing. The lead finding. */
  pastTargetNoProgress: 'goal-9001' as GoalId,
  /** Open, and nobody ever gave it a date. It can never be late. */
  noTargetDate: 'goal-9002' as GoalId,
  /** Marked achieved over somebody who says it was not. */
  achievedButDisagreed: 'goal-9003' as GoalId,
  /** The service stopped, and nobody put it to the person whose goal it was. */
  stoppedWithoutAsking: 'goal-9004' as GoalId,
} as const

{
  const subject = residents.find((resident) => resident.id === 'res-adeyemi')!
  const other = residents.find((resident) => resident.id === 'res-okafor')!

  goalList.push({
    id: GOAL_GAP_IDS.pastTargetNoProgress,
    residentId: subject.id,
    statement: 'I want to get back to the Tuesday singing group.',
    whyItMatters: 'It is the only thing in the week I look forward to.',
    howWeWillKnow: 'Attends the group on three consecutive Tuesdays.',
    target: { kind: 'by_date', on: toIsoDate(daysAgo(74)) },
    domain: { kind: 'domain', domainId: 'social_emotional' },
    setBy: staffOkonkwo,
    setOn: toIsoDate(daysAgo(210)),
    outcome: { kind: 'open' },
  })

  goalList.push({
    id: GOAL_GAP_IDS.noTargetDate,
    residentId: subject.id,
    statement: 'I want to write to my sister myself instead of dictating it.',
    whyItMatters: 'She will know it is me if it is my handwriting.',
    howWeWillKnow: 'Writes and sends a letter without help.',
    target: { kind: 'no_target_date' },
    domain: { kind: 'not_linked' },
    setBy: staffOkonkwo,
    setOn: toIsoDate(daysAgo(96)),
    outcome: { kind: 'open' },
  })

  goalList.push({
    id: GOAL_GAP_IDS.achievedButDisagreed,
    residentId: other.id,
    statement: 'I want to manage the corridor without stopping.',
    whyItMatters: 'Stopping halfway makes me feel watched.',
    howWeWillKnow: 'Walks the full corridor without pausing, on three days.',
    target: { kind: 'by_date', on: toIsoDate(daysAgo(30)) },
    domain: { kind: 'domain', domainId: 'mobility' },
    setBy: staffHalloran,
    setOn: toIsoDate(daysAgo(180)),
    outcome: {
      kind: 'achieved',
      closed: {
        on: toIsoDate(daysAgo(24)),
        by: staffHalloran,
        note: 'Managed it on three days running and it was recorded as met.',
        residentView: {
          kind: 'disagreed',
          note: 'Said he had stopped both times and did not want it marked as done.',
        },
      },
    },
  })

  goalList.push({
    id: GOAL_GAP_IDS.stoppedWithoutAsking,
    residentId: other.id,
    statement: 'I want to take my own tablets from a blister pack.',
    whyItMatters: 'It is one of the last things I did for myself.',
    howWeWillKnow: 'Self-administers under supervision for a fortnight with no errors.',
    target: { kind: 'by_date', on: toIsoDate(daysAgo(12)) },
    domain: { kind: 'domain', domainId: 'medication' },
    setBy: staffOkonkwo,
    setOn: toIsoDate(daysAgo(150)),
    outcome: {
      kind: 'stopped_by_service',
      closed: {
        on: toIsoDate(daysAgo(41)),
        by: staffOkonkwo,
        note: 'Stopped after the medication review recommended against self-administration.',
        // Nobody put it to the person whose goal it was.
        residentView: { kind: 'not_asked' },
      },
    },
  })

  // One progress note on the disagreed goal, so its timeline is not empty and
  // the disagreement is not the only thing on the screen.
  progressList.push({
    id: 'gpn-9001' as GoalProgressNoteId,
    goalId: GOAL_GAP_IDS.achievedButDisagreed,
    body: 'Walked the corridor twice today with one short pause each time.',
    recordedBy: staffNwosu,
    recordedAt: toIsoDateTime(daysAgo(38)),
  })
}

/** Oldest first, so a timeline reads in the order it happened. */
progressList.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

export const goals: Goal[] = goalList
export const goalProgressNotes: GoalProgressNote[] = progressList

export function goalsFor(residentId: ResidentId): Goal[] {
  return goals.filter((goal) => goal.residentId === residentId)
}

export function progressFor(goalId: GoalId): GoalProgressNote[] {
  return goalProgressNotes.filter((note) => note.goalId === goalId)
}

/** So a fixture guard can name the author pool it drew from. */
export const goalAuthors: StaffRef[] = [...managers, ...carersAndSeniors]
