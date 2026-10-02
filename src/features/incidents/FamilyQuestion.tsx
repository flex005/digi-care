import { TELL_THEM } from '@/features/family/family-statement'
import { SectionHeading, type HeadingLevel } from './SectionHeading'
import styles from './incidents.module.css'

/** The three answers both forms offer. */
export type FamilyChoice = 'should' | 'not' | 'undecided'

/**
 * Whether the family should be told, and the fact that deciding is not
 * telling.
 *
 * `TELL_THEM.incident` stays in front of the control rather than behind a
 * click, because the risk is precisely somebody not clicking: a manager who
 * reads a recorded decision as "they were told" may not telephone them.
 */
export function FamilyQuestion({
  tellFamily,
  onTellFamily,
  notTellingReason,
  onNotTellingReason,
  level = 'h2',
}: {
  tellFamily: FamilyChoice | ''
  onTellFamily: (value: FamilyChoice) => void
  notTellingReason: string
  onNotTellingReason: (value: string) => void
  level?: HeadingLevel
}) {
  return (
    <section className={styles.section} data-section="family">
      <SectionHeading level={level}>Should the family be told?</SectionHeading>

      <p className={styles.instruction} data-nothing-sent>
        <b>{TELL_THEM.incident}</b>
      </p>

      <div className={styles.choices} data-family-choices>
        {(
          [
            ['should', 'Yes, they should be told'],
            ['not', 'No, and here is why'],
            ['undecided', 'Not decided yet'],
          ] as const
        ).map(([id, label]) => (
          <label
            key={id}
            className={tellFamily === id ? styles.choiceOn : styles.choice}
            data-family-choice={id}
          >
            <input
              type="radio"
              name="tell-family"
              checked={tellFamily === id}
              onChange={() => onTellFamily(id)}
            />
            {label}
          </label>
        ))}
      </div>

      {tellFamily === 'not' ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Why not</span>
          <textarea
            className={styles.input}
            rows={2}
            value={notTellingReason}
            data-not-telling-reason
            onChange={(event) => onNotTellingReason(event.target.value)}
            placeholder="No injury, and the family asked to be told weekly rather than each time."
          />
          <span className={styles.hint}>
            A decision without a reason reads the same as one nobody made.
          </span>
        </label>
      ) : null}
    </section>
  )
}
