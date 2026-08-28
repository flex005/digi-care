import { useState } from 'react'
import { formatCount } from '@/lib/format'
import { Icon } from '@/components/icon/Icon'
import type { NoteWithResident } from './care-notes-views'
import { NoteQueueRow } from './NoteQueueRow'
import styles from './notes.module.css'

/** How many notes fit on a page before the list stops being readable. */
export const NOTES_PER_PAGE = 15

/**
 * A page of notes, with the size of the whole set stated.
 *
 * **Paging hides rows, so the total is on the screen.** A reader who sees
 * fifteen notes and no total has been told the home wrote fifteen; this list
 * runs to eleven thousand. The line above says which slice is showing and what
 * it is a slice of, which is the same rule as any other claim over a narrowed
 * set.
 */
export function PagedNotes({
  items,
  what,
  onChanged,
  emptyNote,
}: {
  items: NoteWithResident[]
  /** What the count is of, in words: "notes by C. Nwosu". */
  what: string
  onChanged: (outcome: 'recorded' | 'undone') => void
  /** Said when there are none, because zero is an answer. */
  emptyNote: string
}) {
  const [page, setPage] = useState(0)

  /*
   * Clamped on render rather than reset in an effect.
   *
   * A narrower filter can leave the reader on a page that no longer exists,
   * and resetting it from an effect makes the first paint show the empty page
   * before the correction arrives. Deriving it costs nothing and there is no
   * moment where the two disagree.
   */
  const pages = Math.max(1, Math.ceil(items.length / NOTES_PER_PAGE))
  const current = Math.min(page, pages - 1)
  const start = current * NOTES_PER_PAGE
  const shown = items.slice(start, start + NOTES_PER_PAGE)

  if (items.length === 0) {
    return (
      <p className={styles.settledNote} data-notes-empty>
        {emptyNote}
      </p>
    )
  }

  return (
    <>
      <p className={styles.resultLine} data-notes-claim>
        <span data-numeric>{formatCount(items.length)}</span> {what}
        {pages > 1 ? (
          <>
            {'. Showing '}
            <span data-numeric>{formatCount(start + 1)}</span> to{' '}
            <span data-numeric>{formatCount(start + shown.length)}</span>, newest first.
          </>
        ) : (
          ', newest first.'
        )}
      </p>

      <ul className={styles.queueList}>
        {shown.map(({ note, resident }) => (
          <NoteQueueRow
            key={note.id}
            note={note}
            resident={resident}
            onChanged={onChanged}
          />
        ))}
      </ul>

      {pages > 1 ? (
        <nav className={styles.pager} aria-label="Pages of notes" data-notes-pager>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            data-notes-prev
          >
            <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
            Previous
          </button>
          <p className={styles.pagerWhere} aria-live="polite">
            Page <span data-numeric>{formatCount(current + 1)}</span> of{' '}
            <span data-numeric>{formatCount(pages)}</span>
          </p>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage(current + 1)}
            disabled={current === pages - 1}
            data-notes-next
          >
            Next
            <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
          </button>
        </nav>
      ) : null}
    </>
  )
}
