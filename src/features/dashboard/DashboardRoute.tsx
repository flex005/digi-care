import { now as appNow } from '@/data/fixtures/clock'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { IsoDateTime } from '@/data/types'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { PendingInvitations } from './PendingInvitations'
import { Card, SelectedMark } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { NeverWrittenUp, Unrecorded } from '@/components/status'
import { formatCount, formatDate, formatRelative, pluralise } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import {
  deadlineKey,
  loadToday,
  type LateItem,
  type LateKind,
  type Today,
  type UnwrittenResident,
} from './today'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { dashboardIcons } from './dashboard-tiles.icons'
import { DoseBars, HatchSwatch, RoundRing, RoundsDonut } from './charts'
import {
  dosesByDay,
  moduleBars,
  roundsToday,
  todayDoses,
  type ModuleBar,
  type RoundToday,
} from './series'
import styles from './dashboard.module.css'

/**
 * The manager's Dashboard. PRD §8, Phase 12.
 *
 * The sentence: **what is late now, then what is due in the next couple of
 * hours, then who nobody has written up today.**
 *
 * **Nothing here is green and no compliance percentage appears anywhere.** A
 * tile with nothing wrong renders calm — plain surface, ink-700 figure —
 * because green would be a reassurance tile on the screen that exists to say
 * what is left, and a "92% compliant" figure on the front door would be most
 * reassuring exactly when the record is thinnest.
 *
 * Built in Phase 12 rather than earlier because a dashboard over three modules
 * would have been rebuilt twice.
 */
