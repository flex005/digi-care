import type {
  CareNote,
  IsoDate,
  IsoDateTime,
  Resident,
  Shift,
  StaffId,
} from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { zonedDate } from '@/lib/format'
import { staffLabel } from '@/data/access/team-store'

/**
 * The cross-resident Care Notes view. PRD §6.3.
 *
 * > Same records as the profile timeline, different question: *what is
 * > happening in this home* rather than *what happened to this person*. It
 * > earns its place through what the per-resident timeline cannot answer, so
 * > it is built around those queries rather than around a feed.
 *
 * That sentence is the design. A reverse-chronological feed of every note in
 * the home is a screen nobody opens twice: it answers no question anybody
 * arrives with. So the screen is four questions plus a feed, in that order,
 * and the default is the supervisory question that has nowhere else in the
 * product to be discharged.
 *
 * The feed is last and bounded. It is here because somebody occasionally does
 * want to read down the day, and refusing outright would send them to a worse
 * route; it is bounded to the site's day because the alternative at this
 * site's volume is twelve thousand rows, and it names its bound because the
 * alternative to that is a silent cap that reads as "everything".
 *
 * Every function here is pure and takes `now` and the site's timezone as
 * arguments, so the answers are testable and so "today" means the site's day
 * rather than the machine's.
 */

export type CareNotesView =
  'flagged' | 'quiet_today' | 'by_author' | 'by_shift' | 'everything'

export const CARE_NOTES_VIEWS: {
  id: CareNotesView
  label: string
  question: string
}[] = [
  {
    id: 'flagged',
    label: 'Flagged, not reviewed',
    question:
      'Notes a care worker asked a senior to look at, that no senior has looked at yet. Oldest first, because the wait is the problem.',
  },
  {
    id: 'quiet_today',
    label: 'No note today',
    question:
      'Residents nobody has written about today. Named, never counted alone, because a count cannot be acted on and a name can.',
  },
  {
    id: 'by_author',
    label: 'By author',
    question:
      'One worker’s records, for supervision or an investigation. Says what they wrote, not how well they wrote it.',
  },
  {
    id: 'by_shift',
    label: 'By shift',
    question:
      'Whether a shift wrote anything at all. The night team is the one this question is usually about.',
  },
  {
    id: 'everything',
    label: 'All notes',
    question:
      'Every care note at this site, by everybody, newest first, a page at a time. Last, and never the default: a feed answers no question anybody arrives with, and §6.3 calls it a screen nobody opens twice.',
  },
]

export interface NoteWithResident {
  note: CareNote
  resident: Resident
}

function withResidents(notes: CareNote[], residents: Resident[]): NoteWithResident[] {
  const byId = new Map(residents.map((resident) => [resident.id, resident]))
  return notes.flatMap((note) => {
    const resident = byId.get(note.residentId)
    return resident ? [{ note, resident }] : []
  })
}

/**
 * Flagged and not yet reviewed, across every resident.
 *
 * Oldest flag first. A supervisory queue sorted newest-first buries the note
 * that has been waiting three days under the one that arrived this morning,
 * which inverts the only ordering that matters here.
 */
export function flaggedNotReviewed(
  notes: CareNote[],
  residents: Resident[],
): NoteWithResident[] {
  return withResidents(
    notes.filter((note) => note.review.kind === 'flagged_not_reviewed'),
    residents,
  ).sort((a, b) => {
    const at = (item: NoteWithResident) =>
      item.note.review.kind === 'flagged_not_reviewed'
        ? new Date(item.note.review.flaggedAt).getTime()
        : 0
    return at(a) - at(b)
  })
}

export interface QuietResident {
  resident: Resident
  /** Their most recent note, or 'never' if nobody has ever written them up. */
  last: CareNote | 'never'
}

/**
 * Residents with no note today.
 *
 * "Today" is the site's calendar day, not the viewer's and not the machine's.
 *
 * `never` is kept distinct from "nothing today" deliberately. A resident
 * nobody has written up since Tuesday and a resident nobody has ever written
 * up are different failures, and collapsing them into one list would lose the
 * worse of the two inside the milder one.
 */
