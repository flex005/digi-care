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
import { NOW, atTime, daysAgo, makeRandom, toIsoDateTime } from './generate'
import {
  carersAndSeniors,
  staffDeactivated,
  staffHalloran,
  staffNwosu,
} from './organisation'
import { residents } from './residents'

const NOTE_BODIES: Record<CareNoteCategoryId, string[]> = {
  personal_care: [
    'Supported with a full wash at the sink this morning. Chose his own shirt and managed the buttons himself.',
    'Declined a shower today, said she would rather have one tomorrow. Offered a wash instead, which she accepted.',
    'Assisted with oral care. Denture soaking solution replaced. No soreness observed.',
    'Nails cut and filed after a soak. Skin on hands dry — emollient applied as prescribed.',
  ],
  nutrition: [
    'Ate a full breakfast unprompted. Two cups of tea. Fluid chart updated.',
    'Left most of lunch. Offered a fortified milkshake at 15:00, took about half.',
    'Needed prompting between mouthfuls at supper. Sat with her for the whole meal.',
    'Good appetite today. Asked for a second helping of potatoes and finished it.',
  ],
  mobility: [
    'Walked to the dining room with his frame and one staff member alongside. Steady throughout.',
    'Two-staff transfer from bed to chair using the standing hoist. No discomfort reported.',
    'Reluctant to mobilise this morning, said her hip was aching. Encouraged a short walk after lunch, which she managed.',
    'Used the wheelchair for the trip to the garden. Transferred with supervision only.',
  ],
  medication: [
    'Morning medication administered as prescribed. Took tablets with yoghurt as she prefers.',
    'Refused evening medication at first. Explained what each tablet was for and he then took them all.',
    'PRN paracetamol given for knee pain at 14:20. Reported relief by 15:00.',
    'GP contacted about the new dose. Awaiting confirmation before the next round.',
  ],
  social_emotional: [
    'Joined the singing group and knew all the words. Very animated afterwards.',
    'Tearful this afternoon, talking about her late husband. Sat with her and she settled after about twenty minutes.',
    'Family visited for an hour. Noticeably brighter for the rest of the day.',
    'Preferred to stay in his room today. Checked on him hourly; he said he just wanted quiet.',
  ],
  health_observation: [
    'Observations within normal range. Temperature 36.7, pulse 72, BP 128/76.',
    'Slight cough this morning, no temperature. Will continue to monitor.',
    'Small skin tear to left forearm, cleaned and dressed. Body map updated.',
    'Reported feeling dizzy on standing. Sat back down and it passed within a minute. GP informed.',
  ],
  behaviour: [
    'Became agitated in the late afternoon looking for her handbag. Found it in the wardrobe and she settled immediately.',
    'Called out repeatedly during the night. Reorientated and offered a warm drink; slept from about 03:00.',
    'Resisted personal care this morning. Left him for twenty minutes and tried again, which worked.',
    'No episodes of distress today. Calm and engaged throughout.',
  ],
  general: [
    'Settled day. No concerns raised by the resident or the team.',
    'Slept well overnight. Up at 07:30 of his own accord.',
    'Spent the afternoon in the lounge with the newspaper. Content.',
    'Hairdresser visited. Very pleased with the result and showed everyone.',
  ],
}

const CATEGORIES = Object.keys(NOTE_BODIES) as CareNoteCategoryId[]
const SHIFTS = ['early', 'late', 'night'] as const

function makeMood(rng: ReturnType<typeof makeRandom>, index: number): MoodRecord {
  // Roughly one note in six has no mood recorded — a real omission, and the
  // reason MoodRecord has an unrecorded member rather than defaulting to 3.
  if (rng.chance(0.17)) return { kind: 'not_recorded' }
  return {
    kind: 'recorded',
    score: rng.pick([1, 2, 3, 3, 3, 4, 4, 5] as const),
    recordedBy: rng.pick(carersAndSeniors),
    recordedAt: toIsoDateTime(daysAgo(index)),
  }
}

const notes: CareNote[] = []

for (const [residentIndex, resident] of residents.entries()) {
  const rng = makeRandom(0xca4e0007 + residentIndex * 104729)
  // Ashgrove is thin on purpose, and a resident admitted yesterday has almost
  // no history at all.
  const admittedDaysAgo = Math.max(
    0,
    Math.round((NOW.getTime() - new Date(resident.admittedOn).getTime()) / 86_400_000),
  )
  const historyDays = Math.min(90, admittedDaysAgo)
  const notesPerDay = resident.siteId === 'site-ashgrove-lodge' ? 2 : 3

  for (let day = historyDays; day >= 0; day -= 1) {
    // Some days genuinely have no note. Phase 2 renders those as gaps.
    if (rng.chance(0.12)) continue
    const count = rng.int(1, notesPerDay)
    for (let n = 0; n < count; n += 1) {
      const hour = rng.pick([7, 9, 11, 13, 15, 17, 19, 22])
      const at = atTime(daysAgo(day), hour, rng.int(0, 59))
      const category = rng.pick(CATEGORIES)
      const bodies = NOTE_BODIES[category]
      notes.push({
        id: `note-${resident.id}-${day}-${n}` as CareNoteId,
        residentId: resident.id,
        category,
        body: rng.pick(bodies),
        mood: makeMood(rng, day),
        recordedBy: rng.pick(carersAndSeniors),
        recordedAt: toIsoDateTime(at),
        shift: hour < 14 ? SHIFTS[0] : hour < 21 ? SHIFTS[1] : SHIFTS[2],
        review: rng.chance(0.06)
          ? {
              kind: 'reviewed',
              reviewedBy: staffHalloran,
              reviewedAt: toIsoDateTime(
                atTime(daysAgo(day - 1 < 0 ? 0 : day - 1), 9, 0),
              ),
            }
          : { kind: 'not_flagged' },
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
  shift: 'early',
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
  shift: 'late',
  review: { kind: 'not_flagged' },
  supersededBy: 'none',
  corrects: okaforOriginalId,
})

notes.push({
  id: okaforFlaggedId,
  residentId: okaforId,
  category: 'behaviour',
  body: 'Refused all support with personal care and became verbally distressed when I persisted. Left him and returned an hour later, which worked. Flagging for the senior to review whether the approach in his care plan still fits.',
  mood: {
    kind: 'recorded',
    score: 2,
    recordedBy: staffNwosu,
    recordedAt: toIsoDateTime(atTime(daysAgo(3), 8, 40)),
  },
  recordedBy: staffNwosu,
  recordedAt: toIsoDateTime(atTime(daysAgo(3), 8, 40)),
  shift: 'early',
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
  shift: 'night',
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
