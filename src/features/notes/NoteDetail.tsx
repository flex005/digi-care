import { useCallback, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { CareNote, CareNoteId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getCareNote } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, CardHeader, Toast } from '@/components/primitives'
import { StatusPill } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { NoteCard } from './NoteCard'
import { CorrectionDialog } from './CorrectionDialog'
import { ReviewNoteControl } from './ReviewNoteControl'
import { SupervisionRecord } from './SupervisionRecord'
import styles from './notes.module.css'

/**
 * One care note. PRD §6.3: "author, timestamp, shift, immutability notice.
 * There is **no edit control**, ever, for a submitted note."
 *
 * The immutability notice is not fine print. It is the reason there is no
 * pencil on this screen, and a reader who does not know why the pencil is
 * missing will assume the feature is unbuilt and wait for it. So it says, in
 * a sentence, that this is by design and what to do instead.
 *
 * The correction chain is rendered in both directions: a superseded note links
 * to the correction, and a correction links to what it corrected. Either one
 * read alone is misleading, and somebody arriving from a search or a link will
 * land on exactly one of them.
 */
export function NoteDetail() {
  const { resident, site } = useOutletContext<ResidentProfile>()
  const { noteId } = useParams<{ noteId: string }>()
  const { accessMode } = useSession()

  const load = useCallback(() => getCareNote((noteId ?? '') as CareNoteId), [noteId])
  const [reviewed, setReviewed] = useState(0)
  const [outcome, setOutcome] = useState<'recorded' | 'undone' | 'none'>('none')
  const resource = useResource<CareNote>(load, [noteId, reviewed])
  const [correction, setCorrection] = useState<CareNote | 'none'>('none')

  return (
    <div className={styles.tabPanel}>
      <Link className={styles.backLink} to="../notes" relative="path">
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All care notes
      </Link>

      {resource.kind === 'loading' ? (
        <p className={styles.loading} role="status">
          Loading this note…
        </p>
      ) : resource.kind === 'error' ? (
        <Card padded>
          <p className={styles.errorTitle}>This note could not be loaded</p>
          <p className={styles.errorBody}>
            <code>{noteId}</code> did not resolve to a care note for{' '}
            {resident.preferredName}.
          </p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Care note" />
            <ul className={styles.timeline}>
              {/* The review state is stated once on this screen, by the panel
                  below, which is also where the wait is. A chip under the note
                  body saying the same thing was the same fact twice. */}
              <NoteCard note={resource.data} linked={false} showReviewState={false} />
            </ul>
            {/* The wait is what the queue sorts on, and it does not stop
                mattering once the note leaves the queue. */}
            <SupervisionRecord note={resource.data} />

            {/* Both actions on this note, together, primary and secondary.
                They were at opposite corners of the screen. */}
            <div className={styles.noteActions}>
              {resource.data.supersededBy !== 'none' ? (
                <div className={styles.chain}>
                  <StatusPill
                    tone="info"
                    label="Already corrected"
                    detail="this note has been superseded"
                  />
                  <Link
                    className={styles.noteLink}
                    to={`../${resource.data.supersededBy}`}
                    relative="path"
                  >
                    Open the correction
                  </Link>
                </div>
              ) : accessMode === 'read_only' ? (
                // PRD §1: an auditor has zero write. Not a disabled button —
                // the control is not theirs to have.
                <p className={styles.immutabilityBody}>
                  You are a read-only auditor. Nothing on this note can be written from
                  this account.
                </p>
              ) : (
                <>
                  <ReviewNoteControl
                    note={resource.data}
                    resident={resident}
                    onChanged={(next) => {
                      setOutcome(next)
                      setReviewed((count) => count + 1)
                    }}
                  />
                  <CorrectionDialog
                    original={resource.data}
                    resident={resident}
                    site={site}
                    onWritten={setCorrection}
                  />
                </>
              )}
            </div>

            {/* One line, above the control it explains, rather than a card
                longer than the note it describes. */}
            <p className={styles.immutabilityLine}>
              A submitted care note is never edited or deleted, by anybody. A correction
              is a second note, linked to this one, which stays visible and is marked
              superseded.
            </p>
          </Card>

          {/* The correction chain, in both directions. Either half read alone
              is misleading, and somebody arriving from a search or a link
              lands on exactly one of them. */}
          {resource.data.corrects !== 'none' || correction !== 'none' ? (
            <Card padded>
              {resource.data.corrects !== 'none' ? (
                <div className={styles.chain}>
                  <StatusPill
                    tone="info"
                    label="This is a correction"
                    detail="the note it corrects is still on the record"
                  />
                  <Link
                    className={styles.noteLink}
                    to={`../${resource.data.corrects}`}
                    relative="path"
                  >
                    Open the note it corrects
                  </Link>
                </div>
              ) : null}

              {correction === 'none' ? null : (
                <div className={styles.chain}>
                  <StatusPill
                    tone="positive"
                    label="Correction written"
                    detail="this note is now superseded, and still on the record"
                  />
                  <Link
                    className={styles.noteLink}
                    to={`../${correction.id}`}
                    relative="path"
                  >
                    Open the correction
                  </Link>
                </div>
              )}
            </Card>
          ) : null}
        </>
      )}

      <Toast
        open={outcome !== 'none'}
        onOpenChange={(open) => {
          if (!open) setOutcome('none')
        }}
        tone={outcome === 'undone' ? 'info' : 'positive'}
        title={
          outcome === 'undone'
            ? `Review taken back for ${resident.preferredName}`
            : `Review recorded for ${resident.preferredName}`
        }
        description={
          outcome === 'undone'
            ? 'The note is waiting on a senior again, flagged by whoever flagged it, exactly as it was.'
            : 'It is off the queue now. In this build it is held in memory and will be gone on reload.'
        }
      />
    </div>
  )
}
