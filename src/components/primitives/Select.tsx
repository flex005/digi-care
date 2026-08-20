import * as RadixSelect from '@radix-ui/react-select'
import { Icon } from '../icon/Icon'
import surface from './surface.module.css'
import styles from './Select.module.css'

/**
 * Select. Thin wrapper over @radix-ui/react-select.
 *
 * `value` is `string | undefined` and there is no default. A select that
 * pre-answers its own question is the same failure as a blank cell — the
 * placeholder must be able to say "nothing chosen yet" and mean it.
 */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  /** Accessible name for the control. */
  label: string
  /** Shown when nothing has been chosen. Says so plainly. */
  placeholder: string
  options: SelectOption[]
  value: string | undefined
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function Select({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  disabled = false,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger className={styles.trigger} aria-label={label}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <Icon name="arrows-sharp/arrow-down-01-sharp" size={16} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={surface.floating}
          position="popper"
          sideOffset={6}
        >
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled ?? false}
                className={surface.item}
              >
                <RadixSelect.ItemIndicator className={styles.indicator}>
                  <Icon name="check-validation/tick-02" size={16} />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
