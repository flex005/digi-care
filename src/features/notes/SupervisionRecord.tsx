import { now as appNow } from '@/data/fixtures/clock'
import type { CareNote } from '@/data/types'
import { elapsedMinutesBetween, formatDuration } from '@/lib/shift'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './notes.module.css'

/**
 * What happened after somebody asked for a second opinion, in full.
 *
 * The queue sorts on the wait, because the wait is the finding — a note that
 * has been waiting three days is a different problem from one flagged this
 * morning. **That does not stop being true once the note leaves the queue.**
 * Two timestamps side by side make a reader do the arithmetic; the figure is
 * the thing they came for, so it is stated.
 *
 * Rendered on the note detail rather than on the queue row, because the queue
 * is scanned and this is read. On the row the flag chip carries who and when,
 * which is what ranks one row against another.
 *
 * Nothing here is hatched. A flag that was answered is a complete record, and
 * a slow answer is a finding about the answer rather than a hole in the
 * record — Rule 3 in both directions. The wait is stated plainly and lets the
 * reader judge; the product does not have a threshold for it and inventing one
 * would be a claim nobody has signed off.
 */
export function SupervisionRecord({ note }: { note: CareNote }) {
  const format = useSiteFormat()

  if (note.review.kind === 'not_flagged') return null

  if (note.review.kind === 'flagged_not_reviewed') {
    const waiting = elapsedMinutesBetween(
      note.review.flaggedAt,
      appNow().toISOString() as never,
    )
    return (
      <dl className={styles.supervision} data-supervision="waiting">
        <div className={styles.supervisionRow}>
          <dt className={styles.supervisionTerm}>Flagged</dt>
          <dd className={styles.supervisionValue}>
            {note.review.flaggedBy.displayName},{' '}
            <span data-numeric>{format.dateTime(note.review.flaggedAt)}</span>
          </dd>
        </div>
        <div className={styles.supervisionRow}>
          <dt className={styles.supervisionTerm}>Waiting</dt>
          <dd className={styles.supervisionValue}>
            <strong>{formatDuration(waiting)}</strong> so far. Nobody has looked at it
            yet.
          </dd>
        </div>
      </dl>
    )
  }

  const { flaggedBy, flaggedAt, reviewedBy, reviewedAt } = note.review
  const waited = elapsedMinutesBetween(flaggedAt, reviewedAt)
  const bySamePerson = flaggedBy.id === reviewedBy.id

  return (
    <dl className={styles.supervision} data-supervision="reviewed">
      <div className={styles.supervisionRow}>
        <dt className={styles.supervisionTerm}>Flagged</dt>
        <dd className={styles.supervisionValue}>
          {flaggedBy.displayName},{' '}
          <span data-numeric>{format.dateTime(flaggedAt)}</span>
        </dd>
      </div>
      <div className={styles.supervisionRow}>
        <dt className={styles.supervisionTerm}>Reviewed</dt>
        <dd className={styles.supervisionValue}>
          {reviewedBy.displayName},{' '}
          <span data-numeric>{format.dateTime(reviewedAt)}</span>
        </dd>
      </div>
      <div className={styles.supervisionRow}>
        <dt className={styles.supervisionTerm}>Waited</dt>
        <dd className={styles.supervisionValue}>
          <strong>{formatDuration(waited)}</strong>
          {bySamePerson ? (
            // Stated, not judged. Somebody raising a question and answering it
            // themselves is a legitimate thing to do; it is simply not the
            // second opinion the flag asked for, and only the record showing
            // both names lets a reader tell.
            <>
              {' '}
              : flagged and cleared by the same person, so no second opinion was given
            </>
          ) : null}
        </dd>
      </div>
    </dl>
  )
}
