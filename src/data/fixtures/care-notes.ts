/**
 * 90 days of care notes. PRD §5.2.
 *
 * Written from realistic care-note pools per category, never lorem
 * (CLAUDE.md §6). Deliberately uneven: some residents are written up several
 * times a day, some go quiet for a day or more. Those quiet stretches are the
 * gaps Phase 2's timeline has to render as explicit hatched markers rather
 * than as an absence of rows.
 *
 * Carries two of PRD §5.3's ten gaps: a note flagged for review and not yet
 * reviewed, with a correction note referencing an earlier note; and a note
 * authored by a now-deactivated staff member.
 */

import type {
  CareNote,
  CareNoteCategoryId,
  CareNoteId,
  MoodRecord,
  ResidentId,
} from '../types'
import {
  NOW,
  atTime,
  daysAgo,
  recordedBetween,
  makeRandom,
  toIsoDateTime,
} from './generate'
import {
  carersAndSeniors,
  staffDeactivated,
  staffHalloran,
  staffNwosu,
} from './organisation'
import { residents } from './residents'
import { pronounise, pronounsOf } from './pronouns'

/**
 * The prose a care note is drawn from, in tokens rather than pronouns.
 *
 * `{they}` / `{them}` / `{their}` and the verb tokens `{were}` / `{have}` are
 * substituted for the resident at generation — see `pronouns.ts`. Written
 * with pronouns baked in, this pool put "Preferred to stay in his room today"
 * on a woman's record 1,988 times.
 *
 * Sentences that need no pronoun keep none. A pool where every line reaches
 * for one reads like a template; real care notes often do not mention the
 * resident at all.
 *
 * **A verb token is only correct where the pronoun governs the verb.** This is
 * the trap, and it is sharper than a wrong pronoun because a naive guard
 * passes it: the token resolves, the sentence is grammatical for he and she,
 * and it is wrong only for they.
 *
 *     "{They} {were} unsettled"        ✓  the pronoun is the subject
 *     "said {their} hip {were} aching" ✗  the subject is "hip", so it is
 *                                         "was" for everybody, they included
 *
 * When in doubt, ask what the verb agrees with. If the answer is a noun rather
 * than the pronoun, write the verb out.
 */
const NOTE_BODIES: Record<CareNoteCategoryId, string[]> = {
  personal_care: [
    'Supported with a full wash at the sink this morning. Chose {their} own shirt and managed the buttons {themself}.',
    'Declined a shower today, said {they} would rather have one tomorrow. Offered a wash instead, which {they} accepted.',
    'Assisted with oral care. Denture soaking solution replaced. No soreness observed.',
    'Nails cut and filed after a soak. Skin on hands dry; emollient applied as prescribed.',
  ],
  nutrition: [
    'Ate a full breakfast unprompted. Two cups of tea. Fluid chart updated.',
    'Left most of lunch. Offered a fortified milkshake at 15:00, took about half.',
    'Needed prompting between mouthfuls at supper. Sat with {them} for the whole meal.',
    'Good appetite today. Asked for a second helping of potatoes and finished it.',
  ],
  mobility: [
    'Walked to the dining room with {their} frame and one staff member alongside. Steady throughout.',
    'Two-staff transfer from bed to chair using the standing hoist. No discomfort reported.',
    'Reluctant to mobilise this morning, said {their} hip was aching. Encouraged a short walk after lunch, which {they} managed.',
    'Used the wheelchair for the trip to the garden. Transferred with supervision only.',
  ],
  medication: [
    'Morning medication administered as prescribed. Took tablets with yoghurt, which is {their} preference.',
    'Refused evening medication at first. Explained what each tablet was for and {they} then took them all.',
    'PRN paracetamol given for knee pain at 14:20. Reported relief by 15:00.',
    'GP contacted about the new dose. Awaiting confirmation before the next round.',
  ],
  social_emotional: [
    'Joined the singing group and knew all the words. Very animated afterwards.',
    'Tearful this afternoon, talking about {their} late husband. Sat with {them} and {they} settled after about twenty minutes.',
    'Family visited for an hour. Noticeably brighter for the rest of the day.',
    'Preferred to stay in {their} room today. Checked on {them} hourly; {they} said {they} just wanted quiet.',
  ],
  health_observation: [
    'Observations within normal range. Temperature 36.7, pulse 72, BP 128/76.',
    'Slight cough this morning, no temperature. Will continue to monitor.',
    'Small skin tear to left forearm, cleaned and dressed. Body map updated.',
    'Reported feeling dizzy on standing. Sat back down and it passed within a minute. GP informed.',
  ],
  behaviour: [
    'Became agitated in the late afternoon looking for {their} handbag. Found it in the wardrobe and {they} settled immediately.',
    'Called out repeatedly during the night. Reorientated and offered a warm drink; slept from about 03:00.',
    'Resisted personal care this morning. Left {them} for twenty minutes and tried again, which worked.',
    'No episodes of distress today. Calm and engaged throughout.',
  ],
  general: [
    'Settled day. No concerns raised by the resident or the team.',
    'Slept well overnight. Up at 07:30 of {their} own accord.',
    'Spent the afternoon in the lounge with the newspaper. Content.',
    'Hairdresser visited. Very pleased with the result and showed everyone.',
  ],
}

