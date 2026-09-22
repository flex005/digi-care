import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { DocumentRecord, Resident } from '@/data/types'
import { getSiteDocuments } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount } from '@/lib/format'
import { ExpiryChip, FileFactsText } from './DocumentParts'
import { DOCUMENT_CATEGORIES } from './categories'
import { countExpiry, expiryFinding, type ExpiryFinding } from './expiry'
import { useSiteToday } from './today'
import styles from './documents.module.css'

/**
 * One category of the home's library, and the documents in it. PRD §6.7.
 *
 * The library says a category holds 109 documents; this is the 109. Without it
 * the count was the end of the road — a reader who wanted the clinical letter
 * had to know whose record it was on and go there instead, which is the thing
 * a library exists to save them.
 *
 * **Ordered by urgency, like the expiry queue**: expired first, then expiring,
 * then what nobody has decided, then the rest. The order is the finding.
 */
export function CategoryLibraryRoute() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const { activeSite } = useSession()
  const today = useSiteToday()
  const [loaded, setLoaded] = useState<
    { documents: DocumentRecord[]; residents: Resident[] } | 'loading'
  >('loading')

  const category = DOCUMENT_CATEGORIES.find((entry) => entry.id === categoryId)

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
    if (loaded === 'loading' || category === undefined) return []
    const byId = new Map(loaded.residents.map((resident) => [resident.id, resident]))
    return loaded.documents
      .filter((document) => document.category === category.id)
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
      .sort((a, b) => order(a.finding) - order(b.finding))
  }, [loaded, category, today, activeSite.name])

  const back = (
    <Link to="/documents" className={styles.queueLink} data-library-link>
      <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
      The library
    </Link>
  )

  if (category === undefined) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Not a category</h1>
            <p className={styles.pageSubtitle}>
              The library files under {formatCount(DOCUMENT_CATEGORIES.length)}{' '}
              categories, and this is not one of them.
            </p>
          </div>
          {back}
        </header>
      </div>
    )
  }

  if (loaded === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading documents…</p>
      </div>
    )
  }

  const counts = countExpiry(
    loaded.documents.filter((document) => document.category === category.id),
    today,
  )

  return (
    <div className={styles.page} data-category-library={category.id}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{category.label}</h1>
          <p className={styles.pageSubtitle}>
            Everything filed here at {activeSite.name}. It holds {category.holds}.
          </p>
        </div>
        {back}
      </header>

      {/* The same four figures the library's row carries, so the count a
          reader followed here is the count they find. */}
      <Card>
        <div className={styles.organisationRow} data-category-figures>
          <p className={styles.rowTitle}>{category.label}</p>
          <p className={styles.orgCount} data-org-count="total">
            <span data-numeric>{formatCount(counts.total)}</span>
            <span>on file</span>
          </p>
          <p
            className={styles.orgCount}
            data-org-count="expired"
            data-any={counts.expired > 0}
          >
            <span data-numeric>{formatCount(counts.expired)}</span>
            <span>expired</span>
          </p>
          <p
            className={styles.orgCount}
            data-org-count="expiring"
            data-any={counts.expiring > 0}
          >
            <span data-numeric>{formatCount(counts.expiring)}</span>
            <span>expiring within 30 days</span>
          </p>
          <div data-org-count="not_recorded">
            {counts.notRecorded > 0 ? (
              <Unrecorded
                variant="chip"
                label={`${formatCount(counts.notRecorded)} with no expiry recorded`}
                detail="nobody has said whether these expire"
              />
            ) : (
              <p className={styles.orgCount}>
                <span data-numeric>0</span>
                <span>with no expiry recorded</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          /*
           * Empty, and said as what it is: this category holds a kind of
           * thing and nobody has filed one. Not a gap — nothing in the record
           * says a document ought to be here, which is what the resident
           * tab's expected-but-empty state is for.
           */
          <p className={styles.categoryEmpty} data-category-empty>
            Nothing is filed here at {activeSite.name}. It holds {category.holds}.
          </p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.document.id}>
                <div className={styles.categoryRow} data-queue-row={row.document.id}>
                  <div>
                    <p className={styles.rowTitle}>{row.document.title}</p>
                    <p className={styles.rowMeta}>
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

                  {/* A document whose metadata is real opens; one added this
                      session has no type to sample and nothing filed behind
                      it, and says so rather than failing on a click. */}
                  {row.document.file.kind === 'not_retrievable' ? (
                    <span
                      className={styles.rowActionDisabled}
                      data-action="not_retrievable"
                    >
                      Not retrievable: added this session
                    </span>
                  ) : (
                    <Link
                      to={`/documents/${row.document.id}`}
                      className={styles.rowAction}
                      data-action="open"
                      aria-label={`Open ${row.document.title}`}
                    >
                      Open
                      <Icon
                        name="arrows-sharp/arrow-right-01-sharp"
                        size={16}
                        aria-hidden
                      />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
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
