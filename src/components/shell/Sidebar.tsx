import { NavLink } from 'react-router-dom'
import { Icon } from '@/components/icon/Icon'
import { Tooltip } from '@/components/primitives'
import { navItems, navSections, shellIcons } from '@/app/nav-items.icons'
import type { NavItem } from '@/app/nav-items.icons'
import { NavBadge, type NavCount } from './NavBadge'
import styles from './Sidebar.module.css'

/**
 * Left sidebar. PRD §4.7.
 *
 * All seventeen modules are listed from Phase 0 onward. The ones whose phase
 * has not landed are present but disabled, with a tooltip naming the phase —
 * so the shell never changes shape as the build progresses, and the
 * information architecture is legible from the first day.
 *
 * A disabled item is not hidden. Absence from a list is the same bug as a
 * blank cell (CLAUDE.md §1): a manager who cannot find "Compliance" should
 * learn that it is coming, not conclude it does not exist.
 *
 * The sidebar carries the product mark in its own block at the top. Collapsed,
 * the block keeps the mark and drops the wordmark, and every item becomes
 * icon-only with a tooltip — which PRD §7 permits precisely because each one
 * keeps an `aria-label`. An icon-only control with no accessible name would
 * not be permitted, and is the thing to watch for if items are added here.
 */

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Counts by nav path. Absent means no badge, which is not the same as zero. */
  counts: Partial<Record<string, NavCount>>
}

function itemAccessibleName(item: NavItem, count: NavCount | undefined): string {
  const base = item.enabled ? item.label : `${item.label} — coming in a later phase`
  return count ? `${base}. ${count.description}` : base
}

export function Sidebar({ collapsed, onToggleCollapsed, counts }: SidebarProps) {
  return (
    <nav
      className={[styles.sidebar, collapsed ? styles.collapsed : '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Main navigation"
    >
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name={shellIcons.logo} size={20} />
        </span>
        <span className={styles.wordmark}>diGi-Care</span>
      </div>

      <div className={styles.scroll}>
        {navSections.map((section) => {
          const items = navItems.filter((item) => item.section === section.id)
          if (items.length === 0) return null

          return (
            <div key={section.id} className={styles.section}>
              {section.label === '' ? null : (
                <p className={styles.sectionLabel}>{section.label}</p>
              )}
              <ul className={styles.items}>
                {items.map((item) => {
                  const count = counts[item.path]
                  const name = itemAccessibleName(item, count)

                  const inner = (
                    <>
                      <Icon name={item.icon} size={20} />
                      <span className={styles.label}>{item.label}</span>
                      {count ? <NavBadge count={count} collapsed={collapsed} /> : null}
                      {item.enabled || collapsed ? null : (
                        <span className={styles.phaseTag} aria-hidden="true">
                          P{item.phase}
                        </span>
                      )}
                    </>
                  )

                  return (
                    <li key={item.path}>
                      {item.enabled ? (
                        collapsed ? (
                          <Tooltip side="right" content={name}>
                            <NavLink
                              to={item.path}
                              aria-label={name}
                              className={({ isActive }) =>
                                [styles.item, isActive ? styles.active : '']
                                  .filter(Boolean)
                                  .join(' ')
                              }
                            >
                              {inner}
                            </NavLink>
                          </Tooltip>
                        ) : (
                          <NavLink
                            to={item.path}
                            // The visible label is hidden when collapsed, so
                            // the name is carried here either way. PRD §7.
                            aria-label={name}
                            className={({ isActive }) =>
                              [styles.item, isActive ? styles.active : '']
                                .filter(Boolean)
                                .join(' ')
                            }
                          >
                            {inner}
                          </NavLink>
                        )
                      ) : (
                        <Tooltip side="right" content={name}>
                          <span
                            className={[styles.item, styles.disabled].join(' ')}
                            role="link"
                            aria-disabled="true"
                            aria-label={name}
                            tabIndex={0}
                          >
                            {inner}
                          </span>
                        </Tooltip>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Review</p>
          <ul className={styles.items}>
            <li>
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
            </li>
          </ul>
        </div>
      </div>

      <button
        type="button"
        className={styles.collapseButton}
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        <Icon name={shellIcons.collapseSidebar} size={20} />
        <span className={styles.label}>Collapse sidebar</span>
      </button>
    </nav>
  )
}
