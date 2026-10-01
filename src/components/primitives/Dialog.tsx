import type { ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import styles from './surface.module.css'

/**
 * Modal dialog. Thin wrapper over @radix-ui/react-dialog.
 *
 * `title` is REQUIRED, and that is a deliberate constraint rather than an
 * accident of the API. PRD §2.4: every confirmation dialog restates the
 * subject by name in the confirming sentence — never "Are you sure?", always
 * "Record 08:00 medications for Emmanuel Okafor?". Making the title
 * non-optional means a dialog cannot be shipped without one, and a required
 * title is also what gives Radix its accessible name.
 *
 * Radix handles focus trapping, focus return to the trigger, Escape, and the
 * correct ARIA roles. Do not fight it. PRD §7.
 */

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the subject. "Record 08:00 medications for Emmanuel Okafor?" */
  title: string
  description?: string
  children?: ReactNode
  /** Buttons, right-aligned. */
  actions?: ReactNode
  /**
   * How wide the panel is. `standard` is 560px and is what every dialog in
   * the product gets unless it asks otherwise.
   *
   * **Opt-in, because widening `.panel` would move every dialog there is.**
   * A shared shape rule quietly changing for all its users is the defect §8
   * records about `.tile` — the fix there was shape in the shared rule and
   * paint per tile, and this is the same split: `.panel` keeps everything
   * about what a dialog *is*, and the modifier overrides width alone.
   *
   * `wide` exists for the incident correction, which carries two side-by-side
   * grids and two body maps and is unusable at 560px.
   */
  size?: 'standard' | 'wide'
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  size = 'standard',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={
            size === 'wide' ? `${styles.panel} ${styles.panelWide}` : styles.panel
          }
        >
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export const DialogTrigger = RadixDialog.Trigger
export const DialogClose = RadixDialog.Close
