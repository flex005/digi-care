import {
  CLOCK_IS_OVERRIDDEN,
  CLOCK_REASON,
  GENERATED_AT,
  REAL_NOW,
  clockHref,
} from '@/data/fixtures/clock'
import { roundInProgressAt } from '@/data/fixtures/rounds'
import styles from './group.module.css'

const hhmm = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

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

  const round = roundInProgressAt(
    GENERATED_AT.getHours() * 60 + GENERATED_AT.getMinutes(),
  )

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
