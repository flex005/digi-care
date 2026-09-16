import type { TimelineGap } from './timeline'
import { Unrecorded } from '@/components/status'
import { WAKING_HOURS, formatDuration } from '@/lib/shift'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './notes.module.css'

/**
 * A stretch of time with nothing written in it, rendered as an object.
 *
 * PRD §6.3: "The gap is a rendered object, not an absence of rows. This is the
 * invariant applied to time itself." A list that simply jumps from 09:15 to
 * 15:40 has said nothing about the six hours in between, exactly as a blank
 * cell says nothing about whether anyone looked.
 *
 * Two treatments, and the difference between them is a claim about whether
 * anything is wrong:
 *
 *  - **Omission** — hatched. More than four waking hours with nothing written
 *    down. A hole in the record.
 *  - **Overnight** — quiet. The stretch crosses a whole night, and nobody
 *    expects a resident to be written up at 03:00. **Quiet means less visual
 *    weight, never less information**: it still states how long, still says
 *    which hours it covered, and still says plainly that no notes were
 *    expected. A reader who wants to know what happened between 21:00 and
 *    09:00 gets the same facts either way; only the alarm differs.
 *
 * Both state elapsed time and waking time separately rather than folding them
 * into one number, because the waking figure depends on WAKING_HOURS, which is
 * an assumption this build invented. Anyone who disagrees with the window can
 * still read the elapsed figure and judge for themselves.
 */
export function GapMarker({ gap }: { gap: TimelineGap }) {
  const format = useSiteFormat()

  const from = format.time(gap.from)
  const to = gap.isOpen ? 'now' : format.time(gap.to)
  const window = `${from} to ${to}`

  if (gap.gap === 'omission') {
    return (
      <li className={styles.gapRow} data-gap="omission" data-open={gap.isOpen}>
        <Unrecorded
          variant="row"
          label={gap.isOpen ? 'No care note recorded since' : 'No care note recorded'}
          detail={`${formatDuration(gap.elapsedMinutes)}, ${window}${
            // Only where the two figures differ. "· all of it within waking
            // hours" was true of nearly every omission, so it stopped being
            // information and became the tail every marker on the timeline
            // ended with.
            gap.nightMinutes > 0
              ? ` · ${formatDuration(gap.wakingMinutes)} of it within waking hours, the rest overnight`
              : ''
          }`}
        />
      </li>
    )
  }

  return (
    <li className={styles.gapRow} data-gap="overnight">
      <div className={styles.overnight}>
        <span className={styles.overnightLabel}>Overnight</span>
        <span className={styles.overnightDetail}>
          {formatDuration(gap.elapsedMinutes)}, {window}. No notes expected between{' '}
          <span data-numeric>{String(WAKING_HOURS.to).padStart(2, '0')}:00</span> and{' '}
          <span data-numeric>{String(WAKING_HOURS.from).padStart(2, '0')}:00</span>
          {gap.wakingMinutes > 0
            ? `, and ${formatDuration(gap.wakingMinutes)} of this stretch was waking time.`
            : '.'}
        </span>
      </div>
    </li>
  )
}
