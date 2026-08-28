import { describe, expect, it } from 'vitest'
import type { CarePlanDomainStatus, IsoDate, IsoDateTime } from '@/data/types'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { DUE_SOON_DAYS, wholeDaysBetween } from '@/lib/review-interval'
import { TIMING_EMPHASIS, reviewTiming } from './review-timing'

/**
 * "Due soon" is derived, so it is pinned.
 *
 * Every figure in this build that comes from `now` gets a pinned instant and a
 * sentence saying why, at the time it is written (§8). This one is the whole
 * point of the module: the answer moves as the clock does, which is exactly
 * why it is not a member of the status union.
 */
const NOW = '2026-08-24T15:00:00.000Z' as IsoDateTime

const complete = (nextReviewOn: string): CarePlanDomainStatus => ({
  kind: 'complete',
  finalisedBy: staffOkonkwo,
  finalisedOn: '2026-02-01' as IsoDate,
  nextReviewOn: nextReviewOn as IsoDate,
})

/**
 * Every date here is derived from the threshold rather than typed.
 *
 * The first version used "60 days out" and "17 days out", which were only
 * inside and outside a *30-day* threshold — changing the constant to 14 broke
 * two tests that were not about the constant's value. An assertion you have to
 * edit when a legitimate change lands was testing the wrong thing (§8), and a
 * threshold asserted against a literal is two figures that can drift.
 */
const TODAY = '2026-08-24'

describe('due soon is arithmetic, not a record', () => {
  it('reads as settled well before the threshold', () => {
    expect(reviewTiming(complete(addDays(TODAY, DUE_SOON_DAYS * 2)), NOW).kind).toBe(
      'settled',
    )
  })

  it('reads as due soon inside the threshold', () => {
    const daysOut = DUE_SOON_DAYS - 1
    const timing = reviewTiming(complete(addDays(TODAY, daysOut)), NOW)
    expect(timing.kind).toBe('due_soon')
    if (timing.kind === 'due_soon') expect(timing.daysUntil).toBe(daysOut)
  })

  it('turns exactly at the named constant, not at a number typed here', () => {
    // Derived from the constant so that changing it changes the test with it —
    // a threshold asserted against a literal is two figures that can drift.
    const on = addDays(TODAY, DUE_SOON_DAYS)
    const after = addDays(TODAY, DUE_SOON_DAYS + 1)

    expect(reviewTiming(complete(on), NOW).kind).toBe('due_soon')
    expect(reviewTiming(complete(after), NOW).kind).toBe('settled')
  })

  it('moves on its own as the clock does', () => {
    // The property that makes it presentation rather than a recorded fact: the
    // same record answers differently on two days, with nothing written.
    const record = complete(addDays(TODAY, DUE_SOON_DAYS - 1))
    const earlier = `${addDays(TODAY, -DUE_SOON_DAYS * 2)}T09:00:00.000Z` as IsoDateTime

    expect(reviewTiming(record, earlier).kind).toBe('settled')
    expect(reviewTiming(record, NOW).kind).toBe('due_soon')
  })
})

describe('the states that are recorded come straight from the status', () => {
  it('passes overdue through with the days the record holds', () => {
    const timing = reviewTiming(
      {
        kind: 'review_due',
        finalisedBy: staffOkonkwo,
        finalisedOn: '2025-06-01' as IsoDate,
        dueOn: '2026-06-01' as IsoDate,
        daysOverdue: 84,
      },
      NOW,
    )
    expect(timing).toEqual({
      kind: 'overdue',
      signed: { by: staffOkonkwo, on: '2025-06-01' },
      dueOn: '2026-06-01',
      daysOverdue: 84,
    })
  })

  it('keeps not started and in progress as themselves', () => {
    expect(reviewTiming({ kind: 'not_started' }, NOW).kind).toBe('not_started')
    expect(
      reviewTiming(
        {
          kind: 'in_progress',
          updatedBy: staffOkonkwo,
          updatedAt: NOW,
        },
        NOW,
      ).kind,
    ).toBe('in_progress')
  })
})

describe('due soon renders quieter than the two that matter', () => {
  it('is quiet, while never started is a gap and overdue is a finding', () => {
    // A recorded plan approaching a date is the least urgent of the three, and
    // the one most likely to crowd the other two.
    expect(TIMING_EMPHASIS.due_soon).toBe('quiet')
    expect(TIMING_EMPHASIS.not_started).toBe('gap')
    expect(TIMING_EMPHASIS.overdue).toBe('finding')
  })

  it('gives every timing an emphasis, so none can render undecided', () => {
    for (const kind of [
      'not_started',
      'in_progress',
      'due_soon',
      'overdue',
      'settled',
    ] as const) {
      expect(TIMING_EMPHASIS[kind], kind).toBeTruthy()
    }
  })
})

describe('the day arithmetic', () => {
  it('counts whole days forward and backward', () => {
    expect(wholeDaysBetween('2026-08-24' as IsoDate, '2026-08-24' as IsoDate)).toBe(0)
    expect(wholeDaysBetween('2026-08-24' as IsoDate, '2026-08-25' as IsoDate)).toBe(1)
    expect(wholeDaysBetween('2026-08-24' as IsoDate, '2026-08-23' as IsoDate)).toBe(-1)
  })

  it('is not thrown by a British Summer Time boundary', () => {
    // 25 October 2026 is when the clocks go back. A 24-hour-based count across
    // it lands on 24.96 days, and truncating rather than rounding would report
    // one day short.
    expect(wholeDaysBetween('2026-10-01' as IsoDate, '2026-10-26' as IsoDate)).toBe(25)
  })
})

/** Adds days to an ISO date, for the threshold test. */
function addDays(from: string, days: number): string {
  const date = new Date(`${from}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
