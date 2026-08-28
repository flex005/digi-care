import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IsoDateTime, Shift, StaffId } from '@/data/types'
import { getCareNotesForSite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { residentsBySite } from '@/data/fixtures/residents'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import type { CareNote } from '@/data/types'
import {
  Avatar,
  Button,
  Card,
  Select,
  SelectedMark,
  Toast,
} from '@/components/primitives'
import { AggregateFigure, NeverWrittenUp, Unrecorded } from '@/components/status'
import { SHIFTS, SHIFT_NAMES } from '@/lib/shift'
import { formatCount, pluralise, type TimeZone } from '@/lib/format'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { NoteQueueRow } from './NoteQueueRow'
import { FilterNotice } from './FilterNotice'
import { PagedNotes } from './PagedNotes'
import {
  CARE_NOTES_VIEWS,
  authorsIn,
  allNotes,
  byAuthor,
  byShift,
  flaggedNotReviewed,
  notesToday,
  withoutNoteOnShift,
  withoutNoteToday,
  type CareNotesView,
} from './care-notes-views'
import styles from './notes.module.css'

/**
 * Care Notes across the home. PRD §6.3.
 *
 * The sentence this screen exists to say: **these notes are waiting for
 * somebody to act on them.** That is why it opens on the supervisory queue
 * and not on a feed.
 *
 * **The feed is last, and bounded.** A reverse-chronological list of every
 * note in the building answers no question anybody arrives with, and §6.3
 * says as much: it is "a screen nobody opens twice". So the screen is four
 * questions the per-resident timeline cannot answer, and then All notes,
 * scoped to the site's day and saying so.
 *
 * **Rule 3c applies throughout, and is visible.** Every figure states what it
 * was measured over, and every narrowed view carries a `FilterNotice` saying
 * what the filter costs the claims on the page. "No note today" is a real
 * absence claim and names its window and its population; "no note on the
 * night shift today" names its shift as well. Neither is an artefact of a
 * view, because both say what the view is — and the two views that cannot
 * make an absence claim at all say that instead of quietly not making one.
 */
/** One stable empty list, so a loading render does not invalidate every memo. */
const EMPTY: CareNote[] = []

export function CareNotesRoute() {
  const { activeSite } = useSession()
  const [view, setView] = useState<CareNotesView>('flagged')

  const load = useCallback(() => getCareNotesForSite(activeSite.id), [activeSite.id])
  const [written, setWritten] = useState(0)
  // What the last review action did, announced once by the screen rather than
  // by a toast inside each row — the row is removed by the very action it
  // would be confirming.
  const [outcome, setOutcome] = useState<'recorded' | 'undone' | 'none'>('none')
  const resource = useResource<CareNote[]>(load, [activeSite.id, written])

  const residents = useMemo(() => residentsBySite(activeSite.id), [activeSite.id])
  const now = useMemo(() => appNow().toISOString() as IsoDateTime, [])

  // Memoised rather than a bare conditional: a fresh [] on every render would
  // make every derived query below recompute for no reason, and one of them
  // walks twelve thousand notes.
  const notes = useMemo(
    () => (resource.kind === 'ready' ? resource.data : EMPTY),
    [resource],
  )
  const authors = useMemo(() => authorsIn(notes), [notes])
  const flagged = useMemo(
    () => flaggedNotReviewed(notes, residents),
    [notes, residents],
  )
  const unwritten = useMemo(
    () => withoutNoteToday(residents, notes, activeSite.timeZone, now),
    [residents, notes, activeSite.timeZone, now],
  )
  const [author, setAuthor] = useState<StaffId | 'none'>('none')
  const [shift, setShift] = useState<Shift>('night')

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.homePage}>
        <h1 className={styles.pageTitle}>Care notes</h1>

        {/*
         * The shape of the day before the list of it, on the same card the
         * residents list uses. Every figure carries its denominator on the
         * face, and the residents nobody has written up carry the hatch as a
         * chip inside the card rather than as a tint over it: a tinted card
         * cannot say whether the tint is the finding or the card.
         */}
        <MetricTiles label={`Care notes at ${activeSite.name}`}>
          <MetricTile
            label="Notes today"
            icon={metricIcons.notes}
            figure={
              <MetricValue>
                {formatCount(
                  notesToday(notes, residents, activeSite.timeZone, now).length,
                )}
              </MetricValue>
            }
            of={`across ${pluralise(residents.length, 'resident')}`}
          />
          <MetricTile
            label="Flagged for review"
            icon={metricIcons.alert}
            figure={<MetricValue>{formatCount(flagged.length)}</MetricValue>}
            of={`of ${formatCount(notes.length)} on record`}
          />
          <MetricTile
            label="Not written up today"
            icon={metricIcons.notesMissing}
            figure={
              unwritten.length === 0 ? (
                <MetricValue>0</MetricValue>
              ) : (
                <span data-unwritten-chip>
                  <Unrecorded
                    variant="chip"
                    label={`${formatCount(unwritten.length)} not written up`}
                    detail="nobody has recorded a care note for them today"
                  />
                </span>
              )
            }
            of={`of ${pluralise(residents.length, 'resident')}`}
          />
          <MetricTile
            label="On the record here"
            icon={metricIcons.notesAll}
            figure={<MetricValue>{formatCount(notes.length)}</MetricValue>}
            of={`written by ${pluralise(authors.length, 'person', 'people')}`}
          />
        </MetricTiles>

        <div className={styles.viewTabs} role="group" aria-label="What to look at">
          {CARE_NOTES_VIEWS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={[styles.viewTab, view === entry.id ? styles.viewTabActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={view === entry.id}
              onClick={() => setView(entry.id)}
            >
              <SelectedMark selected={view === entry.id} />
              {entry.label}
            </button>
          ))}
        </div>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading care notes…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>These care notes could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial queue is not shown,
              because it would read as a shorter queue than it is.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : view === 'flagged' ? (
          <FlaggedView
            notes={notes}
            residents={residents}
            siteName={activeSite.name}
            onChanged={(next) => {
              setOutcome(next)
              setWritten((count) => count + 1)
            }}
          />
        ) : view === 'quiet_today' ? (
          <QuietView
            onChanged={(next) => {
              setOutcome(next)
              setWritten((count) => count + 1)
            }}
            notes={notes}
            residents={residents}
            siteName={activeSite.name}
            timeZone={activeSite.timeZone}
            now={now}
          />
        ) : view === 'by_author' ? (
          <AuthorView
            onChanged={(next) => {
              setOutcome(next)
              setWritten((count) => count + 1)
            }}
            notes={notes}
            residents={residents}
            siteName={activeSite.name}
            authors={authors}
            author={author}
            onAuthor={setAuthor}
          />
        ) : view === 'by_shift' ? (
          <ShiftView
            onChanged={(next) => {
              setOutcome(next)
              setWritten((count) => count + 1)
            }}
            notes={notes}
            residents={residents}
            siteName={activeSite.name}
            timeZone={activeSite.timeZone}
            now={now}
            shift={shift}
            onShift={setShift}
          />
        ) : (
          <EverythingView
            onChanged={(next) => {
              setOutcome(next)
              setWritten((count) => count + 1)
            }}
            notes={notes}
            residents={residents}
            siteName={activeSite.name}
            timeZone={activeSite.timeZone}
            now={now}
          />
        )}

        <Toast
          open={outcome !== 'none'}
          onOpenChange={(open) => {
            if (!open) setOutcome('none')
          }}
          tone={outcome === 'undone' ? 'info' : 'positive'}
          title={outcome === 'undone' ? 'Review taken back' : 'Review recorded'}
          description={
            outcome === 'undone'
              ? 'The note is waiting on a senior again, flagged by whoever flagged it, exactly as it was.'
              : 'It is off the queue now. In this build it is held in memory and will be gone on reload.'
          }
        />
      </div>
    </SiteTimeZone>
  )
}

