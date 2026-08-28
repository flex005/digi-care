import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { HandoverId, HandoverStatus, IsoDateTime, Resident } from '@/data/types'
import { recordHandoverStatus } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { Button, Dialog, RadioGroup } from '@/components/primitives'
import styles from './handover.module.css'

/**
 * Setting one resident's handover status.
 *
 * A write surface, so it names the subject in its title and on its button
 * (§2.4). It is a small one, but a status set against the wrong resident is
 * how the wrong person gets watched overnight and the right one does not.
 *
 * There is no default selection. The radio group opens on nothing chosen, so
 * "All well" is something somebody says rather than something the form said
 * for them.
 */
type Choice = 'all_well' | 'needs_attention' | 'urgent'

export function StatusDialog({
  handoverId,
  resident,
  current,
  onRecorded,
}: {
  handoverId: HandoverId
  resident: Resident
  current: HandoverStatus
  /**
   * Reports what was recorded, for the screen to announce. Not announced here:
   * this dialog sits inside a row that the write moves to another group, so a
   * toast owned here would be unmounted by the action it was confirming.
   */
  onRecorded: (residentName: string, status: string) => void
}) {
  const { currentUser } = useSession()
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<Choice | undefined>(undefined)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  /** What each status is called in the acknowledgement, in the reader's words. */
  const LABELS: Record<'all_well' | 'needs_attention' | 'urgent', string> = {
    all_well: 'all well',
    needs_attention: 'needing attention',
    urgent: 'urgent',
  }

  const needsNote = choice === 'needs_attention' || choice === 'urgent'
  const ready = choice !== undefined && (!needsNote || note.trim().length > 0)

  const submit = async () => {
    if (choice === undefined) return
    const at = appNow().toISOString() as IsoDateTime
    const status: HandoverStatus =
      choice === 'all_well'
        ? { kind: 'all_well', recordedBy: currentUser, recordedAt: at }
        : { kind: choice, note: note.trim(), recordedBy: currentUser, recordedAt: at }

    try {
      await recordHandoverStatus({ handoverId, residentId: resident.id, status })
      setOpen(false)
      setError('')
      onRecorded(resident.preferredName, LABELS[choice])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nothing was recorded')
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setChoice(undefined)
          setNote('')
          setError('')
          setOpen(true)
        }}
      >
        {current.kind === 'not_reviewed' ? 'Review' : 'Change'}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`How is ${resident.preferredName} for this handover?`}
        description={`${resident.fullLegalName}, room ${
          resident.room.kind === 'recorded' ? resident.room.value : 'not recorded'
        }. Whatever you record here is what the incoming shift reads first.`}
      >
        <div className={styles.statusForm}>
          <RadioGroup
            legend={`Status for ${resident.preferredName}`}
            value={choice}
            onValueChange={(value) => setChoice(value as Choice)}
            options={[
              { value: 'all_well', label: 'All well' },
              { value: 'needs_attention', label: 'Needs attention' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />

          {needsNote ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                What does the incoming shift need to do?
              </span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <span className={styles.fieldHint}>
                Required. A status saying somebody needs attention, without saying what
                for, is a signal the next shift cannot act on.
              </span>
            </label>
          ) : null}

          {error === '' ? null : <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="large" disabled={!ready} onClick={submit}>
              {`Record this for ${resident.preferredName}`}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
