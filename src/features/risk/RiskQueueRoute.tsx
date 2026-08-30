import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IsoDate, Resident, RiskStatus, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
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
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, formatLateness } from '@/lib/format'
import { PlaceholderBanner } from './PlaceholderBanner'
import { LEVEL_LABEL } from './instrument'
import styles from './risk.module.css'

/**
 * Risk assessments across the home. PRD §6.6.
 *
 * The sentence: **these residents have a risk nobody has assessed.**
 *
 * The fifth queue in the shape `/care-notes`, omissions, handover and the
 * incident log already share — the finding leads, the list is ordered by the
 * thing that makes it a finding, every row names its resident, and the figure
 * follows the filter. Somebody who has learned one has learned all of them.
 *
 * **Never assessed leads, not overdue.** An overdue review is a risk somebody
 * looked at and has not looked at recently; a never-assessed one is a risk
 * nobody has looked at at all, and the second is not a worse version of the
 * first — it is a different claim. A home can only rank what it has measured.
 */

type Filter = 'never_assessed' | 'overdue' | 'due' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'never_assessed', label: 'Never assessed' },
  { id: 'overdue', label: 'Review overdue' },
  { id: 'due', label: 'Review due' },
  { id: 'all', label: 'All' },
]

interface Row {
  resident: Resident
  templateId: RiskTemplateId
  templateName: string
  status: RiskStatus
}

