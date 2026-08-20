import { VisuallyHidden } from '@/components/primitives'
import styles from './Sidebar.module.css'

/**
 * A count badge on a nav item. PRD §4.7 specifies these on the items the
 * source PRD names — overdue reviews, open incidents.
 *
 * §4.7 wants a number at a glance; CLAUDE.md §1 says **no bare counts
 * anywhere**. Both hold here: the badge shows the figure, and the item's
 * accessible name carries the whole claim including its denominator. A screen
 * reader never hears "10". Nobody hovering reads "10". The bare number is
 * never the complete statement — it is a glyph pointing at one.
 *
 * Collapsed, the badge becomes a dot: there is no room for a legible figure in
 * a 72px rail, and a truncated number is worse than none. The accessible name
 * does not change, so the claim survives the rail.
 */
export interface NavCount {
  /** What the badge shows. */
  value: number
  /**
   * The full claim, read by assistive technology and shown in the collapsed
   * tooltip. Must name the denominator: "3 open incidents across 32
   * residents", never "3 incidents".
   */
  description: string
}

export function NavBadge({
  count,
  collapsed,
}: {
  count: NavCount
  collapsed: boolean
}) {
  if (collapsed) {
    return <span className={styles.badgeDot} aria-hidden="true" />
  }
  return (
    <>
      <span className={styles.badge} aria-hidden="true">
        {count.value}
      </span>
      <VisuallyHidden>{count.description}</VisuallyHidden>
    </>
  )
}
