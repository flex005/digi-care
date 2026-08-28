import { Icon } from '../icon/Icon'
import styles from './SelectedMark.module.css'

/**
 * The mark on a chosen option. PRD §7.
 *
 * **One treatment for every chosen thing in the product.** A filter pill, a
 * status tab, a multi-select chip and a menu item are all somebody choosing
 * one option out of several, and each had been left to say so with a fill
 * alone. Colour is never the sole carrier of meaning, and a filled pill beside
 * an unfilled one is exactly that: in greyscale, or to a reader who does not
 * see the hue, the row is a set of identical buttons.
 *
 * The same tick the `Select` menu and the `Checkbox` already use, so a reader
 * meets one shape for "this one is chosen" wherever they meet it.
 *
 * Renders nothing when the option is not chosen: an empty box beside every
 * unchosen option is a second treatment, and the absence of the mark is what
 * says the option is available.
 */
export function SelectedMark({ selected }: { selected: boolean }) {
  if (!selected) return null
  return (
    <span className={styles.mark} data-selected-mark aria-hidden="true">
      <Icon name="check-validation/tick-02" size={16} />
    </span>
  )
}
