import { useState } from 'react'
import type { Incident } from '@/data/types'
import { recordFamilyDecision } from '@/data/access/incident-store'
import { Button } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useTerms } from '@/app/session/use-term'
import { TELL_THEM } from '@/features/family/family-statement'
import styles from './incidents.module.css'

/**
 * Whether the family should be told, and the fact that deciding is not telling.
 *
 * **This product cannot reach a family member.** The Family Portal is a
 * separate product with its own UI, so what is recorded here is a decision —
 * the same honest shape `ShareWithFamily` uses for a care note, and for the
 * same reason. A manager who reads this as *the family were told* may not
 * telephone them, and for an incident that is a family not hearing that their
 * relative fell.
 *
 * So `TELL_THEM.incident` is in front of the control rather than behind a
 * click, because the risk here is precisely somebody not clicking.
 *
 * **Still changeable after the report.** The reporter decides at the time with
 * what they knew then; a manager reading it an hour later may know more. The
 * decision carries whoever made it last, and the act is stamped like every
 * other act on this type.
 */
export function FamilyDecision({
  incident,
  onChanged,
}: {
  incident: Incident
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const terms = useTerms()
  const [reason, setReason] = useState('')
  const told = incident.familyTold

  return (
    <section className={styles.section} data-section="family-told">
      <h2 className={styles.sectionTitle}>Telling the {terms.family.one}</h2>

      <p className={styles.decisionState} data-family-state={told.kind}>
        {told.kind === 'not_decided' ? (
          'Nobody has decided either way.'
        ) : told.kind === 'should_be_told' ? (
          <>
            They should be told. Decided by{' '}
            <strong>{told.decided.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(told.decided.at)}</span>
          </>
        ) : (
          <>
            They are not to be told: {told.reason} Decided by{' '}
            <strong>{told.decided.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(told.decided.at)}</span>
          </>
        )}
      </p>

      {/*
       * Never behind a click, and an instruction rather than a caveat. "This
       * is a prototype" tells somebody about the software; "telephone them"
       * tells them what to do, which is the thing about to not happen.
       */}
      <p className={styles.instruction} data-nothing-sent>
        <b>{TELL_THEM.incident}</b>
      </p>

      {/*
       * **The decision is for everybody to read; making one is not.** An
       * auditor is a CQC inspector or an external reviewer, told on five
       * screens that they read — and deciding whether a family is told about
       * an incident is about as clinical as this page gets.
       *
       * Told rather than shown nothing, so a reader knows it is a permission
       * and not a missing control. Same shape as ManagerReviewForm.
       */}
      {!viewer.canRecordIn('/incidents') ? (
        <p className={styles.byline} data-family-read-only>
          Your role is {viewer.roleName}, which reads this incident and does not decide
          whether the {terms.family.one} is told.
        </p>
      ) : (
        <>
          {told.kind === 'not_to_be_told' || told.kind === 'not_decided' ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Why they are not being told</span>
              <input
                className={styles.input}
                type="text"
                value={reason}
                data-family-reason
                placeholder={`No injury, and the ${terms.family.one} asked to be told weekly rather than each time.`}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}

          <div className={styles.decisionActions}>
            <Button
              variant="secondary"
              size="small"
              data-family-should
              disabled={told.kind === 'should_be_told'}
              onClick={() => {
                recordFamilyDecision(incident, { kind: 'should' }, currentUser)
                onChanged()
              }}
            >
              They should be told
            </Button>
            <Button
              variant="secondary"
              size="small"
              data-family-not
              disabled={reason.trim() === ''}
              onClick={() => {
                recordFamilyDecision(
                  incident,
                  { kind: 'not', reason: reason.trim() },
                  currentUser,
                )
                setReason('')
                onChanged()
              }}
            >
              They are not to be told
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
