import type {
  HandoverEntry,
  HandoverSession,
  HandoverStatus,
  ResidentId,
  Shift,
  SiteId,
} from '../types'
import { NOW, atTime, daysAgo, makeRandom, toIsoDate, toIsoDateTime } from './generate'
import { carersAndSeniors, sites, staffHalloran, staffNwosu } from './organisation'
import { residentsBySite } from './residents'
import { pronounise } from './pronouns'

/** See care-notes.ts. They/them when nobody has recorded any, never a guess. */
function pronounsOf(resident: { pronouns: { kind: string; value?: string } }): string {
  return resident.pronouns.kind === 'recorded'
    ? (resident.pronouns.value ?? 'they/them')
    : 'they/them'
}
import { shiftAt } from '@/lib/shift'

/**
 * Shift handovers. PRD §6.3, §5.3.
 *
 * Two sessions per site, and both are deliberate states rather than filler:
 *
 *  - **the open one**, for the shift running now, with several residents
 *    nobody has got to yet. That is the Partial state and the reason the
 *    fourth status exists.
 *  - **the previous one**, which the outgoing shift signed and the incoming
 *    shift never did. That is the Stale state: a handover that was given and
 *    never accepted, which nothing on a three-state screen could express.
 *
 * Ashgrove is thinner, as everywhere: more residents unreviewed, because a
 * short-staffed home is exactly where the fourth state earns its place.
 */

const SHIFT_ORDER: Shift[] = ['early', 'late', 'night']

function nextShift(shift: Shift): Shift {
  return SHIFT_ORDER[(SHIFT_ORDER.indexOf(shift) + 1) % SHIFT_ORDER.length]!
}

function previousShift(shift: Shift): Shift {
  return SHIFT_ORDER[(SHIFT_ORDER.indexOf(shift) + 2) % SHIFT_ORDER.length]!
}

/**
 * Deep enough that a single handover never runs the pool dry.
 *
 * The first version had five, and a site with six residents needing attention
 * showed the same sentence on two of them. On a screen somebody scans in ten
 * minutes that is what teaches them to stop reading the notes.
 */
const ATTENTION_NOTES = [
  'Off {their} food since yesterday teatime. Fluid chart started, needs watching at supper.',
  'Sore left heel, dressing changed at 14:00. District nurse to review tomorrow.',
  'Family visiting at 18:00 and have asked to speak to whoever is on.',
  'Unsteady on the way back from the lounge twice today. Two staff for transfers tonight.',
  'Refused the evening medication yesterday. Try again with the yoghurt {they} like.',
  'Slept badly and was up from about 04:00. May want a rest after lunch.',
  'New glasses arrived and do not fit. She is managing without, so keep an eye at meals.',
  'Bowels not open for three days. Chart it and tell the senior if nothing by morning.',
  'Chesty first thing but clear by midday. Temperature normal at 15:00, keep checking.',
  /*
   * The sister's pronoun is not the resident's, and the guard cannot tell.
   *
   * This read "…when {their} sister is coming. She died in 2019…", and the
   * pronoun sweep flags any gendered pronoun in a sentence carrying resident
   * tokens — it has no way to know "She" belongs to a named third party. The
   * limitation is real and worth knowing about; the fix here is to keep the
   * pool free of third-party pronouns rather than to teach the guard grammar.
   */
  'Asked twice today when {their} sister is coming. {Their} sister died in 2019; do not correct {them} sharply.',
  'Hearing aid battery went this morning. Replaced, but speak on {their} right until {they} confirm.',
  'Skin on both shins looking papery. Emollient applied, avoid the hoist sling edge.',
]

const URGENT_NOTES = [
  'Chest sounds rattly and temperature 37.9 at 16:00. GP called, awaiting a call back tonight.',
  'Fell in the bathroom at 11:20, no injury found but on neuro obs until midnight.',
  'Has not passed urine since this morning. Bladder scan requested, escalate if nothing by 20:00.',
  'Refusing all fluids since lunch. GP aware, review at 20:00 and call 111 if no change.',
  'New confusion since this afternoon, not {their} baseline. Urine sample sent, obs hourly.',
  'Vomited twice after supper. Nil by mouth until the GP calls back, mouth care only.',
]

