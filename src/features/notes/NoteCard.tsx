import { Link } from 'react-router-dom'
import type { CareNote } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import { CorrectionTags, NoteMeta, ReviewState, ShiftOverride } from './note-parts'
import styles from './notes.module.css'

/**
 * One care note, on a screen that reads it rather than scans it.
 *
 * **Two layouts here, and a third component for the queue.**
 *
 *   `railed`   the resident's own timeline. The subject is settled — it is in
 *              the header above — and what the reader is scanning is *when*.
 *              The time moves out to a rail on the left, and the notes and
 *              the gap markers between them line up against a single column
 *              of clock times. That is what makes a gap marker legible as a
 *              stretch rather than as one more row.
 *   `stacked`  the detail screen, which is a single note and has nothing to
 *              align with.
 *
 * The cross-resident queue is `NoteQueueRow`, not a third branch here. It
 * asks a different question — which of these is waiting, and on whom — so it
 * needs a subject column and a flag column this shape has no place for. Both
 * render the same facts from `note-parts.tsx`, so the two cannot drift.
 */
export function NoteCard({
  note,
  /** Shown where a note without a name on it would be unreadable. Omitted on
   *  the profile timeline, where the header already says who. */
  subject,
  /** False on the detail screen, which is already the note. A link to where
   *  you are is a link somebody presses once and learns to distrust. */
  linked = true,
  layout = 'stacked',
  /**
   * False on the note detail, where the supervision panel below states the
   * review state and the wait with it. A chip here saying the same thing was
   * the same fact twice on one screen.
   */
  showReviewState = true,
}: {
  note: CareNote
  subject?: { id: string; name: string }
  linked?: boolean
  layout?: 'stacked' | 'railed'
  showReviewState?: boolean
}) {
  const format = useSiteFormat()
  const superseded = note.supersededBy !== 'none'
  const railed = layout === 'railed'

  return (
    <li
      className={[
        railed ? styles.noteRailed : styles.note,
        superseded ? styles.noteSuperseded : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-note={note.id}
      data-superseded={superseded}
      data-layout={layout}
    >
      {railed ? (
        // The rail. Time over date, so a day of notes reads as one column of
        // clock times and the gaps between them have something to span.
        //
        // It carries the zone, because a clinical timestamp without one is
        // ambiguous (CLAUDE.md §6). That makes it the record rather than an
        // aid to scanning, which is why the meta line below drops the stamp
        // on this layout instead of printing it twice.
        <p className={styles.rail}>
          <span className={styles.railTime} data-numeric>
            {format.time(note.recordedAt)}
          </span>
          <span className={styles.railDate} data-numeric>
            {format.instantDate(note.recordedAt)}
          </span>
        </p>
      ) : null}

      <div className={railed ? styles.railedBody : styles.stackedBody}>
        {subject ? (
          <Link className={styles.noteSubject} to={`/residents/${subject.id}/notes`}>
            {subject.name}
          </Link>
        ) : null}

        <p className={styles.noteBody}>{note.body}</p>

        <NoteMeta note={note} showTimestamp={!railed} />

        <ShiftOverride note={note} />

        {showReviewState ? (
          <div className={styles.noteTags}>
            <ReviewState note={note} />
          </div>
        ) : null}

        <CorrectionTags note={note} />

        {linked ? (
          // Absolute, not relative. This card renders on more than one screen
          // and a relative link resolves differently in each. The note
          // belongs to a resident wherever it is being read from.
          <Link
            className={styles.noteLink}
            to={`/residents/${note.residentId}/notes/${note.id}`}
          >
            Open this note
          </Link>
        ) : null}
      </div>
    </li>
  )
}
