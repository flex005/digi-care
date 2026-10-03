import { Select } from '@/components/primitives'
import {
  ORGANISATION_TYPES,
  TERM_IDS,
  TERM_OPTIONS,
  type OrganisationType,
  type TermId,
} from '@/lib/vocabulary'
import { BRAND_OPTIONS, BRAND_STEPS, brandOptionById, brandRampHex } from '@/lib/brand'
import styles from './setup.module.css'

/**
 * The three things an organisation configures about itself, as controls.
 *
 * **Extracted rather than copied, because two screens render them.** The setup
 * wizard asks once, outside the product; the Organisation tab in Settings is
 * where they are changed afterwards. Those are different moments and the same
 * controls, and a second copy of nine `Select`s and a swatch strip is the
 * drift this build keeps finding — the report form and its correction modal
 * were brought together for exactly this reason.
 *
 * **State lives with the caller.** The wizard holds a draft and writes it on
 * "Confirm and continue"; Settings writes on change, because there is no
 * confirm step on a settings tab and a control that needs a save button
 * somebody might not press is a control that silently does nothing. So these
 * take values and handlers rather than owning them.
 */

/** The labels the term pickers carry, in the order the wizard asks them. */
export const TERM_LABELS: Record<TermId, string> = {
  subject: 'The people this service holds records about',
  carePlan: 'The plan of their care',
  staff: 'The people who work here',
  manager: 'The person who runs the service',
  admission: 'Somebody joining the service',
  incidentReport: 'A record of something that went wrong',
  medication: 'What is given and signed for',
  assessment: 'A judgement recorded about somebody',
  family: 'The people close to them',
}

/** The option id that is a type's default subject term. */
export function defaultTermIdFor(type: OrganisationType): string {
  return type === 'hospital' ? 'patient' : type === 'clinic' ? 'client' : 'resident'
}

export interface VocabularyValue {
  type: OrganisationType
  /** The chosen subject option, or undefined for this type's default. */
  subjectTermId: string | undefined
  choices: Partial<Record<TermId, string>>
}

/**
 * The service type and the nine words.
 *
 * The type picks the subject's default and **clears an earlier override of
 * that one term**: somebody switching from Care Home to Hospital means
 * patients, and keeping "Resident" because they once chose it would make the
 * type control do nothing. The other eight are untouched — they have nothing
 * to do with the type.
 */
export function VocabularyControls({
  value,
  onChange,
}: {
  value: VocabularyValue
  onChange: (next: VocabularyValue) => void
}) {
  return (
    <div className={styles.controlStack}>
      <div className={styles.choices} role="radiogroup" aria-label="Service type">
        {ORGANISATION_TYPES.map((entry) => (
          <label
            key={entry.id}
            className={value.type === entry.id ? styles.choiceOn : styles.choice}
            data-org-type={entry.id}
          >
            <input
              type="radio"
              name="organisation-type"
              checked={value.type === entry.id}
              onChange={() => {
                const choices = { ...value.choices }
                delete choices.subject
                onChange({ type: entry.id, subjectTermId: undefined, choices })
              }}
            />
            {entry.name}
          </label>
        ))}
      </div>

      {/*
        No wrapping `<label>`: `Select` is a Radix combobox rather than a native
        control, so a label around it associates with nothing — it carries its
        own `label` prop, which is the association.

        One Select per term. The subject comes first because the type above
        picks its default; the rest default to their own first option and are
        changed only by somebody who wants to.
      */}
      {TERM_IDS.map((id) => (
        <div className={styles.field} key={id} data-term-choice={id}>
          <Select
            labelVisible
            label={TERM_LABELS[id]}
            placeholder="Choose a word"
            value={
              id === 'subject'
                ? (value.subjectTermId ?? defaultTermIdFor(value.type))
                : (value.choices[id] ?? TERM_OPTIONS[id][0]!.id)
            }
            onValueChange={(chosen) => {
              onChange({
                ...value,
                subjectTermId: id === 'subject' ? chosen : value.subjectTermId,
                choices: { ...value.choices, [id]: chosen },
              })
            }}
            options={TERM_OPTIONS[id].map((entry) => ({
              value: entry.id,
              label: entry.label,
            }))}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * The brand hue, and the ramp it produces.
 *
 * The five swatches are shown rather than described because a hue name cannot
 * say the thing somebody choosing needs to know: at the lightness this ladder
 * holds, a teal and a magenta differ a great deal in how vivid they can be.
 */
export function BrandControls({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const preview = brandRampHex(brandOptionById(value).hue)
  return (
    <div className={styles.controlStack}>
      <div className={styles.field} data-brand-choice>
        <Select
          labelVisible
          label="Brand colour"
          placeholder="Choose a colour"
          value={value}
          onValueChange={onChange}
          options={BRAND_OPTIONS.map((entry) => ({
            value: entry.id,
            label: entry.label,
          }))}
        />
      </div>

      <div className={styles.swatches} data-brand-preview>
        {BRAND_STEPS.map((step) => (
          <span key={step} className={styles.swatch} data-swatch={step}>
            <span
              className={styles.swatchBlock}
              style={{ background: preview[step] }}
            />
            <span className={styles.swatchLabel}>{step}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
