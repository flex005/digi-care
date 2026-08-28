import type { ReactNode } from 'react'
import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import { VisuallyHidden } from '@/components/primitives'
import styles from './MetricTile.module.css'

/**
 * A figure on a card. One definition, used by Residents, Care notes, Handover
 * and Medications.
 *
 * **`of` is required, and it is the reason this component exists.** A big
 * figure on a card looks finished without a denominator, which makes a metric
 * strip the easiest place in a build for a bare count to appear. Here the
 * denominator has nowhere to not be: it renders in the footer and it goes into
 * the spoken claim.
 *
 * **Nothing here is tinted by state.** A gap goes in `figure` as an
 * `<Unrecorded>` chip rather than colouring the card, because the hatch has one
 * owner and a tinted card cannot say whether the tint is the finding or the
 * card.
 */
export interface MetricTileProps {
  label: string
  icon: IconName
  /** The figure. A number, or a chip where there is no figure to give. */
  figure: ReactNode
  /** The denominator, on the card face. Never absent. */
  of: string
  /** A second line under the denominator, where one is needed. */
  note?: string
  /**
   * The whole claim in one sentence, for a reader who gets the card without
   * its surroundings. Falls back to the visible parts.
   */
  spoken?: string
  /**
   * The one figure in a strip that leads.
   *
   * **Position and width, never a different card.** Where one figure in a set
   * is the only one still actionable — the handover's not-reviewed count,
   * which is the only thing still changeable before the signature goes on —
   * four equal cards make the reader do the ranking themselves. It takes two
   * columns and says on its face why, rather than relying on the type size to
   * carry an argument.
   */
  emphasis?: 'lead' | 'supporting'
}

export function MetricTiles({
  label,
  children,
}: {
  /** Names the strip, so it is not "region" to a screen reader. */
  label: string
  children: ReactNode
}) {
  return (
    <section className={styles.tiles} aria-label={label}>
      {children}
    </section>
  )
}

export function MetricTile({
  label,
  icon,
  figure,
  of,
  note,
  spoken,
  emphasis,
}: MetricTileProps) {
  return (
    <div
      className={emphasis === 'lead' ? styles.tileLead : styles.tile}
      data-metric-tile={label}
      {...(emphasis ? { 'data-emphasis': emphasis } : {})}
    >
      <span className={styles.tileHead}>
        <span className={styles.tileLabel}>{label}</span>
        <span className={styles.tileIcon} aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      </span>

      <span className={styles.tileFigure}>{figure}</span>

      <span className={styles.tileFooter}>
        <span className={styles.tileChange} data-metric-of>
          {of}
        </span>
        {note ? <span className={styles.tileExcluded}>{note}</span> : null}
      </span>

      <VisuallyHidden>{spoken ?? `${label}: ${of}.`}</VisuallyHidden>
    </div>
  )
}

/** The figure itself, at the top of the closed type scale. */
export function MetricValue({ children }: { children: ReactNode }) {
  return <span className={styles.tileValue}>{children}</span>
}
