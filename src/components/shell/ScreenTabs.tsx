import { NavLink } from 'react-router-dom'
import styles from './ScreenTabs.module.css'

/**
 * Moves between the screens of one module.
 *
 * A module with more than one screen under a single sidebar item needs
 * somewhere to say so. Without it the second screen is reachable only by
 * typing its URL, which CLAUDE.md §8 counts as not built — the MAR chart
 * proved that once already, with seventeen green tests and no way in.
 *
 * The resident profile's own strip carries a disabled state for tabs whose
 * phase has not been built; this one does not, because every screen it links
 * to exists. A disabled tab is a promise, and a promise with no phase number
 * attached is placeholder text.
 */
export interface ScreenTab {
  label: string
  /** The route this tab lands on, relative to the module's layout route. */
  path: string
  /** `.` needs `end`, or it stays active on every child. */
  end?: boolean
}

export function ScreenTabs({
  label,
  tabs,
}: {
  /** Names the module, so the strip is not "Tabs" to a screen reader. */
  label: string
  tabs: ScreenTab[]
}) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.path}
          end={tab.end ?? false}
          className={({ isActive }) =>
            [styles.tab, styles.tabBuilt, isActive ? styles.tabActive : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
