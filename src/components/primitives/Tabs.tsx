import type { ComponentPropsWithoutRef } from 'react'
import * as RadixTabs from '@radix-ui/react-tabs'
import styles from './Tabs.module.css'

/**
 * Tabs. Thin wrapper over @radix-ui/react-tabs.
 * Radix supplies arrow-key navigation and the correct roles.
 */

export const Tabs = RadixTabs.Root

export function TabsList({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={[styles.list, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export function TabsTrigger({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={[styles.trigger, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export function TabsContent({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      className={[styles.content, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
