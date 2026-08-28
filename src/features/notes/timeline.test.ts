import { describe, expect, it } from 'vitest'
import type { CareNote, CareNoteId, IsoDateTime, ResidentId } from '@/data/types'
import { staffNwosu } from '@/data/fixtures/organisation'
import {
  GAP_THRESHOLD_WAKING_MINUTES,
  NIGHT_LENGTH_MINUTES,
  WAKING_HOURS,
  elapsedMinutesBetween,
  formatDuration,
  shiftAt,
  wakingMinutesBetween,
} from '@/lib/shift'
import { buildTimeline } from './timeline'

/**
 * The invariant applied to time. PRD §6.3.
 *
 * A list of notes can say what happened. It cannot say that for six hours
 * nothing was written down, which is the same failure as a blank cell one
 * dimension over. These tests are about the stretches BETWEEN the rows.
 */

const TZ = 'Europe/London'

// Mid-January: no clock change anywhere near it, so a failure here is a
// failure in the logic and not in a DST edge.
const at = (day: number, hour: number, minute = 0): IsoDateTime =>
  `2026-01-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
    minute,
  ).padStart(2, '0')}:00Z` as IsoDateTime

const note = (id: string, recordedAt: IsoDateTime): CareNote => ({
  id: `note-${id}` as CareNoteId,
  residentId: 'res-test' as ResidentId,
  category: 'general',
  body: 'Settled.',
  mood: { kind: 'not_recorded' },
  recordedBy: staffNwosu,
  recordedAt,
  shift: { kind: 'auto', value: shiftAt(recordedAt, TZ) },
  review: { kind: 'not_flagged' },
  supersededBy: 'none',
  corrects: 'none',
})

const gaps = (items: ReturnType<typeof buildTimeline>) =>
  items.flatMap((item) => (item.kind === 'gap' ? [item] : []))

describe('waking hours are counted, not clock hours', () => {
  it('counts only time inside the waking window', () => {
    // 21:00 to 09:00 the next day: twelve hours elapsed, but only the hour
    // before 22:00 and the two after 07:00 are waking.
    expect(wakingMinutesBetween(at(12, 21), at(13, 9), TZ)).toBe(180)
    expect(elapsedMinutesBetween(at(12, 21), at(13, 9))).toBe(720)
  })

  it('counts a whole waking day as the window length', () => {
    const full = (WAKING_HOURS.to - WAKING_HOURS.from) * 60
    expect(wakingMinutesBetween(at(12, 0), at(13, 0), TZ)).toBe(full)
  })

  it('counts nothing for a stretch entirely inside the night', () => {
    expect(wakingMinutesBetween(at(12, 23), at(13, 5), TZ)).toBe(0)
  })
})

describe('shifts', () => {
  it.each([
    [7, 'early'],
    [13, 'early'],
    [14, 'late'],
    [20, 'late'],
    [21, 'night'],
    [23, 'night'],
    // The hours the fixture generator never produces, and would have called
    // "early" if it had.
    [3, 'night'],
    [6, 'night'],
  ])('%i:00 is the %s shift', (hour, expected) => {
    expect(shiftAt(at(12, hour), TZ)).toBe(expected)
  })
})

describe('a gap is a rendered object, not an absence of rows', () => {
  it('marks more than four waking hours as an omission', () => {
    const items = buildTimeline(
      [note('b', at(12, 15, 40)), note('a', at(12, 9, 15))],
      TZ,
      at(12, 16),
    )
    const [gap] = gaps(items)
    expect(gap?.gap).toBe('omission')
    expect(gap?.wakingMinutes).toBe(385)
    expect(gap?.wakingMinutes).toBeGreaterThan(GAP_THRESHOLD_WAKING_MINUTES)
  })

  it('does not mark a night as an omission', () => {
    // Twelve hours elapsed, three of them waking. Nobody is written up at
    // 03:00, and flagging every resident every night discriminates nothing.
    const items = buildTimeline(
      [note('b', at(13, 9)), note('a', at(12, 21))],
      TZ,
      at(13, 9, 30),
    )
    const [gap] = gaps(items)
    expect(gap?.gap).toBe('overnight')
  })

  it('still states the night gap in full, quietly', () => {
    // Quiet means less visual weight, never less information.
    const items = buildTimeline(
      [note('b', at(13, 9)), note('a', at(12, 21))],
      TZ,
      at(13, 9, 30),
    )
    const [gap] = gaps(items)
    expect(gap?.elapsedMinutes).toBe(720)
    expect(gap?.nightMinutes).toBe(540)
    expect(gap?.nightMinutes).toBeGreaterThanOrEqual(NIGHT_LENGTH_MINUTES)
  })

  it('calls a long stretch that includes a night an omission, not a night', () => {
    // 19:00 to 14:00 the next day. Three waking hours before the night and
    // seven after it: the omission is real and the night does not excuse it.
    const items = buildTimeline(
      [note('b', at(13, 14)), note('a', at(12, 19))],
      TZ,
      at(13, 14, 30),
    )
    const [gap] = gaps(items)
    expect(gap?.gap).toBe('omission')
    expect(gap?.nightMinutes).toBeGreaterThan(0)
  })

  it('says nothing about a normal stretch between two notes', () => {
    const items = buildTimeline(
      [note('b', at(12, 13)), note('a', at(12, 11))],
      TZ,
      at(12, 13, 30),
    )
    expect(gaps(items)).toHaveLength(0)
  })
})

describe('the open gap', () => {
  /**
   * The one a plain list cannot show at all. A resident last written up six
   * waking hours ago has a hole in their record and it is open right now.
   */
  it('measures the newest note against now, and marks it open', () => {
    const items = buildTimeline([note('a', at(12, 9))], TZ, at(12, 17))
    const [gap] = gaps(items)
    expect(gap?.isOpen).toBe(true)
    expect(gap?.gap).toBe('omission')
    // And it is first, because it is the one somebody can still do something
    // about.
    expect(items[0]?.kind).toBe('gap')
  })

  it('is absent when the newest note is recent', () => {
    const items = buildTimeline([note('a', at(12, 15))], TZ, at(12, 16))
    expect(gaps(items)).toHaveLength(0)
  })

  it('renders nothing at all when there are no notes', () => {
    // Not an empty timeline with a gap from the beginning of time: nobody
    // knows when this record was supposed to start. The screen says "never
    // written up" in words instead.
    expect(buildTimeline([], TZ, at(12, 16))).toEqual([])
  })
})

describe('durations are stated, never rounded away', () => {
  it.each([
    [0, '0 minutes'],
    [1, '1 minute'],
    [59, '59 minutes'],
    [60, '1 hour'],
    [61, '1 hour 1 minute'],
    [385, '6 hours 25 minutes'],
    [720, '12 hours'],
  ])('%i minutes reads as "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})
