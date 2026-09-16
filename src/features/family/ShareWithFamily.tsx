import type { CareNoteId, ResidentId } from '@/data/types'
import { Button } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  currentDisclosure,
  disclosureHistory,
  isSharedWithFamily,
  share,
  withdrawSharing,
} from '@/data/access/family-disclosure-store'
import { familyFor } from '@/data/access/family-access-store'
import { TELL_THEM } from './family-statement'
import styles from './family.module.css'

/**
 * Sharing one care note with a family. AM v2.0 FAM-02, Phase 21.
 *
 * **A decision about the note, never a property of it.** A care note is
 * immutable, and sharing is not an edit to it: it is a new record, with an
 * author and a moment, about who may see it. The log is append-only, so
 * un-sharing supersedes rather than erases — **a note that was visible to a
 * family for three weeks was disclosed**, and a flag flipped back to false
 * would destroy that.
 *
 * **Only a manager shares.** AM v2.0 is explicit that care workers cannot, and
 * it is the approve act in this module: choosing what a family reads is
 * signing off somebody else's writing.
 *
 * **It is refused where nobody may see it.** Sharing a note with a family that
 * has nobody named against it discloses to nobody and reads as disclosing to
 * somebody, which is the belief this whole module is careful about.
 */
export function ShareWithFamily({
  residentId,
  noteId,
  onChanged,
}: {
  residentId: ResidentId
  noteId: CareNoteId
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const viewer = useViewer()

  if (!viewer.canApproveIn('/care-notes')) return null

  const subject = { kind: 'care_note' as const, noteId }
  const shared = isSharedWithFamily(subject)
  const current = currentDisclosure(subject)
  const history = disclosureHistory(subject)
  const named = familyFor(residentId)

  if (named.length === 0) {
    return (
      <p className={styles.noFamily} data-no-family-named>
        Nobody is named to see this resident&rsquo;s updates, so there is nobody to
        share a note with. Family access is recorded on the Consent tab.
      </p>
    )
  }

  return (
    <div className={styles.share} data-share-note={noteId}>
      <p className={styles.shareState} data-shared={shared ? 'yes' : 'no'}>
        {current === undefined
          ? 'Not shared with the family. Nobody has decided either way.'
          : shared
            ? `Shared by ${current.by.displayName} · `
            : `Sharing stopped by ${current.by.displayName} · `}
        {current === undefined ? null : (
          <span data-numeric>{format.dateTime(current.at)}</span>
        )}
      </p>

      {/*
       * **The history stays, and un-sharing does not unsay it.** A note that a
       * family could read for three weeks was read, or could have been, and
       * the record of that is the point of an append-only log.
       */}
      {history.length > 1 ? (
        <ul className={styles.shareHistory} data-share-history={history.length}>
          {history.slice(0, -1).map((entry) => (
            <li key={entry.id}>
              {entry.decision === 'shared' ? 'Shared' : 'Sharing stopped'} by{' '}
              {entry.by.displayName} ·{' '}
              <span data-numeric>{format.dateTime(entry.at)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.instruction} data-nothing-sent>
        <b>{TELL_THEM.note}</b>
      </p>

      <Button
        variant="secondary"
        size="small"
        data-toggle-share
        onClick={() => {
          if (shared) withdrawSharing(residentId, subject, currentUser)
          else share(residentId, subject, currentUser)
          onChanged()
        }}
      >
        {shared ? 'Stop sharing with the family' : 'Share with the family'}
      </Button>
    </div>
  )
}
