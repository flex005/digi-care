import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

/**
 * The one button. Not a Radix primitive — Radix has no button — but it lives
 * here because every other primitive triggers from it.
 *
 * `size` respects PRD §7's target sizes: 'small' is 32px and is for
 * non-destructive, non-clinical controls only. Anything destructive or
 * clinical uses 'large', which clears 44px.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'small' | 'medium' | 'large'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.destructive,
}

const SIZE: Record<ButtonSize, string> = {
  small: styles.small,
  medium: styles.medium,
  large: styles.large,
}

/**
 * The button's classes, for a control that navigates.
 *
 * A way into another screen is a link, so a crawler, a screen reader and a
 * middle-click all treat it as one. It still has to look like a control: a
 * link drawn as body text is present in the DOM and invisible to a reader,
 * which is how the setup wizard was reachable and could not be found.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'medium',
}: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return [styles.button, VARIANT[variant], SIZE[size]].join(' ')
}

export function Button({
  variant = 'primary',
  size = 'medium',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClassName({ variant, size }), className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
