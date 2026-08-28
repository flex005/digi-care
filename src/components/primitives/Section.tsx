import type { ReactNode } from 'react'
import styles from './Section.module.css'

/**
 * A titled part of a screen, with air around it.
 *
 * The distinction it exists to draw is rank. A screen built as a stack of
 * equally-weighted cards has told the reader that everything on it matters
 * equally, which on a handover is false: the coverage figures, an unsigned
 * handover from yesterday, the residents themselves and the signature are
 * four different kinds of thing and one of them is the reason the screen is
 * open. Rule 3b is usually applied to a status; this applies it to a page.
 *
 * The heading is an `<h2>` and the sections are real `<section>` elements, so
 * the ranking a sighted reader gets from the spacing is the same ranking a
 * screen reader gets from the outline. Colour and size are never the only
 * carriers of structure (PRD §7).
 *
 * `note` is the sentence under the title saying what the section is measured
 * over or why it is here. It is not decoration: on this screen it carries the
 * denominators and the reason Not reviewed leads.
 */
export interface SectionProps {
  title: string
  note?: ReactNode
  /** Right-aligned beside the title — a picker, a count, an action. */
  actions?: ReactNode
  children: ReactNode
}

export function Section({ title, note, actions, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{title}</h2>
          {note ? <p className={styles.note}>{note}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}
