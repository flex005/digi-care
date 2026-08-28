import { useId, useState } from 'react'
import { Icon } from '@/components/icon/Icon'
import { passwordIcons } from '@/components/shell/top-bar.icons'
import styles from './password-field.module.css'

/**
 * A password field with a reveal.
 *
 * **One component, because there are three of these and they must agree.**
 * Sign-in has one, the invitation has two, and a reveal that behaves
 * differently on the confirm field from the one above it is how somebody
 * concludes their password did not match when it did.
 *
 * **The control says which way it goes, not which state it is in.** "Show
 * password" while hidden and "Hide password" while shown: a toggle labelled
 * with its current state reads as a claim about the field rather than as
 * something to press. The icon changes with it, and the label is not
 * icon-only — an icon-only control needs a visible adjacent label or an
 * `aria-label` plus tooltip (PRD §7), and this has the second.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  id,
  ...rest
}: {
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete?: string
  id?: string
} & Record<`data-${string}`, string | undefined>) {
  const generated = useId()
  const fieldId = id ?? generated
  const [shown, setShown] = useState(false)

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          id={fieldId}
          type={shown ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          {...rest}
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setShown((was) => !was)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          data-reveal={shown ? 'shown' : 'hidden'}
        >
          <Icon
            name={shown ? passwordIcons.hide : passwordIcons.show}
            size={20}
            aria-hidden
          />
        </button>
      </div>
    </div>
  )
}