type ViewProps = {
  notes: CareNote[]
  residents: ReturnType<typeof residentsBySite>
  siteName: string
  /** What a review action did, so the screen can announce it and refetch. */
  onChanged: (outcome: 'recorded' | 'undone') => void
}

function FlaggedView({ notes, residents, siteName, onChanged }: ViewProps) {
  const items = flaggedNotReviewed(notes, residents)

  return (
    <Card>
      <div className={styles.queueHead} data-flagged-queue>
        <AggregateFigure
          emphasis="inline"
          caption="flagged and not yet reviewed"
          denominatorNoun={`residents at ${siteName}`}
          qualifier="oldest first"
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: items.length,
            coverage: { covered: items.length, total: residents.length },
          }}
        />
      </div>

      {items.length === 0 ? (
        // Rule 3b: recorded and unremarkable, stated plainly rather than
        // celebrated with a green panel.
        <p className={styles.settledNote}>Nothing is waiting on a senior.</p>
      ) : (
        <ul className={styles.queueList}>
          {items.map(({ note, resident }) => (
            <NoteQueueRow
              key={note.id}
              note={note}
              resident={resident}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

// Lists residents rather than notes, so it has no queue row and nothing to
// refetch for. It still takes `onChanged` through ViewProps; it just has no
// use for it.
function QuietView({
  notes,
  residents,
  siteName,
  timeZone,
  now,
}: ViewProps & { timeZone: string; now: IsoDateTime }) {
  const format = useSiteFormat()
  const quiet = withoutNoteToday(residents, notes, timeZone, now)

  return (
    <Card>
      <div className={styles.queueHead}>
        <AggregateFigure
          emphasis="inline"
          caption="with no note today"
          denominatorNoun={`residents at ${siteName}`}
          qualifier={`${format.time(now)} there now`}
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: quiet.length,
            coverage: { covered: quiet.length, total: residents.length },
          }}
        />
      </div>

      {quiet.length === 0 ? (
        <p className={styles.settledNote}>Everybody has a care note today.</p>
      ) : (
        <ul className={styles.quietList}>
          {quiet.map(({ resident, last }) => (
            <li key={resident.id} className={styles.quietRow} data-quiet={resident.id}>
              <div className={styles.quietWho}>
                <Avatar
                  photo={resident.photo}
                  name={resident.fullLegalName}
                  size="small"
                />
                <div>
                  <Link
                    className={styles.quietName}
                    to={`/residents/${resident.id}/notes`}
                  >
                    {resident.preferredName}
                  </Link>
                  <p className={styles.quietFacts}>
                    {resident.fullLegalName}
                    {resident.room.kind === 'recorded'
                      ? ` · Room ${resident.room.value}`
                      : ' · Room not recorded'}
                  </p>
                </div>
              </div>
              <div>
                {last === 'never' ? (
                  <NeverWrittenUp />
                ) : (
                  <p className={styles.quietFacts}>
                    Last written up{' '}
                    <span data-numeric>{format.dateTime(last.recordedAt)}</span>, by{' '}
                    {last.recordedBy.displayName}, {format.relative(last.recordedAt)}.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AuthorView({
  notes,
  residents,
  siteName,
  onChanged,
  authors,
  author,
  onAuthor,
}: ViewProps & {
  authors: [StaffId, string][]
  author: StaffId | 'none'
  onAuthor: (id: StaffId | 'none') => void
}) {
  /*
   * Staff as tabs, with All staff among them.
   *
   * A dropdown of fourteen names hides how many there are and what the other
   * thirteen would show; the tabs put the whole set on the screen and make the
   * chosen one visible without opening anything. "All staff" is a tab rather
   * than a cleared filter, so leaving one person is a choice a reader makes
   * rather than a state they have to work out how to get back to.
   */
  const everyone = author === 'none'
  const items = everyone
    ? allNotes(notes, residents)
    : byAuthor(notes, residents, author)
  const name = authors.find(([id]) => id === author)?.[1] ?? ''

  return (
    <Card>
      <div className={styles.authorTabs} role="group" aria-label="Whose notes">
        <button
          type="button"
          className={[styles.viewTab, everyone ? styles.viewTabActive : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={everyone}
          onClick={() => onAuthor('none')}
          data-author-tab="all"
        >
          <SelectedMark selected={everyone} />
          All staff
        </button>

        {authors.map(([id, label]) => {
          const active = author === id
          return (
            <button
              key={id}
              type="button"
              className={[styles.viewTab, active ? styles.viewTabActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={active}
              onClick={() => onAuthor(id)}
              data-author-tab={id}
            >
              <SelectedMark selected={active} />
              {label}
            </button>
          )
        })}
      </div>

      {/*
       * Rule 3c, said out loud while one person is chosen. Without it the
       * screen declines to make an absence claim and a reader cannot tell a
       * suppressed claim from one that came back empty.
       */}
      {everyone ? null : (
        <FilterNotice tone="suppressed" heading={`Filtered to ${name}`}>
          Absence here is absence from this filter, not from the record.
        </FilterNotice>
      )}

      <PagedNotes
        items={items}
        what={everyone ? `notes at ${siteName}, by everybody` : `notes by ${name}`}
        onChanged={onChanged}
        emptyNote={
          everyone
            ? `No care note has been written at ${siteName}.`
            : `${name} has written no care notes at ${siteName}.`
        }
      />
    </Card>
  )
}

function ShiftView({
  notes,
  residents,
  siteName,
  onChanged,
  timeZone,
  now,
  shift,
  onShift,
}: ViewProps & {
  timeZone: string
  now: IsoDateTime
  shift: Shift
  onShift: (shift: Shift) => void
}) {
  const items = byShift(notes, residents, shift, timeZone, now)
  const missed = withoutNoteOnShift(residents, notes, shift, timeZone, now)
  const covered = residents.length - missed.length

  return (
    <Card>
      <div className={styles.pickers}>
        <Select
          label="Shift"
          placeholder="Shift"
          value={shift}
          onValueChange={(value) => onShift(value as Shift)}
          options={SHIFTS.map((entry) => ({
            value: entry.id,
            label: `${entry.name} shift`,
          }))}
        />
      </div>

      {/* Rule 3c, and this one is the opposite case to the author view: the
          absence claim below is legitimate, because the shift and the day are
          in the sentence that makes it. The banner says which kind of claim
          the reader is looking at. */}
      <FilterNotice
        tone="scoped"
        heading={`Filtered to the ${SHIFT_NAMES[shift].toLowerCase()} shift, today`}
      >
        This shift did not write about these residents today. It does not say nobody
        did.
      </FilterNotice>

      <div className={styles.queueHead}>
        <AggregateFigure
          emphasis="inline"
          caption={`written up on the ${SHIFT_NAMES[shift].toLowerCase()} shift today`}
          denominatorNoun={`residents at ${siteName}`}
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: covered,
            coverage: { covered, total: residents.length },
          }}
        />
      </div>

      {missed.length > 0 ? (
        <ul className={styles.quietList}>
          {missed.map((resident) => (
            <li key={resident.id} className={styles.quietRow} data-missed={resident.id}>
              <div className={styles.quietWho}>
                <Avatar
                  photo={resident.photo}
                  name={resident.fullLegalName}
                  size="small"
                />
                <div>
                  <Link
                    className={styles.quietName}
                    to={`/residents/${resident.id}/notes`}
                  >
                    {resident.preferredName}
                  </Link>
                  <p className={styles.quietFacts}>{resident.fullLegalName}</p>
                </div>
              </div>
              <div>
                <Unrecorded
                  label={`No note on the ${SHIFT_NAMES[shift].toLowerCase()} shift today`}
                  detail="this shift did not write about this resident"
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.settledNote}>
          The {SHIFT_NAMES[shift].toLowerCase()} shift has written about everybody
          today.
        </p>
      )}

      {items.length > 0 ? (
        <ul className={styles.queueList}>
          {items.map(({ note, resident }) => (
            <NoteQueueRow
              key={note.id}
              note={note}
              resident={resident}
              onChanged={onChanged}
            />
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

/**
 * All notes, bounded to the site's day.
 *
 * The one view §6.3 warns about, built so it cannot mislead. Three things
 * keep it honest:
 *
 *  1. **It is not the default.** It is last in the list and the screen opens
 *     on the supervisory queue.
 *  2. **The bound is named on the page**, in the same sentence as the figure.
 *     Twelve thousand notes rendered as a feed is volume that drowns the
 *     distinction it exists to show; twelve thousand notes silently cut to
 *     fifty is worse, because the screen then reads as "this is everything".
 *  3. **It makes no absence claim at all.** A quiet day here is a quiet day
 *     in this window, and the banner says so rather than letting the empty
 *     space imply a home that stopped writing.
 */
function EverythingView({
  notes,
  residents,
  siteName,
  onChanged,
  timeZone,
  now,
}: ViewProps & { timeZone: string; now: IsoDateTime }) {
  const format = useSiteFormat()
  const items = allNotes(notes, residents)
  const today = notesToday(notes, residents, timeZone as TimeZone, now).length

  return (
    <Card>
      {/*
       * Every note, a page at a time.
       *
       * It was bounded to the day and still called "All notes", which is the
       * one thing a tab of that name must not be: somebody looking for a note
       * from Tuesday found nothing here and had no way to tell that from its
       * not existing. Paging is what lets the whole record be on the screen
       * without the screen becoming one nobody reads to the end of, and the
       * line above the list says which slice is showing and what of.
       */}
      <div className={styles.queueHead}>
        <AggregateFigure
          emphasis="inline"
          caption="notes on the record"
          denominatorNoun={`residents at ${siteName}`}
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: items.length,
            coverage: {
              covered: new Set(items.map((item) => item.resident.id)).size,
              total: residents.length,
            },
          }}
        />
        {/*
         * How much of the record is today, on its own line rather than in the
         * figure's note, which only renders on the banner emphasis.
         *
         * A day with nothing written must not read as a record with nothing
         * in it: the zero sits beside a total, rather than the screen being
         * empty with a sentence under it.
         */}
        <p className={styles.todayLine} data-today-line>
          <span data-numeric>{formatCount(today)}</span> of them written today, and it
          is {format.time(now)} at this home now.
        </p>
      </div>

      <PagedNotes
        items={items}
        what={`care notes at ${siteName}, by everybody`}
        onChanged={onChanged}
        emptyNote={`No care note has been written at ${siteName}.`}
      />
    </Card>
  )
}
