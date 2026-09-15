import { useState } from 'react'
import type { Incident } from '@/data/types'
import { Button } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useSiteFormat } from '@/app/session/use-session'
import { subjectResidentId } from '@/data/types'
import {
  currentDisclosure,
  isSharedWithFamily,
  share,
  withdrawSharing,
} from '@/data/access/family-disclosure-store'
import { familyFor } from '@/data/access/family-access-store'
import { NOTHING_WAS_SENT, TELL_THEM } from './family-statement'
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
  const format = useSiteFormat()
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

  return (
    <section className={styles.share} data-family-message={incident.id}>
      <p className={styles.shareState}>Telling the family</p>

      {named.length === 0 ? (
        <p className={styles.noFamily} data-no-family-named>
          Nobody is named to see this resident&rsquo;s updates, so there is nobody here
          to write to. That is not the same as the family not needing to know: family
          access is a record on the Consent tab, and a telephone call is not.
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
            <b>{TELL_THEM.incident}</b> {NOTHING_WAS_SENT}
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
              They see this and never the incident record. Not &ldquo;unwitnessed fall,
              moderate harm&rdquo;, but what happened and how their relative is.
            </span>
          </label>

          <p className={styles.instruction} data-nothing-sent>
            <b>{TELL_THEM.incident}</b> {NOTHING_WAS_SENT}
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
