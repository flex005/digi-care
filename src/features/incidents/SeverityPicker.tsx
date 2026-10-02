import type { IncidentSeverityId } from '@/data/types'
import { ChoiceMark } from './ChoiceMark'
import { SectionHeading, type HeadingLevel } from './SectionHeading'
import styles from './incidents.module.css'

/**
 * How much harm was caused.
 *
 * **A card group, not a `<Select>`.** The glosses are the control: "no harm /
 * nothing came of it" and "severe harm / permanent or life-changing" are the
 * difference between two words a reader would otherwise have to already know.
 * A dropdown shows one option at a time and hides the scale.
 *
 * **The words carry the meaning and the tint reinforces it**, never the other
 * way round (§7) — which is why each option renders its name and its gloss
 * beside a `ChoiceMark`, and the colour is the last thing added.
 *
 * Extracted so the correction modal renders this and not a second, plainer
 * control: it held a `<Select>`, which meant an admin correcting a severity
 * saw none of the scale the reporter chose from.
 */
const SEVERITIES: {
  id: IncidentSeverityId
  name: string
  gloss: string
  tint: string
}[] = [
  {
    id: 'no_harm',
    name: 'No harm',
    gloss: 'nothing came of it',
    tint: styles.severityNoHarm!,
  },
  {
    id: 'low_harm',
    name: 'Low harm',
    gloss: 'minor treatment, no lasting effect',
    tint: styles.severityLowHarm!,
  },
  {
    id: 'moderate_harm',
    name: 'Moderate harm',
    gloss: 'treatment needed, recovery expected',
    tint: styles.severityModerateHarm!,
  },
  {
    id: 'severe_harm',
    name: 'Severe harm',
    gloss: 'permanent or long-term effect',
    tint: styles.severitySevereHarm!,
  },
]

export function SeverityPicker({
  severity,
  onSeverity,
  level = 'h2',
}: {
  severity: IncidentSeverityId | ''
  onSeverity: (id: IncidentSeverityId) => void
  level?: HeadingLevel
}) {
  return (
    <section className={styles.section} aria-labelledby="harm-heading">
      <SectionHeading level={level} id="harm-heading">
        How much harm was caused
      </SectionHeading>
      <div
        className={styles.severities}
        role="radiogroup"
        aria-labelledby="harm-heading"
      >
        {SEVERITIES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={severity === option.id}
            className={[
              styles.severity,
              option.tint,
              severity === option.id ? styles.severitySelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-severity={option.id}
            onClick={() => {
              onSeverity(option.id)
            }}
          >
            {/* The words carry the meaning; the tint reinforces it and
                never stands alone (§7). */}
            <ChoiceMark selected={severity === option.id} />
            <span className={styles.severityName}>{option.name}</span>
            <span className={styles.severityGloss}>{option.gloss}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
