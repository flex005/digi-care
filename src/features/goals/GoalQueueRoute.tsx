import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Goal, GoalProgressNote, IsoDateTime, Resident } from '@/data/types'
import { getGoalsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, SelectedMark } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, pluralise } from '@/lib/format'
import { GoalState } from './GoalParts'
import { goalStanding } from './goal-timing'
import styles from './goals.module.css'

/**
 * Goals across the home. PRD §6.7.
 *
 * The sentence: **these goals passed their date and nobody has said what
 * happened.**
 *
 * The eighth queue in the settled shape. The statement is the content column,
 * in the resident's own words and never truncated to a clinical summary — on
 * a screen a manager scans, that is the only place the resident speaks.
 */

type Filter = 'past_target' | 'open' | 'closed' | 'not_asked' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'past_target', label: 'Past date, nothing said' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'not_asked', label: 'Resident not asked' },
  { id: 'all', label: 'All' },
]

interface Loaded {
  residents: Resident[]
  goals: Goal[]
  progress: GoalProgressNote[]
}

export function GoalQueueRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('past_target')

  const load = useCallback(() => getGoalsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Loaded>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Goals</h1>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading goals…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Goals could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer unanswered goals than there are.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            data={resource.data}
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
  data,
  siteName,
  filter,
  onFilter,
}: {
  data: Loaded
  siteName: string
  filter: Filter
  onFilter: (value: Filter) => void
}) {
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const byResident = new Map(data.residents.map((resident) => [resident.id, resident]))

  const byGoal = new Map<string, GoalProgressNote[]>()
  for (const note of data.progress) {
    byGoal.set(note.goalId, [...(byGoal.get(note.goalId) ?? []), note])
  }

  const rows = data.goals.flatMap((goal) => {
    const resident = byResident.get(goal.residentId)
    if (!resident) return []
    return [
      { goal, resident, standing: goalStanding(goal, byGoal.get(goal.id) ?? [], now) },
    ]
  })

  const pastTarget = rows.filter((row) => row.standing.kind === 'past_target')
  const dated = data.goals.filter((goal) => goal.target.kind === 'by_date').length
  const undated = data.goals.length - dated

  const visible = rows
    .filter((row) => {
      switch (filter) {
        case 'all':
          return true
        case 'past_target':
          return row.standing.kind === 'past_target'
        case 'open':
          return row.standing.kind !== 'closed'
        case 'closed':
          return row.standing.kind === 'closed'
        case 'not_asked':
          return (
            row.standing.kind === 'closed' &&
            row.standing.residentView !== 'not_applicable' &&
            row.standing.residentView.kind === 'not_asked'
          )
        default:
          return assertNever(filter)
      }
    })
    .sort(byLongestPast)

  return (
    <>
      <div className={styles.lead} data-past-target={pastTarget.length}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(pastTarget.length)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            {pastTarget.length === 1
              ? 'goal passed its date and nobody has said what happened'
              : 'goals passed their date and nobody has said what happened'}
          </span>
          <span className={styles.leadDetail}>
            Of <span data-numeric>{pluralise(dated, 'goal')}</span> with a target date,
            across <span data-numeric>{formatCount(data.goals.length)}</span> at{' '}
            {siteName}. <span data-numeric>{formatCount(undated)}</span> have no date at
            all: a goal with no date is not late and is not counted here.
          </span>
        </span>
      </div>

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
          Longest past its date first: the wait is the finding
          {filter === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(rows.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'past_target'
              ? `Every goal at ${siteName} with a date on it has either been answered or has not reached it yet.`
              : 'Nothing matches this filter. That is a statement about the filter, not about the record.'}
          </p>
        ) : (
          <ul className={styles.goalList}>
            {visible.map(({ goal, resident }) => (
              <li key={goal.id}>
                <div className={styles.queueRow} data-row={goal.id}>
                  <span className={styles.rowWho}>
                    <span className={styles.rowName}>{resident.preferredName}</span>
                    <span className={styles.rowMeta}>
                      {resident.fullLegalName}
                      {resident.room.kind === 'recorded'
                        ? ` · Room ${resident.room.value}`
                        : ' · Room not recorded'}
                    </span>
                  </span>

                  <span>
                    {/* Their words, never a summary of them. */}
                    <span className={styles.rowStatement} data-goal-statement={goal.id}>
                      &ldquo;{goal.statement}&rdquo;
                    </span>
                    <span className={styles.rowGoalMeta}>
                      set by {goal.setBy.displayName}
                    </span>
                  </span>

                  <GoalState
                    goal={goal}
                    progress={byGoal.get(goal.id) ?? []}
                    now={now}
                    preferredName={resident.preferredName}
                  />

                  <Link
                    to={`/residents/${resident.id}/goals/${goal.id}`}
                    className={styles.action}
                    aria-label={`Open the goal "${goal.statement}" for ${resident.fullLegalName}`}
                  >
                    Open
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
        )}
      </Card>
    </>
  )
}

/** Longest past its date first — the wait is the finding, as on every queue. */
function byLongestPast(
  a: { standing: ReturnType<typeof goalStanding> },
  b: { standing: ReturnType<typeof goalStanding> },
): number {
  const past = (row: { standing: ReturnType<typeof goalStanding> }) =>
    row.standing.kind === 'past_target' ? row.standing.daysPast : -1
  return past(b) - past(a)
}
