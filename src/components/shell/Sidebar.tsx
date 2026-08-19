import { NavLink } from 'react-router-dom'
import { Icon } from '@/components/icon/Icon'
import { Tooltip } from '@/components/primitives'
import { navItems, shellIcons } from '@/app/nav-items.icons'
import styles from './Sidebar.module.css'

/**
 * Left sidebar. PRD §4.7.
 *
 * All sixteen modules are listed from Phase 0 onward. The ones whose phase has
 * not landed are present but disabled, with a tooltip naming the phase — so
 * the shell never changes shape as the build progresses, and the information
 * architecture is legible from the first day.
 *
 * A disabled item is not hidden. Absence from a list is the same bug as a
 * blank cell (CLAUDE.md §1): a manager who cannot find "Compliance" should
 * learn that it is coming, not conclude it does not exist.
 */

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <nav
      className={[styles.sidebar, collapsed ? styles.collapsed : '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Main navigation"
    >
      {navItems.map((item) =>
        item.enabled ? (
          <NavLink
            key={item.path}
            to={item.path}
            // The visible label is hidden when collapsed, which would leave an
            // icon-only control with no accessible name. PRD §7.
            aria-label={item.label}
            className={({ isActive }) =>
              [styles.item, isActive ? styles.active : ''].filter(Boolean).join(' ')
            }
          >
            <Icon name={item.icon} size={20} />
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ) : (
          <Tooltip
            key={item.path}
            side="right"
            content={`${item.label} — coming in a later phase (phase ${item.phase})`}
          >
            <span
              className={[styles.item, styles.disabled].join(' ')}
              role="link"
              aria-disabled="true"
              aria-label={`${item.label} — coming in a later phase`}
              tabIndex={0}
            >
              <Icon name={item.icon} size={20} />
              <span className={styles.label}>{item.label}</span>
              <span className={styles.phaseTag}>P{item.phase}</span>
            </span>
          </Tooltip>
        ),
      )}

      <div className={styles.devSection}>
        <NavLink
          to="/dev/states"
          aria-label="Status states"
          className={({ isActive }) =>
            [styles.item, isActive ? styles.active : ''].filter(Boolean).join(' ')
          }
        >
          <Icon name="check-validation/validation" size={20} />
          <span className={styles.label}>Status states</span>
        </NavLink>
      </div>

      <button
        type="button"
        className={styles.collapseButton}
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        <Icon name={shellIcons.collapseSidebar} size={20} />
        <span className={styles.label}>
          {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        </span>
      </button>
    </nav>
  )
}
