import LockupSvg from '@/assets/brand/logo-lockup.svg?react'
import MarkSvg from '@/assets/brand/logo-mark.svg?react'
import styles from './logo.module.css'

/**
 * The product mark. PRD §4.7.
 *
 * **Not an icon, and deliberately not in the icon registry.** The registry is
 * generated from the Aligned Line Icons set and normalised to `currentColor`
 * (CLAUDE.md §3); a two-tone brand mark is neither one of those icons nor a
 * single-colour glyph, and putting it through that pipeline would flatten it.
 *
 * **Two parts, coloured from tokens rather than from the file.** The artwork
 * ships with its hex baked in — `#6935CF` on the mark and `#1E0059` on the
 * wordmark, which are `--purple-600` and `--purple-900` — and each path
 * carries `data-part` so CSS can override both. That matters because the same
 * lockup sits on a white rail and on a deep purple panel, and brand purple on
 * brand purple is not readable.
 *
 * `tone="ink"` is the artwork as supplied, for light surfaces. `tone="light"`
 * puts the whole lockup in one light colour, because a two-tone mark on a dark
 * ground loses the darker half.
 */
export function Logo({
  variant = 'lockup',
  tone = 'ink',
  height,
  title,
}: {
  variant?: 'lockup' | 'mark'
  tone?: 'ink' | 'light'
  /** In px, on the 4px scale. The mark scales to it. */
  height?: number
  /**
   * An accessible name, where the mark is the only thing identifying the
   * product. Omitted where a heading beside it already says diGi-Care — a
   * second announcement of the same word is noise on a screen reader.
   */
  title?: string
}) {
  const Art = variant === 'lockup' ? LockupSvg : MarkSvg
  const className = [styles.logo, tone === 'light' ? styles.light : styles.ink]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={className}
      style={height === undefined ? undefined : { height: `${height}px` }}
      data-logo={variant}
      {...(title === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': title })}
    >
      <Art />
    </span>
  )
}
