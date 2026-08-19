import { useId } from 'react'
import * as RadixRadioGroup from '@radix-ui/react-radio-group'
import styles from './control.module.css'

/**
 * Radio group. Thin wrapper over @radix-ui/react-radio-group.
 *
 * Note `value` is `string | undefined` rather than defaulted: several places
 * in this product require a gate with NO default selection — the capacity
 * gate before recording consent (PRD §6.7) and the CQC notification decision,
 * whose "not yet decided" must never silently become "not required"
 * (PRD §6.5). A defaulted radio group would quietly answer a question nobody
 * asked, which is the Evidence Invariant failing in a different costume.
 */

export interface RadioOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RadioGroupProps {
  /** Names the question. Read out as the group's accessible name. */
  legend: string
  options: RadioOption[]
  /** undefined means nobody has chosen yet. That is a real state. */
  value: string | undefined
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function RadioGroup({
  legend,
  options,
  value,
  onValueChange,
  disabled = false,
}: RadioGroupProps) {
  const groupId = useId()
  return (
    <RadixRadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-label={legend}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}
    >
      {options.map((option) => {
        const id = `${groupId}-${option.value}`
        return (
          <span key={option.value} className={styles.field}>
            <RadixRadioGroup.Item
              id={id}
              value={option.value}
              disabled={option.disabled ?? false}
              className={styles.radio}
            >
              <RadixRadioGroup.Indicator className={styles.radioDot} />
            </RadixRadioGroup.Item>
            <label htmlFor={id}>{option.label}</label>
          </span>
        )
      })}
    </RadixRadioGroup.Root>
  )
}
