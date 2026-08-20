import type { SVGProps } from 'react'
import { iconRegistry } from './registry.generated'
import type { IconName } from './registry.names.generated'
import styles from './Icon.module.css'

/**
 * The only way an icon reaches a screen. CLAUDE.md §3.
 *
 * No icon library, ever. No raw <svg> in feature code, no direct imports from
 * src/assets/icons. Names are namespaced by category because filenames repeat
 * across the 57 folders:
 *
 *     <Icon name="medical/stethoscope" size={20} />
 *
 * A name not in the folder fails in three independent places: `npm run icons`
 * refuses to generate, tsc rejects it because it is not in the IconName union,
 * and `npm run icons:check` fails CI.
 *
 * Accessibility (PRD §7): icons are decorative by default — aria-hidden and
 * focusable="false" — because meaning belongs to the text beside them. Passing
 * `label` promotes the icon to an image with an accessible name, for the rare
 * case where the icon genuinely is the content.
 */

/** Closed set. An arbitrary pixel size is a design decision, not a prop. */
export type IconSize = 12 | 16 | 20 | 24 | 32

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  name: IconName
  size?: IconSize
  /** Give the icon an accessible name. Omit for decorative icons. */
  label?: string
}

export function Icon({ name, size = 20, label, className, ...rest }: IconProps) {
  const Svg = iconRegistry[name]

  if (!Svg) {
    // Reachable two ways, and prebuild only closes the first:
    //
    //  1. The registry is stale — a name was added and `npm run icons` has
    //     not run since. predev/prebuild handle this; it happens mid-session
    //     during HMR.
    //  2. The registry is CURRENT but the scanner could not see the name.
    //     A name written somewhere the scan does not read is regenerated
    //     *out* of the registry, `icons:check` reports it current — because
    //     it is, for the wrong input — and this throws at runtime. It is a
    //     valid IconName, so the type system cannot catch it either.
    //     Happened on 20/08/2026 in a fresh production build.
    //
    // Either way: say so, rather than substituting a similar-looking glyph.
    // CLAUDE.md §3.
    throw new Error(
      `Icon "${name}" is not in the generated registry. Run \`npm run icons\`.`,
    )
  }

  const accessibility = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true, focusable: 'false' } as const)

  return (
    <Svg
      {...accessibility}
      {...rest}
      width={size}
      height={size}
      className={className ? `${styles.icon} ${className}` : styles.icon}
    />
  )
}
