import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IsoDateTime } from '@/data/types'
import type { Omission } from '@/data/access/client'
import { getOmissions } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, SelectedMark } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount } from '@/lib/format'
import { elapsedMinutesBetween } from '@/lib/shift'
import { coarseWait } from '@/features/notes/note-parts'
import styles from './medications.module.css'

/**
 * Omissions across the home. PRD §6.4.
 *
 * The sentence this screen exists to say: **these doses were missed across the
 * home, and this is how long ago.**
 *
 * The MAR chart's counterpart, and the same relationship `/care-notes` has to
 * one resident's timeline — same records, different question. The chart asks
 * what happened to this person; this asks what is going wrong in this home,
 * and it opens on the doses nobody has accounted for.
 *
 * **Every row names its resident**, and that is not a layout preference. This
 * is the first cross-resident medication screen, and a row carrying a drug, a
 * dose and a time with no person attached to it is the wrong-subject failure
 * with a dosage on it (§2.4). The join happens in `getOmissions`, and a record
 * whose resident cannot be resolved is dropped rather than rendered.
 *
 * **Oldest first**, because the wait is the finding — the same ordering and
 * the same reason as the flagged care-note queue.
 */

const RANGE_DAYS = 7

type Filter = 'all' | 'escalated' | 'not_escalated'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'not_escalated', label: 'Not escalated' },
]

/**
 * What the banner's figure is a count of, per filter.
 *
 * The filter is in the caption rather than left to the tab strip: a figure
 * read on its own has to say what it counted, and "20 doses with no record" is
 * a different claim from "3 doses with no record and not yet escalated".
 */
const CAPTIONS: Record<Filter, string> = {
  all: 'doses with no record',
  escalated: 'doses with no record, escalated',
  not_escalated: 'doses with no record and not yet escalated',
}

