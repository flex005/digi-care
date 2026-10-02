import type { ReactNode } from 'react'
import styles from './incidents.module.css'

/**
 * The level a section's heading renders at, taken as a prop.
 *
 * **Because the same section appears under two different documents.** On the
 * report route these sections sit under the page's `h1`, so they are `h2`s.
 * Inside the correction modal, Radix renders the dialog's own title as the
 * `h2`, so the same sections have to be `h3`s or the outline skips a level
 * while looking identical on screen.
 *
 * Taken as a prop rather than duplicated, because a second copy of the markup
 * is the thing this whole extraction exists to avoid — and a heading level is
 * exactly the sort of difference that would drift unnoticed, since nothing
 * about the rendered page looks wrong when it is wrong.
 */
export type HeadingLevel = 'h2' | 'h3'

export function SectionHeading({
  level,
  id,
  children,
}: {
  level: HeadingLevel
  id?: string
  children: ReactNode
}) {
  const Tag = level
  return (
    <Tag className={styles.sectionTitle} id={id}>
      {children}
    </Tag>
  )
}
