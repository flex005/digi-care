import type { ComponentPropsWithoutRef } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import styles from './surface.module.css'

/**
 * Popover. Thin wrapper over @radix-ui/react-popover.
 * Radix handles focus management and dismissal.
 */

export const Popover = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverClose = RadixPopover.Close

export function PopoverContent({
  className,
  sideOffset = 6,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        className={[styles.floating, className].filter(Boolean).join(' ')}
        {...rest}
      />
    </RadixPopover.Portal>
  )
}
