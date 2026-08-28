import type { CareNote, IsoDateTime } from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { gapThresholdWakingMinutes } from '@/data/access/settings-store'
import {
  NIGHT_LENGTH_MINUTES,
  elapsedMinutesBetween,
  wakingMinutesBetween,
} from '@/lib/shift'

/**
 * The timeline, as objects. PRD §6.3:
 *
 * > Gaps of more than 4 waking hours render as an explicit hatched gap marker
 * > in the timeline. **The gap is a rendered object, not an absence of rows.**
 * > This is the invariant applied to time itself.
 *
 * That last sentence is the whole design. A list of notes with nothing between
 * them says "here is what happened"; it cannot say "and here is a stretch
 * where nothing was written down", which is the same failure as a blank cell
 * one dimension over. So every interval between two consecutive notes is
 * classified and, if it says anything, rendered.
 *
 * Three outcomes per interval:
 *
 *  - **omission** — more than four waking hours with nothing written.
 *    Hatched. This is a hole in the record.
 *  - **overnight** — the interval crosses a whole night. Quiet, because
 *    nobody expects a resident to be written up at 03:00, but still rendered
 *    with its duration stated: quiet means less visual weight, never less
 *    information. The record has to visibly continue through the night rather
 *    than jumping a day.
 *  - **nothing** — a normal stretch between two notes on the same shift.
 *
 * An interval can be both; omission wins, and its wording says the stretch
 * included a night so the reader is not left thinking somebody was ignored at
 * four in the morning.
 *
 * **The first interval is the one that matters most**, and it is the one a
 * plain list cannot show at all: the stretch from the newest note to *now*. A
 * resident last written up six waking hours ago has an open gap, and it is
 * open right now.
 */

export type GapKind = 'omission' | 'overnight'

export interface TimelineGap {
  kind: 'gap'
  gap: GapKind
  /** The earlier bound: the note this gap opens after. */
  from: IsoDateTime
  /** The later bound: the next note, or now for the open gap at the top. */
  to: IsoDateTime
  /** True when `to` is now rather than another note. */
  isOpen: boolean
  elapsedMinutes: number
  wakingMinutes: number
  /** Elapsed minus waking. Stated separately; never folded into one figure. */
  nightMinutes: number
}

export interface TimelineNote {
  kind: 'note'
  note: CareNote
}

export type TimelineItem = TimelineNote | TimelineGap

function classify(
  from: IsoDateTime,
  to: IsoDateTime,
  isOpen: boolean,
  timeZone: TimeZone,
): TimelineGap | undefined {
  const elapsedMinutes = elapsedMinutesBetween(from, to)
  const wakingMinutes = wakingMinutesBetween(from, to, timeZone)
  const nightMinutes = Math.max(0, elapsedMinutes - wakingMinutes)

  const base = { from, to, isOpen, elapsedMinutes, wakingMinutes, nightMinutes }

  if (wakingMinutes > gapThresholdWakingMinutes()) {
    return { kind: 'gap', gap: 'omission', ...base }
  }

  // A whole night, not merely some minutes after 22:00. Derived from
  // WAKING_HOURS rather than a second threshold nobody could justify.
  if (nightMinutes >= NIGHT_LENGTH_MINUTES) {
    return { kind: 'gap', gap: 'overnight', ...base }
  }

  return undefined
}

/**
 * @param notes Newest first. Filtered ones are fine; the gaps then describe
 *   the filtered view, which is why the timeline says so on screen when a
 *   filter is active.
 * @param now The instant the open gap is measured to. Passed in rather than
 *   read from the clock, so a test can pin it.
 */
export function buildTimeline(
  notes: CareNote[],
  timeZone: TimeZone,
  now: IsoDateTime,
): TimelineItem[] {
  const items: TimelineItem[] = []
  if (notes.length === 0) return items

  const open = classify(notes[0]!.recordedAt, now, true, timeZone)
  if (open) items.push(open)

  for (const [index, note] of notes.entries()) {
    items.push({ kind: 'note', note })
    const next = notes[index + 1]
    if (!next) continue
    const gap = classify(next.recordedAt, note.recordedAt, false, timeZone)
    if (gap) items.push(gap)
  }

  return items
}
