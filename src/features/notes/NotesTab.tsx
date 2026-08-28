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

  const notes = resource.kind === 'ready' ? resource.data : []
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
              Showing {visible.length} of {notes.length} notes, and gap markers are
              hidden.
            </strong>{' '}
            A stretch with nothing in it here is a stretch with nothing matching these
            filters. Clear them to see where the real gaps are.
          </p>
        </Card>
      ) : null}

      {notes.length === 0 ? (
        <Card padded>
          {/* No caption: the card above already says "Care notes", and a
              panel that repeats its own heading spends a line saying nothing. */}
          <NeverWrittenUp variant="panel" />
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
          </ul>
        </Card>
      )}
    </div>
  )
}
