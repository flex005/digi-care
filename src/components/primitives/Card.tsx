import type { ReactNode } from 'react'
import styles from './Card.module.css'

/**
 * The white surface everything sits on. PRD §4.7 — white cards on pale
 * lavender, generous radii.
 *
 * `padded` is off by default so a table can run edge to edge inside a card
 * while a form gets breathing room.
 */
export interface CardProps {
  children: ReactNode
  padded?: boolean
  className?: string
}

export function Card({ children, padded = false, className }: CardProps) {
  return (
    <section
      className={[styles.card, padded ? styles.padded : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  )
}

export interface CardHeaderProps {
  title: string
  /** Where a denominator belongs — "28 residents at Rosewood Court". Rule 4. */
  subtitle?: string
  /** Actions, right-aligned. */
  actions?: ReactNode
}

export function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  )
}
