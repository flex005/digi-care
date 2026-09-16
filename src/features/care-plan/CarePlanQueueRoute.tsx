import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CarePlanDomainId, IsoDateTime, Resident } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import {
  Button,
  Card,
  Pager,
  Select,
  SelectedMark,
  usePaged,
} from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, formatLateness } from '@/lib/format'
import { reviewTiming } from './review-timing'
import type { ReviewTiming } from './review-timing'
import styles from '@/features/reviews/reviews.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * Care plans across the home. PRD §6.7.
 *
 * The sentence: **these parts of these people's care have never been written
 * down.**
 *
 * **A different claim from the review queue's**, on an overlapping population.
 * "Nobody ever scheduled a review" is about a record that exists and has no
 * date on it; this is about a record that does not exist. The review queue
 * counts these domains in its denominator and excludes them from its findings,
 * naming them and pointing here — because a domain nobody has written has no
 * review to be late for.
 *
 * The seventh queue in the shape the others share.
 */

type Filter = 'never_written' | 'unsigned' | 'overdue' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'never_written', label: 'Never written' },
  { id: 'unsigned', label: 'Started, not signed' },
  { id: 'overdue', label: 'Review overdue' },
  { id: 'all', label: 'All' },
]

interface Row {
  resident: Resident
  domainId: CarePlanDomainId
  domainName: string
  timing: ReviewTiming
}

