import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { IsoDateTime, Medication, Resident } from '@/data/types'
import type { PrnAdministration } from '@/data/access/mar-store'
import { recordPrn, recordPrnOutcomeFor } from '@/data/access/client'
import { Button } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { staffLabel } from '@/data/access/team-store'
import styles from './medications.module.css'

/**
 * Medications available if needed, and the doses given from them.
 *
 * **Its own section, beneath the due list, and it never blocks submission.**
 * A scheduled dose is due at 08:00; paracetamol is not due at all, it is
 * available. In the due list, leaving it unanswered would render as an
 * omission — a claim that somebody missed a dose nobody was ever supposed to
 * give — so it cannot live there and the round cannot wait on it.
 *
 * **PRN is more than a third button.** It needs a reason and a symptom before
 * the dose, and an outcome after it, which is a second write the other two
 * answers do not have. A PRN given with no outcome recorded is a dose nobody
 * checked the effect of, so the outcome starts `not_recorded` and renders as
 * the gap it is.
 */
export function PrnSection({
  resident,
  available,
  given,
  onChanged,
}: {
  resident: Resident
  available: Medication[]
  given: PrnAdministration[]
  onChanged: () => void
}) {
  if (available.length === 0) return null

  return (
    <section className={styles.prn} aria-label="Available if needed">
      <div className={styles.prnHead}>
        <h3 className={styles.prnTitle}>Available if needed</h3>
        <p className={styles.prnNote}>
          Not due, and not part of this round. Nothing here has to be answered before
          the round can be recorded.
        </p>
      </div>

      <ul className={styles.prnList}>
        {available.map((medication) => (
          <PrnRow
            key={medication.id}
            resident={resident}
            medication={medication}
            given={given.filter((entry) => entry.medicationId === medication.id)}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  )
}

function PrnRow({
  resident,
  medication,
  given,
  onChanged,
}: {
  resident: Resident
  medication: Medication
  given: PrnAdministration[]
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [symptom, setSymptom] = useState('')
  const [error, setError] = useState('')

  const ready = reason.trim() !== '' && symptom.trim() !== ''

  const give = async () => {
    try {
      await recordPrn({
        residentId: resident.id,
        medicationId: medication.id,
        reason,
        symptom,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
      })
      setOpen(false)
      setReason('')
      setSymptom('')
      setError('')
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That dose was not recorded.')
    }
  }

  return (
    <li className={styles.prnRow} data-prn={medication.id}>
      <div className={styles.prnAbout}>
        <p className={styles.doseDrug}>{medication.name}</p>
        <p className={styles.doseStrength}>
          {medication.dose} · {medication.route} · as required
        </p>

        {given.map((entry) => (
          <div key={entry.id} className={styles.prnGiven} data-prn-given={entry.id}>
            <p className={styles.prnGivenLine}>
              Given <span data-numeric>{format.time(entry.givenAt)}</span> by{' '}
              {entry.givenBy.displayName}: {entry.symptom}, {entry.reason}
            </p>
            <PrnOutcome entry={entry} onChanged={onChanged} />
          </div>
        ))}
      </div>

      <div className={styles.prnAction}>
        {open ? null : (
          <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
            Give a dose
          </Button>
        )}
      </div>

      {open ? (
        <div className={styles.prnForm}>
          <label className={styles.cdField}>
            <span className={styles.cdFieldLabel}>What was observed</span>
            <input
              className={styles.cdInput}
              type="text"
              value={symptom}
              placeholder="Knee pain on standing"
              onChange={(event) => setSymptom(event.target.value)}
            />
          </label>
          <label className={styles.cdField}>
            <span className={styles.cdFieldLabel}>Why it was given</span>
            <input
              className={styles.cdInput}
              type="text"
              value={reason}
              placeholder="Resident asked, last dose over six hours ago"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error === '' ? null : <p className={styles.required}>{error}</p>}
          <div className={styles.prnFormActions}>
            <Button variant="ghost" size="small" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="small" disabled={!ready} onClick={give}>
              Record this dose
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/**
 * What the dose did, or the fact that nobody has said.
 *
 * The follow-up write. It is hatched until answered because a PRN with no
 * outcome is not a completed record — it is a dose given and never checked,
 * which is exactly the gap a blank would hide.
 */
function PrnOutcome({
  entry,
  onChanged,
}: {
  entry: PrnAdministration
  onChanged: () => void
}) {
  const format = useSiteFormat()
  const { currentUser } = useSession()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  if (entry.outcome.kind === 'recorded') {
    return (
      <p className={styles.prnOutcome}>
        Outcome: {entry.outcome.text},{' '}
        <span data-numeric>
          {format.attribution(staffLabel(entry.outcome.by), entry.outcome.at)}
        </span>
      </p>
    )
  }

  const record = async () => {
    try {
      await recordPrnOutcomeFor({
        id: entry.id,
        text,
        at: appNow().toISOString() as IsoDateTime,
        by: currentUser,
      })
      setError('')
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That outcome was not saved.')
    }
  }

  return (
    <div className={styles.prnOutcomePending}>
      <Unrecorded
        variant="chip"
        label="No outcome recorded"
        detail="a dose given and never checked is not a complete record"
      />
      <label className={styles.cdField}>
        <span className={styles.cdFieldLabel}>What happened afterwards</span>
        <input
          className={styles.cdInput}
          type="text"
          value={text}
          placeholder="Reported relief by 15:00"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {error === '' ? null : <p className={styles.required}>{error}</p>}
      <Button
        variant="secondary"
        size="small"
        disabled={text.trim() === ''}
        onClick={record}
      >
        Record outcome
      </Button>
    </div>
  )
}