export function RiskQueueRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('never_assessed')
  const [template, setTemplate] = useState<RiskTemplateId | 'all'>('all')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Risk assessments</h1>

        <PlaceholderBanner />

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading risk assessments…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Risk assessments could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer unassessed risks than there are.
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
            template={template}
            onFilter={setFilter}
            onTemplate={setTemplate}
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
  template,
  onFilter,
  onTemplate,
}: {
  residents: Resident[]
  siteName: string
  filter: Filter
  template: RiskTemplateId | 'all'
  onFilter: (value: Filter) => void
  onTemplate: (value: RiskTemplateId | 'all') => void
}) {
  const format = useSiteFormat()

  /*
   * Every resident against every template, from the constant.
   *
   * The denominator is residents × templates rather than "assessments on
   * record", because counting what exists would make a home that has assessed
   * nothing look complete. Absence from a list is the same bug as a blank
   * cell, at the scale of a home.
   */
  const all: Row[] = residents.flatMap((resident) =>
    RISK_ASSESSMENT_TEMPLATES.map((entry) => ({
      resident,
      templateId: entry.id,
      templateName: entry.name,
      status: resident.risks[entry.id],
    })),
  )

  const never = all.filter((row) => row.status.kind === 'not_assessed')
  const overdue = all.filter(
    (row) =>
      row.status.kind === 'assessed' && row.status.reviewState.kind === 'overdue',
  )

  const visible = all
    .filter((row) => (template === 'all' ? true : row.templateId === template))
    .filter((row) => {
      switch (filter) {
        case 'all':
          return true
        case 'never_assessed':
          return row.status.kind === 'not_assessed'
        case 'overdue':
          return (
            row.status.kind === 'assessed' && row.status.reviewState.kind === 'overdue'
          )
        case 'due':
          return row.status.kind === 'assessed' && row.status.reviewState.kind === 'due'
      }
    })
    .sort(sortByUrgency)

  const paged = usePaged(visible)

  return (
    <>
      <div className={styles.findings}>
        {/* The lead. Nobody has looked at these at all. */}
        <div className={styles.findingLead} data-finding="never-assessed">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(never.length)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              {never.length === 1
                ? 'risk has never been assessed'
                : 'risks have never been assessed'}
            </span>
            <span className={styles.findingDetail}>
              Across <span data-numeric>{formatCount(residents.length)}</span> residents
              and <span data-numeric>{RISK_ASSESSMENT_TEMPLATES.length}</span> templates
              at {siteName}, <span data-numeric>{formatCount(all.length)}</span>{' '}
              assessments the home is expected to hold. Never assessed is not low risk.
            </span>
          </span>
        </div>

        {/* The secondary. Somebody looked, and has not looked recently — a
            different claim, so it is never added to the first. */}
        <div className={styles.findingSecondary} data-finding="overdue">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(overdue.length)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>past their review date</span>
            <span className={styles.findingDetail}>
              Assessed once and not since. Of{' '}
              <span data-numeric>{formatCount(all.length)}</span> expected assessments
              at {siteName}.
            </span>
          </span>
        </div>
      </div>

      <Card>
        <div className={styles.filters}>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={[
                styles.filterTab,
                filter === entry.id ? styles.filterTabActive : '',
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

          {/* A nine-item list is a select, not a pill row — a different amount
              of choice, not a different meaning. */}
          <div className={styles.filterSelects}>
            <Select
              label="Template"
              placeholder="Any template"
              value={template === 'all' ? undefined : template}
              onValueChange={(value) => onTemplate(value as RiskTemplateId | 'all')}
              options={[
                { value: 'all', label: 'Any template' },
                ...RISK_ASSESSMENT_TEMPLATES.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
          </div>
        </div>

        <p className={styles.resultLine}>
          Never assessed first, then longest overdue
          {filter === 'all' && template === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'never_assessed' && template === 'all'
              ? `Every risk assessment at ${siteName} has been completed at least once.`
              : 'Nothing matches these filters. That is a statement about the filters, not about the record.'}
          </p>
        ) : (
          <>
            <ul className={styles.queueList}>
              {paged.shown.map((row) => (
                <li key={`${row.resident.id}-${row.templateId}`}>
                  <Link
                    to={`/residents/${row.resident.id}/risk-assessments/${row.templateId}`}
                    className={styles.queueRow}
                    data-row={`${row.resident.id}-${row.templateId}`}
                    data-state={row.status.kind}
                  >
                    {/* Every row names its resident. An assessment with nobody
                      attached is the wrong-subject failure with a risk on it. */}
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
                      <span className={styles.rowName}>{row.templateName}</span>
                    </span>

                    <QueueState status={row.status} format={format} />

                    <span className={styles.rowOpen}>
                      {row.status.kind === 'not_assessed' ? 'Score now' : 'Re-score'}
                      <Icon
                        name="arrows-sharp/arrow-right-01-sharp"
                        size={16}
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pager paged={paged} total={visible.length} noun="assessments" />
          </>
        )}
      </Card>
    </>
  )
}

/**
 * Never assessed first, then longest overdue.
 *
 * The wait is the finding on the second half, as it is on every other queue —
 * but a risk nobody has assessed has no wait to measure, which is why it sorts
 * above rather than among them.
 */
function sortByUrgency(a: Row, b: Row): number {
  const rank = (row: Row) => {
    if (row.status.kind === 'not_assessed') return 0
    if (row.status.reviewState.kind === 'overdue') return 1
    if (row.status.reviewState.kind === 'due') return 2
    return 3
  }

  const difference = rank(a) - rank(b)
  if (difference !== 0) return difference

  const lateness = (row: Row) =>
    row.status.kind === 'assessed' && row.status.reviewState.kind === 'overdue'
      ? row.status.reviewState.daysOverdue
      : 0
  return lateness(b) - lateness(a)
}

function QueueState({
  status,
  format,
}: {
  status: RiskStatus
  format: ReturnType<typeof useSiteFormat>
}) {
  if (status.kind === 'not_assessed') {
    return (
      <span className={styles.rowState}>
        <Unrecorded
          variant="chip"
          label="Never assessed"
          detail="nobody has looked at this risk"
        />
      </span>
    )
  }

  const review = status.reviewState

  if (review.kind === 'overdue') {
    return (
      <span className={`${styles.rowState} ${styles.rowStateOverdue}`}>
        Review overdue
        <small>
          {formatLateness(review.daysOverdue)} late · {LEVEL_LABEL[status.level]}
        </small>
      </span>
    )
  }

  if (review.kind === 'due') {
    return (
      <span className={`${styles.rowState} ${styles.rowStateDue}`}>
        Review due
        <small>
          due <span data-numeric>{format.date(review.dueOn)}</span> ·{' '}
          {LEVEL_LABEL[status.level]}
        </small>
      </span>
    )
  }

  if (review.kind === 'never_scheduled') {
    return (
      <span className={styles.rowState}>
        <Unrecorded
          variant="chip"
          label="No review scheduled"
          detail="assessed, and nobody has set a date to look again"
        />
      </span>
    )
  }

  // Assessed and in date. Quiet — a column of green would drown the rows that
  // are the reason to open this screen (§3b).
  return (
    <span className={styles.rowState}>
      <StatusPill tone={LEVEL_TONE[status.level]} label={LEVEL_LABEL[status.level]} />
      <small>
        assessed{' '}
        <span data-numeric>
          {format.date(status.assessedAt.slice(0, 10) as IsoDate)}
        </span>
      </small>
    </span>
  )
}

const LEVEL_TONE = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
} as const
