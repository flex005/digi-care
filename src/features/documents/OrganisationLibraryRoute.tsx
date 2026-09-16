import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentRecord } from '@/data/types'
import { getSiteDocuments } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { AggregateFigure, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount } from '@/lib/format'
import { UploadDrawer } from './UploadDrawer'
import { expiryDecisionCoverage } from './expiry'
import { organisationRows } from './library'
import { useSiteToday } from './today'
import styles from './documents.module.css'

/**
 * The home's library. PRD §6.7, Phase 11.
 *
 * The sentence: **how much of this site's holding carries an expiry decision
 * at all, then the categories ordered by what expires soonest.**
 *
 * **Ordered by urgency, never alphabetically**, because the order is the
 * finding. Alphabetical would put Assessments first every day of the year,
 * which tells a reader nothing they did not know before opening it.
 */
export function OrganisationLibraryRoute() {
  const { activeSite } = useSession()
  const today = useSiteToday()
  const [documents, setDocuments] = useState<DocumentRecord[] | 'loading'>('loading')
  const [added, setAdded] = useState(0)

  useEffect(() => {
    let live = true
    void getSiteDocuments(activeSite.id).then((result) => {
      if (live) setDocuments(result.documents)
    })
    return () => {
      live = false
    }
  }, [activeSite.id, added])

  const rows = useMemo(
    () => (documents === 'loading' ? [] : organisationRows(documents, today)),
    [documents, today],
  )

  if (documents === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading documents…</p>
      </div>
    )
  }

  const coverage = expiryDecisionCoverage(documents, activeSite.name)

  return (
    <div className={styles.page} data-organisation-library>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Documents</h1>
          <p className={styles.pageSubtitle}>
            Everything on file at {activeSite.name}, the residents&rsquo; documents and
            the home&rsquo;s own.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link to="expiry" className={styles.queueLink} data-expiry-link>
            Expiry tracking
            <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
          </Link>
          <UploadDrawer
            owner={{ kind: 'site', siteId: activeSite.id }}
            subjectName={activeSite.name}
            onFiled={() => setAdded((count) => count + 1)}
          />
        </div>
      </header>

      <AggregateFigure
        caption="of documents on file carry an expiry decision"
        aggregate={coverage}
        denominatorNoun="documents"
        emphasis="lead"
      />
      <p className={styles.coverageNote}>
        Either a date or a recorded decision that it does not expire; with neither,
        nobody can tell whether it is still valid.
      </p>

      <Card>
        <ul className={styles.organisationRows}>
          {rows.map((row) => (
            <li key={row.id}>
              <div className={styles.organisationRow} data-org-row={row.id}>
                <p className={styles.rowTitle}>{row.label}</p>

                <p className={styles.orgCount} data-org-count="total">
                  <span data-numeric>{formatCount(row.total)}</span>
                  <span>on file</span>
                </p>

                <p
                  className={styles.orgCount}
                  data-org-count="expired"
                  data-any={row.expired > 0}
                >
                  <span data-numeric>{formatCount(row.expired)}</span>
                  <span>expired</span>
                </p>

                <p
                  className={styles.orgCount}
                  data-org-count="expiring"
                  data-any={row.expiring > 0}
                >
                  <span data-numeric>{formatCount(row.expiring)}</span>
                  <span>expiring within 30 days</span>
                </p>

                {/*
                 * The third is never summed with the two beside it. Where it is
                 * zero there is nothing missing, so it renders quietly rather
                 * than hatching a fact that is present.
                 */}
                <div data-org-count="not_recorded">
                  {row.notRecorded > 0 ? (
                    <Unrecorded
                      variant="chip"
                      label={`${formatCount(row.notRecorded)} with no expiry recorded`}
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
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
