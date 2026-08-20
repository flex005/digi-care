import type { ReactNode } from 'react'
import * as RadixAccordion from '@radix-ui/react-accordion'
import { Icon } from '../icon/Icon'
import styles from './Accordion.module.css'

/**
 * Accordion. Thin wrapper over @radix-ui/react-accordion.
 *
 * Collapsing is for detail, never for status. A resident's risk badges, an
 * omission, an Insufficient Evidence panel — none of those may live behind a
 * disclosure, because a collapsed section is indistinguishable from an absent
 * one at a glance.
 */

export const Accordion = RadixAccordion.Root

export interface AccordionSectionProps {
  value: string
  title: string
  children: ReactNode
}

export function AccordionSection({ value, title, children }: AccordionSectionProps) {
  return (
    <RadixAccordion.Item value={value} className={styles.item}>
      <RadixAccordion.Header>
        <RadixAccordion.Trigger className={styles.trigger}>
          {title}
          <Icon
            name="arrows-sharp/arrow-down-01-sharp"
            size={20}
            className={styles.chevron}
          />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content className={styles.content}>
        {children}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  )
}

export { styles as accordionStyles }
