import { Link } from 'react-router-dom'
import type { CareNote, Resident } from '@/data/types'
import { Dialog } from '@/components/primitives'
import { CorrectionTags, NoteMeta, ShiftOverride } from './note-parts'
import { SupervisionRecord } from './SupervisionRecord'
import { ReviewNoteControl } from './ReviewNoteControl'
import styles from './notes.module.css'

/**
 * A note read without leaving the queue.
 *
 * **The queue is a screen somebody works down.** Opening a note used to be a
 * full page navigation: position, filter and scroll all gone, and getting back
 * meant a browser button and a re-render. A senior clearing six flags paid
 * that twelve times.
 *
 * So the row opens the note over the queue. Everything that made the detail
 * screen worth going to is here — the body in full, the meta, the shift
 * override, the correction chain, the supervision record with the wait, and
 * both actions — and closing it returns to exactly the row they left.
 *
 * **The title names the resident**, not the note. PRD §2.4: this is a surface
 * somebody acts on, and a dialog over a list of twenty-eight people has to say
 * which one it is about before it says anything else.
 *
 * The full detail screen is still reachable, and still linked, because a note
 * read in the context of the resident's own timeline answers a different
 * question — what else was happening to this person that day.
 */
export function NotePeek({
  note,
  resident,
  open,
  onOpenChange,
  onChanged,
}: {
  note: CareNote
  resident: Resident
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: (outcome: 'recorded' | 'undone') => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${resident.preferredName} · ${resident.fullLegalName}`}
      description={
        resident.room.kind === 'recorded'
          ? `Room ${resident.room.value}`
          : 'Room not recorded'
      }
    >
      <div className={styles.peek}>
        <p className={styles.peekBody}>{note.body}</p>
        <NoteMeta note={note} />
        <ShiftOverride note={note} />
        <CorrectionTags note={note} />
        <SupervisionRecord note={note} />

        <div className={styles.peekActions}>
          <ReviewNoteControl
            note={note}
            resident={resident}
            onChanged={(outcome) => {
              onOpenChange(false)
              onChanged(outcome)
            }}
          />
          {/* Still linked. A note read beside the resident's own timeline
              answers a different question from a note read in a queue. */}
          <Link
            className={styles.noteLink}
            to={`/residents/${note.residentId}/notes/${note.id}`}
          >
            Open in {resident.preferredName}&rsquo;s record
          </Link>
        </div>
      </div>
    </Dialog>
  )
}
