import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IsoDate, IsoDateTime, Resident } from '@/data/types'
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
import { AggregateFigure, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, formatLateness, pluralise } from '@/lib/format'
import { COVERAGE_WINDOW_DAYS, coverageOver } from './coverage'
import { KIND_LABEL, byMostRecent, byUrgency, projectReviews } from './projection'
import type { Reviewable, ReviewableKind, ReviewStanding } from './projection'
import styles from './reviews.module.css'

/**
 * Reviews across the home. PRD §6.7.
 *
 * The sentence: **these records have no review scheduled at all.**
 *
 * The sixth queue in the shape `/care-notes`, omissions, handover, the
 * incident log and the risk queue already share. Somebody who has learned one
 * has learned all of them.
 *
 * **This phase builds no third session.** The care plan review session is the
 * domain editor and the risk re-score session is the assessment form; a third
 * would be two ways to do one act, and the flag-clearing store assumes exactly
 * one. Every row routes to the module that owns the act.
 *
 * ## The completed filter changes what the screen is
 *
 * A queue of completed records has no gap to lead on, so the lead becomes an
 * `Aggregate` rather than a finding: coverage with its denominator, and how
 * much of it was done late. That is why completed is a filter here rather than
 * a second screen — same rows, same shape, one fact swapped.
 */

type Filter = 'never_scheduled' | 'overdue' | 'due_soon' | 'completed' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'never_scheduled', label: 'Never scheduled' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_soon', label: 'Due soon' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
]

