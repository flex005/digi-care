import type { ComponentPropsWithoutRef } from 'react'
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu'
import styles from './surface.module.css'

/**
 * Dropdown menu. Thin wrapper over @radix-ui/react-dropdown-menu.
 * Radix supplies roving focus, typeahead and the correct roles.
 */

export const DropdownMenu = RadixDropdownMenu.Root
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        className={[styles.floating, className].filter(Boolean).join(' ')}
        {...rest}
      />
    </RadixDropdownMenu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>) {
  return (
    <RadixDropdownMenu.Item
      className={[styles.item, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>) {
  return (
    <RadixDropdownMenu.Label
      className={[styles.menuLabel, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>) {
  return (
    <RadixDropdownMenu.Separator
      className={[styles.separator, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
