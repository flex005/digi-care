import { useCallback, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import type { ResidentId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getCareNotes } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, CardHeader } from '@/components/primitives'
import { NeverWrittenUp } from '@/components/status'
import { useSession, useTimeZone } from '@/app/session/use-session'
import type { IsoDateTime } from '@/data/types'
import { buildTimeline } from './timeline'
import { WindowEdge } from './WindowEdge'
import { RangeControl } from './RangeControl'
import {
  DEFAULT_NOTE_RANGE,
  RANGE_DAYS,
  rangeLabel,
  windowNotes,
  type NoteRange,
} from './note-window'
import { NoteCard } from './NoteCard'
import { GapMarker } from './GapMarker'
import { NoteFilterBar } from './NoteFilters'
import { NoteComposer } from './NoteComposer'
import { useNoteFilters } from './use-note-filters'
import styles from './notes.module.css'

/**
 * The note timeline. PRD §6.3.
 *
 * Reverse chronological, and the stretches between the notes are rendered as
 * objects rather than left as the space between rows. See `timeline.ts` and
 * `GapMarker` for why that is the point of the screen rather than a flourish.
 *
 * **Gap markers are suppressed while a filter is active**, and the screen says
 * so. This is the one decision on this screen that is not obvious and is not
 * negotiable: a six-hour hole in "Medication notes only" is a hole in the
 * filter, not in the record. Rendering it as "No care note recorded" would be
 * the product making a false claim about somebody's care — the same class of
 * failure as a blank cell meaning "no", and worse for being confident.
 *
 * Two empty states, and they are different answers:
 *
 *  - nobody has ever written this resident up — a hole, hatched;
 *  - the filters exclude everything — not a hole, and the record is still
 *    there behind them.
 */
export function NotesTab() {
  const { resident, site } = useOutletContext<ResidentProfile>()
  const { accessMode } = useSession()
  const { residentId } = useParams<{ residentId: string }>()
  const timeZone = useTimeZone()

  const load = useCallback(
    () => getCareNotes((residentId ?? '') as ResidentId),
    [residentId],
  )
  // Bumped when a note is written, so the timeline refetches and the new note
  // appears where its timestamp puts it rather than being pushed on the front.
  const [written, setWritten] = useState(0)
  const resource = useResource(load, [residentId, written])

  // One instant for the whole render, so the open gap and the date-range
  // filter agree with each other.
  const now = useMemo(() => new Date(), [])

  const allNotes = resource.kind === 'ready' ? resource.data : []

  /**
   * The window, applied before the filters.
   *
   * Order matters for the denominators: the filter bar says "showing X of Y",
   * and Y has to be the notes the window is drawing, not the whole record —
   * otherwise the figure is measured over a population that is not on screen.
   * Rule 4.
   */
  const [range, setRange] = useState<NoteRange>(DEFAULT_NOTE_RANGE)
  const [stepsBack, setStepsBack] = useState(0)
  const anchorMs = useMemo(
    () => now.getTime() - stepsBack * RANGE_DAYS[range] * 86_400_000,
    [now, stepsBack, range],
  )
  const shown = useMemo(
    () => windowNotes(allNotes, range, anchorMs),
    [allNotes, range, anchorMs],
  )
  const notes = shown.inWindow

  const { filters, setFilters, visible, authors, narrowed, clear } = useNoteFilters(
    notes,
    now,
  )

  const items = useMemo(
    () =>
      narrowed
        ? visible.map((note) => ({ kind: 'note' as const, note }))
        : buildTimeline(visible, timeZone, now.toISOString() as IsoDateTime),
    [narrowed, visible, timeZone, now],
  )

  if (resource.kind === 'loading') {
    return (
      <div className={styles.tabPanel}>
        <p className={styles.loading} role="status">
          Loading care notes…
        </p>
      </div>
    )
  }

  if (resource.kind === 'error') {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>These care notes could not be loaded</p>
          <p className={styles.errorBody}>
            Nothing has been lost; this is a read. A partial history is not shown,
            because it would read as a quieter record than it is.
          </p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.tabPanel}>
      <Card>
        <CardHeader
          title="Care notes"
          actions={
            // PRD §1: an auditor has zero write. Not a disabled button — the
            // control is not theirs to have.
            accessMode === 'read_only' ? null : (
              <NoteComposer
                resident={resident}
                site={site}
                onWritten={() => setWritten((count) => count + 1)}
              />
            )
          }
        />
        <div className={styles.filterSlot}>
          <RangeControl
            range={range}
            stepsBack={stepsBack}
            onRangeChange={(next) => {
              setRange(next)
              setStepsBack(0)
            }}
            onStep={(direction) =>
              setStepsBack((steps) => Math.max(0, steps - direction))
            }
          />
          <NoteFilterBar
            filters={filters}
            authors={authors}
            narrowed={narrowed}
            onChange={setFilters}
            onClear={clear}
          />
        </div>
      </Card>

      {narrowed ? (
        <Card padded>
          <p className={styles.narrowedNote}>
            <strong>
              Showing {visible.length} of {notes.length} notes in {rangeLabel(range)},
              and gap markers are hidden.
            </strong>{' '}
            A stretch with nothing in it here is a stretch with nothing matching these
            filters. Clear them to see where the real gaps are.
          </p>
        </Card>
      ) : null}

      {allNotes.length === 0 ? (
        <Card padded>
          {/* No caption: the card above already says "Care notes", and a
              panel that repeats its own heading spends a line saying nothing. */}
          <NeverWrittenUp variant="panel" />
        </Card>
      ) : notes.length === 0 ? (
        /*
         * Written up, but not inside this window. A third answer, and it must
         * not borrow either of the others: "never written up" would be false,
         * and "no notes match these filters" would blame a filter the reader
         * did not set. The claim carries its bound. Rule 3c.
         */
        <Card padded>
          <p className={styles.emptyTitle}>No notes in {rangeLabel(range)}</p>
          <p className={styles.emptyBody}>
            {resident.preferredName} has {allNotes.length} care notes on the record, all
            of them outside this range. Widen it or step back to reach them.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card padded>
          <p className={styles.emptyTitle}>No notes match these filters</p>
          <p className={styles.emptyBody}>
            {resident.preferredName} has {notes.length} care notes on the record. None
            of them matches what you have set, and they are still there.
          </p>
          <Button variant="secondary" onClick={clear}>
            Show the whole record
          </Button>
        </Card>
      ) : (
        <Card>
          {/* Railed: the subject is settled by the header above, so the column
              the reader scans is the clock. The notes and the stretches
              between them line up against one rail of times, which is what
              makes a gap marker read as a span rather than as another row. */}
          <ul className={[styles.timeline, styles.railedList].join(' ')}>
            {items.map((item) =>
              item.kind === 'note' ? (
                <NoteCard key={item.note.id} note={item.note} layout="railed" />
              ) : (
                <GapMarker key={`gap-${item.from}-${item.to}`} gap={item} />
              ),
            )}
            {/* Last, because newest-first means the window cuts at the foot.
                Not a gap marker — see WindowEdge for why that distinction is
                the whole reason this is a window and not a page. */}
            <WindowEdge
              range={range}
              previous={shown.previous}
              oldestShown={notes[notes.length - 1]?.recordedAt ?? 'none'}
            />
          </ul>
        </Card>
      )}
    </div>
  )
}
