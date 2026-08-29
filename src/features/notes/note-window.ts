import type { CareNote, IsoDateTime } from '@/data/types'

/**
 * The bound on how much of a resident's timeline is drawn at once.
 *
 * **A window, not a page.** The difference is the whole reason this exists:
 * "the last 30 days" is a claim a reader can see and check, where "page 2" is
 * a claim about nothing. That matters here more than on an ordinary list,
 * because this timeline renders the *stretches between* notes as objects — and
 * a gap marker inside a page has no denominator. It would state a span whose
 * ends were decided by where the page happened to break, which is Rule 3c: a
 * claim over a filtered set that does not carry its filter is false.
 *
 * A window removes that rather than working around it. Every gap inside one is
 * measured between two real notes, and the single boundary — where the window
 * cuts — is not left as a gap marker at all. It is a statement naming the
 * bound and the true elapsed time across it. See `WindowEdge`.
 *
 * Rolling rather than calendar-aligned, unlike the MAR chart's ranges. "The
 * last 30 days" is what the statement says, so it is what the window is; a
 * calendar month would make the sentence false for 30 days out of every 31.
 * The *control* is the MAR chart's, so the two screens behave alike to a
 * reader's hand even though the arithmetic behind them differs.
 */
export type NoteRange = 'week' | 'month'

/** Overdue from Phase 6: the timeline drew all 394 notes until 29/08/2026. */
export const DEFAULT_NOTE_RANGE: NoteRange = 'month'

export const RANGE_DAYS: Record<NoteRange, number> = { week: 7, month: 30 }

/** Reads inside a sentence: "Showing the last 30 days." */
export function rangeLabel(range: NoteRange): string {
  return `the last ${RANGE_DAYS[range]} days`
}

export interface NoteWindow {
  /** Notes inside the window, newest first — the order they arrive in. */
  inWindow: CareNote[]
  /**
   * The newest note *before* the window opens, or `'none'` when the window
   * already reaches the start of the record.
   *
   * `'none'` is a real answer and a different one from "there are older notes
   * we are not drawing": it means the reader is seeing the whole record, and
   * the edge says so rather than implying something lies beyond.
   */
  previous: CareNote | 'none'
  /** Inclusive start of the window. */
  startsAt: IsoDateTime
  /** Exclusive end. `anchor` moved back by however many steps. */
  endsAt: IsoDateTime
  /** How many notes fall outside it, in either direction. */
  excluded: number
}

/**
 * @param notes Newest first, as the fixtures and the client both return them.
 * @param anchorMs The instant the window ends at. Passed in rather than read
 *   from the clock, so a test can pin it and so stepping back is arithmetic on
 *   one value rather than state smeared across the component.
 */
export function windowNotes(
  notes: CareNote[],
  range: NoteRange,
  anchorMs: number,
): NoteWindow {
  const startMs = anchorMs - RANGE_DAYS[range] * 86_400_000
  const startsAt = new Date(startMs).toISOString() as IsoDateTime
  const endsAt = new Date(anchorMs).toISOString() as IsoDateTime

  const inWindow: CareNote[] = []
  let previous: CareNote | 'none' = 'none'

  for (const note of notes) {
    const at = new Date(note.recordedAt).getTime()
    if (at > anchorMs) continue
    if (at >= startMs) {
      inWindow.push(note)
      continue
    }
    // Newest first, so the first note below the window is the newest of them.
    if (previous === 'none') previous = note
  }

  return {
    inWindow,
    previous,
    startsAt,
    endsAt,
    excluded: notes.length - inWindow.length,
  }
}

/** Whole days between two instants, for the sentence across the boundary. */
export function daysBetween(from: IsoDateTime, to: IsoDateTime): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}
