import { useState } from 'react'
import { AlertDialog, Button, Toast } from '@/components/primitives'
import styles from './profile.module.css'

/**
 * The change control on a resuscitation decision or an ADRT. PRD §6.2:
 * "Changing a DNAR or ADRT raises a confirmation naming the resident and
 * warning that all staff on shift are notified."
 *
 * Every part of that sentence is load-bearing:
 *
 *  - **naming the resident.** §2.4, and the reason this control is built in
 *    Phase 1 rather than deferred with the rest of editing. Never "Are you
 *    sure?" — always "Change the resuscitation decision for Emmanuel Okafor?".
 *    The subject comes from the route parameter, through the profile, and
 *    never from anything the user last looked at.
 *  - **all staff on shift are notified.** Named site, not "everyone". A
 *    manager covering two homes needs to know which building is about to be
 *    told, and "all staff" does not say.
 *  - **destructive styling**, because changing one of these overrides a signed
 *    clinical decision. Recording a first decision does not, so it is not
 *    styled as though it did.
 *
 * Nothing is written. No phase has built resident editing and the fixtures are
 * read-only, so the confirmation is real and the toast says which half is
 * missing rather than faking a save. Hiding the control instead would have
 * meant the one interaction §2.4 exists to demonstrate never appearing in the
 * phase that is about the profile.
 */
export function ClinicalChangeControl({
  residentName,
  siteName,
  buttonLabel,
  room,
  action,
  description,
  confirmLabel,
  destructive,
  onConfirmed,
}: {
  residentName: string
  siteName: string
  buttonLabel: string
  /** Shown on the confirmation, so the subject is identified twice over. */
  room?: string
  /**
   * A verb phrase with no subject in it — "Record a resuscitation decision".
   * `AlertDialog` composes "… for <resident>?" so a caller cannot ship a
   * confirmation that names nobody.
   */
  action: string
  description: string
  confirmLabel: string
  destructive: boolean
  /**
   * What confirming writes, where it can write anything.
   *
   * Absent for a decision this build cannot honestly record — a resuscitation
   * decision and an ADRT both need a clinician's signature and a document
   * reference — and present for one it can, which is an allergy.
   *
   * **What would make this writable, so the next reader does not re-derive
   * it.** v4 of the source PRD adds a Clinician role that this build's
   * `StaffRole` does not have: clinical leads and nurses, with medication
   * protocols, PRN authorisation and clinical assessments. That is the role
   * this refusal is waiting on. The role model here is deliberately this
   * build's own, so the answer is recorded rather than acted on. The question
   * "why can nobody record this" has an answer, and it is a role rather than
   * a screen.
   */
  onConfirmed?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className={styles.changeControl}>
      {/* Secondary, even when what it leads to is destructive. The trigger
          destroys nothing — it opens a question. Red belongs on the button
          that actually overrides the record, which is the one inside the
          dialog, and two red buttons on a read-only tab spend the reader's
          alarm before anything has happened. `large` regardless: PRD §7 wants
          44px on anything clinical, and this is. */}
      <Button variant="secondary" size="large" onClick={() => setConfirming(true)}>
        {buttonLabel}
      </Button>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: residentName,
          ...(room === undefined ? {} : { room }),
        }}
        action={action}
        description={description}
        confirmLabel={confirmLabel}
        destructive={destructive}
        onConfirm={() => {
          if (onConfirmed !== undefined) onConfirmed()
          setConfirmed(true)
        }}
      />

      <Toast
        open={confirmed}
        onOpenChange={setConfirmed}
        tone={onConfirmed === undefined ? 'caution' : 'positive'}
        title={
          onConfirmed === undefined
            ? `No change was made to ${residentName}'s record`
            : `Recorded on ${residentName}'s record`
        }
        description={
          onConfirmed === undefined
            ? /*
               * **Not "a later phase will build it".** Recording a
               * resuscitation decision or an ADRT needs a clinician's
               * signature and a document reference, and this build has neither
               * — the same distinction as prescribing and as "not held here": a
               * gap somebody can close against one nothing on any screen can.
               */
              `Recording this needs a clinician's signature and a document reference, and diGi-Care captures neither, it records the decision somebody else made. Nobody on shift at ${siteName} was notified, because nothing changed.`
            : `Held in memory only and gone on reload. Everybody on shift at ${siteName} would be notified.`
        }
      />
    </div>
  )
}