const CATEGORIES = Object.keys(NOTE_BODIES) as CareNoteCategoryId[]

/**
 * A resident's pronouns, or they/them when nobody has recorded any.
 *
 * They/them rather than a guess. Pronouns are a `Recorded<string>` and an
 * unrecorded one means nobody asked — inferring from a name is exactly the
 * assumption this whole change exists to remove.
 */
/**
 * Hours a note actually gets written at, by shift.
 *
 * **Corrected 22/08/2026.** These fixtures previously gave a resident one to
 * three notes a day, picked from eight daytime hours. That was wrong about the
 * work, not merely sparse: a care home writes a note per shift as a minimum
 * and more when something happens, so four to six a day is the floor for a
 * resident with nothing unusual going on. See PROGRESS.md — this is a
 * correction to a wrong baseline, not a tidy-up of a screen.
 *
 * Night hours are real night hours. A 02:00 check that got written up is a
 * night note, and having some of them is what makes the timeline's overnight
 * marker appear at all.
 */
const SHIFT_HOURS = {
  early: [7, 8, 9, 11, 13],
  late: [15, 16, 18, 19, 20],
  night: [22, 23, 2, 5],
} as const

function makeMood(rng: ReturnType<typeof makeRandom>, at: Date): MoodRecord {
  // Roughly one note in six has no mood recorded — a real omission, and the
  // reason MoodRecord has an unrecorded member rather than defaulting to 3.
  if (rng.chance(0.17)) return { kind: 'not_recorded' }
  return {
    kind: 'recorded',
    score: rng.pick([1, 2, 3, 3, 3, 4, 4, 5] as const),
    recordedBy: rng.pick(carersAndSeniors),
    // The mood was recorded with the note, not at some unrelated moment.
    recordedAt: toIsoDateTime(at),
  }
}

const notes: CareNote[] = []

/**
 * Nobody has written Ismail Sowande up. Not once.
 *
 * Pinned rather than left to probability, and checked before pinning: with the
 * previous one-to-three-notes-a-day generator no resident had zero notes
 * either, so `latestNote: 'none'` — a branch the residents list, the profile
 * header and the note timeline all render — has never had a fixture behind it.
 * It was reachable only by reading the code.
 *
 * He is the resident admitted yesterday (PRD §5.3), so this is the honest
 * version of that gap rather than an invented one: somebody arrived and no
 * care worker has recorded a thing about them. It also gives "sort by oldest
 * care note" a resident who genuinely belongs at the top, which is the whole
 * reason that sort exists.
 *
 * Same reasoning as `broadbent` carrying the settled risk picture: a state
 * that exists only in a unit test is a state nobody reviews.
 */
const NEVER_WRITTEN_UP: ResidentId[] = ['res-sowande' as ResidentId]

