import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import styles from './Unrecorded.module.css'

/**
 * The single entry point to the unrecorded treatment. Rule 2 of the Evidence
 * Invariant, PRD §2.2 and §4.5.
 *
 * Nothing else in the project applies the hatch. Two mechanisms hold that,
 * and one gap is left open on purpose — stated here rather than implied:
 *
 *  - scripts/check-hatch.mjs fails the lint if the pattern is REDRAWN
 *    anywhere else. Enforced.
 *  - `label` is a REQUIRED prop, so there is no way to render the hatch
 *    through this component without visible text saying what is missing.
 *    "The pattern is reinforcement, never the sole carrier" stops being a
 *    review note and becomes a type error. Enforced.
 *  - Being the only *consumer* of the classes is currently just true, not
 *    enforced. `composes:` reaches them from any stylesheet, and the guard
 *    script recommends exactly that. A second component composing them would
 *    apply the hatch with no required label and nothing would fail.
 *
 *     <Unrecorded label="Falls risk — not assessed" />
 *     <Unrecorded
 *       variant="panel"
 *       label="Insufficient evidence"
 *       detail="4 of 32 residents have a completed falls risk assessment."
 *     />
 *
 * This is never used for a recorded negative. "Not Given — resident refused —
 * C. Nwosu, 08:04" is a complete record and looks settled; it uses
 * <StatusPill tone="caution">. An omission looks unfinished. Rule 3.
 */

export type UnrecordedVariant = 'badge' | 'cell' | 'chip' | 'flag' | 'panel' | 'row'

export interface UnrecordedProps {
  /**
   * What is missing, in words. Required — the pattern alone is never the
   * carrier of meaning. "Not recorded", "Not assessed", "No decision
   * recorded", "Insufficient evidence".
   */
  label: string
  /**
   * The supporting sentence: what is missing and how much of it. Where a
   * denominator exists it belongs here — "4 of 32 residents have a completed
   * falls risk assessment". Rule 4.
   */
  detail?: string
  /**
   * The field being answered, above the label — "End of life care" over "Not
   * recorded", "Allergies and adverse reactions" over "Not recorded".
   *
   * Used by the `flag` and `panel` variants, both of which stand alone rather
   * than sitting beside a label of their own: together with `label` it is what
   * makes a short answer a complete statement.
   */
  caption?: string
  variant?: UnrecordedVariant
  /**
   * A qualifier on the gap — escalated, overdue, blocking — carried as a mark
   * beside the label.
   *
   * **Decorative and additive, never the carrier.** It is `aria-hidden` and it
   * adds nothing a reader could only get from the picture: the label still
   * says the word. Its job is that a gap already marked somewhere else in the
   * product — an escalated MAR cell — keeps the same mark when it appears in a
   * list, so a reader moving between the two screens meets one mechanism
   * rather than two.
   *
   * No default. Every hatch already in the product renders exactly as it did.
   */
  icon?: IconName
}

const VARIANT_CLASS: Record<UnrecordedVariant, string> = {
  badge: styles.badge,
  cell: styles.cell,
  // Compact and stacked, for a table cell whose detail is a list of names.
  chip: styles.chip,
  flag: styles.flag,
  panel: styles.panel,
  row: styles.row,
}

export function Unrecorded({
  label,
  detail,
  caption,
  variant = 'badge',
  icon,
}: UnrecordedProps) {
  return (
    <span className={VARIANT_CLASS[variant]} data-state="unrecorded">
      {caption ? <span className={styles.caption}>{caption}</span> : null}
      <span className={styles.label}>
        {icon ? (
          // Beside the words, never instead of them. Colour never the sole
          // carrier of meaning, and neither is a glyph (PRD §7).
          <Icon name={icon} size={12} aria-hidden />
        ) : null}
        {label}
      </span>
      {detail ? (
        // Hooked for the guards: a gap that names what it costs is structurally
        // different from one that only names the field, and several screens
        // require the first. Asserting on the words would pin the copy.
        <span className={styles.detail} data-unrecorded-detail>
          {detail}
        </span>
      ) : null}
    </span>
  )
}
