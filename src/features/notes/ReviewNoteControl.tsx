import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { CareNote, IsoDateTime, Resident } from '@/data/types'
import {
  recordNoteReview,
  reviewRecordedThisSession,
  undoNoteReview,
} from '@/data/access/client'
import { AlertDialog, Button } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import styles from './notes.module.css'

/**
 * Marking a flagged note as reviewed. The supervisory loop closed.
 *
 * A care worker flags a note to ask a senior for a second opinion. Until this
 * existed nothing anywhere could record having given one, so the queue at
 * `/care-notes` could only grow — a screen whose entire purpose is a list that
 * gets worked down, and which could never reach the bottom.
 *
 * **The reviewer and the moment come from the session and the clock.** Never
 * from a form. A field somebody could type a reviewer into is a way to sign
 * off work in another person's name, which is the wrong-subject failure
 * pointed at a member of staff instead of a resident.
 *
 * **The confirmation names the resident and the note**, not "Are you sure?"
 * (PRD §2.4). Which note matters here as much as which resident: a senior
 * working down a queue of six is confirming one row out of six, and the rows
 * differ only in their body text.
 *
 * **The outcome is announced by the screen, not by this control.** Recording
 * a review takes the row off the queue, which unmounts whatever is inside it —
 * so a toast owned here would be destroyed by the very action it was
 * confirming, and never seen. It would also put one toast per row into the
 * DOM. So this reports what happened and the screen says so.
 *
 * **It is undoable for the life of the session**, and that is not a softening
 * of the immutability rule. A submitted care note is never edited and never
 * deleted; this is not the note. It is a supervisory acknowledgement held in
 * memory in a build with no backend, so there is nothing to raise a correction
 * note against and no record to correct. What a mis-click would otherwise
 * remove, silently and until somebody reloaded, is a care worker's request for
 * help. Only a review this session recorded can be taken back — one the
 * fixtures already carried was signed off by somebody else.
 */
export function ReviewNoteControl({
  note,
  resident,
  onChanged,
  /** `inline` on a queue row, where the action column is narrow. */
  size = 'default',
}: {
  note: CareNote
  resident: Resident
  /** What happened, for the screen to announce and to refetch on. */
  onChanged: (outcome: 'recorded' | 'undone') => void
  size?: 'default' | 'inline'
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  /*
   * Marking a flagged note reviewed is the approve act in Care Notes: signing
   * off somebody else's work. Withheld from the auditor, who is the one role
   * signing into this platform with zero write, and not as a disabled button:
   * the control is not theirs to have.
   */
  if (!viewer.canApproveIn('/care-notes')) return null
  if (note.review.kind === 'not_flagged') return null

  const stamp = `${format.instantDate(note.recordedAt)} ${format.time(note.recordedAt)}`

  const record = async () => {
    try {
      await recordNoteReview({
        noteId: note.id,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
      })
      setConfirming(false)
      onChanged('recorded')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That review was not recorded.')
    }
  }

  const undo = async () => {
    try {
      await undoNoteReview({ noteId: note.id })
      onChanged('undone')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'That review was not taken back.',
      )
    }
  }

  return (
    <>
      {note.review.kind === 'flagged_not_reviewed' ? (
        <Button
          variant="secondary"
          size={size === 'inline' ? 'small' : 'medium'}
          onClick={() => setConfirming(true)}
        >
          Mark reviewed
        </Button>
      ) : (
        // Offered only for a review this session recorded. Everything else
        // renders nothing, because there is nothing this user may take back.
        <ReviewedByThisSession note={note} onUndo={undo} size={size} />
      )}

      {error === '' ? null : <p className={styles.formError}>{error}</p>}

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Mark the ${stamp} note as reviewed`}
        description={`This records that you looked at it, as ${currentUser.displayName}, at the time you confirm. It does not change the note, and ${
          note.review.kind === 'flagged_not_reviewed'
            ? note.review.flaggedBy.displayName
            : 'whoever flagged it'
        } stays on the record as having flagged it. You can take it back while this session is open.`}
        confirmLabel="Mark reviewed"
        onConfirm={record}
      />
    </>
  )
}
/**
 * The undo affordance, and only where it is honest.
 *
 * Split out because the condition is easy to get wrong from the outside: a
 * note can be `reviewed` because a senior signed it off weeks ago, or because
 * this user clicked a button a moment ago, and only the second is theirs to
 * take back. The store is the only thing that knows which.
 */
function ReviewedByThisSession({
  note,
  onUndo,
  size,
}: {
  note: CareNote
  onUndo: () => void
  size: 'default' | 'inline'
}) {
  // Asked of the store rather than decided here: a note can be reviewed
  // because a senior signed it off weeks ago or because this user clicked a
  // button a moment ago, and only the store knows which.
  if (!reviewRecordedThisSession(note.id)) return null

  return (
    <Button
      variant="ghost"
      size={size === 'inline' ? 'small' : 'medium'}
      onClick={onUndo}
    >
      Undo review
    </Button>
  )
}
