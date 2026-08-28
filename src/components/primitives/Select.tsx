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
  /**
   * Render `label` above the control rather than only to a screen reader.
   *
   * A filter pill row carries its meaning in the placeholder — "Any template"
   * — and a visible label there is noise. **A form field is the opposite**: it
   * sits in a column with other fields whose labels are visible, and a control
   * with no label is both a different thing to read and a different height,
   * so the columns stop lining up. Off by default so the queues are unchanged.
   */
  labelVisible?: boolean
}

export function Select({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  disabled = false,
  labelVisible = false,
}: SelectProps) {
  const trigger = (
    <RadixSelect.Trigger
      className={styles.trigger}
      {...(labelVisible ? {} : { 'aria-label': label })}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon className={styles.chevron}>
        <Icon name="arrows-sharp/arrow-down-01-sharp" size={16} />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  )

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      {labelVisible ? (
        // A real <label>, so the visible text *is* the accessible name rather
        // than a second one sitting beside an aria-label that says the same.
        <label className={styles.field}>
          <span className={styles.label}>{label}</span>
          {trigger}
        </label>
      ) : (
        trigger
      )}
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
