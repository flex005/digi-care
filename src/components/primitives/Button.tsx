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
      className={[styles.button, VARIANT[variant], SIZE[size], className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
