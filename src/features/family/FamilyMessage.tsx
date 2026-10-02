import { useState } from 'react'
import type { Incident } from '@/data/types'
import { Button } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useTerm } from '@/app/session/use-term'
import { useViewer } from '@/app/session/use-viewer'
import { ReadOnlyHere } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { subjectResidentId } from '@/data/types'
import {
  currentDisclosure,
  isSharedWithFamily,
  share,
  withdrawSharing,
} from '@/data/access/family-disclosure-store'
import { familyFor } from '@/data/access/family-access-store'
import { TELL_THEM } from './family-statement'
import styles from './family.module.css'

/**
 * What the family are told about an incident. AM v2.0 INC-01 and FAM-03,
 * Phase 21.
 *
 * **The family never see the incident.** AM v2.0 is explicit and it is the
 * whole reason this is a separate message rather than a switch on the record:
 * "Emmanuel had a fall this afternoon, he was checked by the nurse and is
 * comfortable" rather than "Fall: unwitnessed. Moderate harm. Root cause:
 * environmental." Two audiences, two registers, and the clinical record is not
 * written for the second.
 *
 * **This is the one screen in the build where believing a stub could hurt
 * somebody.** Everywhere else a stub costs a reader a file. Here a manager who
 * saves this and believes the family were told **may not telephone them**, and
 * the family do not hear that their relative fell. So the instruction is on
 * the control, in front of the act, and it says what to do rather than what
 * the software is.
 */
export function FamilyMessage({
  incident,
  onChanged,
}: {
  incident: Incident
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const term = useTerm()
  const [message, setMessage] = useState('')

  /*
   * **An incident with no resident subject has no family to tell.** Some are
   * about a member of staff or a visitor: `subjectResidentId` says `'none'`
   * rather than guessing, and there is nobody whose family this is.
   */
  const residentId = subjectResidentId(incident)
  if (residentId === 'none') return null

  const named = familyFor(residentId)
  const sent = isSharedWithFamily({
    kind: 'incident',
    incidentId: incident.id,
    message: '',
  })
  const current = currentDisclosure({
    kind: 'incident',
    incidentId: incident.id,
    message: '',
  })

  /*
   * Sharing an update with the family writes a disclosure record against the
   * resident. `/family` declares `records: 'naming somebody who may see a
   * resident's updates, and removing them'` and `approves: false`.
   */
  if (!viewer.canRecordIn('/family')) {
    return (
      <ReadOnlyHere
        roleName={viewer.roleName}
        subject="what has been shared with the family"
        act="share an update or withdraw one"
      />
    )
  }

  return (
    <section className={styles.share} data-family-message={incident.id}>
      <p className={styles.shareState}>Telling the family</p>

      {named.length === 0 ? (
        <p className={styles.noFamily} data-no-family-named>
          Nobody is named to see this {term.ones} updates; if the family need to know,
          telephone them.
        </p>
      ) : current !== undefined ? (
        <>
          <p className={styles.shareState} data-message-recorded>
            {sent ? 'Recorded' : 'Withdrawn'} by {current.by.displayName} ·{' '}
            <span data-numeric>{format.dateTime(current.at)}</span>
          </p>
          {current.subject.kind === 'incident' && current.subject.message !== '' ? (
            <p className={styles.messageText}>{current.subject.message}</p>
          ) : null}
          <p className={styles.instruction} data-nothing-sent>
            <b>{TELL_THEM.incident}</b>
          </p>
          {sent ? (
            <Button
              variant="secondary"
              size="small"
              data-withdraw-message
              onClick={() => {
                withdrawSharing(
                  residentId,
                  { kind: 'incident', incidentId: incident.id, message: '' },
                  currentUser,
                )
                onChanged()
              }}
            >
              Withdraw this message
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              In plain language, for the family to read
            </span>
            <textarea
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              data-field="family-message"
            />
            <span className={styles.levelMeans}>
              They see this and never the incident record, so say what happened and how
              their relative is.
            </span>
          </label>

          <p className={styles.instruction} data-nothing-sent>
            <b>{TELL_THEM.incident}</b>
          </p>

          <Button
            variant="secondary"
            size="small"
            disabled={message.trim() === ''}
            data-record-message
            onClick={() => {
              share(
                residentId,
                { kind: 'incident', incidentId: incident.id, message: message.trim() },
                currentUser,
              )
              setMessage('')
              onChanged()
            }}
          >
            Record this message
          </Button>
        </>
      )}
    </section>
  )
}
