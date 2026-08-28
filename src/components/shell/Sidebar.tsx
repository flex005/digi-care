import { NavLink, useMatch } from 'react-router-dom'
import { Icon } from '@/components/icon/Icon'
import { Tooltip } from '@/components/primitives'
import { navItems, navSections, shellIcons } from '@/app/nav-items.icons'
import { Logo } from '@/components/brand/Logo'
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
  const base = item.enabled ? item.label : `${item.label} (coming in a later phase)`
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
  /*
   * Matched here rather than via NavLink's render prop, so the class list is a
   * plain string in every branch.
   *
   * **The root is matched exactly and everything else by prefix.** `end: false`
   * keeps a parent lit on its children, which is what /residents needs on
   * /residents/:id — but the Dashboard's path is `/`, and every URL in the
   * product is prefixed by `/`, so it matched all of them and the front door
   * stayed lit on every screen. A nav item is active when you are looking at
   * it, and only then.
   */
  const match = useMatch({ path: item.path, end: item.path === '/' })
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
        {/*
         * The mark alone when the rail is collapsed: the wordmark does not
         * fit in 72px and scaling the lockup down to make it fit would make
         * the word unreadable while still taking the space.
         */}
        {/*
         * The name announced is the name on the artwork. The mark reads
         * "Radiant digicare" and the product's copy says diGi-Care; a screen
         * reader hearing the second for an image showing the first is being
         * told about a different thing from the one on screen.
         */}
        <Logo
          variant={collapsed ? 'mark' : 'lockup'}
          height={collapsed ? 28 : 32}
          title="Radiant digicare"
        />
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

        {/*
         * **`/dev/states` is still routed and is no longer in the rail.** It
         * is the kitchen sink the Evidence Invariant is checked against at
         * the end of every phase, and it was never a product module — it sat
         * under a "Review" heading of its own, which put a developer's tool
         * in a care manager's navigation. It is reached by typing the URL,
         * and the reachability guard names it as the one route that is
         * deliberately not linked rather than counting it as a failure.
         */}
      </div>
    </nav>
  )
}
