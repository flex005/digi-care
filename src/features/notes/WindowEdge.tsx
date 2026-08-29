import type { CareNote, IsoDateTime } from '@/data/types'
import { formatInstantDate, pluralise } from '@/lib/format'
import { useTimeZone } from '@/app/session/use-session'
import { daysBetween, rangeLabel, type NoteRange } from './note-window'
import styles from './notes.module.css'

/**
 * Where the window cuts, at the foot of the timeline.
 *
 * **Deliberately not a gap marker.** A gap marker is a claim about a stretch
 * in which nothing was written, and the stretch below the oldest note shown is
 * not that — it is a stretch we chose not to draw. Drawing it as a gap would
 * be the screen inventing a hole out of its own scrolling decision, which is
 * the failure this product exists to prevent, arriving from the one direction
 * nobody watches: a *layout* choice becoming a *clinical* claim.
 *
 * So it states two things instead, and both are true:
 *
 *  - the bound, in the reader's words — "Showing the last 30 days";
 *  - what actually lies past it — the previous note's date and the real
 *    elapsed time between it and the oldest note drawn.
 *
 * Nothing is fabricated and nothing is hidden. A reader can see the limit, see
 * that there is more, and see how much time separates the two.
 *
 * When the window already reaches the start of the record, it says so. "There
 * are no earlier notes" is a different fact from "there are earlier notes we
 * are not showing", and a reader deciding whether they have the whole history
 * needs to know which one they are looking at.
 */
export function WindowEdge({
  range,
  previous,
  oldestShown,
}: {
  range: NoteRange
  previous: CareNote | 'none'
  /** The oldest note actually drawn, which the sentence measures back from. */
  oldestShown: IsoDateTime | 'none'
}) {
  const timeZone = useTimeZone()

  return (
    <li className={styles.windowEdge} data-window-edge>
      <p className={styles.windowEdgeBound}>Showing {rangeLabel(range)}.</p>
      <p className={styles.windowEdgeDetail}>
        {previous === 'none' ? (
          // The whole record is on screen. Said plainly, because the absence
          // of an edge is otherwise indistinguishable from an edge nobody
          // mentioned.
          <>There are no notes before this. This is the whole record.</>
        ) : (
          <>
            The previous note was {formatInstantDate(previous.recordedAt, timeZone)}
            {oldestShown === 'none' ? (
              <>. Widen the range to reach it.</>
            ) : (
              <>
                , {pluralise(daysBetween(previous.recordedAt, oldestShown), 'day')}{' '}
                before the one above.
              </>
            )}
          </>
        )}
      </p>
    </li>
  )
}
