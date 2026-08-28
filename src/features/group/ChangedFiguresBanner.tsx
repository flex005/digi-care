import { Link } from 'react-router-dom'
import { changedFigures } from '@/data/access/settings-store'
import { formatCount, pluralise } from '@/lib/format'
import styles from './group.module.css'

/**
 * A figure has been changed this session. PRD §6.7, Phase 15.
 *
 * **On every screen, not on the screens a mapping says are affected.** A map
 * from a figure to the screens it touches is a second rule beside the first
 * one, and two rules drift — §8 names that exactly. Every screen is a superset
 * and cannot go stale.
 *
 * It names which figures moved, because "something has changed" is a signal
 * with nothing behind it.
 */
export function ChangedFiguresBanner() {
  const changed = changedFigures()
  if (changed.length === 0) return null

  return (
    <div className={styles.changedBanner} data-changed-figures={changed.length}>
      <p className={styles.changedTitle}>
        {pluralise(changed.length, 'figure')} on this build{' '}
        {changed.length === 1 ? 'is' : 'are'} not at the documented default.
      </p>
      <p className={styles.changedBody}>
        {changed
          .map(
            (figure) =>
              `${figure.label} is ${formatCount(figure.value)} rather than ${formatCount(figure.fallback)}`,
          )
          .join('; ')}
        . Anything on this screen derived from {changed.length === 1 ? 'it' : 'them'}{' '}
        was drawn against the changed value, and reverts on reload.
      </p>
      <Link to="/settings" className={styles.changedLink} data-changed-link>
        Settings
      </Link>
    </div>
  )
}
