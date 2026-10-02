import type { CarePlanText } from '@/data/types'
import { useTerms } from '@/app/session/use-term'
import { EMPTY_PLAN, PLAN_FIELDS } from './plan-fields'
import styles from './care-plan-fields.module.css'

/**
 * The three things a care plan domain says, wherever it is written.
 *
 * **One field set, because there is one record.** Admission writes a domain on
 * the day somebody arrives, the editor writes one later, and a domain outside
 * the ten is written in a dialog on the resident's own tab: three doors into
 * `CarePlanText`. A second set of boxes for any of them would be a second
 * shape to reconcile on the way to the same plan.
 *
 * **The voice belongs to the field, not to the writer.** Two of the three are
 * the resident's own words and the third is what staff will do, and the labels
 * and placeholders carry that distinction rather than leaving it to whoever is
 * typing — a plan written about somebody in clinical language is a document
 * they cannot recognise themselves in.
 */
export function CarePlanTextFields({
  idPrefix,
  text,
  onChange,
}: {
  idPrefix: string
  text: CarePlanText
  onChange: (next: CarePlanText) => void
}) {
  const terms = useTerms()

  return (
    <div className={styles.planFields}>
      {PLAN_FIELDS.map((field) => (
        <label key={field.id} className={styles.field}>
          <span className={styles.fieldLabel}>{field.label(terms.staff)}</span>
          <span className={styles.fieldHint}>{field.guidance}</span>
          <textarea
            rows={3}
            value={text[field.id]}
            placeholder={field.placeholder}
            data-field={`${idPrefix}-${field.id}`}
            onChange={(event) => onChange({ ...text, [field.id]: event.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

/**
 * Nothing typed anywhere: a domain nobody has started rather than a blank one.
 *
 * Over the declared fields, not a list of them — this named three while
 * `CarePlanText` had four, so a domain whose only written field was the new
 * one read as never started.
 */
export const isWritten = (text: CarePlanText): boolean =>
  PLAN_FIELDS.some((field) => text[field.id].trim() !== '')

export const emptyText = (): CarePlanText => ({ ...EMPTY_PLAN })
