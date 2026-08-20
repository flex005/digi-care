import type { ReactNode } from 'react'
import { Icon } from '../icon/Icon'
import styles from './Table.module.css'

/**
 * A real `<table>`. PRD §7.
 *
 * Not a div grid, not now and not in Phase 3 where the MAR chart has to expose
 * a full-sentence accessible name per cell. Semantic markup here is what makes
 * that possible later without a rewrite.
 *
 * A sortable header is a real `<button>` inside a `<th scope="col">`, carrying
 * `aria-sort` on the `<th>` — so a screen reader announces both the column and
 * its current sort, and a keyboard user can operate it. The arrow glyph is
 * reinforcement; it is never the only carrier (PRD §7).
 */

export type SortDirection = 'ascending' | 'descending'

export interface TableColumn<TSortKey extends string> {
  /** Visible header text. */
  label: string
  /** Set to make the column sortable. */
  sortKey?: TSortKey
  /** Numeric columns get tabular numerals via base.css. */
  numeric?: boolean
  /**
   * Column width, as a CSS length. Declared here rather than as a min-width on
   * whatever happens to be inside the cell, so the column edges are identical
   * on every row and the eye can run straight down one. Scanning a column is
   * the primary motion on a list of 32 residents; it does not work if each
   * row negotiates its own widths.
   */
  width?: string
}

export interface TableProps<TSortKey extends string> {
  /**
   * Describes the table for screen readers — "32 residents at Rosewood Court,
   * sorted by oldest care note". Required: a table nobody can identify is a
   * table nobody can use.
   */
  caption: string
  columns: TableColumn<TSortKey>[]
  sortKey: TSortKey
  sortDirection: SortDirection
  onSort: (key: TSortKey) => void
  children: ReactNode
}

export function Table<TSortKey extends string>({
  caption,
  columns,
  sortKey,
  sortDirection,
  onSort,
  children,
}: TableProps<TSortKey>) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        {/* Driven off the same `columns` array as the headers, so the widths
            cannot drift out of step with what they are sizing. */}
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.label}
              {...(column.width === undefined
                ? {}
                : { style: { width: column.width } })}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted =
                column.sortKey !== undefined && column.sortKey === sortKey
              return (
                <th
                  key={column.label}
                  scope="col"
                  className={styles.headerCell}
                  aria-sort={isSorted ? sortDirection : undefined}
                  {...(column.numeric ? { 'data-numeric': '' } : {})}
                >
                  {column.sortKey === undefined ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      className={[styles.sortButton, isSorted ? styles.sorted : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onSort(column.sortKey as TSortKey)}
                    >
                      {column.label}
                      {isSorted ? (
                        <Icon
                          name={
                            sortDirection === 'ascending'
                              ? 'arrows-round/arrow-up-02-round'
                              : 'arrows-round/arrow-down-02-round'
                          }
                          size={12}
                          className={styles.sortArrow}
                        />
                      ) : null}
                    </button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className={styles.row}>{children}</tr>
}

export function TableCell({
  children,
  numeric = false,
}: {
  children: ReactNode
  numeric?: boolean
}) {
  return (
    <td className={styles.cell} {...(numeric ? { 'data-numeric': '' } : {})}>
      {children}
    </td>
  )
}
