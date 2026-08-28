import { describe, expect, it } from 'vitest'
import {
  CLOCK_IS_OVERRIDDEN,
  CLOCK_REASON,
  GENERATED_AT,
  clockHref,
  now,
} from './clock'
import { roundInProgressAt } from './rounds'
import { NOW } from './generate'

/**
 * The clock the record is drawn against. PRD §6.7.
 *
 * **One clock, or every timestamp on the screen is compared with an instant it
 * was not drawn against.** The first version moved the fixtures and left the
 * screens reading the real time, so the header said 15:42 over a record of the
 * morning and every "how long ago" was hours out. That is the same defect the
 * donut had between two of its own segments, one layer up.
 */
describe('the record and the screens read one clock', () => {
  it('generates the fixtures against the instant the app calls now', () => {
    /*
     * The same instant, not merely the same clock. Every record is a snapshot
     * taken at one moment and every screen is as of that moment; a `now()`
     * that ticked past it would compare the record with a time it was not
     * drawn against, which is what left the header reading 16:05 over a
     * record of 14:20.
     */
    expect(NOW.getTime()).toBe(GENERATED_AT.getTime())
    expect(now().getTime()).toBe(GENERATED_AT.getTime())
  })

  it('draws the record where a round is running, and says which it did', () => {
    /*
     * A home gives medication four times a day, so most of the day has no
     * round in it and every screen built to show one shows nothing. The
     * record is drawn at the real time when the real time is live, and twenty
     * minutes into the most recent round when it is not.
     *
     * Either way the reason is stated, and the banner reads it: a record drawn
     * against an instant that does not announce itself is the reassurance
     * failure with the reader's own change as the cause.
     */
    const minutes = GENERATED_AT.getHours() * 60 + GENERATED_AT.getMinutes()
    expect(roundInProgressAt(minutes)).toBeDefined()

    expect(CLOCK_REASON).toBe(CLOCK_IS_OVERRIDDEN ? 'nearest_round' : 'real')
  })

  it('builds a link that carries the time, and one that clears it', () => {
    expect(clockHref('08:20')).toContain('at=08%3A20')
    expect(clockHref('')).not.toContain('at=')
  })
})
