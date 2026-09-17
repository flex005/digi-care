import { now as appNow } from '@/data/fixtures/clock'
import { useId, useState } from 'react'
import type { CareNote, IsoDateTime, Resident, ReviewOutcome } from '@/data/types'
import { REVIEW_OUTCOMES } from '@/data/types'
import {
  recordNoteReview,
  reviewRecordedThisSession,
  undoNoteReview,
} from '@/data/access/client'
import { AlertDialog, Button, RadioGroup } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { assertNever } from '@/lib/assert-never'
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
 * **It asks what was done, and pre-answers nothing.** CW PRD CN-01's "Action
 * taken?" opens on no outcome chosen, and the confirm stays disabled until one
 * is. A default of "No further action needed" would record a decision nobody
 * made, on the one act that closes a care worker's request for help. "Other"
 * needs words, because "Other" alone tells the next reader nothing.
 *
 * **The outcome is recorded, not performed.** Choosing "Incident raised" does
 * not raise an incident and "Care plan updated" does not touch the plan; the
 * dialog says so beside the choice, because a senior who believed otherwise
 * might not go and do it.
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
  // Nothing chosen is a real state, and the one the question opens on.
  const [outcomeKind, setOutcomeKind] = useState<ReviewOutcome['kind'] | undefined>(
    undefined,
  )
  const [otherText, setOtherText] = useState('')
  const fieldId = useId()

  /*
   * Marking a flagged note reviewed is the approve act in Care Notes: signing
   * off somebody else's work. Withheld from the auditor, who is the one role
   * signing into this platform with zero write, and not as a disabled button:
   * the control is not theirs to have.
   */
  if (!viewer.canApproveIn('/care-notes')) return null
  if (note.review.kind === 'not_flagged') return null

  const stamp = `${format.instantDate(note.recordedAt)} ${format.time(note.recordedAt)}`

  const outcome = chosenOutcome(outcomeKind, otherText)

  const setOpen = (open: boolean) => {
    setConfirming(open)
    // Each confirmation asks afresh. An answer left over from a dialog somebody
    // cancelled is an answer to a question they walked away from.
    if (!open) {
      setOutcomeKind(undefined)
      setOtherText('')
    }
  }

  const record = async () => {
    if (outcome === 'none') return
    try {
      await recordNoteReview({
        noteId: note.id,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
        outcome,
      })
      setOpen(false)
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
          onClick={() => setOpen(true)}
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
        onOpenChange={setOpen}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Mark the ${stamp} note as reviewed`}
        description={
          <span className={styles.reviewConfirm}>
            <span>
              {`This records that ${currentUser.displayName} looked at it; the note, and ${
                note.review.kind === 'flagged_not_reviewed'
                  ? note.review.flaggedBy.displayName
                  : 'whoever flagged it'
              } as having flagged it, stay as they are.`}
            </span>
            <span className={styles.reviewConfirmField}>
              <span className={styles.fieldLabel} aria-hidden>
                Action taken?
              </span>
              <RadioGroup
                legend="Action taken?"
                value={outcomeKind}
                onValueChange={(value) => {
                  const kind = REVIEW_OUTCOMES.find((option) => option.id === value)?.id
                  if (kind === undefined) return
                  setOutcomeKind(kind)
                  if (kind !== 'other') setOtherText('')
                }}
                options={REVIEW_OUTCOMES.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
              />
              <span className={styles.fieldHint}>
                This records what you did. It does not update the care plan or raise an
                incident.
              </span>
            </span>
            {outcomeKind === 'other' ? (
              <span className={styles.reviewConfirmField}>
                <label className={styles.fieldLabel} htmlFor={`${fieldId}-other`}>
                  What was done?
                </label>
                <textarea
                  id={`${fieldId}-other`}
                  className={styles.textarea}
                  rows={2}
                  required
                  value={otherText}
                  onChange={(event) => setOtherText(event.target.value)}
                />
              </span>
            ) : null}
          </span>
        }
        confirmLabel="Mark reviewed"
        confirmDisabled={outcome === 'none'}
        onConfirm={() => {
          void record()
        }}
      />
    </>
  )
}
/**
 * The outcome the dialog would record, or that it cannot record one yet.
 *
 * "Other" with no words is not an outcome: the client refuses it too, and this
 * only saves the round trip by holding the confirm.
 */
function chosenOutcome(
  kind: ReviewOutcome['kind'] | undefined,
  otherText: string,
): ReviewOutcome | 'none' {
  switch (kind) {
    case undefined:
      return 'none'
    case 'other':
      return otherText.trim() === ''
        ? 'none'
        : { kind: 'other', text: otherText.trim() }
    case 'no_further_action':
    case 'care_plan_updated':
    case 'incident_raised':
      return { kind }
    default:
      return assertNever(kind)
  }
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
