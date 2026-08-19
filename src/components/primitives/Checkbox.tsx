import { useId } from 'react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { Icon } from '../icon/Icon'
import styles from './control.module.css'

/**
 * Checkbox. Thin wrapper over @radix-ui/react-checkbox.
 *
 * `label` is required and always visible. A bare control carries no meaning,
 * and PRD §7 permits no exception here.
 */
export interface CheckboxProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: CheckboxProps) {
  const id = useId()
  return (
    <span className={styles.field}>
      <RadixCheckbox.Root
        id={id}
        className={styles.checkbox}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
      >
        <RadixCheckbox.Indicator>
          <Icon name="check-validation/tick-02" size={16} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={id}>{label}</label>
    </span>
  )
}
