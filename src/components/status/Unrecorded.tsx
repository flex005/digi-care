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

export type UnrecordedVariant = 'badge' | 'cell' | 'chip' | 'panel' | 'row'

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
  variant?: UnrecordedVariant
}

const VARIANT_CLASS: Record<UnrecordedVariant, string> = {
  badge: styles.badge,
  cell: styles.cell,
  // Compact and stacked, for a table cell whose detail is a list of names.
  chip: styles.chip,
  panel: styles.panel,
  row: styles.row,
}

export function Unrecorded({ label, detail, variant = 'badge' }: UnrecordedProps) {
  return (
    <span className={VARIANT_CLASS[variant]} data-state="unrecorded">
      <span className={styles.label}>{label}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
    </span>
  )
}
