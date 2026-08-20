import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

/**
 * A designed empty state. PRD §6: "Empty and Partial are never a shrug. They
 * are designed states that say what is missing."
 *
 * `body` is required, not optional. An empty state with only a title says
 * "nothing here" without saying why — which is the same failure as a blank
 * cell, one level up. The body has to distinguish "nothing matched your
 * filters" from "nothing exists".
 */
export interface EmptyStateProps {
  title: string
  body: string
  actions?: ReactNode
}

export function EmptyState({ title, body, actions }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
}
