import type { ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import styles from './Tooltip.module.css'

/**
 * Tooltip. Thin wrapper over @radix-ui/react-tooltip.
 *
 * A tooltip is never the only place information lives. PRD §3.6: every
 * clinical record displays its author and timestamp with no hover-to-reveal,
 * and PRD §6.4 requires the MAR legend to be permanently visible rather than
 * hidden behind one of these. Use it for supplementary help — the disabled
 * sidebar items, an icon-only control's name — and nothing load-bearing.
 */

export const TooltipProvider = RadixTooltip.Provider

export interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.content} side={side} sideOffset={6}>
          {content}
          <RadixTooltip.Arrow className={styles.arrow} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
