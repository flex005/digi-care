import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { CarePlanDomainId, IsoDate, IsoDateTime } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { AlertDialog, Button, Card, Select, Toast } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { EMPTY_GOAL, GOAL_FIELDS, outstandingGoalFields } from './goal-fields'
import type { GoalText } from './goal-fields'
import styles from './goals.module.css'

/**
 * Setting a goal with somebody. PRD §6.7.
 *
 * The sentence: **this is what this person says they want, in their words.**
 *
 * Built from the care plan editor rather than invented: the same three-field
 * shape, two in the resident's voice and one written to staff, the same
 * hatched empty field, the same footer naming what is outstanding. A goal and
 * a care plan domain are the same kind of document — a person's account of
 * what they want plus what the home will do about it — and a reader who has
 * learned one form should not have to learn the other.
 *
 * **Nothing here is pre-filled**, for the care plan editor's reason: a goal
 * assembled from a care plan domain is the home's method with the resident's
 * name on it.
 */
export function GoalFormRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  const [text, setText] = useState<GoalText>(EMPTY_GOAL)
  const [domain, setDomain] = useState<CarePlanDomainId | 'none'>('none')
  const [target, setTarget] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)

  const waiting = outstandingGoalFields(text)

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All goals
      </Link>

      <h2 className={styles.sectionTitle}>Set a goal with {resident.fullLegalName}</h2>

      {/* Said, not implied — the same note the care plan editor carries, for
          the same reason. */}
      <div className={styles.voiceNote} data-voice-note>
        <b>Written in {resident.preferredName}&rsquo;s own words.</b> A goal is
        something they want to be able to do, said the way they say it, not a care plan
        action, and not something decided for them. What staff will do about it belongs
        in the care plan domain this is filed under; what goes here is the outcome and
        how anybody will know it happened.
      </div>

      <Card>
        {GOAL_FIELDS.map((field) => (
          <div className={styles.field} key={field.id} data-field={field.id}>
            <label className={styles.fieldName} htmlFor={`goal-${field.id}`}>
              {field.label}
            </label>
            <p className={styles.fieldGuidance}>{field.guidance}</p>

            <textarea
              id={`goal-${field.id}`}
              className={styles.textarea}
              value={text[field.id]}
              placeholder={field.placeholder}
              onChange={(event) =>
                setText((current) => ({ ...current, [field.id]: event.target.value }))
              }
            />

            {text[field.id].trim() === '' ? (
              <span className={styles.fieldEmpty}>
                <Unrecorded variant="chip" label={field.emptyNote} />
              </span>
            ) : null}
          </div>
        ))}

        <div className={styles.twoUp}>
          <Select
            labelVisible
            label="Which part of the care plan"
            placeholder="Not filed under a domain"
            value={domain === 'none' ? undefined : domain}
            onValueChange={(value) => setDomain(value as CarePlanDomainId | 'none')}
            options={[
              { value: 'none', label: 'Not filed under a domain' },
              ...CARE_PLAN_DOMAINS.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />

          <label className={styles.fieldName} htmlFor="goal-target">
            Target date
            <input
              id="goal-target"
              className={styles.dateField}
              type="date"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
            {target === '' ? (
              // A goal with no date can never be late, and the form says so
              // rather than letting the blank pass as "not yet due".
              <span className={styles.fieldEmpty}>
                <Unrecorded
                  variant="chip"
                  label="No target date"
                  detail="a goal with no date can never be late, and will not appear on the queue"
                />
              </span>
            ) : null}
          </label>
        </div>

        <div className={styles.foot}>
          <p className={styles.footState} data-foot-state>
            {waiting.length === 0 ? (
              <>
                <strong>
                  Every field is written. This records a goal for{' '}
                  {resident.fullLegalName}, set by {currentUser.displayName} on{' '}
                  <span data-numeric>{format.date(now.slice(0, 10) as IsoDate)}</span>.
                </strong>{' '}
                It can be closed later as achieved, not achieved, withdrawn by{' '}
                {resident.preferredName}, or stopped by the service, and whichever it
                is, the record will carry what {resident.preferredName} said about it.
              </>
            ) : (
              <>
                <strong>Waiting on:</strong>{' '}
                {waiting.map((field) => field.label).join(' · ')}.
              </>
            )}
          </p>

          <Button
            size="large"
            disabled={waiting.length > 0}
            onClick={() => setConfirming(true)}
            data-set-goal
          >
            Set this goal
          </Button>
        </div>
      </Card>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action="Set this goal"
        confirmLabel="Set this goal"
        description={
          <span className={styles.footState}>
            {target === ''
              ? 'With no target date, this goal can never be late and will not appear on the goals queue.'
              : `Its target date is ${format.date(target as IsoDate)}.`}{' '}
            Held in memory only for this session and gone on reload. There is no backend
            in this build, so nothing here reaches a real record.
          </span>
        }
        onConfirm={() => {
          setConfirming(false)
          setSaved(true)
        }}
      />

      <Toast
        open={saved}
        onOpenChange={setSaved}
        tone="info"
        title="Goal not stored"
        // The export stub's treatment, for the export stub's reason: a control
        // that appears to save and does not is worse than one that says so.
        description="This build has no backend and no goal store. The text stays on this screen and is gone the moment you leave it."
      />
    </div>
  )
}
