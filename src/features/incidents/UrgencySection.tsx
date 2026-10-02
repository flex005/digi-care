import { useState } from 'react'
import type { Incident } from '@/data/types'
import { raiseUrgency } from '@/data/access/incident-store'
import { Button } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import styles from './incidents.module.css'

/**
 * Saying this one needs attention now, after it was filed.
 *
 * **Urgency could only be set while filing.** A manager who reads an incident
 * an hour later and realises it cannot wait had no control anywhere, which is
 * the same gap `FamilyDecision` closed for the family decision and for the
 * same reason: the reporter decides at the time with what they knew then, and
 * somebody reading it later may know more.
 *
 * **Raise or reword, never stand down.** There is no control here to put it
 * back to ordinary, because that would erase the fact that somebody raised it
 * and what they said. The reasoning, and the union member that would make
 * standing down honest, are on `raiseUrgency` in the store.
 */
export function UrgencySection({
  incident,
  onChanged,
}: {
  incident: Incident
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const urgency = incident.urgency
  const raised = urgency.kind === 'needs_attention_now'
  const [because, setBecause] = useState('')

  return (
    <section className={styles.section} data-section="urgency">
      <h2 className={styles.sectionTitle}>Whether this needs attention now</h2>

      <p className={styles.decisionState} data-urgency-state={urgency.kind}>
        {urgency.kind === 'ordinary' ? (
          // Not hatched: nobody failed to record anything. An incident that
          // nobody marked urgent is a complete record saying so.
          'Nobody has said this one cannot wait.'
        ) : (
          <>
            This needs attention now: {urgency.because} Raised by{' '}
            <strong>{urgency.raised.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(urgency.raised.at)}</span>
          </>
        )}
      </p>

      {/*
       * **The state is for everybody; the act is not.** An auditor is a CQC
       * inspector or an external reviewer, told on five screens that they
       * read. Letting one raise an urgency is the product breaking a refusal
       * it states out loud.
       *
       * Told, rather than shown nothing: a section with its control silently
       * missing leaves a reader guessing whether it is a permission or a bug.
       * Same shape and same reason as ManagerReviewForm above it.
       */}
      {!viewer.canRecordIn('/incidents') ? (
        <p className={styles.byline} data-urgency-read-only>
          Your role is {viewer.roleName}, which reads this incident and does not say
          whether it needs attention now.
        </p>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {raised ? 'Change what it says' : 'Why it cannot wait'}
            </span>
            <input
              className={styles.input}
              type="text"
              value={because}
              data-urgency-reason
              placeholder="The family are on their way in and nobody has spoken to them yet."
              onChange={(event) => {
                setBecause(event.target.value)
              }}
            />
          </label>

          <div className={styles.decisionActions}>
            <Button
              variant="secondary"
              size="small"
              data-urgency-raise
              disabled={because.trim() === ''}
              onClick={() => {
                raiseUrgency(incident, because, currentUser)
                setBecause('')
                onChanged()
              }}
            >
              {raised ? 'Update the reason' : 'This needs attention now'}
            </Button>
          </div>
        </>
      )}

      {/*
       * Said where somebody would otherwise look for the control. A missing
       * button with no explanation reads as an oversight; this says it is a
       * decision and what the record would need to hold it.
       */}
      {raised ? (
        <p className={styles.footState} data-urgency-no-standdown>
          There is no way to take this back. Doing so would remove the fact that
          somebody raised it and what they said, and the record has nowhere to put who
          stood it down or why.
        </p>
      ) : null}
    </section>
  )
}