export function OmissionsRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('all')

  /**
   * One instant for the life of the screen, so the range and every "how long
   * ago" on the page agree with each other.
   *
   * A lazy `useState` rather than a `useMemo`: reading the clock is impure, and
   * a memo runs during render. The same pattern the note composer uses.
   */
  const [since] = useState<IsoDateTime>(
    () => new Date(Date.now() - RANGE_DAYS * 86_400_000).toISOString() as IsoDateTime,
  )

  const load = useCallback(
    () => getOmissions(activeSite.id, since),
    [activeSite.id, since],
  )
  const resource = useResource<{ omissions: Omission[]; dueInRange: number }>(load, [
    activeSite.id,
    since,
  ])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading medication omissions…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>These omissions could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer missed doses than there are.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            omissions={resource.data.omissions}
            dueInRange={resource.data.dueInRange}
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
  omissions,
  dueInRange,
  siteName,
  filter,
  onFilter,
}: {
  omissions: Omission[]
  dueInRange: number
  siteName: string
  filter: Filter
  onFilter: (filter: Filter) => void
}) {
  // Counted over the week rather than the filtered list: these are the tiles'
  // figures and each carries its own denominator.
  const escalatedCount = omissions.filter(
    (entry) => entry.escalatedAt !== 'not_escalated',
  ).length

  const visible = omissions.filter((entry) =>
    filter === 'all'
      ? true
      : filter === 'escalated'
        ? entry.escalatedAt !== 'not_escalated'
        : entry.escalatedAt === 'not_escalated',
  )

  return (
    <>
      {/**
       * The same fact, the same component, the same treatment as the chart's.
       *
       * **It follows the filter, and its caption says which.** A figure of 20
       * above a list of 3 is a claim about a set the reader is not looking at
       * — Rule 3c, and the most direct way to break it. Narrowing the list
       * narrows the claim, and the caption carries the filter so the number is
       * never bare.
       */}
      {/*
       * The week's figures, on the same card the residents list uses.
       *
       * These are the whole week and never the filtered set: each carries its
       * own denominator, so narrowing the list below cannot make one of them
       * a claim about a set the reader is not looking at. The filtered count
       * lives on the line above the list, where the filter that produced it is
       * named beside it.
       */}
      <div data-omissions>
        <MetricTiles label={`Doses at ${siteName} this week`}>
          <MetricTile
            label="Doses with no record"
            icon={metricIcons.notesMissing}
            figure={
              omissions.length === 0 ? (
                <MetricValue>0</MetricValue>
              ) : (
                <span data-omissions-chip>
                  <Unrecorded
                    variant="chip"
                    label={`${formatCount(omissions.length)} with no record`}
                    detail="the window closed and nobody wrote anything"
                  />
                </span>
              )
            }
            of={`of ${formatCount(dueInRange)} doses due this week`}
          />
          <MetricTile
            label="Escalated"
            icon={metricIcons.alert}
            figure={<MetricValue>{formatCount(escalatedCount)}</MetricValue>}
            of={`of ${formatCount(omissions.length)} with no record`}
          />
          <MetricTile
            label="Not yet escalated"
            icon={metricIcons.waiting}
            figure={
              <MetricValue>
                {formatCount(omissions.length - escalatedCount)}
              </MetricValue>
            }
            of={`of ${formatCount(omissions.length)} with no record`}
          />
          <MetricTile
            label="Doses due this week"
            icon={metricIcons.doses}
            figure={<MetricValue>{formatCount(dueInRange)}</MetricValue>}
            of={`at ${siteName}`}
          />
        </MetricTiles>
      </div>

      <Card>
        <div className={styles.filters} role="group" aria-label="Which omissions">
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
              onClick={() => onFilter(entry.id)}
            >
              <SelectedMark selected={filter === entry.id} />
              {entry.label}
            </button>
          ))}
        </div>

        {/*
         * The filtered claim, with the filter that produced it named beside
         * it and the week's total after it. A count above a narrowed list is
         * otherwise a claim about a set the reader is not looking at.
         */}
        <p className={styles.resultLine} data-result-line>
          <span data-numeric>{formatCount(visible.length)}</span> {CAPTIONS[filter]}
          {filter === 'all' ? null : (
            <>
              {', of '}
              <span data-numeric>{formatCount(omissions.length)}</span> with no record
              this week
            </>
          )}
          {' · oldest first'}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {filter === 'all'
              ? `Every dose due at ${siteName} this week has a record against it.`
              : 'Nothing matches this filter. That is a statement about the filter, not about the record.'}
          </p>
        ) : (
          <ul className={styles.omissionList}>
            {visible.map((entry) => (
              <OmissionRow key={rowKey(entry)} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/** `15/08` — the day at a glance. The full date is on the meta line. */
const shortDay = (at: IsoDateTime) => {
  const day = new Date(at)
  return `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`
}

const rowKey = (entry: Omission) =>
  `${entry.record.medicationId}|${entry.record.date}|${entry.record.roundTime}`

function OmissionRow({ entry }: { entry: Omission }) {
  const format = useSiteFormat()
  const { resident, medication, record } = entry
  const escalated = entry.escalatedAt !== 'not_escalated'

  const ago = coarseWait(
    elapsedMinutesBetween(entry.dueAt, appNow().toISOString() as IsoDateTime),
  )

  return (
    <li
      className={styles.omissionRow}
      data-omission={rowKey(entry)}
      data-escalated={escalated}
    >
      {/* The subject leads. A dose never renders without the person it belongs
          to — this is the first cross-resident medication screen (§2.4). */}
      <div className={styles.omissionWho}>
        <Link
          className={styles.omissionName}
          to={`/residents/${resident.id}/medications`}
        >
          {resident.preferredName}
        </Link>
        <p className={styles.omissionFacts}>
          {resident.fullLegalName}
          {resident.room.kind === 'recorded'
            ? ` · Room ${resident.room.value}`
            : ' · Room not recorded'}
        </p>
      </div>

      <div className={styles.omissionState}>
        {/* The mark is the one the MAR cell uses, so a reader moving between
            the two screens meets one mechanism. It is decorative: "escalated"
            is in the words either way. */}
        {/* The round and the day lead, then how long ago.
            "missed 6 days ago" repeated on six consecutive rows, so the key the
            list is sorted by was the one thing a reader could not see —
            15/08 20:00 and 16/08 08:00 read identically. The full date stays on
            the meta line; this is the short form because it is being scanned. */}
        <Unrecorded
          variant="chip"
          label={escalated ? 'No record, escalated' : 'No record, not escalated'}
          {...(escalated ? { icon: 'alert-notification/alert-02' as const } : {})}
          detail={`${record.roundTime}, ${shortDay(entry.dueAt)} · missed ${ago} ago`}
        />
      </div>

      <div className={styles.omissionMain}>
        <p className={styles.omissionDose}>
          {medication.name} {medication.dose}
        </p>
        <p className={styles.omissionMeta}>
          <span data-numeric>{record.roundTime}</span>
          <span data-numeric>{format.instantDate(entry.dueAt)}</span>
          <span>{medication.route.toLowerCase()}</span>
          {medication.isControlledDrug ? <span>controlled drug</span> : null}
          {/* The chip already says whether it was escalated. What it cannot
              say is when, so that is all this carries — and nothing at all
              when there is nothing to say. */}
          {entry.escalatedAt === 'not_escalated' ? null : (
            <span>raised {format.time(entry.escalatedAt)}</span>
          )}
        </p>
      </div>

      <div className={styles.omissionAction}>
        <Link className={styles.noteLink} to={`/residents/${resident.id}/medications`}>
          Open MAR
        </Link>
      </div>
    </li>
  )
}