export function CarePlanQueueRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('never_written')
  const [domain, setDomain] = useState<CarePlanDomainId | 'all'>('all')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Care plans</h1>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading care plans…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Care plans could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer unwritten domains than there are.
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
            domain={domain}
            onFilter={setFilter}
            onDomain={setDomain}
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
  domain,
  onFilter,
  onDomain,
}: {
  residents: Resident[]
  siteName: string
  filter: Filter
  domain: CarePlanDomainId | 'all'
  onFilter: (value: Filter) => void
  onDomain: (value: CarePlanDomainId | 'all') => void
}) {
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  /*
   * Every resident against every domain, from the constant.
   *
   * The denominator is residents × domains rather than "domains written",
   * because counting what exists would make a home that has written nothing
   * look complete. Absence from a list is the same bug as a blank cell, at the
   * scale of a home.
   */
  const all: Row[] = residents.flatMap((resident) => {
    const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
    return CARE_PLAN_DOMAINS.map((entry) => {
      const record = byDomain.get(entry.id)
      return {
        resident,
        domainId: entry.id,
        domainName: entry.name,
        timing: record
          ? reviewTiming(record.status, now)
          : ({ kind: 'not_started' } as const),
      }
    })
  })

  const neverWritten = all.filter((row) => row.timing.kind === 'not_started').length
  const unsigned = all.filter((row) => row.timing.kind === 'in_progress').length
  const overdue = all.filter((row) => row.timing.kind === 'overdue').length

  const visible = all
    .filter((row) => (domain === 'all' ? true : row.domainId === domain))
    .filter((row) => {
      switch (filter) {
        case 'all':
          return true
        case 'never_written':
          return row.timing.kind === 'not_started'
        case 'unsigned':
          return row.timing.kind === 'in_progress'
        case 'overdue':
          return row.timing.kind === 'overdue'
        default:
          return assertNever(filter)
      }
    })
    .sort(byUrgency)

  const paged = usePaged(visible)

  return (
    <>
      <div className={styles.findings}>
        {/* The lead. Nobody has written this part of this person's care. */}
        <div className={styles.findingLead} data-finding="never-written">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(neverWritten)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              parts of a care plan have never been written down
            </span>
            <span className={styles.findingDetail}>
              Across <span data-numeric>{formatCount(residents.length)}</span> residents
              and <span data-numeric>{CARE_PLAN_DOMAINS.length}</span> domains at{' '}
              {siteName}, <span data-numeric>{formatCount(all.length)}</span> domains
              the home is expected to hold. Never written down is not &ldquo;no needs
              here&rdquo;.
            </span>
          </span>
        </div>

        <div
          className={`${styles.finding} ${styles.findingOverdue}`}
          data-finding="overdue"
        >
          <span className={styles.findingFigure} data-numeric>
            {formatCount(overdue)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>past their review date</span>
            <span className={styles.findingDetail}>
              Written and signed once, and nobody has been back. Of{' '}
              <span data-numeric>{formatCount(all.length)}</span>.
            </span>
          </span>
        </div>

        {/* A separate claim again: somebody started and nothing is signed, so
            staff have nothing to follow — but it is not "nobody looked". */}
        <div
          className={`${styles.finding} ${styles.findingPlain}`}
          data-finding="unsigned"
        >
          <span className={styles.findingFigure} data-numeric>
            {formatCount(unsigned)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>started and never signed</span>
            <span className={styles.findingDetail}>
              A draft exists and staff have nothing to follow. Of{' '}
              <span data-numeric>{formatCount(all.length)}</span>.
            </span>
          </span>
        </div>
      </div>

      <p className={styles.sortLine} data-review-link>
        Whether anybody has scheduled a review of what <em>is</em> written is a
        different question, and it is on the <Link to="/reviews">review queue</Link>.
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

          <div className={styles.filterSelect}>
            <Select
              label="Domain"
              placeholder="Any domain"
              value={domain === 'all' ? undefined : domain}
              onValueChange={(value) => onDomain(value as CarePlanDomainId | 'all')}
              options={[
                { value: 'all', label: 'Any domain' },
                ...CARE_PLAN_DOMAINS.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
          </div>
        </div>

        <p className={styles.sortLine}>
          Never written first, then longest overdue, a domain nobody has written has no
          wait to measure, so it sorts above the ones that do
          {filter === 'all' && domain === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'never_written' && domain === 'all'
              ? `Every care plan domain at ${siteName} has been written at least once.`
              : 'Nothing matches these filters. That is a statement about the filters, not about the record.'}
          </p>
        ) : (
          <>
            <ul className={styles.queueList}>
              {paged.shown.map((row) => (
                <li key={`${row.resident.id}-${row.domainId}`}>
                  <div
                    className={styles.row}
                    data-row={`${row.resident.id}-${row.domainId}`}
                    data-state={row.timing.kind}
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

                    <span className={styles.rowWhat}>
                      <span className={styles.rowKind}>Care plan domain</span>
                      <span className={styles.rowName}>{row.domainName}</span>
                    </span>

                    <span className={styles.rowState}>
                      <DomainStanding timing={row.timing} />
                    </span>

                    <Link
                      to={`/residents/${row.resident.id}/care-plan/${row.domainId}`}
                      className={
                        row.timing.kind === 'not_started'
                          ? styles.rowActionPrimary
                          : styles.rowAction
                      }
                      data-action={row.timing.kind === 'not_started' ? 'write' : 'open'}
                      aria-label={`${
                        row.timing.kind === 'not_started' ? 'Write' : 'Open'
                      } the ${row.domainName} care plan domain for ${row.resident.fullLegalName}`}
                    >
                      {row.timing.kind === 'not_started'
                        ? 'Write this domain'
                        : 'Open domain'}
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
            <Pager paged={paged} total={visible.length} noun="care plan domains" />
          </>
        )}
      </Card>
    </>
  )
}

/**
 * Never written first, then longest overdue.
 *
 * The same order as every other queue: a domain nobody has written has no wait
 * to measure, so it sorts above the ones that do rather than among them.
 */
function byUrgency(a: Row, b: Row): number {
  const rank = (row: Row) => {
    switch (row.timing.kind) {
      case 'not_started':
        return 0
      case 'overdue':
        return 1
      case 'in_progress':
        return 2
      case 'due_soon':
        return 3
      case 'settled':
        return 4
      default:
        return assertNever(row.timing)
    }
  }

  const difference = rank(a) - rank(b)
  if (difference !== 0) return difference

  const lateness = (row: Row) =>
    row.timing.kind === 'overdue' ? row.timing.daysOverdue : 0
  return lateness(b) - lateness(a)
}

function DomainStanding({ timing }: { timing: ReviewTiming }) {
  const format = useSiteFormat()

  switch (timing.kind) {
    case 'not_started':
      return (
        <Unrecorded
          variant="chip"
          label="Never written"
          detail="nobody has written what this person needs here"
        />
      )

    case 'in_progress':
      return (
        <span className={styles.stateSettled} data-state-draft>
          Draft in progress
          <small>
            {format.attributionOn(staffLabel(timing.updatedBy), timing.updatedAt)} · not
            signed
          </small>
        </span>
      )

    case 'overdue':
      return (
        <span className={`${styles.stateChip} ${styles.stateOverdue}`} data-state-chip>
          Review overdue
          <small>
            {formatLateness(timing.daysOverdue)} late · signed{' '}
            <span data-numeric>{format.date(timing.signed.on)}</span>
          </small>
        </span>
      )

    case 'due_soon':
      // No chip. The least urgent of the three unsettled states, and the one
      // most likely to crowd the two that matter.
      return (
        <span className={styles.stateSettled} data-due-soon>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            review due <span data-numeric>{format.date(timing.dueOn)}</span>
          </small>
        </span>
      )

    case 'settled':
      return (
        <span className={styles.stateSettled} data-settled>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            next review <span data-numeric>{format.date(timing.nextReviewOn)}</span>
          </small>
        </span>
      )

    default:
      return assertNever(timing)
  }
}
