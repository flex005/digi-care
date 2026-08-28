import type { ReactNode } from 'react'
import { Tooltip } from '@/components/primitives'
import styles from './profile.module.css'

/**
 * A link to a screen a later phase builds: present, disabled, and saying so.
 *
 * Present rather than hidden, for the same reason the sidebar lists every
 * unbuilt module — the profile does not change shape as those screens land,
 * and nobody has to relearn where anything is. Disabled rather than dead,
 * because a link that goes nowhere is worse than one that admits it does not
 * go anywhere yet.
 *
 * The visible text says what it would do; `describes` supplies the full
 * sentence a screen reader hears, because "Open document" repeated six times
 * down a tab is six identical announcements for six different documents.
 */
export function PendingLink({
  what,
  describes,
  phase,
  children,
}: {
  /** What is coming, for the tooltip: "Document viewer". */
  what: string
  /** The full accessible sentence, without the phase suffix. */
  describes: string
  phase: number
  children: ReactNode
}) {
  return (
    <Tooltip content={`${what} (coming in Phase ${phase})`}>
      <span
        className={styles.pendingLink}
        role="link"
        aria-disabled="true"
        aria-label={`${describes} (coming in Phase ${phase})`}
        tabIndex={0}
      >
        {children}
      </span>
    </Tooltip>
  )
}
