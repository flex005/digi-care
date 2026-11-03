import {
  CLOCK_IS_OVERRIDDEN,
  CLOCK_REASON,
  GENERATED_AT,
  REAL_NOW,
  clockHref,
} from '@/data/fixtures/clock'
import { HOME_ZONE, homeMinutesOfDay } from '@/data/fixtures/home-zone'
import { roundInProgressAt } from '@/data/fixtures/rounds'
import type { IsoDateTime } from '@/data/types'
import { formatTime } from '@/lib/format'
import styles from './group.module.css'

/** On the home's clock, which is the one the record was built on, never the machine's. */
const hhmm = (at: Date) => formatTime(at.toISOString() as IsoDateTime, HOME_ZONE)

/**
 * The record was drawn at a time somebody chose. PRD §6.7.
 *
 * **On every screen, not on the screens a mapping says are affected.** Every
 * record in the build is generated against this instant, so there is no screen
 * it does not reach; a map from the clock to the screens it touches would be a
 * second rule beside the first, and two rules drift.
 *
 * A record drawn against a pretend instant that does not announce it is the
 * reassurance failure with the reader's own change as the cause, and this one
 * is worse than a changed figure: a wrong figure is wrong in one place, a wrong
 * clock makes every timestamp on every screen agree with each other and with
 * nothing outside.
 */
export function MovedClockBanner() {
  if (!CLOCK_IS_OVERRIDDEN) return null

  const round = roundInProgressAt(homeMinutesOfDay(GENERATED_AT))

  return (
    <p className={styles.clockStrip} data-moved-clock={CLOCK_REASON}>
      <span className={styles.clockNow} data-numeric>
        {hhmm(GENERATED_AT)}
      </span>
      {CLOCK_REASON === 'nearest_round' && round !== undefined
        ? `Showing the ${round} round, which is the nearest one running. Real time ${hhmm(REAL_NOW)}.`
        : `You asked for this time. Real time ${hhmm(REAL_NOW)}.`}
      <a href={clockHref('real')} className={styles.clockLink} data-clock-reset>
        Use the real time
      </a>
    </p>
  )
}
