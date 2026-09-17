import { now as appNow } from '@/data/fixtures/clock'
import { useId, useState } from 'react'
import type { IsoDateTime } from '@/data/types'
import { closeOmission, type Omission } from '@/data/access/client'
import { AlertDialog, Button } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import styles from './medications.module.css'

/**
 * Closing an omission: who looked, when, and why. CW PRD MED-01, shared with the
 * Care Worker build through `closeOmission`.
 *
 * **Closing records a decision about the gap and fills nothing.** The dose
 * stays a dose with no record, hatched wherever it appears, and the closure
 * renders beside it. The dialog says so before the confirm, because a reader
 * who believed closing it accounted for the dose would stop looking for it.
 *
 * **Drawn only where this build lets the viewer record in Medications.** No
 * permission rule was invented for it. The act is not named in this build's
 * permission table, and the nearest existing question is whether the viewer
 * can write what Medications records. Of the roles that sign into this
 * product that is the registered manager and the deputy; the auditor reads.
 * The CW PRD gives the act to a senior carer or a manager and withholds it
 * from a care worker, which this build's matrix row for a care worker does not
 * express; neither role signs in here.
 *
 * **The closer and the moment come from the session and the clock**, never
 * from a form: a field somebody could type a name into is a way to close a gap
 * in another person's name.
 *
 * **The reason is required and pre-filled with nothing.** A closure nobody
 * explained is a dismissal, and the client refuses a blank one too; holding
 * the confirm only saves the round trip.
 *
 * **Nobody is told.** Closing records a decision in this browser and sends
 * nothing, so the dialog says in one line that nobody is notified and that
 * telling anybody who needs to know is the reader's to do. A manager who read
 * "closed" as "the GP knows" might not telephone the GP.
 *
 * **The outcome is announced by the screen, not by this control**, which is
 * replaced by the closure once the row reloads. Same shape as marking a
 * flagged care note reviewed.
 */
export function CloseOmissionControl({
  omission,
  onClosed,
}: {
  omission: Omission
  /** For the screen to announce, and to reload on. */
  onClosed: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const fieldId = useId()

  if (!viewer.canRecordIn('/medications')) return null
  if (omission.closure.kind === 'closed') return null

  const { resident, medication, record } = omission
  const when = `${record.roundTime}, ${format.instantDate(omission.dueAt)}`

  const setOpen = (open: boolean) => {
    setConfirming(open)
    // Each confirmation asks afresh: a reason left over from a dialog somebody
    // cancelled is a reason for a decision they walked away from.
    if (!open) setReason('')
    if (open) setError('')
  }

  const close = async () => {
    const given = reason.trim()
    if (given === '') return
    try {
      await closeOmission({
        medicationId: record.medicationId,
        date: record.date,
        roundTime: record.roundTime,
        reason: given,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
      })
      setOpen(false)
      onClosed()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That omission was not closed.')
    }
  }

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        Close omission
      </Button>

      {error === '' ? null : (
        <p className={styles.closeError} role="alert">
          {error}
        </p>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={setOpen}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Close the ${when} omission of ${medication.name} ${medication.dose}`}
        description={
          <span className={styles.closeConfirm}>
            <span>
              {`This records that ${currentUser.displayName} looked at it and why. The dose still has no record, and stays marked that way.`}
            </span>
            <span className={styles.closeField}>
              <label className={styles.closeLabel} htmlFor={`${fieldId}-reason`}>
                Why is it closed?
              </label>
              <textarea
                id={`${fieldId}-reason`}
                className={styles.closeTextarea}
                rows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </span>
            <span className={styles.closeNotice} data-not-performed>
              Nobody is notified. If the GP, pharmacy or family need to know, tell them.
            </span>
          </span>
        }
        confirmLabel="Close omission"
        confirmDisabled={reason.trim() === ''}
        onConfirm={() => {
          void close()
        }}
      />
    </>
  )
}