for (const [residentIndex, resident] of residents.entries()) {
  if (NEVER_WRITTEN_UP.includes(resident.id)) continue
  const rng = makeRandom(0xca4e0007 + residentIndex * 104729)
  // Ashgrove is thin on purpose, and a resident admitted yesterday has almost
  // no history at all.
  const admittedDaysAgo = Math.max(
    0,
    Math.round((NOW.getTime() - new Date(resident.admittedOn).getTime()) / 86_400_000),
  )
  const historyDays = Math.min(90, admittedDaysAgo)
  // Ashgrove is thinner than Rosewood on purpose, but not below the floor:
  // "thin" means fewer extras and more days that slip, never fewer than the
  // one-per-shift a real home writes.
  const extras = resident.siteId === 'site-ashgrove-lodge' ? 1 : 3

  for (let day = historyDays; day >= 0; day -= 1) {
    // Some days genuinely have no note at all. Phase 2 renders those as gaps,
    // and they are the point: this is the ambient messiness CLAUDE.md §6 says
    // not to tidy, and it survives the volume correction untouched.
    if (rng.chance(0.12)) continue

    // One per shift, then events on top. Sampled without replacement so six
    // notes are six moments rather than the same hour picked twice.
    const hours: number[] = [
      rng.pick(SHIFT_HOURS.early),
      rng.pick(SHIFT_HOURS.late),
      rng.pick(SHIFT_HOURS.night),
    ]
    const pool = [
      ...SHIFT_HOURS.early,
      ...SHIFT_HOURS.late,
      ...SHIFT_HOURS.night,
    ].filter((hour) => !hours.includes(hour))
    for (let extra = rng.int(1, extras); extra > 0 && pool.length > 0; extra -= 1) {
      hours.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!)
    }

    // Categories without replacement too. At one to three notes a day a
    // repeat was invisible; at four to six the same sentence appeared twice in
    // an afternoon, which reads as a bug rather than as a record. A day's
    // notes are about different things, which is what a day is like.
    const dayCategories = [...CATEGORIES]
    for (const [n, hour] of hours.entries()) {
      const at = atTime(daysAgo(day), hour, rng.int(0, 59))
      // Today's later rounds have not happened yet. A care note timestamped
      // in the future is not a messy record, it is an impossible one — and it
      // would render as "in 12 hours", which reads as a plan rather than an
      // observation. The gaps in these fixtures are deliberate; this would
      // just be wrong.
      if (at.getTime() > NOW.getTime()) continue
      const category =
        dayCategories.length > 0
          ? dayCategories.splice(rng.int(0, dayCategories.length - 1), 1)[0]!
          : rng.pick(CATEGORIES)
      const bodies = NOTE_BODIES[category]
      // Drawn here, in the order the object literal used to draw them, so the
      // RNG stream is bit-for-bit what it was and no other fixture moves.
      // `author` is hoisted only because the review branch below needs it: a
      // flag is raised by whoever wrote the note.
      // Substituted after the draw, so the RNG stream is untouched and the
      // pronouns are the resident's rather than whichever sentence came up.
      const body = pronounise(rng.pick(bodies), pronounsOf(resident))
      const mood = makeMood(rng, at)
      const author = rng.pick(carersAndSeniors)
      notes.push({
        id: `note-${resident.id}-${day}-${n}` as CareNoteId,
        residentId: resident.id,
        category,
        body,
        mood,
        recordedBy: author,
        recordedAt: toIsoDateTime(at),
        // Auto, from the clock. Every fixture note is auto: an override is
        // something a person does at the composer, and nobody has.
        shift: {
          kind: 'auto',
          value:
            hour >= 7 && hour < 14
              ? 'early'
              : hour >= 14 && hour < 21
                ? 'late'
                : 'night',
        },
        /**
         * **Corrected 22/08/2026.** This drew one chance and produced only
         * `reviewed` or `not_flagged`, so across twelve thousand notes exactly
         * one was ever awaiting a senior: the §5.3 pinned one. That is not a
         * patchy home, it is a home where nobody ever asks for help and every
         * request that was made has been answered.
         *
         * The supervisory queue at `/care-notes` is built on this state, and a
         * queue of one cannot show that it is sorted by how long each has
         * waited, which is the only ordering that matters there.
         *
         * One draw, three outcomes, so the RNG stream is exactly as long as it
         * was and no other fixture moves. A flag is raised by whoever wrote the
         * note, as they write it, which is also how the composer records one.
         */
        review: (() => {
          const roll = rng.int(0, 99)
          if (roll < 6) {
            return {
              kind: 'reviewed' as const,
              // The flag is carried forward, not replaced. Somebody asked for
              // this second opinion and the record has to keep saying who and
              // when — the gap between the two is the supervision.
              flaggedBy: author,
              flaggedAt: toIsoDateTime(at),
              reviewedBy: staffHalloran,
              // Nine the next morning, but never before the note it reviews
              // and never after now. Both bounds are real: a note written at
              // 14:00 today was previously "reviewed" at 09:00 today, and a
              // note written yesterday evening was reviewed at a 09:00 that
              // has not happened yet.
              reviewedAt: toIsoDateTime(
                recordedBetween(at, atTime(daysAgo(Math.max(day - 1, 0)), 9, 0)),
              ),
            }
          }
          // A flag is a request for a second opinion, so it attaches to notes
          // somebody would actually escalate. Flagging "denture soaking
          // solution replaced" fills the supervisory queue with things nobody
          // needs to read, and a queue of noise is one a senior stops opening.
          // Gated on a category already chosen, so no extra draw and the RNG
          // stream is unchanged.
          const escalable =
            category === 'behaviour' ||
            category === 'health_observation' ||
            category === 'medication' ||
            category === 'social_emotional'

          if (roll < 10 && escalable) {
            // Flagged. A senior clears the queue within a day or two, so only
            // recent flags are still waiting; older ones were dealt with.
            //
            // Without that bound, 8% of twelve thousand notes left 208 notes
            // awaiting review across 28 residents, which is not a queue, it is
            // a wall. Standing check: volume that drowns a distinction is the
            // same failure as a blank cell.
            if (day <= 1) {
              return {
                kind: 'flagged_not_reviewed' as const,
                flaggedBy: author,
                flaggedAt: toIsoDateTime(at),
              }
            }
            return {
              kind: 'reviewed' as const,
              flaggedBy: author,
              flaggedAt: toIsoDateTime(at),
              reviewedBy: staffHalloran,
              reviewedAt: toIsoDateTime(
                recordedBetween(at, atTime(daysAgo(Math.max(day - 1, 0)), 9, 0)),
              ),
            }
          }
          return { kind: 'not_flagged' as const }
        })(),
        supersededBy: 'none',
        corrects: 'none',
      })
    }
  }
}

