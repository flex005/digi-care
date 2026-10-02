import { Select } from '@/components/primitives'
import { SectionHeading, type HeadingLevel } from './SectionHeading'
import styles from './incidents.module.css'

/** Whether somebody was contacted, as both forms express it. */
export type ContactChoice = 'not_yet' | 'not_required' | 'contacted'
export type EmergencyChoice = 'not_called' | 'ambulance_999' | 'nhs_111'

/**
 * What you did about it: the immediate action, and who was contacted.
 *
 * **The shared "why it was not required" reason is part of the section, not
 * beside it.** `not_required` is a decision and a decision carries its reason;
 * without one it reads the same as a call nobody made. One field serves both
 * the GP and the family answer, which is why it cannot be split out.
 */
export function ResponseSection({
  immediateAction,
  onImmediateAction,
  gp,
  onGp,
  family,
  onFamily,
  emergency,
  onEmergency,
  notRequiredReason,
  onNotRequiredReason,
  level = 'h2',
}: {
  immediateAction: string
  onImmediateAction: (value: string) => void
  gp: ContactChoice | ''
  onGp: (value: ContactChoice) => void
  family: ContactChoice | ''
  onFamily: (value: ContactChoice) => void
  emergency: EmergencyChoice | ''
  onEmergency: (value: EmergencyChoice) => void
  notRequiredReason: string
  onNotRequiredReason: (value: string) => void
  level?: HeadingLevel
}) {
  return (
    <section className={styles.section} aria-labelledby="response-heading">
      <SectionHeading level={level} id="response-heading">
        What you did about it
      </SectionHeading>

      <label className={styles.field}>
        <span className={styles.label}>Immediate action taken</span>
        <textarea
          className={styles.textarea}
          value={immediateAction}
          onChange={(event) => onImmediateAction(event.target.value)}
          placeholder="What you did in the minutes after."
        />
        {/* Yours, not the manager's. Their account is written later on
            the review and the two are different records. */}
        <span className={styles.hint}>
          Your words, at the time. The manager writes their own account when they review
          it.
        </span>
      </label>

      <div className={styles.threeUp}>
        <Select
          label="GP contacted"
          placeholder="Choose an answer"
          value={gp === '' ? undefined : gp}
          onValueChange={(value) => onGp(value as ContactChoice)}
          options={[
            { value: 'not_yet', label: 'Not yet' },
            { value: 'not_required', label: 'Not required' },
            { value: 'contacted', label: 'Contacted' },
          ]}
        />
        <Select
          label="Family contacted"
          placeholder="Choose an answer"
          value={family === '' ? undefined : family}
          onValueChange={(value) => onFamily(value as ContactChoice)}
          options={[
            { value: 'not_yet', label: 'Not yet' },
            { value: 'not_required', label: 'Not required' },
            { value: 'contacted', label: 'Contacted' },
          ]}
        />
        <Select
          label="Emergency services"
          placeholder="Choose an answer"
          value={emergency === '' ? undefined : emergency}
          onValueChange={(value) => onEmergency(value as EmergencyChoice)}
          options={[
            { value: 'not_called', label: 'Not called' },
            { value: 'ambulance_999', label: '999: ambulance' },
            { value: 'nhs_111', label: '111' },
          ]}
        />
      </div>

      {/* `not_required` is a decision and a decision carries its reason.
          Without one it is indistinguishable from a call nobody made. */}
      {gp === 'not_required' || family === 'not_required' ? (
        <label className={styles.field}>
          <span className={styles.label}>Why it was not required</span>
          <input
            className={styles.input}
            type="text"
            value={notRequiredReason}
            onChange={(event) => onNotRequiredReason(event.target.value)}
            placeholder="No injury and no change in condition."
          />
          <span className={styles.hint}>
            A decision without a reason reads the same as a call nobody made.
          </span>
        </label>
      ) : null}
    </section>
  )
}
