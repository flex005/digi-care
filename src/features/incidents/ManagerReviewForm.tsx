import { useState } from 'react'
import type { Incident, IsoDateTime, ManagerReview, Recorded } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { Button } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { acknowledge, close, recordReview } from '@/data/access/incident-store'
import { decisionFor } from '@/data/access/notification-store'
import styles from './incidents.module.css'

/**
 * Writing what the manager concluded. AM v2.0 INC-01, Phase 20.
 *
 * **The reporter's account is not on this form and cannot be reached from
 * it.** What the person who was there wrote is `ImmediateResponse`, rendered
 * in its own section above with their name on it; this writes `ManagerReview`
 * and nothing else. The two have been separate in the type since Phase 4 —
 * "the reporter's account written at the time and the manager's written later
 * are two records by two people, and merging them attributes one to the
 * other" — and a write path is exactly where that stops being true without
 * anybody deciding it should.
 *
 * **Field by field, never one form saving three things at once.** A bulk save
 * attributing three conclusions to one act is the wrong shape for a clinical
 * record, which is the rule Phase 16 settled for editing a resident. Here it
 * also matters because the fields are written at different times: a root cause
 * on the day, preventive measures after somebody has thought about it.
 *
 * **Acknowledging is its own act and comes first.** A review with nobody's
 * name against the incident is a conclusion from nobody, so the form does not
 * appear until somebody has picked the incident up.
 */
export function ManagerReviewForm({
  incident,
  onChanged,
}: {
  incident: Incident
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const [draft, setDraft] = useState<Record<string, string>>({})

  if (!viewer.canApproveIn('/incidents')) {
    return (
      <p className={styles.byline} data-review-read-only>
        Your role is {viewer.roleName}, which reads this incident and does not
        acknowledge or close it.
      </p>
    )
  }

  if (incident.status.kind === 'reported_not_acknowledged') {
    return (
      <div className={styles.reviewActions}>
        <p className={styles.byline} data-not-acknowledged>
          Nobody has picked this up. Acknowledging it puts your name against it, and it
          cannot be taken back: who took it on is the fact the log exists for.
        </p>
        <Button
          data-acknowledge
          onClick={() => {
            acknowledge(incident, currentUser)
            onChanged()
          }}
        >
          Acknowledge this incident
        </Button>
      </div>
    )
  }

  const fields: { id: keyof ManagerReview; label: string; asks: string }[] = [
    {
      id: 'rootCause',
      label: 'Root cause',
      asks: 'What led to this, as far as anybody can tell. Required before it closes.',
    },
    {
      id: 'actionsTaken',
      label: 'Actions taken',
      asks: 'What you have done since. Not what the person who was there did: that is their account, above, with their name on it.',
    },
    {
      id: 'preventiveMeasures',
      label: 'Preventive measures',
      asks: 'What will stop it happening again.',
    },
  ]

  const decided = decisionFor(incident.id) ?? incident.notification
  const closable =
    incident.status.kind === 'under_review' &&
    incident.review.rootCause.kind === 'recorded' &&
    decided.kind !== 'not_yet_decided'

  return (
    <div className={styles.reviewForm} data-review-form>
      {fields.map((field) => {
        const existing = incident.review[field.id]
        const value = draft[field.id] ?? ''
        return (
          <div
            key={field.id}
            className={styles.reviewWrite}
            data-review-field={field.id}
          >
            <label className={styles.label} htmlFor={`review-${field.id}`}>
              {existing.kind === 'recorded'
                ? `Add to ${field.label.toLowerCase()}`
                : field.label}
            </label>
            <p className={styles.byline}>{field.asks}</p>
            <textarea
              id={`review-${field.id}`}
              rows={3}
              value={value}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.id]: event.target.value }))
              }
              data-field={field.id}
            />
            <Button
              variant="secondary"
              size="small"
              disabled={value.trim() === ''}
              data-record={field.id}
              onClick={() => {
                /*
                 * Built as a typed value and then keyed, rather than an object
                 * literal cast to `Partial<ManagerReview>`. The cast compiled
                 * and hid a real mismatch: `recordedAt` is `IsoDateTime`, a
                 * template type, and a bare `toISOString()` is a string. §6
                 * forbids `any`; a cast that silences the same check is the
                 * same thing with better manners.
                 */
                const written: Recorded<string> = {
                  kind: 'recorded',
                  value: value.trim(),
                  recordedBy: currentUser,
                  recordedAt: appNow().toISOString() as IsoDateTime,
                }
                recordReview(incident, { [field.id]: written }, currentUser)
                setDraft((current) => ({ ...current, [field.id]: '' }))
                onChanged()
              }}
            >
              Record {field.label.toLowerCase()}
            </Button>
          </div>
        )
      })}

      {incident.status.kind === 'closed' ? null : (
        <div className={styles.reviewActions}>
          {closable ? null : (
            <p className={styles.byline} data-cannot-close>
              {/*
               * What is outstanding, named. A disabled button with nothing
               * said is a control somebody stares at.
               */}
              Before this can close:{' '}
              {[
                incident.review.rootCause.kind === 'recorded' ? null : 'a root cause',
                decided.kind === 'not_yet_decided'
                  ? 'a decision about telling the CQC'
                  : null,
              ]
                .filter(Boolean)
                .join(' and ')}
              .
            </p>
          )}
          <Button
            disabled={!closable}
            data-close-incident
            onClick={() => {
              close(incident, currentUser, decided.kind !== 'not_yet_decided')
              onChanged()
            }}
          >
            Close this incident
          </Button>
        </div>
      )}
    </div>
  )
}
