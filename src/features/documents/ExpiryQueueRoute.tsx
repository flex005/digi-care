import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentRecord, Resident } from '@/data/types'
import { getSiteDocuments } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { Card, SelectedMark } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { formatCount } from '@/lib/format'
import { ExpiryChip, FileFactsText } from './DocumentParts'
import { categoryLabel } from './categories'
import { countExpiry, expiryFinding, type ExpiryFinding } from './expiry'
import { useSiteToday } from './today'
import styles from './documents.module.css'

/**
 * Expiry tracking. PRD §6.7, Phase 11.
 *
 * The sentence: **what has expired, then what expires inside 30 days, then
 * what nobody has said anything about — three claims, never one countdown.**
 *
 * The eleventh queue, in the settled shape: findings across the top, filters
 * as pills, one row per record. **A claim inside a filter carries the filter**
 * (Rule 3c) — the count on a filtered view says what it is counting over, or
 * it asserts an absence that is an artefact of the view.
 */
type Filter = 'all' | 'expired' | 'expiring' | 'not_recorded'

/**
 * Each filter carries a label and a phrase, for the reason `INCIDENT_TYPES`
 * does: the words that read correctly on a pill read wrongly in a sentence,
 * and lowercasing at the call site is the tidying transformation that has
 * already destroyed one label in this build.
 */
/** How many rows fit before the list stops being readable. Matches the note
 *  queue's 15 in intent, larger because a document row is one line. */
const DOCUMENTS_PER_PAGE = 25

const FILTERS: { id: Filter; label: string; phrase: string }[] = [
  { id: 'all', label: 'Everything on file', phrase: 'everything on file' },
  { id: 'expired', label: 'Expired', phrase: 'the documents that have expired' },
  {
    id: 'expiring',
    label: 'Expiring within 30 days',
    phrase: 'the documents expiring within 30 days',
  },
  {
    id: 'not_recorded',
    label: 'No expiry recorded',
    phrase: 'the documents with no expiry recorded',
  },
]

export function ExpiryQueueRoute() {
  const { activeSite } = useSession()
  const today = useSiteToday()
  const [loaded, setLoaded] = useState<
    { documents: DocumentRecord[]; residents: Resident[] } | 'loading'
  >('loading')
  const [filter, setFilter] = useState<Filter>('expired')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let live = true
    void getSiteDocuments(activeSite.id).then((result) => {
      if (live) setLoaded(result)
    })
    return () => {
      live = false
    }
  }, [activeSite.id])

  const rows = useMemo(() => {
    if (loaded === 'loading') return []
    const byId = new Map(loaded.residents.map((resident) => [resident.id, resident]))
    return loaded.documents
      .map((document) => ({
        document,
        finding: expiryFinding(document.expiry, today),
        subject:
          document.owner.kind === 'site'
            ? activeSite.name
            : (byId.get(document.owner.residentId)?.fullLegalName ??
              'Resident not found'),
        residentId:
          document.owner.kind === 'resident' ? document.owner.residentId : undefined,
      }))
      .filter((row) => matches(row.finding, filter))
      .sort((a, b) => order(a.finding) - order(b.finding))
  }, [loaded, today, filter, activeSite.name])

  /*
   * Clamped on render rather than reset in an effect, the same way the note
   * queue does it: switching to a narrower filter can leave the reader on a
   * page that no longer exists, and correcting that from an effect paints the
   * empty page first. Derived, so there is no moment where the two disagree.
   */
  const pages = Math.max(1, Math.ceil(rows.length / DOCUMENTS_PER_PAGE))
  const current = Math.min(page, pages - 1)
  const start = current * DOCUMENTS_PER_PAGE
  const shown = rows.slice(start, start + DOCUMENTS_PER_PAGE)

  if (loaded === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading documents…</p>
      </div>
    )
  }

  const counts = countExpiry(loaded.documents, today)
  const selected = FILTERS.find((entry) => entry.id === filter)

  return (
    <div className={styles.page} data-expiry-queue>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Expiry tracking</h1>
          <p className={styles.pageSubtitle}>
            Every document at {activeSite.name}, by what its expiry decision says today.
          </p>
        </div>
        <Link to=".." relative="path" className={styles.queueLink} data-library-link>
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
          The library
        </Link>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter by expiry">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={styles.filterPill}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            data-filter={entry.id}
          >
            <SelectedMark selected={filter === entry.id} />
            {entry.label}
            <span data-numeric>{formatCount(countFor(entry.id, counts))}</span>
          </button>
        ))}
      </div>

      {/*
        The claim carries the filter, or it is a claim about a different set —
        and now it carries the page too. Paging hides rows, so a reader looking
        at twenty-five of three hundred has been told this site holds
        twenty-five unless the sentence says otherwise. Three figures, all
        real: which slice is on screen, what the filter matched, and what the
        library holds.
      */}
      <p className={styles.filterClaim} data-filter-claim>
        <span data-numeric>{formatCount(rows.length)}</span> of{' '}
        <span data-numeric>{formatCount(counts.total)}</span> documents at{' '}
        {activeSite.name}, showing <b>{selected?.phrase ?? 'everything on file'}</b>
        {pages > 1 ? (
          <>
            {'. On screen: '}
            <span data-numeric>{formatCount(start + 1)}</span> to{' '}
            <span data-numeric>{formatCount(start + shown.length)}</span>.
          </>
        ) : (
          '.'
        )}
      </p>

      <Card>
        {rows.length === 0 ? (
          <p className={styles.categoryEmpty} data-empty="filtered">
            Nothing at {activeSite.name} matches {selected?.label ?? 'this filter'}.
            That is a statement about this filter, not about the whole library.
          </p>
        ) : (
          <ul className={styles.rows}>
            {shown.map((row) => (
              <li key={row.document.id}>
                <div className={styles.queueRow} data-queue-row={row.document.id}>
                  <div>
                    <p className={styles.rowTitle}>{row.document.title}</p>
                    <p className={styles.rowMeta}>
                      {categoryLabel(row.document.category)} ·{' '}
                      <FileFactsText file={row.document.file} />
                    </p>
                  </div>

                  <p className={styles.queueSubject} data-queue-subject>
                    {row.residentId === undefined ? (
                      row.subject
                    ) : (
                      <Link to={`/residents/${row.residentId}/documents`}>
                        {row.subject}
                      </Link>
                    )}
                  </p>

                  <ExpiryChip finding={row.finding} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav
            className={styles.pager}
            aria-label="Pages of documents"
            data-documents-pager
          >
            <button
              type="button"
              className={styles.pagerButton}
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              data-documents-prev
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
              data-documents-next
            >
              Next
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </button>
          </nav>
        ) : null}
      </Card>
    </div>
  )
}

function matches(finding: ExpiryFinding, filter: Filter): boolean {
  if (filter === 'all') return true
  return finding.kind === filter
}

function countFor(
  filter: Filter,
  counts: { expired: number; expiring: number; notRecorded: number; total: number },
): number {
  switch (filter) {
    case 'all':
      return counts.total
    case 'expired':
      return counts.expired
    case 'expiring':
      return counts.expiring
    case 'not_recorded':
      return counts.notRecorded
  }
}

/** Expired first, then expiring, then everything else. Urgency, not filing. */
function order(finding: ExpiryFinding): number {
  switch (finding.kind) {
    case 'expired':
      return 0
    case 'expiring':
      return 1
    case 'not_recorded':
      return 2
    case 'in_date':
      return 3
    case 'does_not_expire':
      return 4
  }
}