// ---------------------------------------------------------------------------
// PRD §5.3 gap 8 — a note flagged for review and not yet reviewed, and a
// correction note referencing an earlier one.
//
// Care notes are immutable after submission (CLAUDE.md §6). There is no edit
// control, ever. A correction creates a NEW linked note and marks the original
// superseded, while leaving the original visible — because the fact that
// somebody first recorded the wrong thing is itself part of the record.
// ---------------------------------------------------------------------------

const okaforOriginalId = 'note-res-okafor-correction-original' as CareNoteId
const okaforCorrectionId = 'note-res-okafor-correction' as CareNoteId
const okaforFlaggedId = 'note-res-okafor-flagged' as CareNoteId
const okaforId = 'res-okafor' as ResidentId

notes.push({
  id: okaforOriginalId,
  residentId: okaforId,
  category: 'health_observation',
  body: 'Small skin tear to the right forearm, cleaned and dressed. Body map updated.',
  mood: {
    kind: 'recorded',
    score: 3,
    recordedBy: staffNwosu,
    recordedAt: toIsoDateTime(atTime(daysAgo(6), 11, 20)),
  },
  recordedBy: staffNwosu,
  recordedAt: toIsoDateTime(atTime(daysAgo(6), 11, 20)),
  shift: { kind: 'auto', value: 'early' },
  review: { kind: 'not_flagged' },
  supersededBy: okaforCorrectionId,
  corrects: 'none',
})

