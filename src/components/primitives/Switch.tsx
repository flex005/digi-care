import { useId } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import styles from './control.module.css'

/**
 * Switch. Thin wrapper over @radix-ui/react-switch.
 *
 * For interface preferences only — sidebar collapsed, filters on. Never for a
 * clinical value: a two-state control cannot express "nobody has decided",
 * and every clinical value needs that third state. Use RadioGroup with no
 * default, or a status union.
 */
export interface SwitchProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: SwitchProps) {
  const id = useId()
  return (
    <span className={styles.field}>
      <RadixSwitch.Root
        id={id}
        className={styles.switch}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <RadixSwitch.Thumb className={styles.thumb} />
      </RadixSwitch.Root>
      <label htmlFor={id}>{label}</label>
    </span>
  )
}
