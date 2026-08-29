import { useState } from 'react'
import { formatCount } from '@/lib/format'
import { Icon } from '../icon/Icon'
import styles from './Pager.module.css'

/**
 * Paging, with the slice stated as part of the control rather than beside it.
 *
 * **Paging hides rows, so the total is on the screen.** A reader shown
 * twenty-five of three hundred has been told the home holds twenty-five unless
 * the sentence says otherwise — the same rule as any claim over a narrowed
 * set (Rule 4), arriving from the one direction nobody watches: a *scrolling*
 * decision becoming a claim about a home.
 *
 * That sentence is rendered by this component, not left to each screen. Six
 * screens page, and a slice line written six times is a slice line forgotten
 * once. Here it is impossible to page without saying so.
 *
 * **Not for every list.** A list whose rows carry claims about the stretches
 * *between* them cannot be paged at all — a gap marker inside a page states a
 * span whose ends were chosen by the page break. The note timeline takes a
 * window for exactly that reason. Paging is right where a row is complete on
 * its own, which is every work queue in the product.
 *
 * **And never for a complete-set list.** Where an item's absence is the
 * finding — the ten risk templates on one resident's tab, the eight consent
 * types, the ten care plan domains — every one is listed or the screen lies.
 * Those are per-resident tabs; the cross-resident queues below them are work
 * lists, and paging those is safe because their completeness lives in a
 * denominator rather than in the rows on screen.
 */

/** How many rows fit before a list stops being readable. */
export const ROWS_PER_PAGE = 25

export interface Paged<T> {
  /** The rows to render. */
  shown: T[]
  /** Zero-based, already clamped. */
  page: number
  pages: number
  /** Index of the first row shown, zero-based. */
  start: number
  setPage: (page: number) => void
}

/**
 * @param items Everything the current filter matched, not everything held.
 * @param perPage Overridable, because a one-line row fits more than a card.
 */
export function usePaged<T>(items: T[], perPage: number = ROWS_PER_PAGE): Paged<T> {
  const [page, setPage] = useState(0)

  /*
   * Clamped on render rather than reset in an effect.
   *
   * A narrower filter can leave the reader on a page that no longer exists,
   * and correcting that from an effect paints the empty page first. Deriving
   * it costs nothing and there is no moment where the two disagree.
   */
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const current = Math.min(page, pages - 1)
  const start = current * perPage

  return {
    shown: items.slice(start, start + perPage),
    page: current,
    pages,
    start,
    setPage,
  }
}

export function Pager({
  paged,
  total,
  /** What the rows are, in words: "assessments", "documents". */
  noun,
}: {
  paged: Paged<unknown>
  /** Everything the filter matched — the figure the slice is a slice of. */
  total: number
  noun: string
}) {
  const { page, pages, start, shown, setPage } = paged
  if (pages <= 1) return null

  return (
    <nav className={styles.pager} aria-label={`Pages of ${noun}`} data-pager>
      {/* The slice, always. This is the half that makes paging honest. */}
      <p className={styles.slice} data-pager-slice aria-live="polite">
        Showing <span data-numeric>{formatCount(start + 1)}</span> to{' '}
        <span data-numeric>{formatCount(start + shown.length)}</span> of{' '}
        <span data-numeric>{formatCount(total)}</span> {noun}
      </p>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          data-pager-prev
        >
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
          Previous
        </button>
        <p className={styles.where}>
          Page <span data-numeric>{formatCount(page + 1)}</span> of{' '}
          <span data-numeric>{formatCount(pages)}</span>
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={() => setPage(page + 1)}
          disabled={page === pages - 1}
          data-pager-next
        >
          Next
          <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
