import type { Site } from '@/data/types'
import { Icon } from '@/components/icon/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives'
import { shellIcons } from '@/app/nav-items.icons'
import styles from './TopBar.module.css'

/**
 * The application header. PRD §4.7.
 *
 * The active site name is permanently visible for ALL users, including
 * single-site users, who do not get a switcher but do get the label
 * (PRD §2.4). This is a structural mitigation against the second-worst
 * failure in the product — a record saved into the wrong site — and it is not
 * re-decided per screen.
 */

export interface TopBarProps {
  sites: Site[]
  activeSite: Site
  onSiteChange: (site: Site) => void
  alertCount: number
  userName: string
  userRoleLabel: string
}

export function TopBar({
  sites,
  activeSite,
  onSiteChange,
  alertCount,
  userName,
  userRoleLabel,
}: TopBarProps) {
  const isMultiSite = sites.length > 1

  return (
    <header className={styles.topbar}>
      <span className={styles.wordmark}>diGi-Care</span>

      {isMultiSite ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={styles.site}>
            <span className={styles.siteLabel}>Site</span>
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
        // No switcher, but still the label. PRD §2.4.
        <span className={styles.site}>
          <span className={styles.siteLabel}>Site</span>
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

      <DropdownMenu>
        <DropdownMenuTrigger className={styles.user}>
          <Icon name={shellIcons.user} size={20} />
          {userName}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userRoleLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            Profile — coming in a later phase
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Sign out — coming in a later phase
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
