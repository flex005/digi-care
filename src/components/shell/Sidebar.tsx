import { NavLink, useMatch } from 'react-router-dom'
import { Icon } from '@/components/icon/Icon'
import { Tooltip } from '@/components/primitives'
import { devStatesItem, navItems, navSections, shellIcons } from '@/app/nav-items.icons'
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
 * The sidebar carries the product mark and the collapse control together in
 * its own block at the top. Collapsed, the block keeps both and drops the
 * wordmark, and every item becomes icon-only with a tooltip — which PRD §7
 * permits precisely because each one keeps an `aria-label`. An icon-only
 * control with no accessible name would not be permitted, and is the thing to
 * watch for if items are added here.
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

/**
 * One row.
 *
 * Enabled, disabled, collapsed and expanded all render through here, and all
 * four build the class list the same way — as a **string**.
 *
 * That is not incidental tidiness. The earlier version passed NavLink's
 * function form of `className` and, when collapsed, wrapped it in a Tooltip.
 * Radix's Slot merges a trigger's className with its child's by joining them,
 * which silently stringified the function — so the active item lost every
 * class it had, sat unpadded against the left edge, and showed no active
 * state. It looked like a styling slip; it was the two branches diverging.
 * One renderer, one string, and the divergence has nowhere to live.
 */
function SidebarItem({
  item,
  count,
  collapsed,
}: {
  item: NavItem
  count: NavCount | undefined
  collapsed: boolean
}) {
  // Matched here rather than via NavLink's render prop, so the class list is
  // a plain string in every branch. `end: false` keeps the parent item active
  // on a child route — /residents stays lit on /residents/:id.
  const match = useMatch({ path: item.path, end: false })
  const isActive = item.enabled && match !== null
  const name = itemAccessibleName(item, count)

  const className = [
    styles.item,
    isActive ? styles.active : '',
    item.enabled ? '' : styles.disabled,
  ]
    .filter(Boolean)
    .join(' ')

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

  const control = item.enabled ? (
    <NavLink to={item.path} aria-label={name} className={className}>
      {inner}
    </NavLink>
  ) : (
    <span
      className={className}
      role="link"
      aria-disabled="true"
      aria-label={name}
      tabIndex={0}
    >
      {inner}
    </span>
  )

  // A tooltip when the label is not readable (collapsed) or the item cannot be
  // followed (disabled). Where the visible label is present and the item works,
  // a tooltip would only repeat it.
  return (
    <li>
      {collapsed || !item.enabled ? (
        <Tooltip side="right" content={name}>
          {control}
        </Tooltip>
      ) : (
        control
      )}
    </li>
  )
}

export function Sidebar({ collapsed, onToggleCollapsed, counts }: SidebarProps) {
  return (
    <nav
      className={[styles.sidebar, collapsed ? styles.collapsed : '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Main navigation"
    >
      {/* Mark and collapse control share the top block. The control belongs
          with the thing it acts on, and it stays in the same place in both
          states rather than moving between the top and the foot of the rail. */}
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name={shellIcons.logo} size={20} />
        </span>
        <span className={styles.wordmark}>diGi-Care</span>
        <Tooltip
          side="right"
          content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <Icon name={shellIcons.collapseSidebar} size={20} />
          </button>
        </Tooltip>
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
                {items.map((item) => (
                  <SidebarItem
                    key={item.path}
                    item={item}
                    count={counts[item.path]}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </div>
          )
        })}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Review</p>
          <ul className={styles.items}>
            <SidebarItem
              item={devStatesItem}
              count={counts[devStatesItem.path]}
              collapsed={collapsed}
            />
          </ul>
        </div>
      </div>
    </nav>
  )
}
