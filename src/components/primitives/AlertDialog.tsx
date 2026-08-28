import type { ReactNode } from 'react'
import * as RadixAlertDialog from '@radix-ui/react-alert-dialog'
import styles from './surface.module.css'
import buttonStyles from './Button.module.css'

/**
 * Confirmation dialog. Thin wrapper over @radix-ui/react-alert-dialog.
 *
 * Used for anything consequential: recording medications, changing a DNAR,
 * withdrawing consent, signing a handover.
 *
 * **"Are you sure?" is not expressible here.** There is no free-text title.
 * The caller supplies a `subject` and an `action`, and the component composes
 * the sentence — so a dialog cannot be shipped without naming who it is about,
 * whatever the caller intends. PRD §2.4 is unambiguous: never "Are you sure?",
 * always "Record 08:00 medications for Emmanuel Okafor?".
 *
 * This replaced `title: string`, which the type could only require, not check.
 * `title="Are you sure?"` compiled, and the rule was carried by review. The
 * first genuinely clinical confirmations — a medication round, a controlled
 * drug's second signature, a stock count that does not reconcile — are being
 * built now, and they must not be built against a shape already known to be
 * unsafe.
 *
 * The subject is also **rendered in the dialog**, not only folded into the
 * title. A title is read once; a subject line is still there while somebody
 * reads the rest and decides.
 *
 * The action button is `large`, clearing the 44px target PRD §7 requires of
 * anything destructive or clinical.
 */

/**
 * Who or what a confirmation is about.
 *
 * A closed union, so adding a kind is a deliberate act with a sentence
 * attached rather than a caller inventing prose. Every member carries enough
 * to identify one thing unambiguously — a resident by name and room, a
 * handover by shift, site and date.
 */
export type ConfirmationSubject =
  | { kind: 'resident'; name: string; room?: string }
  | { kind: 'handover'; shift: string; site: string; date: string }

/** "for Emmanuel Okafor", "for the late shift handover at Rosewood Court". */
function subjectPhrase(subject: ConfirmationSubject): string {
  switch (subject.kind) {
    case 'resident':
      return subject.name
    case 'handover':
      return `the ${subject.shift} shift handover at ${subject.site} on ${subject.date}`
  }
}

/** The line that stays on screen while the reader decides. */
function subjectLine(subject: ConfirmationSubject): string {
  switch (subject.kind) {
    case 'resident':
      return subject.room ? `${subject.name} · Room ${subject.room}` : subject.name
    case 'handover':
      return `${subject.site} · ${subject.shift} shift · ${subject.date}`
  }
}

export interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Who this is about. Composed into the question, and shown beneath it. */
  subject: ConfirmationSubject
  /**
   * What is about to happen, as a verb phrase with no subject in it:
   * "Record 08:00 medications", "Change the resuscitation decision".
   *
   * The component adds "for <subject>?" — so an action that names the subject
   * itself will read twice, and one that names nobody still cannot.
   */
  action: string
  /** What it means, and what follows. Names the subject again where it can. */
  description: ReactNode
  /** Names the action on the button. "Record medications", not "OK". */
  confirmLabel: string
  cancelLabel?: string
  /**
   * Holds the confirm action until something else is satisfied — a PIN, a
   * reconciling count.
   *
   * A gate, not a courtesy: the write behind it refuses the same condition, so
   * this only saves somebody a round trip. Anything that must not happen is
   * refused where it cannot be bypassed.
   */
  confirmDisabled?: boolean
  onConfirm: () => void
  /** Use for anything that destroys or overrides a clinical record. */
  destructive?: boolean
}

export function AlertDialog({
  open,
  onOpenChange,
  subject,
  action,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  onConfirm,
  destructive = false,
}: AlertDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className={styles.overlay} />
        <RadixAlertDialog.Content className={styles.panel}>
          <RadixAlertDialog.Title className={styles.title}>
            {action} for {subjectPhrase(subject)}?
          </RadixAlertDialog.Title>
          {/* Still on screen while the description is read. A subject folded
              into a title alone is read once and then argued past. */}
          <p className={styles.subject} data-confirm-subject>
            {subjectLine(subject)}
          </p>
          <RadixAlertDialog.Description className={styles.description}>
            {description}
          </RadixAlertDialog.Description>
          <div className={styles.actions}>
            <RadixAlertDialog.Cancel
              className={[
                buttonStyles.button,
                buttonStyles.secondary,
                buttonStyles.large,
              ].join(' ')}
            >
              {cancelLabel}
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action
              disabled={confirmDisabled}
              onClick={onConfirm}
              className={[
                buttonStyles.button,
                destructive ? buttonStyles.destructive : buttonStyles.primary,
                buttonStyles.large,
              ].join(' ')}
            >
              {confirmLabel}
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  )
}

export const AlertDialogTrigger = RadixAlertDialog.Trigger
