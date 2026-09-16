import { useState } from 'react'
import type { Activity } from '@/data/types'
import { Button, Dialog } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { cancelSession } from '@/data/access/activity-store'
import { pluralise } from '@/lib/format'
import styles from './activities.module.css'

/**
 * Calling a session off. AM v2.0 ACT-01, Phase 20.
 *
 * **AM v2.0 asks whether to remove attendance already recorded, and this
 * refuses the question.** Somebody wrote that a resident came, with their name
 * and the time on it. A later decision about the session does not make that
 * untrue, and discarding those records would be a record editing itself —
 * which is the shape consent withdrawal settled: a withdrawal supersedes a
 * consent and never erases it, because the earlier record is evidence of what
 * somebody did.
 *
 * So the confirmation does not ask. It **says what stays**, counted, before
 * anybody decides — the same reason the sign-out confirmation names what it
 * would destroy item by item rather than saying "unsaved changes will be
 * lost". A reader can hold a count against what they can see.
 *
 * **The reason is required**, and refused rather than defaulted. A cancelled
 * session with no reason says a session did not happen and nothing about why,
 * which is the question anybody reading it back has.
 */
export function CancelSession({
  activity,
  onCancelled,
}: {
  activity: Activity
  onCancelled: () => void
}) {
  const { currentUser } = useSession()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (activity.standing.kind === 'cancelled') return null

  const recorded = activity.invited.filter(
    (invitation) => invitation.attendance.kind !== 'not_recorded',
  ).length

  return (
    <>
      <Button
        variant="secondary"
        size="small"
        data-cancel-open
        onClick={() => setOpen(true)}
      >
        Cancel this session
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setReason('')
        }}
        title={`Cancel ${activity.name}?`}
        description={`It stays on the calendar, marked cancelled, with your name and your reason on it.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep the session
            </Button>
            <Button
              variant="primary"
              disabled={reason.trim() === ''}
              data-confirm-cancel
              onClick={() => {
                cancelSession(activity, reason, currentUser)
                setOpen(false)
                setReason('')
                onCancelled()
              }}
            >
              Cancel the session
            </Button>
          </>
        }
      >
        <p className={styles.cancelBody} data-attendance-kept>
          {recorded === 0 ? (
            <>Nobody&rsquo;s attendance has been recorded yet.</>
          ) : (
            <>
              <b>
                {pluralise(recorded, 'attendance record')} already written stay exactly
                as they are.
              </b>
            </>
          )}
        </p>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Why is it being cancelled?</span>
          <textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-field="cancel-reason"
          />
        </label>
      </Dialog>
    </>
  )
}
