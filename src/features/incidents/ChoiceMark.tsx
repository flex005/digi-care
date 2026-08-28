import { Icon } from '@/components/icon/Icon'
import styles from './incidents.module.css'

/**
 * The mark on a choice card.
 *
 * An empty ring until it is chosen and a filled tick after — so the control
 * says it *is* a choice before anybody clicks it, and says which one is taken
 * afterwards. A tinted border alone was colour carrying the meaning on its
 * own, which §7 forbids and which a reader in greyscale cannot see at all.
 *
 * **Driven by the prop rather than by a parent class.** A descendant rule off
 * `.choiceSelected` would have styled the subject cards and silently done
 * nothing on the severity tiles, which carry `.severitySelected` instead — a
 * permanent empty ring on the row where harm is chosen.
 */
export function ChoiceMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={styles.choiceMark}
      data-selected={selected || undefined}
      aria-hidden
    >
      <Icon name="check-validation/tick-02" size={12} />
    </span>
  )
}
