import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnyConsent, ConsentTypeId, Resident } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, Pager, SelectedMark, usePaged } from '@/components/primitives'
import { ConsentBadge } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount } from '@/lib/format'
import { CONSENT_MEANS } from './consent-meaning'
import styles from './consent.module.css'

/**
 * Consent across the home. PRD §6.7, Phase 10.
 *
 * The sentence: **these consents have never been sought.**
 *
 * The tenth queue in the settled shape. The denominator is residents × the
 * eight types, never "consents on record" — counting what exists would make a
 * home that has asked nobody look complete, which is the same denominator
 * mistake the risk queue names.
 */

type Filter = 'never_sought' | 'pending' | 'refused' | 'best_interests' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'never_sought', label: 'Never sought' },
  { id: 'pending', label: 'Awaiting a decision' },
  { id: 'refused', label: 'Refused' },
  { id: 'best_interests', label: 'Decided for them' },
  { id: 'all', label: 'All' },
]

interface Row {
  resident: Resident
  typeId: ConsentTypeId
  typeName: string
  status: AnyConsent
}

export function ConsentDashboardRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('never_sought')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Consent</h1>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading consents…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Consents could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer unsought consents than there are.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            residents={resource.data}
            siteName={activeSite.name}
            filter={filter}
            onFilter={setFilter}
          />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Found({
  residents,
  siteName,
  filter,
  onFilter,
}: {
  residents: Resident[]
  siteName: string
  filter: Filter
  onFilter: (value: Filter) => void
}) {
  const all: Row[] = residents.flatMap((resident) =>
    CONSENT_TYPES.map((type) => ({
      resident,
      typeId: type.id as ConsentTypeId,
      typeName: type.name,
      status: resident.consents[type.id as ConsentTypeId] as AnyConsent,
    })),
  )

  const neverSought = all.filter((row) => row.status.kind === 'not_sought').length
  const decidedFor = all.filter(
    (row) =>
      row.status.kind !== 'not_sought' &&
      row.status.kind !== 'pending' &&
      row.status.by.kind !== 'the_resident',
  ).length

  const visible = all
    .filter((row) => {
      switch (filter) {
        case 'all':
          return true
        case 'never_sought':
          return row.status.kind === 'not_sought'
        case 'pending':
          return row.status.kind === 'pending'
        case 'refused':
          return row.status.kind === 'refused'
        case 'best_interests':
          return (
            row.status.kind !== 'not_sought' &&
            row.status.kind !== 'pending' &&
            row.status.by.kind !== 'the_resident'
          )
        default:
          return assertNever(filter)
      }
    })
    /*
     * Gaps first, and this became load-bearing the moment the list was paged.
     *
     * Unsorted, "Never sought" rows sat wherever `residents × types` happened
     * to put them — fine while every row was on screen, and a way of burying
     * the finding once only the first twenty-five are. A gap on page eight is
     * hidden as surely as a gap behind a green tile; the ordering does the
     * work the colour used to.
     */
    .sort(byUrgency)

  const paged = usePaged(visible)

  return (
    <>
      <div className={styles.lead} data-never-sought={neverSought}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(neverSought)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>consents have never been sought</span>
          <span className={styles.leadDetail}>
            Across <span data-numeric>{formatCount(residents.length)}</span> residents
            and <span data-numeric>{CONSENT_TYPES.length}</span> types at {siteName},{' '}
            <span data-numeric>{formatCount(all.length)}</span> decisions the home is
            expected to hold. Never sought is not refusal and it is not permission.
          </span>
        </span>
      </div>

      <p className={styles.sortLine} data-decided-for>
        <span data-numeric>{formatCount(decidedFor)}</span> of the decisions that have
        been made were made <em>for</em> somebody rather than <em>by</em> them: a
        best-interests process or an attorney. That is lawful and it is not the same
        thing, which is why the two are separate columns.
      </p>

      <Card>
        <div className={styles.filters}>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={[
                styles.filterPill,
                filter === entry.id ? styles.filterPillActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={filter === entry.id}
              data-filter={entry.id}
              onClick={() => onFilter(entry.id)}
            >
              <SelectedMark selected={filter === entry.id} />
              {entry.label}
            </button>
          ))}
        </div>

        <p className={styles.sortLine}>
          Every resident against every consent type
          {filter === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'never_sought'
              ? `Every consent at ${siteName} has been sought at least once.`
              : 'Nothing matches this filter. That is a statement about the filter, not about the record.'}
          </p>
        ) : (
          <>
            <ul className={styles.consentList}>
              {paged.shown.map((row) => (
                <li key={`${row.resident.id}-${row.typeId}`}>
                  <div
                    className={styles.queueRow}
                    data-row={`${row.resident.id}-${row.typeId}`}
                    data-state={row.status.kind}
                  >
                    <span className={styles.rowWho}>
                      <span className={styles.rowName}>
                        {row.resident.preferredName}
                      </span>
                      <span className={styles.rowMeta}>
                        {row.resident.fullLegalName}
                        {row.resident.room.kind === 'recorded'
                          ? ` · Room ${row.resident.room.value}`
                          : ' · Room not recorded'}
                      </span>
                    </span>

                    <span>
                      <span className={styles.rowName}>{row.typeName}</span>
                      <span className={styles.typeMeans}>
                        {CONSENT_MEANS[row.typeId]}
                      </span>
                    </span>

                    <span data-outcome={row.status.kind}>
                      <ConsentBadge status={row.status} />
                    </span>

                    <Link
                      to={`/residents/${row.resident.id}/consent/${row.typeId}`}
                      className={
                        row.status.kind === 'not_sought'
                          ? styles.actionPrimary
                          : styles.action
                      }
                      aria-label={`${
                        row.status.kind === 'not_sought' ? 'Seek' : 'Open'
                      } consent for ${row.typeName}, ${row.resident.fullLegalName}`}
                    >
                      {row.status.kind === 'not_sought' ? 'Seek consent' : 'Open'}
                      <Icon
                        name="arrows-sharp/arrow-right-01-sharp"
                        size={16}
                        aria-hidden
                      />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <Pager paged={paged} total={visible.length} noun="consent records" />
          </>
        )}
      </Card>
    </>
  )
}

/**
 * Nobody asked, then asked and waiting, then decided for them, then settled.
 *
 * The same shape as the risk and care plan queues deliberately: three screens
 * that rank a gap above a record should rank it the same way, or a reader
 * learns one order and is wrong on the next.
 */
function byUrgency(a: Row, b: Row): number {
  const rank = (row: Row) => {
    if (row.status.kind === 'not_sought') return 0
    if (row.status.kind === 'pending') return 1
    if (row.status.kind === 'refused') return 2
    if (row.status.by.kind !== 'the_resident') return 3
    return 4
  }
  return rank(a) - rank(b)
}