function makeSession(
  siteId: SiteId,
  index: number,
  outgoingShift: Shift,
  date: Date,
  options: { open: boolean },
): HandoverSession {
  const rng = makeRandom(0xa4d0e2 + index * 7717)
  const residents = residentsBySite(siteId)
  const thin = siteId === 'site-ashgrove-lodge'
  const at = toIsoDateTime(atTime(date, 13, 45))

  // Without replacement. Two residents carrying the same sentence reads as a
  // bug rather than as a record, and on a screen somebody scans in ten minutes
  // it is the kind of thing that teaches them to stop reading the notes.
  const attention = [...ATTENTION_NOTES]
  const urgent = [...URGENT_NOTES]
  const take = (pool: string[], fallback: readonly string[]) =>
    pool.length > 0
      ? pool.splice(rng.int(0, pool.length - 1), 1)[0]!
      : rng.pick(fallback)

  const entries: HandoverEntry[] = []
  for (const resident of residents) {
    // A share of residents are simply not in the list. They render as
    // not_reviewed, which is a true statement about them.
    if (rng.chance(thin ? 0.3 : 0.15)) continue

    const author = rng.pick(carersAndSeniors)
    let status: HandoverStatus
    if (rng.chance(0.12)) {
      status = {
        kind: 'urgent',
        note: pronounise(take(urgent, URGENT_NOTES), pronounsOf(resident)),
        recordedBy: author,
        recordedAt: at,
      }
    } else if (rng.chance(0.28)) {
      status = {
        kind: 'needs_attention',
        note: pronounise(take(attention, ATTENTION_NOTES), pronounsOf(resident)),
        recordedBy: author,
        recordedAt: at,
      }
    } else {
      status = { kind: 'all_well', recordedBy: author, recordedAt: at }
    }
    entries.push({ residentId: resident.id, status })
  }

  const reviewed = entries.length
  const notReviewed = residents.length - reviewed

  return {
    id: `handover-${siteId}-${toIsoDate(date)}-${outgoingShift}`,
    siteId,
    date: toIsoDate(date),
    outgoingShift,
    incomingShift: nextShift(outgoingShift),
    // The open session is unsigned on both sides: it is still running.
    // The previous one was handed over and never accepted.
    outgoing: options.open
      ? { kind: 'not_signed' }
      : {
          kind: 'signed',
          by: staffNwosu,
          at: toIsoDateTime(atTime(date, 14, 5)),
          reviewed,
          notReviewed,
        },
    incoming: { kind: 'not_signed' },
    entries,
  }
}

const currentShift: Shift = shiftAt(toIsoDateTime(NOW), 'Europe/London')

export const handovers: HandoverSession[] = sites.flatMap((site, index) => [
  makeSession(site.id, index * 2, currentShift, NOW, { open: true }),
  makeSession(site.id, index * 2 + 1, previousShift(currentShift), daysAgo(1), {
    open: false,
  }),
])

/** The handover being worked on right now for a site: today's, current shift. */
export function openHandoverFor(siteId: SiteId): HandoverSession | undefined {
  return handovers.find(
    (session) =>
      session.siteId === siteId &&
      session.date === toIsoDate(NOW) &&
      session.outgoingShift === currentShift,
  )
}

/** Handovers still missing a signature. The Stale state, PRD §6. */
export function unsignedHandoversFor(siteId: SiteId): HandoverSession[] {
  return handovers.filter(
    (session) =>
      session.siteId === siteId &&
      session.id !== openHandoverFor(siteId)?.id &&
      (session.outgoing.kind === 'not_signed' ||
        session.incoming.kind === 'not_signed'),
  )
}

export const HANDOVER_STAFF = { outgoing: staffNwosu, incoming: staffHalloran }

export type { ResidentId }
