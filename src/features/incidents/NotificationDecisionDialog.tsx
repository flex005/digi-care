import { useState } from 'react'
import type { Incident } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Button, Dialog } from '@/components/primitives'
import {
  decideNotRequired,
  decideRequired,
  recordNotified,
} from '@/data/access/notification-store'
import styles from './incidents.module.css'

/** Which decision is being taken. `none` closes the dialog. */
export type DecideStep = 'none' | 'required' | 'not_required' | 'notified'

/**
 * Deciding whether the CQC has to be told. PRD §6.5.
 *
 * **A decision is required either way, and "not required" is one of them.** The
 * incident said nobody had decided and offered three buttons that did nothing,
 * so the duty could be read, judged and then not recorded: a screen whose whole
 * job is tracking an outstanding obligation could not discharge it.
 *
 * Each decision carries who took it and when. "Not required" also carries its
 * reason, and the field is required here as well as in the store, because a
 * "not required" with nothing behind it cannot be told from nobody having
 * thought about it.
 */
export function NotificationDecisionDialog({
  step,
  incident,
  onClose,
  onDecided,
}: {
  step: DecideStep
  incident: Incident
  onClose: () => void
  onDecided: () => void
}) {
  const { currentUser } = useSession()
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')

  if (step === 'none') return null

  const close = () => {
    setReason('')
    setReference('')
    onClose()
  }

  const decision = incident.notification
  const ready =
    step === 'required' ||
    (step === 'not_required' && reason.trim() !== '') ||
    (step === 'notified' && reference.trim() !== '')

  const confirm = () => {
    if (step === 'required') decideRequired(incident.id, currentUser)
    if (step === 'not_required') {
      decideNotRequired(incident.id, reason, currentUser)
    }
    if (step === 'notified' && decision.kind === 'required_not_yet_notified') {
      recordNotified(incident.id, reference, currentUser, decision.decided)
    }
    setReason('')
    setReference('')
    onDecided()
  }

  const title =
    step === 'required'
      ? 'Record that this must be notified to the CQC?'
      : step === 'not_required'
        ? 'Record that the CQC does not need to be told?'
        : 'Record that the CQC has been told?'

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : close())}
      title={title}
      description={`${incident.description.slice(0, 90)} Your name and the time go on the record with the decision, and it cannot be edited afterwards.`}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!ready} data-confirm-decision={step}>
            {step === 'notified' ? 'Record the notification' : 'Record the decision'}
          </Button>
        </>
      }
    >
      {step === 'not_required' ? (
        <label className={styles.decideField}>
          <span className={styles.decideLabel}>Why it is not notifiable</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-decision-reason
          />
          {/*
           * Required, and said before it is enforced. "Not required" with no
           * reason cannot be told from nobody having considered it, which is
           * exactly the state this decision exists to leave.
           */}
          <span className={styles.decideHint}>
            In words, and it goes on the record. A judgement with nothing behind it
            reads the same as no judgement at all.
          </span>
        </label>
      ) : null}

      {step === 'notified' ? (
        <label className={styles.decideField}>
          <span className={styles.decideLabel}>The CQC&rsquo;s reference</span>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            data-decision-reference
            autoComplete="off"
          />
          <span className={styles.decideHint}>
            The reference the CQC gave it, so somebody can find the notification again.
            A record that it was told with nothing to look up is not one.
          </span>
        </label>
      ) : null}

      {step === 'required' ? (
        <p className={styles.decideHint}>
          This records the duty, not its discharge. The incident will show as required
          and not yet notified until somebody records the notification.
        </p>
      ) : null}
    </Dialog>
  )
}
