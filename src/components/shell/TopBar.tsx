import type { Site } from '@/data/types'
import type { AccessMode } from '@/data/access/resource'
import { Icon } from '@/components/icon/Icon'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  VisuallyHidden,
} from '@/components/primitives'
import { shellIcons } from '@/app/nav-items.icons'
import { AppSwitcher } from './AppSwitcher'
import styles from './TopBar.module.css'

/**
 * The application header. PRD §4.7.
 *
 * The active site name is permanently visible for ALL users, including
 * single-site users, who do not get a switcher but do get the label
 * (PRD §2.4). This is a structural mitigation against the second-worst
 * failure in the product — a record saved into the wrong site — and it is not
 * re-decided per screen.
 *
 * The product mark now sits in the sidebar's own block rather than here, so
 * the top bar carries only what is about the current context: which site, what
 * you are searching, what needs attention, and who you are.
 */

export interface TopBarProps {
  sites: Site[]
  activeSite: Site
  onSiteChange: (site: Site) => void
  alertCount: number
  userName: string
  userRoleLabel: string
  accessMode: AccessMode
  onAccessModeChange: (mode: AccessMode) => void
}

export function TopBar({
  sites,
  activeSite,
  onSiteChange,
  alertCount,
  userName,
  userRoleLabel,
  accessMode,
  onAccessModeChange,
}: TopBarProps) {
  const isMultiSite = sites.length > 1

  return (
    <header className={styles.topbar}>
      {isMultiSite ? (
        <DropdownMenu>
          {/* The word "Site" is off the pill but not out of the control. A
              button whose entire accessible name is "Rosewood Court" says
              nothing about what it does, and this is the control that decides
              which home a record lands in. The visible text is contained in
              the accessible name, so voice control still reaches it by what is
              written on it — WCAG 2.5.3. */}
          <DropdownMenuTrigger
            className={styles.site}
            aria-label={`Site: ${activeSite.name}. Change site.`}
          >
            {activeSite.name}
            <Icon name={shellIcons.siteSwitcher} size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Switch site</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sites.map((site) => (
              <DropdownMenuItem key={site.id} onSelect={() => onSiteChange(site)}>
                {site.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // No switcher, but still the site — permanently visible for
        // single-site users too. PRD §2.4. A bare place name has no context
        // read aloud, so the word survives where it still does work.
        <span className={styles.site}>
          <VisuallyHidden>Site: </VisuallyHidden>
          {activeSite.name}
        </span>
      )}

      <div className={styles.spacer} />

      <div className={styles.search}>
        <Icon name={shellIcons.search} size={16} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search residents, notes, incidents"
          aria-label="Search residents, notes and incidents"
        />
      </div>

      {/* Alerts, apps and user read as one cluster of account-and-context
          controls, so they sit tight together and the bar's wider gap falls
          between the search field and the group. */}
      <div className={styles.actions}>
        <Tooltip content={`Alerts — ${alertCount} unread`}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Alerts — ${alertCount} unread`}
          >
            <Icon name={shellIcons.alerts} size={20} />
            {alertCount > 0 ? (
              <span className={styles.count} aria-hidden="true">
                {alertCount}
              </span>
            ) : null}
          </button>
        </Tooltip>

        <AppSwitcher />

        <DropdownMenu>
          {/* Named explicitly for the same reason as the site pill: a button
              whose accessible name is just "A. Okonkwo" does not say what it
              does. The visible text is contained in the name, so voice control
              still reaches it by what is written on it — WCAG 2.5.3. */}
          <DropdownMenuTrigger
            className={styles.user}
            aria-label={`${userName} — account menu`}
          >
            {/* A real image container, not a glyph: it shows a photograph the
                day staff carry one, and initials until then. Decorative here —
                the name sits beside it, and Avatar's own "no photograph on
                file" label is a resident-record concern, not a chrome one. */}
            <span aria-hidden="true">
              <Avatar
                photo={{ kind: 'not_on_file' }}
                name={userName}
                size="small"
                tone="brand"
              />
            </span>
            {userName}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{userRoleLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Read-only is one of the seven states every screen is reviewed
              against (PRD §6). This makes it reachable without a build flag —
              an auditor sees every record and can change none of them. */}
            <DropdownMenuLabel>View as</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onAccessModeChange('read_write')}>
              {accessMode === 'read_write' ? '✓ ' : ''}Registered Manager
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAccessModeChange('read_only')}>
              {accessMode === 'read_only' ? '✓ ' : ''}Read-only — Auditor
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              Profile — coming in a later phase
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              Sign out — coming in a later phase
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
