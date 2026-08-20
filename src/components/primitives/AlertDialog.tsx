import * as RadixAlertDialog from '@radix-ui/react-alert-dialog'
import styles from './surface.module.css'
import buttonStyles from './Button.module.css'

/**
 * Confirmation dialog. Thin wrapper over @radix-ui/react-alert-dialog.
 *
 * Used for anything consequential: changing a DNAR, recording medications,
 * withdrawing consent, switching site with unsaved input.
 *
 * `title` and `confirmLabel` are both REQUIRED, and both must name the subject.
 * PRD §2.4 is unambiguous: never "Are you sure?", always "Record 08:00
 * medications for Emmanuel Okafor?".
 *
 * **The type enforces that they are present, not that they name anybody.**
 * `title="Are you sure?"` compiles. A required `string` cannot check its own
 * contents, so this one is carried by review, not by the compiler — unlike
 * `Unrecorded`'s label, where a missing prop is a type error and an empty one
 * is caught by a test. Closing it would take a branded type minted by a helper
 * that takes the resident, or a test over every call site.
 *
 * The action button is `large`, clearing the 44px target PRD §7 requires for
 * anything destructive or clinical.
 */

export interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the subject. "Record 08:00 medications for Emmanuel Okafor?" */
  title: string
  /** What will happen, and to whom. Also names the subject where it can. */
  description: string
  /** Names the action. "Record medications", not "OK". */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  /** Use for anything that destroys or overrides a clinical record. */
  destructive?: boolean
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
}: AlertDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className={styles.overlay} />
        <RadixAlertDialog.Content className={styles.panel}>
          <RadixAlertDialog.Title className={styles.title}>
            {title}
          </RadixAlertDialog.Title>
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
