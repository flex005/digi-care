import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, IsoDate, IsoDateTime, Resident } from '@/data/types'
import { getActivities } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, formatDateTime, pluralise } from '@/lib/format'
import { useViewer } from '@/app/session/use-viewer'
import { PlanSession } from './PlanSession'
import { zonedDate } from '@/lib/format'
import { sessionState, unrecordedSessions } from './session-state'
import type { SessionState } from './session-state'
import styles from './activities.module.css'
import { NotYourHome } from '@/components/status'

/**
 * The week of activities. PRD §6.7, Phase 9.
 *
 * The sentence: **these sessions happened and nobody recorded who came.**
 *
 * **Range and arrangement use the same shape.** A segmented control means one
 * of a small set of mutually exclusive presentations of the same data — week
 * against month is an instance of that, and calendar against list is another.
 * A fourth shape would need distinguishing from the three that exist, which is
 * the cost the one-shape-one-meaning rule exists to avoid.
 */

type Range = 'week' | 'month'
type Arrangement = 'calendar' | 'list'

interface Loaded {
  activities: Activity[]
  residents: Resident[]
}

export function ActivityCalendarRoute() {
  const { activeSite } = useSession()
  const [range, setRange] = useState<Range>('week')
  const [arrangement, setArrangement] = useState<Arrangement>('calendar')
  const [offset, setOffset] = useState(0)
  const viewer = useViewer()
  /* Bumped when a session is planned, to re-read the calendar with it on. */
  const [version, setVersion] = useState(0)
  const [justPlanned, setJustPlanned] = useState<Activity | undefined>(undefined)

  const load = useCallback(() => getActivities(activeSite.id), [activeSite.id])
  const resource = useResource<Loaded>(load, [activeSite.id, version])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.pageTitle}>Activities</h1>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.nav}
              aria-label="Previous"
              onClick={() => setOffset((current) => current - 1)}
            >
              <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
            </button>

            <Segmented
              label="Range"
              value={range}
              options={[
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
              ]}
              onChange={setRange}
            />

            <button
              type="button"
              className={styles.nav}
              aria-label="Next"
              onClick={() => setOffset((current) => current + 1)}
            >
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </button>

            <Segmented
              label="Arrangement"
              value={arrangement}
              options={[
                { id: 'calendar', label: 'Calendar' },
                { id: 'list', label: 'List' },
              ]}
              onChange={setArrangement}
            />

            {/* Absent rather than disabled for anybody who cannot record here. */}
            {resource.kind === 'ready' && viewer.canRecordIn('/activities') ? (
              <PlanSession
                siteId={activeSite.id}
                timeZone={activeSite.timeZone}
                residents={resource.data.residents}
                onPlanned={(activity) => {
                  setJustPlanned(activity)
                  setVersion((count) => count + 1)
                }}
              />
            ) : null}
          </div>
        </div>

        {/*
         * Where it went, because it may be in a week this calendar is not
         * showing, and a session that vanished on saving reads as one that
         * did not save.
         */}
        {justPlanned !== undefined ? (
          <p className={styles.plannedNote} data-just-planned>
            Planned{' '}
            <Link to={justPlanned.id} className={styles.backLink}>
              {justPlanned.name}
            </Link>{' '}
            for{' '}
            <span data-numeric>
              {formatDateTime(justPlanned.startsAt, activeSite.timeZone)}
            </span>
            , with your name on it.
          </p>
        ) : null}

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading activities…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Activities could not be loaded</p>
            <p className={styles.errorBody}>Nothing has been lost; this is a read.</p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            data={resource.data}
            siteName={activeSite.name}
            range={range}
            arrangement={arrangement}
            offset={offset}
          />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={[styles.segment, value === option.id ? styles.segmentActive : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={value === option.id}
          data-segment={option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Found({
  data,
  siteName,
  range,
  arrangement,
  offset,
}: {
  data: Loaded
  siteName: string
  range: Range
  arrangement: Arrangement
  offset: number
}) {
  const format = useSiteFormat()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  /*
   * Today is the site's day, never the viewer's.
   *
   * `now.toISOString()` is UTC, so at ten past midnight British Summer Time
   * the calendar highlighted yesterday — the same defect §3.6 names for
   * clinical timestamps, arriving on a diary instead. The site's zone decides
   * which square is today, because the sessions in it happened there.
   */
  const today = zonedDate(now, format.timeZone)
  const days = useMemo(() => daysInRange(today, range, offset), [today, range, offset])
  const inRange = data.activities.filter((activity) =>
    days.includes(activity.startsAt.slice(0, 10) as IsoDate),
  )

  const unrecorded = unrecordedSessions(inRange, now)
  const invitedToThem = unrecorded.reduce(
    (total, activity) => total + activity.invited.length,
    0,
  )

  return (
    <>
      <div className={styles.lead} data-unrecorded={unrecorded.length}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(unrecorded.length)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            {unrecorded.length === 1
              ? 'session happened and nobody recorded who came'
              : 'sessions happened and nobody recorded who came'}
          </span>
          <span className={styles.leadDetail}>
            Of <span data-numeric>{pluralise(inRange.length, 'session')}</span> at{' '}
            {siteName} this {range}.{' '}
            <span data-numeric>{formatCount(invitedToThem)}</span> residents were
            invited to them, and there is no record of whether any of them came.
          </span>
        </span>
      </div>

      <Card>
        {arrangement === 'calendar' ? (
          <div className={styles.calendar} data-calendar>
            {days.map((day) => (
              <Day
                key={day}
                day={day}
                today={today}
                sessions={inRange.filter(
                  (activity) => activity.startsAt.slice(0, 10) === day,
                )}
                now={now}
              />
            ))}
          </div>
        ) : (
          <SessionList sessions={inRange} now={now} format={format} />
        )}
      </Card>
    </>
  )
}

function Day({
  day,
  today,
  sessions,
  now,
}: {
  day: IsoDate
  today: IsoDate
  sessions: Activity[]
  now: IsoDateTime
}) {
  const date = new Date(`${day}T00:00:00.000Z`)
  const future = day > today

  return (
    <div
      className={[
        styles.day,
        future ? styles.dayFuture : '',
        day === today ? styles.dayToday : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-day={day}
    >
      <div className={styles.dayHead}>
        <span className={styles.dayName}>{WEEKDAYS[date.getUTCDay()]}</span>
        <span className={styles.dayNumber} data-numeric>
          {date.getUTCDate()}
        </span>
      </div>

      {sessions.map((activity) => (
        <Session key={activity.id} activity={activity} now={now} />
      ))}
    </div>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Session({ activity, now }: { activity: Activity; now: IsoDateTime }) {
  const format = useSiteFormat()
  const state = sessionState(activity, now)

  return (
    <Link
      to={activity.id}
      className={`${styles.session} ${STATE_CLASS[state.kind]}`}
      data-session={activity.id}
      data-state={state.kind}
    >
      <span className={styles.sessionName}>{activity.name}</span>
      <span className={styles.sessionWhere}>
        {format.time(activity.startsAt)} · {activity.place}
      </span>
      <span className={styles.sessionStatus}>
        <StatusLine state={state} />
      </span>
    </Link>
  )
}

const STATE_CLASS: Record<SessionState['kind'], string> = {
  planned: styles.sessionPlanned,
  unrecorded: styles.sessionUnrecorded,
  partly_recorded: styles.sessionPartly,
  fully_recorded: styles.sessionDone,
}

/**
 * What the session says about itself. **An exhaustive switch.**
 *
 * The fullest case is the one where everything is recorded, so a member
 * falling through a chain would render as a session somebody had written up.
 */
function StatusLine({ state }: { state: SessionState }) {
  switch (state.kind) {
    case 'planned':
      return (
        <>
          Planned · <span data-numeric>{formatCount(state.invited)}</span> invited
        </>
      )
    case 'unrecorded':
      return (
        <>
          Nothing recorded · <span data-numeric>{formatCount(state.invited)}</span>{' '}
          invited
        </>
      )
    case 'partly_recorded':
      return (
        <>
          <span data-numeric>{formatCount(state.recorded)}</span> of{' '}
          <span data-numeric>{formatCount(state.invited)}</span> recorded
        </>
      )
    case 'fully_recorded':
      return (
        <>
          All <span data-numeric>{formatCount(state.invited)}</span> recorded ·{' '}
          <span data-numeric>{formatCount(state.attended)}</span> attended
        </>
      )
    default:
      return assertNever(state)
  }
}

function SessionList({
  sessions,
  now,
  format,
}: {
  sessions: Activity[]
  now: IsoDateTime
  format: ReturnType<typeof useSiteFormat>
}) {
  // Unrecorded first, then by when it happened. The wait is the finding, as on
  // every other queue in this build.
  const ordered = [...sessions].sort((a, b) => {
    const rank = (activity: Activity) =>
      sessionState(activity, now).kind === 'unrecorded' ? 0 : 1
    const difference = rank(a) - rank(b)
    return difference !== 0 ? difference : a.startsAt.localeCompare(b.startsAt)
  })

  if (ordered.length === 0) {
    return <p className={styles.settledNote}>Nothing was planned in this range.</p>
  }

  return (
    <>
      <p className={styles.sortLine}>
        Sessions nobody wrote up first, then in the order they happened
      </p>
      <ul className={styles.sessionList}>
        {ordered.map((activity) => (
          <li key={activity.id}>
            <Link
              to={activity.id}
              className={styles.listRow}
              data-session={activity.id}
              data-state={sessionState(activity, now).kind}
            >
              <span className={styles.listWhen} data-numeric>
                {format.instantDate(activity.startsAt)}
              </span>
              <span>
                <span className={styles.whoName}>{activity.name}</span>
                <span className={styles.listWhere}>
                  {' '}
                  {format.time(activity.startsAt)} · {activity.place}
                </span>
              </span>
              <span className={styles.sessionStatus}>
                <StatusLine state={sessionState(activity, now)} />
              </span>
              <span className={styles.backLink}>
                Open
                <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The days the range covers, from an anchor moved by whole weeks or months. */
function daysInRange(today: IsoDate, range: Range, offset: number): IsoDate[] {
  const anchor = new Date(`${today}T00:00:00.000Z`)
  if (range === 'week') anchor.setUTCDate(anchor.getUTCDate() + offset * 7)
  else anchor.setUTCMonth(anchor.getUTCMonth() + offset)

  if (range === 'week') {
    // Monday first, which is how a rota is read.
    const weekday = (anchor.getUTCDay() + 6) % 7
    const monday = new Date(anchor)
    monday.setUTCDate(monday.getUTCDate() - weekday)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday)
      day.setUTCDate(day.getUTCDate() + index)
      return day.toISOString().slice(0, 10) as IsoDate
    })
  }

  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
  const length = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return Array.from({ length }, (_, index) => {
    const day = new Date(first)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10) as IsoDate
  })
}
