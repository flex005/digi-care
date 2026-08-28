import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CareNote, Resident } from '@/data/types'
import { CorrectionTags, NoteMeta, ReviewState, ShiftOverride } from './note-parts'
import { ReviewNoteControl } from './ReviewNoteControl'
import { NotePeek } from './NotePeek'
import styles from './notes.module.css'

/**
 * One note in the cross-resident queue. Four aligned columns.
 *
 *   resident   preferred name, over full legal name and room
 *   flag       whether anybody has looked at it yet
 *   note       the body, with its meta beneath
 *   action     open it
 *
 * **A queue is scanned, not read**, and that is the whole reason this is not
 * the card the profile timeline uses. As stacked blocks, three notes filled a
 * screen and the action sat on a line of its own, so a supervisor working
 * through what is waiting had to read every note to find the next name. In
 * columns the eye runs down one at a time: all the names, or all the flag
 * states, or all the times.
 *
 * The alignment is the point rather than the density. Every row is the same
 * shape whether its note is one line or six, so nothing shifts as you go down
 * — and the note body is never clipped to achieve it, because a care note cut
 * off mid-sentence is a care note somebody misreads.
 *
 * The subject column is the difference from every other arrangement of a
 * note: on this screen the reader does not yet know who they are looking at,
 * and a cross-resident note with no name on it cannot be read at all.
 */
export function NoteQueueRow({
  note,
  resident,
  onChanged,
}: {
  note: CareNote
  resident: Resident
  /** What a review action did, for the screen to announce and refetch on. */
  onChanged: (outcome: 'recorded' | 'undone') => void
}) {
  const superseded = note.supersededBy !== 'none'
  const [peeking, setPeeking] = useState(false)

  return (
    <li
      className={[styles.queueRow, superseded ? styles.noteSuperseded : '']
        .filter(Boolean)
        .join(' ')}
      data-note={note.id}
      data-superseded={superseded}
      data-layout="row"
    >
      <div className={styles.queueSubject}>
        <Link className={styles.queueName} to={`/residents/${resident.id}/notes`}>
          {resident.preferredName}
        </Link>
        <p className={styles.queueFacts}>
          {resident.fullLegalName}
          {resident.room.kind === 'recorded'
            ? ` · Room ${resident.room.value}`
            : ' · Room not recorded'}
        </p>
      </div>

      <div className={styles.queueFlag}>
        <ReviewState note={note} />
      </div>

      <div className={styles.queueMain}>
        {/* Opening the note is the row. A stacked "Open" link under the button
            cost every row two lines of height for something the body text
            already does — and a real link rather than a click handler, so a
            keyboard reaches it too. */}
        <button
          type="button"
          className={styles.queueBodyLink}
          onClick={() => setPeeking(true)}
        >
          <span className={styles.noteBody}>{note.body}</span>
        </button>
        {/* Mood off this line: a second hatch competes with the flag for the
            one thing this screen is asking the reader to see. */}
        <NoteMeta note={note} showMood={false} />
        <ShiftOverride note={note} />
        <CorrectionTags note={note} />
      </div>

      {/* One control. The queue is worked down from here, so the action that
          empties it is on the row — clearing six flags from the note detail
          would be six round trips. */}
      <div className={styles.queueAction}>
        <ReviewNoteControl
          note={note}
          resident={resident}
          onChanged={onChanged}
          size="inline"
        />
      </div>

      <NotePeek
        note={note}
        resident={resident}
        open={peeking}
        onOpenChange={setPeeking}
        onChanged={onChanged}
      />
    </li>
  )
}
