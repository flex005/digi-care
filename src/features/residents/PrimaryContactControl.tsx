import { useState } from 'react'
import { AlertDialog, Button, Toast } from '@/components/primitives'
import styles from './profile.module.css'

/**
 * The primary contact control. PRD §6.2 lists a "primary contact toggle" on
 * this tab.
 *
 * **A button, not a switch.** A switch that flips, raises a confirmation, and
 * then flips back when the write does not happen reads as a bug; and even once
 * writing exists, a switch implies a per-person setting when this is a single
 * role that exactly one person holds. Pressing it takes it off whoever has it,
 * which the confirmation says.
 *
 * **The confirmation names the subject in the sentence** — §2.4, the whole
 * reason this control exists in Phase 1 at all. Never "Are you sure?", always
 * "Make Helen Whitcombe the primary contact for Emmanuel Okafor?". This is the
 * structural mitigation against writing against the wrong resident, and a
 * dialog that does not name them is not it.
 *
 * **Nothing is written.** No phase has built resident editing, and the fixtures
 * are read-only by design. Rather than fake the write or hide the control, the
 * confirmation is the real one and the toast says plainly which half is
 * missing — so the interaction can be reviewed now and wired up later without
 * the screen changing shape.
 */
export function PrimaryContactControl({
  personName,
  relationship,
  residentName,
}: {
  personName: string
  relationship: string
  residentName: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className={styles.personActions}>
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Make primary contact
      </Button>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{ kind: 'resident', name: residentName }}
        action={`Make ${personName} the primary contact`}
        description={`${personName} (${relationship}) becomes the person this home rings first about ${residentName}, ahead of everybody else on this tab. Whoever holds it now loses it.`}
        confirmLabel="Make primary contact"
        onConfirm={() => setConfirmed(true)}
      />

      <Toast
        open={confirmed}
        onOpenChange={setConfirmed}
        tone="caution"
        title={`No change was made to ${residentName}'s record`}
        description="Recording a primary contact needs resident editing, which no phase has built yet. The confirmation you just saw is the real one; only the write is missing."
      />
    </div>
  )
}