export function ReviewQueueRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('never_scheduled')
  const [kind, setKind] = useState<ReviewableKind | 'all'>('all')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Reviews</h1>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading reviews…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Reviews could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer unscheduled reviews than there are.
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
            kind={kind}
            onFilter={setFilter}
            onKind={setKind}
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
  kind,
  onFilter,
  onKind,
}: {
  residents: Resident[]
  siteName: string
  filter: Filter
  kind: ReviewableKind | 'all'
  onFilter: (value: Filter) => void
  onKind: (value: ReviewableKind | 'all') => void
}) {
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const projection = projectReviews(residents, now)
  const all = projection.items

  const counted = (test: (item: Reviewable) => boolean) => all.filter(test).length
  const neverScheduled = counted((item) => item.standing.kind === 'never_scheduled')
  const overdue = counted((item) => item.standing.kind === 'overdue')
  const dueSoon = counted((item) => item.standing.kind === 'due_soon')

  const visible = all
    .filter((item) => (kind === 'all' ? true : item.kind === kind))
    .filter((item) => {
      switch (filter) {
        case 'all':
          return true
        case 'never_scheduled':
          return item.standing.kind === 'never_scheduled'
        case 'overdue':
          return item.standing.kind === 'overdue'
        case 'due_soon':
          return item.standing.kind === 'due_soon'
        case 'completed':
          return item.standing.kind === 'completed'
        default:
          return assertNever(filter)
      }
    })
    .sort(filter === 'completed' ? byMostRecent : byUrgency)

  const paged = usePaged(visible)

  /* The composition, said once and reused. Three populations behind one
     projection, and a count that does not say so is a figure nobody can
     check. */
  const composition = (
    <>
      <span data-numeric>{formatCount(all.length)}</span> records at {siteName} that
      could carry a review date,{' '}
      <span data-numeric>{formatCount(counted(isKind('risk_assessment')))}</span>{' '}
      assessed risks,{' '}
      <span data-numeric>{formatCount(counted(isKind('care_plan_domain')))}</span>{' '}
      written care plan domains and{' '}
      <span data-numeric>{formatCount(counted(isKind('whole_care_plan')))}</span>{' '}
      whole-plan reviews.
    </>
  )

  return (
    <>
      {filter === 'completed' ? (
        <CoverageLead items={all} siteName={siteName} now={now} />
      ) : (
        <div className={styles.findings}>
          {/* The lead. A record nobody ever set a review date for is the
              never-assessed shape applied to review itself. */}
          <div className={styles.findingLead} data-finding="never-scheduled">
            <span className={styles.findingFigure} data-numeric>
              {formatCount(neverScheduled)}
            </span>
            <span className={styles.findingBody}>
              <span className={styles.findingTitle}>
                have no review scheduled at all
              </span>
              <span className={styles.findingDetail}>
                Nobody ever set a date. Of {composition}
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
              <span className={styles.findingTitle}>overdue</span>
              <span className={styles.findingDetail}>
                Scheduled, and the date has passed. Of{' '}
                <span data-numeric>{formatCount(all.length)}</span>.
              </span>
            </span>
          </div>

          <div
            className={`${styles.finding} ${styles.findingPlain}`}
            data-finding="due-soon"
          >
            <span className={styles.findingFigure} data-numeric>
              {formatCount(dueSoon)}
            </span>
            <span className={styles.findingBody}>
              <span className={styles.findingTitle}>
                due in the next{' '}
                <span data-numeric>{pluralise(REVIEW_WINDOW, 'day')}</span>
              </span>
              <span className={styles.findingDetail}>
                Of <span data-numeric>{formatCount(all.length)}</span>.
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Both exclusions named, because silence on either would let a home
          that has done nothing read as a home with nothing outstanding. */}
      <p className={styles.sortLine} data-exclusions>
        Not counted here, because there is no review to schedule for a record that does
        not exist: <span data-numeric>{formatCount(projection.neverAssessed)}</span>{' '}
        risk assessments nobody has done, on the{' '}
        <Link to="/risk-assessments">risk assessment queue</Link>, and{' '}
        <span data-numeric>{formatCount(projection.neverWritten)}</span> care plan
        domains with nothing signed, on the{' '}
        <Link to="/care-plans">care plan queue</Link>. Both are real gaps, and each is
        the finding its own queue leads on.
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
              label="Record type"
              placeholder="All record types"
              value={kind === 'all' ? undefined : kind}
              onValueChange={(value) => onKind(value as ReviewableKind | 'all')}
              options={[
                { value: 'all', label: 'All record types' },
                { value: 'risk_assessment', label: 'Risk assessments' },
                { value: 'care_plan_domain', label: 'Care plan domains' },
                { value: 'whole_care_plan', label: 'Whole care plan reviews' },
              ]}
            />
          </div>
        </div>

        <p className={styles.sortLine}>
          {filter === 'completed'
            ? 'Most recent first: this is the record that a review happened, not a queue of work'
            : 'Never scheduled first: a record nobody set a date for has no wait to measure, so it sorts above the ones that do rather than among them'}
          {filter === 'all' && kind === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'never_scheduled' && kind === 'all'
              ? `Every record at ${siteName} that can be reviewed has a review date on it.`
              : 'Nothing matches these filters. That is a statement about the filters, not about the record.'}
          </p>
        ) : (
          <>
            <ul className={styles.queueList}>
              {paged.shown.map((item) => (
                <li key={item.id}>
                  <div className={styles.row} data-row={item.id} data-kind={item.kind}>
                    {/* Every row names its resident. A review with nobody
                      attached is the wrong-subject failure with a date on it. */}
                    <span className={styles.rowWho}>
                      <span className={styles.rowName}>
                        {item.resident.preferredName}
                      </span>
                      <span className={styles.rowMeta}>
                        {item.resident.fullLegalName}
                        {item.resident.room.kind === 'recorded'
                          ? ` · Room ${item.resident.room.value}`
                          : ' · Room not recorded'}
                      </span>
                    </span>

                    <span className={styles.rowWhat}>
                      {/* The kind is what stops three populations reading as
                        one list. */}
                      <span className={styles.rowKind}>{KIND_LABEL[item.kind]}</span>
                      <span className={styles.rowName}>{item.label}</span>
                    </span>

                    <span className={styles.rowState}>
                      <Standing standing={item.standing} />
                    </span>

                    <Link
                      to={item.to}
                      className={
                        item.standing.kind === 'never_scheduled'
                          ? styles.rowActionPrimary
                          : styles.rowAction
                      }
                      data-action={item.kind}
                      aria-label={`${item.actionLabel}, ${item.label} for ${item.resident.fullLegalName}`}
                    >
                      {item.actionLabel}
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
            <Pager paged={paged} total={visible.length} noun="reviews" />
          </>
        )}
      </Card>
    </>
  )
}

const isKind = (kind: ReviewableKind) => (item: Reviewable) => item.kind === kind

/** The threshold the third finding counts against, named rather than inline. */
const REVIEW_WINDOW = 30

/**
 * Where a review has got to. **An exhaustive switch, not a chain of ifs.**
 *
 * The last branch of a chain is the fullest case and the fullest case is the
 * one where everything is recorded (§8), so a member falling through here
 * would render as a review somebody had done.
 */
function Standing({ standing }: { standing: ReviewStanding }) {
  const format = useSiteFormat()

  switch (standing.kind) {
    case 'never_scheduled':
      return (
        <Unrecorded
          variant="chip"
          label="Never scheduled"
          detail="nobody has set a date to look at this again"
        />
      )

    case 'overdue':
      return (
        <span className={`${styles.stateChip} ${styles.stateOverdue}`} data-state-chip>
          Overdue
          <small>
            {formatLateness(standing.daysOverdue)} late · was due{' '}
            <span data-numeric>{format.date(standing.dueOn)}</span>
          </small>
        </span>
      )

    case 'due_soon':
      return (
        <span className={`${styles.stateChip} ${styles.stateDue}`} data-state-chip>
          Due soon
          <small>
            due <span data-numeric>{format.date(standing.dueOn)}</span>
          </small>
        </span>
      )

    case 'scheduled':
      // Recorded and unremarkable renders quietly (§3b).
      return (
        <span className={styles.stateSettled} data-settled>
          Scheduled
          <small>
            due <span data-numeric>{format.date(standing.dueOn)}</span>
          </small>
        </span>
      )

    case 'completed':
      /*
       * The evidence a review happened, and until now it existed in the data
       * and appeared on no screen at all. Quiet is not hidden: author and both
       * dates are always visible, never behind a hover.
       */
      return (
        <span className={styles.rowState}>
          <span className={styles.stateSettled} data-completed>
            Reviewed <span data-numeric>{format.date(standing.on)}</span>
            <small>
              {standing.by.displayName} · next due{' '}
              <span data-numeric>{format.date(standing.nextDueOn)}</span>
            </small>
          </span>
          {standing.late && standing.against.kind === 'due_on' ? (
            <span className={styles.stateLate} data-late>
              closed{' '}
              <span data-numeric>
                {formatLateness(daysBetweenDates(standing.against.dueOn, standing.on))}
              </span>{' '}
              after it was due
            </span>
          ) : standing.against.kind === 'never_scheduled' ? (
            // Done, and it had never been scheduled. Not late — there was no
            // date to be late against — and not on time either, which is why
            // it says what happened rather than choosing between the two.
            <span className={styles.stateSettled} data-never-was-scheduled>
              <small>no review date had been set</small>
            </span>
          ) : null}
        </span>
      )

    default:
      return assertNever(standing)
  }
}

function CoverageLead({
  items,
  siteName,
  now,
}: {
  items: Reviewable[]
  siteName: string
  now: IsoDateTime
}) {
  const since = shiftDays(now.slice(0, 10) as IsoDate, -COVERAGE_WINDOW_DAYS)
  const coverage = coverageOver(items, since)
  const reviewed = coverage.onTime + coverage.late
  const total = reviewed + coverage.outstanding
  const percent = (value: number) => (total === 0 ? 0 : (value / total) * 100)

  return (
    <div className={styles.coverage} data-coverage>
      <AggregateFigure
        caption={`Reviewed, of records due in the last ${pluralise(COVERAGE_WINDOW_DAYS, 'day')}`}
        aggregate={coverage.aggregate}
        denominatorNoun="records due a review"
        emphasis="lead"
      />

      <div>
        {/*
          The figure and its denominator come from AggregateFigure, which owns
          both. What is left here is what it cannot say: how much of that
          coverage was late, and what the denominator is counted against.
        */}
        <p className={styles.coverageTitle}>
          at {siteName}, of which <span data-numeric>{formatCount(coverage.late)}</span>{' '}
          were completed after their date
        </p>
        <p className={styles.coverageDetail}>
          A review is counted against the date it was <em>due</em>, not the date it was
          done: otherwise a home that clears a year&rsquo;s backlog in one afternoon
          makes the year it neglected disappear. A review nobody ever scheduled has no
          date to be counted against and is not in this figure; it is the lead finding
          on the other four filters.
        </p>
      </div>

      <div>
        <div className={styles.coverageBar}>
          <i
            className={styles.coverageDone}
            style={{ width: `${percent(coverage.onTime)}%` }}
          />
          <i
            className={styles.coverageLate}
            style={{ width: `${percent(coverage.late)}%` }}
          />
        </div>
        <p className={styles.coverageKey}>
          <span data-numeric>{formatCount(coverage.onTime)}</span> on time ·{' '}
          <span data-numeric>{formatCount(coverage.late)}</span> late ·{' '}
          <span data-numeric>{formatCount(coverage.outstanding)}</span> not reviewed
        </p>
      </div>
    </div>
  )
}

/** Whole days between two dates, for the lateness sentence on a completion. */
function daysBetweenDates(from: IsoDate, to: IsoDate): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)
}

function shiftDays(from: IsoDate, days: number): IsoDate {
  const date = new Date(`${from}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10) as IsoDate
}