export function DashboardRoute() {
  const { activeSite } = useSession()
  const format = useSiteFormat()
  const [today, setToday] = useState<Today | 'loading'>('loading')

  useEffect(() => {
    let live = true
    const now = appNow().toISOString() as IsoDateTime
    void loadToday(activeSite, now).then((loaded) => {
      if (live) setToday(loaded)
    })
    return () => {
      live = false
    }
  }, [activeSite])

  if (today === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading today…</p>
      </div>
    )
  }

  const residents = today.residents.length
  const days = dosesByDay(activeSite, today.residents, today.now)
  const rounds = roundsToday(activeSite, today.residents, today.now)
  const doses = todayDoses(rounds)
  const latest = days[days.length - 1]
  const bars = moduleBars({
    residents: today.residents,
    writtenUpToday: residents - today.unwritten.length,
    doses: latest ?? {
      date: '' as never,
      daysBack: 0,
      recorded: 0,
      noRecord: 0,
      due: 0,
      stillToCome: 0,
    },
    acknowledged: today.incidentsTotal - today.unacknowledged.length,
    incidentsTotal: today.incidentsTotal,
  })

  return (
    <div className={styles.page} data-dashboard>
      {/* One pattern definition for every chart on the page. */}

      <PendingInvitations />

      <header>
        <h1 className={styles.pageTitle}>{activeSite.name}</h1>
        <p className={styles.pageSubtitle}>
          {format.dateTime(today.now)} · {pluralise(residents, 'resident')}
        </p>
      </header>

      {/*
       * ROW 1: four figures, each with its denominator, on the card every
       * other module uses.
       *
       * **Overdue now leads**, and it leads on position and width rather than
       * on a colour. It is the only figure here somebody can act on before
       * the end of the shift; the other three are the shape around it.
       *
       * The residents nobody has written up carry the hatch as a chip inside
       * a plain card. Tinting the whole tile said the card was the finding.
       */}
      <MetricTiles label={`Today at ${activeSite.name}`}>
        <MetricTile
          emphasis="lead"
          label="Overdue now"
          icon={dashboardIcons.overdue}
          figure={<MetricValue>{formatCount(today.late.length)}</MetricValue>}
          of={`things, across ${formatCount(residents)} residents`}
          note={overdueBreakdown(today)}
        />
        <MetricTile
          emphasis="supporting"
          label={`Due in the next ${pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}`}
          icon={dashboardIcons.dueSoon}
          figure={<MetricValue>{formatCount(today.dueSoon.length)}</MetricValue>}
          of={`doses, across ${formatCount(
            new Set(today.dueSoon.map((entry) => entry.resident.id)).size,
          )} of ${formatCount(residents)} residents`}
        />
        <MetricTile
          emphasis="supporting"
          label="Not written up today"
          icon={dashboardIcons.unwritten}
          figure={
            today.unwritten.length === 0 ? (
              <MetricValue>0</MetricValue>
            ) : (
              <span data-unwritten-chip>
                <Unrecorded
                  variant="chip"
                  label={`${formatCount(today.unwritten.length)} not written up`}
                  detail="nobody has recorded a care note for them today"
                />
              </span>
            )
          }
          of={`of ${pluralise(residents, 'resident')}`}
        />
        <MetricTile
          emphasis="supporting"
          label="Unacknowledged incidents"
          icon={dashboardIcons.incidents}
          figure={<MetricValue>{formatCount(today.unacknowledged.length)}</MetricValue>}
          of={`of ${formatCount(today.incidentsTotal)} on record at ${activeSite.name}`}
        />
      </MetricTiles>

      {/* ROW 2: the week, and today */}
      <div className={styles.rowTwo}>
        <section className={styles.panel} data-panel="doses-by-day">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              Doses recorded against due, last 7 days
            </h2>
            <p className={styles.panelNote}>
              Each bar is that day's doses due. Solid is recorded, hatched is the gap.
              Today is outlined.
            </p>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.swatchRecorded} aria-hidden />
                Recorded
              </span>
              <span className={styles.legendItem}>
                <HatchSwatch />
                Due and not recorded
              </span>
            </div>
          </div>
          <div className={styles.areaWrap}>
            <DoseBars days={days} />
          </div>
        </section>

        <section className={styles.panel} data-panel="rounds-donut">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Today's doses</h2>
            <p className={styles.panelNote}>
              Counts, not shares. Nothing recorded draws a hatched ring, not an empty
              one.
            </p>
          </div>
          <div className={styles.donutWrap}>
            <div className={styles.donutCentre}>
              <RoundsDonut doses={doses} />
              <div className={styles.donutMid}>
                <p className={styles.donutValue} data-numeric data-donut-centre>
                  {formatCount(doses.recorded)}
                </p>
                <p className={styles.donutLabel}>
                  of {formatCount(doses.total)} doses
                  <br />
                  scheduled today
                </p>
              </div>
            </div>
            <ul className={styles.donutKey}>
              {/*
               * All four, every time, including the zeroes. Absence from a
               * list is the same bug as a blank cell — and which of these is
               * empty depends on the hour, not on the home.
               */}
              <DonutKey
                what="Recorded"
                swatch={styles.swatchRecorded}
                value={doses.recorded}
              />
              <DonutKey
                what="No record"
                note="the window closed"
                swatch={<HatchSwatch />}
                value={doses.noRecord}
              />
              <DonutKey
                what="Due now"
                note="inside its window"
                swatch={styles.swatchDueNow}
                value={doses.dueNow}
              />
              <DonutKey
                what="Due soon"
                note={`within ${pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}`}
                swatch={styles.swatchDueSoon}
                value={doses.dueSoon}
              />
              <DonutKey
                what="Not due yet"
                note="later today"
                swatch={styles.swatchNotDue}
                value={doses.notDueYet}
              />
            </ul>
          </div>
        </section>
      </div>

      {/* ROW 3: what the record holds, and each round today */}
      <div className={styles.rowThree}>
        <section className={styles.panel} data-panel="module-bars">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>What the record holds, by module</h2>
            <p className={styles.panelNote}>
              Solid is recorded, hatched is expected and missing.
            </p>
          </div>
          <ul className={styles.bars}>
            {bars.map((bar) => (
              <ModuleBarRow key={bar.id} bar={bar} />
            ))}
          </ul>
        </section>

        <section className={styles.panel} data-panel="rounds">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Rounds today</h2>
            <p className={styles.panelNote}>One ring per round.</p>
          </div>
          {rounds.length === 0 ? (
            <p className={styles.calmEmpty} data-empty="rounds">
              No medication is scheduled today.
            </p>
          ) : (
            <ul className={styles.roundRows}>
              {rounds.map((round) => (
                <li key={round.at}>
                  <RoundRow round={round} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Card>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Already late</h2>
          <p className={styles.sectionNote}>
            Ordered by how long. All of it should have happened and has not.
          </p>
        </div>

        {today.late.length === 0 ? (
          <p className={styles.calmEmpty} data-empty="late">
            Nothing at {activeSite.name} is past its time.
          </p>
        ) : (
          <LateList items={today.late} />
        )}
      </Card>

      <Card>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            Nobody has written these residents up today
          </h2>
          <p className={styles.sectionNote}>
            <span data-numeric>{formatCount(today.unwritten.length)}</span> of{' '}
            <span data-numeric>{formatCount(residents)}</span>.
          </p>
        </div>

        {today.unwritten.length === 0 ? (
          <p className={styles.calmEmpty} data-empty="unwritten">
            Everybody at {activeSite.name} has been written up today.
          </p>
        ) : (
          <ul className={styles.rows}>
            {today.unwritten.map((entry) => (
              <li key={entry.resident.id}>
                <UnwrittenRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** How many late things fit on a page before the list stops being readable. */
const PAGE_SIZE = 8

const LATE_FILTERS: { id: LateKind | 'all'; label: string; claim: string }[] = [
  { id: 'all', label: 'Everything late', claim: 'things past their time' },
  { id: 'dose', label: 'Medication', claim: 'doses with no record' },
  { id: 'review', label: 'Reviews', claim: 'reviews past their date' },
  { id: 'handover', label: 'Handovers', claim: 'handovers left unsigned' },
]

/**
 * Everything late, filtered and paged.
 *
 * **Pills, not a tab strip.** An underline strip means navigation in this
 * product and a pill means a filter (§6). These narrow a list on the screen
 * you are already on, so they are pills, and borrowing the other shape would
 * teach the reader that an underline sometimes navigates and sometimes does
 * not.
 *
 * **The count carries the filter.** A figure of 26 above a list of 3 is a claim
 * about a set the reader is not looking at, which is Rule 3c and the most
 * direct way to break it. Narrowing the list narrows the claim, and the line
 * above says which filter produced it and what the unfiltered total is.
 *
 * **Paging hides rows, so the total is stated rather than implied.** A reader
 * who sees eight rows and no total has been told the home has eight problems.
 */
function LateList({ items }: { items: LateItem[] }) {
  const [filter, setFilter] = useState<LateKind | 'all'>('all')
  const [page, setPage] = useState(0)

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  )

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  /*
   * Two mechanisms hold the reader on a page that exists: choosing a filter
   * resets to the first, and this clamps anything still out of range. They are
   * deliberately redundant, and the guard for it fails only when both go,
   * which is worth saying out loud: a mutation against either one on its own
   * comes back green, and that is the guard being belt-and-braces rather than
   * the guard being broken.
   */
  const current = Math.min(page, pages - 1)
  const start = current * PAGE_SIZE
  const shown = visible.slice(start, start + PAGE_SIZE)
  const claim = LATE_FILTERS.find((entry) => entry.id === filter)!.claim

  const choose = (next: LateKind | 'all') => {
    setFilter(next)
    setPage(0)
  }

  return (
    <>
      <div className={styles.filters} role="group" aria-label="Which late things">
        {LATE_FILTERS.map((entry) => {
          const count =
            entry.id === 'all'
              ? items.length
              : items.filter((item) => item.kind === entry.id).length
          return (
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
              onClick={() => choose(entry.id)}
              data-late-filter={entry.id}
            >
              <SelectedMark selected={filter === entry.id} />
              {entry.label}
              {/* The size of each set, before you open it. */}
              <span className={styles.filterCount} data-numeric>
                {formatCount(count)}
              </span>
            </button>
          )
        })}
      </div>

      <p className={styles.resultLine} data-late-claim>
        <span data-numeric>{formatCount(visible.length)}</span> {claim}
        {filter === 'all' ? null : (
          <>
            , of <span data-numeric>{formatCount(items.length)}</span> late in total
          </>
        )}
        {pages > 1 ? (
          <>
            {'. '}
            Showing <span data-numeric>{formatCount(start + 1)}</span> to{' '}
            <span data-numeric>{formatCount(start + shown.length)}</span>.
          </>
        ) : null}
      </p>

      {visible.length === 0 ? (
        <p className={styles.calmEmpty} data-empty="filtered">
          Nothing matches this filter. That is a statement about the filter, not about
          the record.
        </p>
      ) : (
        <ul className={styles.rows}>
          {shown.map((item) => (
            <li key={item.id}>
              <LateRow item={item} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className={styles.pager} aria-label="Pages of late things" data-pager>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            data-pager-prev
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
            data-pager-next
          >
            Next
            <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
          </button>
        </nav>
      ) : null}
    </>
  )
}

function LateRow({ item }: { item: LateItem }) {
  const format = useSiteFormat()

  return (
    <div className={styles.row} data-late-row={item.id} data-late-kind={item.kind}>
      {/*
       * A time for an instant and a date for a date. The union makes the wrong
       * one unwritable rather than unlikely.
       */}
      <div className={styles.when} data-due={item.due.kind}>
        <span className={styles.whenLabel}>
          {item.due.kind === 'instant'
            ? format.time(item.due.at)
            : format.date(item.due.on)}
        </span>
        <span className={styles.whenDetail}>
          {formatRelative(deadlineKey(item.due) as IsoDateTime)}
        </span>
      </div>

      <div>
        <p className={styles.rowTitle}>{item.what}</p>
        <p className={styles.rowMeta}>{item.who}</p>
      </div>

      <span className={styles.lateChip} data-late-state>
        <span className={styles.lateLabel}>{item.state}</span>
        <span className={styles.lateDetail}>{item.detail}</span>
      </span>

      <Link
        to={item.to}
        className={styles.rowAction}
        aria-label={`${item.actionLabel}: ${item.what}, ${item.who}`}
      >
        {item.actionLabel}
        <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
      </Link>
    </div>
  )
}

function UnwrittenRow({ entry }: { entry: UnwrittenResident }) {
  const format = useSiteFormat()
  const { resident, last } = entry

  return (
    <div className={styles.row} data-unwritten={resident.id}>
      <div className={styles.when}>
        <span className={styles.whenLabel}>
          {last.kind === 'never' ? 'Never' : 'Not today'}
        </span>
        <span className={styles.whenDetail}>
          {last.kind === 'never'
            ? 'since admission'
            : `last ${format.instantDate(last.note.recordedAt)}`}
        </span>
      </div>

      <div>
        <p className={styles.rowTitle}>
          {resident.fullLegalName}
          {resident.room.kind === 'recorded' ? ` · Room ${resident.room.value}` : null}
        </p>
        <p className={styles.rowMeta}>
          {last.kind === 'never'
            ? `Admitted ${formatDate(resident.admittedOn)}`
            : `Last written up by ${last.note.recordedBy.displayName}`}
        </p>
      </div>

      {/*
       * Two different absences, and the owner of each says the words.
       * "Never written up" belongs to NeverWrittenUp — one concept, one label,
       * one treatment — and a resident written up yesterday but not today is a
       * different fact, so it keeps its own hatch and its own last-note line.
       */}
      <span data-unwritten-state={last.kind}>
        {last.kind === 'never' ? (
          <NeverWrittenUp variant="chip" />
        ) : (
          <Unrecorded
            variant="chip"
            label="Nothing today"
            detail={`last note ${format.dateTime(last.note.recordedAt)}`}
          />
        )}
      </span>

      <Link
        to={`/residents/${resident.id}/notes`}
        className={styles.rowAction}
        aria-label={`Write a care note for ${resident.fullLegalName}`}
      >
        Write a note
        <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
      </Link>
    </div>
  )
}

function DonutKey({
  what,
  note,
  swatch,
  value,
}: {
  what: string
  note?: string
  /*
   * A class for a plain colour, or the hatch swatch itself. The hatched row
   * cannot take a class: its treatment is SVG geometry, matching the arc it
   * labels rather than the boxes around it. See `HatchSwatch`.
   */
  swatch: string | ReactElement
  value: number
}) {
  return (
    <li className={styles.donutKeyRow} data-donut-key={what}>
      {typeof swatch === 'string' ? <span className={swatch} aria-hidden /> : swatch}
      <span className={styles.donutKeyName}>
        {what}
        {note === undefined ? null : (
          <span className={styles.donutKeyNote}> · {note}</span>
        )}
      </span>
      <span className={styles.donutKeyValue} data-numeric>
        {formatCount(value)}
      </span>
    </li>
  )
}

function ModuleBarRow({ bar }: { bar: ModuleBar }) {
  const share = bar.expected === 0 ? 0 : (bar.recorded / bar.expected) * 100

  return (
    <li className={styles.bar} data-bar={bar.id}>
      <p className={styles.barHead}>
        <span className={styles.barName}>{bar.label}</span>
        <span className={styles.barFigure}>
          <span data-numeric>{formatCount(bar.recorded)}</span>
          <span className={styles.barOf}>
            {' '}
            of {formatCount(bar.expected)} {bar.of}
          </span>
        </span>
      </p>
      <span className={styles.barTrack}>
        <span className={styles.barRecorded} style={{ width: `${share}%` }} />
        {/*
         * The remainder is hatched only where it is evidence nobody has
         * written. An unacknowledged incident was written down by somebody,
         * so hatching it would recruit a recorded fact into the
         * missing-evidence count.
         */}
        <span
          className={bar.remainder === 'finding' ? styles.barFinding : styles.barGap}
          style={{ width: `${100 - share}%` }}
          data-bar-remainder={bar.remainder}
        />
      </span>
    </li>
  )
}

function RoundRow({ round }: { round: RoundToday }) {
  return (
    <div className={styles.roundRow} data-round={round.at}>
      <RoundRing round={round} />
      <div>
        <p className={styles.roundName}>{round.at}</p>
        <p className={styles.roundNote} data-round-state>
          {roundState(round)}
        </p>
      </div>
      <p className={styles.roundFigure}>
        <span data-numeric>
          {round.recorded === 0 && round.notDueYet === round.expected
            ? 'Not due'
            : formatCount(round.recorded)}
        </span>
        <span className={styles.roundOf}>of {formatCount(round.expected)}</span>
      </p>
    </div>
  )
}

/**
 * What a round is, in its own words.
 *
 * **Never "complete" for a round that has not started.** Not-due-yet and
 * nothing-outstanding are opposite states that both have zero outstanding, and
 * the one thing neither of them gets is a reassurance: a round nobody has
 * reached has not been succeeded at.
 */
function roundState(round: RoundToday): string {
  if (round.notDueYet === round.expected) return 'not due yet'
  if (round.dueNow > 0)
    return `due now · ${pluralise(round.dueNow, 'dose')} in its window`
  if (round.noRecord > 0) {
    return `${pluralise(round.noRecord, 'dose')} with no record · ${signedBy(round)}`
  }
  if (round.notDueYet > 0) {
    return `${pluralise(round.notDueYet, 'dose')} still to come · ${signedBy(round)}`
  }
  return `all recorded · ${signedBy(round)}`
}

/**
 * Who recorded this round.
 *
 * A whole-site round is recorded by whoever was on it, which on a 28-resident
 * home is most of the shift. One name would say a single person did it, so
 * past one the row states the count instead.
 */
function signedBy(round: RoundToday): string {
  if (round.by.length === 0) return 'nobody has recorded any of it'
  if (round.by.length === 1) return round.by[0]!
  return `${pluralise(round.by.length, 'member')} of staff`
}

/** What the overdue figure is made of, so the tile is not a bare number. */
function overdueBreakdown(today: Today): string {
  const parts: string[] = []
  if (today.lateDoses.length > 0) {
    parts.push(pluralise(today.lateDoses.length, 'dose'))
  }
  if (today.overdueReviews.length > 0) {
    parts.push(pluralise(today.overdueReviews.length, 'review'))
  }
  if (today.unsignedHandovers.length > 0) {
    parts.push(pluralise(today.unsignedHandovers.length, 'handover'))
  }
  return parts.length === 0 ? 'nothing is past its time' : parts.join(' · ')
}
