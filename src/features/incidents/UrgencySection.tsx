import { useState } from 'react'
import type { Incident } from '@/data/types'
import { raiseUrgency, standDownUrgency } from '@/data/access/incident-store'
import { Button } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useTerms } from '@/app/session/use-term'
import { NO_RE_RAISE } from './UrgencyQuestion'
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
 * **Three states, and standing down is not the same as never raising.**
 * Returning to `ordinary` would erase the fact that somebody raised this and
 * what they said; `stood_down` keeps the raise in full and records the answer
 * beside it, so the record says who judged it urgent and who disagreed. It is
 * a decision, not a gap, so it renders quietly and never takes the hatch (§1).
 *
 * Raising asks `canRecordIn`, standing down asks `canApproveIn`: a senior
 * carer may say an incident cannot wait, and overruling that is a manager's
 * call.
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
  const terms = useTerms()
  const urgency = incident.urgency
  const raised = urgency.kind === 'needs_attention_now'
  const settled = urgency.kind === 'stood_down'
  const [because, setBecause] = useState('')
  const [why, setWhy] = useState('')

  /*
   * On a first raise `worded` is the same act as `raised`, and printing both
   * would state one value twice. Only a reword is worth a second line.
   */
  const reworded =
    urgency.kind === 'needs_attention_now' &&
    (urgency.worded.at !== urgency.raised.at ||
      urgency.worded.by.id !== urgency.raised.by.id)

  return (
    <section className={styles.section} data-section="urgency">
      <h2 className={styles.sectionTitle}>Whether this needs attention now</h2>

      <p className={styles.decisionState} data-urgency-state={urgency.kind}>
        {urgency.kind === 'ordinary' ? (
          // Not hatched: nobody failed to record anything. An incident that
          // nobody marked urgent is a complete record saying so.
          'Nobody has said this one cannot wait.'
        ) : urgency.kind === 'stood_down' ? (
          /*
           * **Quietly and in full, never hatched.** A stood-down urgency is a
           * decision somebody made with their name on it, not a gap — §1's
           * recorded-negative rule. Both judgements are stated, because that
           * is what the record holds and keeping the raise is the whole
           * reason this member exists.
           */
          <>
            <strong>{urgency.raised.by.displayName}</strong> said this one could not
            wait, <span data-numeric>{format.dateTime(urgency.raised.at)}</span>:{' '}
            {urgency.because} Stood down by{' '}
            <strong>{urgency.stoodDown.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(urgency.stoodDown.at)}</span>:{' '}
            {urgency.why}
          </>
        ) : (
          <>
            This needs attention now: {urgency.because} Raised by{' '}
            <strong>{urgency.raised.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(urgency.raised.at)}</span>
            {reworded && urgency.kind === 'needs_attention_now' ? (
              <>
                {'. Reworded by '}
                <strong>{urgency.worded.by.displayName}</strong> ·{' '}
                <span data-numeric>{format.dateTime(urgency.worded.at)}</span>
              </>
            ) : null}
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
      ) : settled ? (
        /*
         * Nothing more to do, and said rather than left as an absent control.
         * Re-raising would overwrite the stand-down, and the union holds one
         * raise and one answer rather than a chain — the store refuses it for
         * the same reason this screen does not offer it.
         */
        <p className={styles.byline} data-urgency-settled>
          {NO_RE_RAISE}
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
              placeholder={`We are expecting the ${terms.family.one} and nobody has spoken to them yet.`}
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

          {/*
           * **Standing down is stricter than raising.** It overrules somebody
           * else's clinical judgement, so it asks `canApproveIn` where the
           * raise asks `canRecordIn`: a senior carer may say an incident
           * cannot wait, and answering that is a manager's call.
           */}
          {raised ? (
            viewer.canApproveIn('/incidents') ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Why it no longer needs attention now
                  </span>
                  <input
                    className={styles.input}
                    type="text"
                    value={why}
                    data-urgency-why
                    placeholder={`Seen by the GP within the hour and somebody has rung the ${terms.family.one}.`}
                    onChange={(event) => {
                      setWhy(event.target.value)
                    }}
                  />
                </label>
                <div className={styles.decisionActions}>
                  <Button
                    variant="secondary"
                    size="small"
                    data-urgency-stand-down
                    disabled={why.trim() === ''}
                    onClick={() => {
                      standDownUrgency(incident, why, currentUser)
                      setWhy('')
                      onChanged()
                    }}
                  >
                    Stand this down
                  </Button>
                </div>
              </>
            ) : (
              <p className={styles.byline} data-stand-down-read-only>
                Your role is {viewer.roleName}, which may say an incident needs
                attention now and does not stand one down.
              </p>
            )
          ) : null}
        </>
      )}
    </section>
  )
}