export function withoutNoteToday(
  residents: Resident[],
  notes: CareNote[],
  timeZone: TimeZone,
  now: IsoDateTime,
): QuietResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  const latest = new Map<string, CareNote>()
  const wroteToday = new Set<string>()

  for (const note of notes) {
    if (!latest.has(note.residentId)) latest.set(note.residentId, note)
    if (zonedDate(note.recordedAt, timeZone) === today) wroteToday.add(note.residentId)
  }

  return residents
    .filter((resident) => !wroteToday.has(resident.id))
    .map((resident) => ({
      resident,
      last: latest.get(resident.id) ?? ('never' as const),
    }))
    .sort((a, b) => {
      // Never written up first: it is the worse finding and it must not sit
      // below somebody who was written up an hour before midnight.
      if (a.last === 'never' && b.last !== 'never') return -1
      if (b.last === 'never' && a.last !== 'never') return 1
      if (a.last === 'never' || b.last === 'never') return 0
      return (
        new Date(a.last.recordedAt).getTime() - new Date(b.last.recordedAt).getTime()
      )
    })
}

export function byAuthor(
  notes: CareNote[],
  residents: Resident[],
  author: StaffId,
): NoteWithResident[] {
  return withResidents(
    notes.filter((note) => note.recordedBy.id === author),
    residents,
  )
}

/**
 * Every note at this site, newest first.
 *
 * **Paginated by the screen, never truncated here.** A slice taken in the data
 * layer is a claim the reader cannot see the edge of; the list has to know how
 * many there are in order to say so.
 */
export function allNotes(notes: CareNote[], residents: Resident[]): NoteWithResident[] {
  return withResidents(
    [...notes].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    residents,
  )
}

export function byShift(
  notes: CareNote[],
  residents: Resident[],
  shift: Shift,
  timeZone: TimeZone,
  now: IsoDateTime,
): NoteWithResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  return withResidents(
    notes.filter(
      (note) =>
        note.shift.value === shift && zonedDate(note.recordedAt, timeZone) === today,
    ),
    residents,
  )
}

/**
 * Everything written across the home today, newest first.
 *
 * **Bounded to the site's day, and the bound is named on screen.** The record
 * for one site is twelve thousand notes, and a feed of twelve thousand rows is
 * volume that drowns the distinction it was supposed to show — the same
 * failure as a blank cell, arriving from the other direction. The alternative
 * is a silent cap, which reads as "this is everything" when it is not.
 *
 * So this view answers a smaller question honestly rather than a bigger one
 * falsely: what has been written today. The screen states the window, and
 * states how much of the record sits outside it.
 */
export function notesToday(
  notes: CareNote[],
  residents: Resident[],
  timeZone: TimeZone,
  now: IsoDateTime,
): NoteWithResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  return withResidents(
    notes.filter((note) => zonedDate(note.recordedAt, timeZone) === today),
    residents,
  ).sort(
    (a, b) =>
      new Date(b.note.recordedAt).getTime() - new Date(a.note.recordedAt).getTime(),
  )
}

/**
 * Residents nobody wrote about on a given shift today.
 *
 * A legitimate absence claim under Rule 3c **because it names its filter**:
 * "no note on the night shift today" is a precise statement, not an artefact
 * of a view. The screen states the shift and the day in the sentence; without
 * that it would be the same false claim the profile timeline suppresses.
 */
export function withoutNoteOnShift(
  residents: Resident[],
  notes: CareNote[],
  shift: Shift,
  timeZone: TimeZone,
  now: IsoDateTime,
): Resident[] {
  const covered = new Set(
    byShift(notes, residents, shift, timeZone, now).map((item) => item.resident.id),
  )
  return residents.filter((resident) => !covered.has(resident.id))
}

/** Authors who wrote for this site, for the author picker. */
export function authorsIn(notes: CareNote[]): [StaffId, string][] {
  const seen = new Map<StaffId, string>()
  for (const note of notes) {
    if (!seen.has(note.recordedBy.id)) {
      seen.set(note.recordedBy.id, staffLabel(note.recordedBy))
    }
  }
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
}