notes.push({
  id: okaforCorrectionId,
  residentId: okaforId,
  category: 'health_observation',
  body: 'Correction to the note recorded at 11:20. The skin tear is to the LEFT forearm, not the right. Body map corrected and dressing checked.',
  mood: { kind: 'not_recorded' },
  recordedBy: staffNwosu,
  recordedAt: toIsoDateTime(atTime(daysAgo(6), 14, 5)),
  shift: { kind: 'auto', value: 'late' },
  review: { kind: 'not_flagged' },
  supersededBy: 'none',
  corrects: okaforOriginalId,
})

notes.push({
  id: okaforFlaggedId,
  residentId: okaforId,
  category: 'behaviour',
  // Tokenised like the pool. A pinned note is prose about a named person and
  // follows the same rule: nothing in this file states a pronoun the record
  // does not. Emmanuel's pronouns are unrecorded — one of the deliberate gaps
  // — so this reads "them", which is the honest answer rather than the one a
  // forename suggests.
  body: pronounise(
    'Refused all support with personal care and became verbally distressed when I persisted. Left {them} and returned an hour later, which worked. Flagging for the senior to review whether the approach in {their} care plan still fits.',
    pronounsOf(residents.find((entry) => entry.id === 'res-okafor')!),
  ),
  mood: {
    kind: 'recorded',
    score: 2,
    recordedBy: staffNwosu,
    recordedAt: toIsoDateTime(atTime(daysAgo(3), 8, 40)),
  },
  recordedBy: staffNwosu,
  recordedAt: toIsoDateTime(atTime(daysAgo(3), 8, 40)),
  shift: { kind: 'auto', value: 'early' },
  // Flagged, and nobody has reviewed it. Distinct from "not flagged" and from
  // "flagged and reviewed" — three states, not a boolean.
  review: {
    kind: 'flagged_not_reviewed',
    flaggedBy: staffNwosu,
    flaggedAt: toIsoDateTime(atTime(daysAgo(3), 8, 41)),
  },
  supersededBy: 'none',
  corrects: 'none',
})

/** PRD §5.3 gap 10 — a record authored by a now-deactivated staff member.
 *  Records outlive access: the note stays, and stays attributed. */
notes.push({
  id: 'note-res-pemberton-deactivated' as CareNoteId,
  residentId: 'res-pemberton' as ResidentId,
  category: 'general',
  body: 'Settled evening. Watched the football with the other gentlemen in the lounge and went to bed at 21:30.',
  mood: {
    kind: 'recorded',
    score: 4,
    recordedBy: staffDeactivated,
    recordedAt: toIsoDateTime(atTime(daysAgo(47), 21, 45)),
  },
  recordedBy: staffDeactivated,
  recordedAt: toIsoDateTime(atTime(daysAgo(47), 21, 45)),
  shift: { kind: 'auto', value: 'night' },
  review: { kind: 'not_flagged' },
  supersededBy: 'none',
  corrects: 'none',
})

export const careNotes: CareNote[] = notes.sort(
  (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
)

export function careNotesFor(residentId: ResidentId): CareNote[] {
  return careNotes.filter((note) => note.residentId === residentId)
}

/** The most recent note, or nothing — and "nothing" is a real answer that the
 *  residents list has to render as such rather than as an empty cell. */
export function latestNoteFor(residentId: ResidentId): CareNote | undefined {
  return careNotesFor(residentId)[0]
}

export const GAP_NOTE_IDS = {
  flaggedNotReviewed: okaforFlaggedId,
  correctionNote: okaforCorrectionId,
  supersededOriginal: okaforOriginalId,
  deactivatedAuthor: 'note-res-pemberton-deactivated' as CareNoteId,
}
