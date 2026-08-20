import { useCallback } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import type { ResidentId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getResidentProfile } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Tooltip } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { ProfileHeader } from './ProfileHeader'
import styles from './profile.module.css'

/**
 * A resident's profile. PRD §6.2.
 *
 * **Subject identity comes from the route parameter and nothing else** — never
 * navigation history, never "last viewed", never component state (§2.4). That
 * is why this reads `useParams` and refetches on it rather than accepting a
 * resident from wherever the user came from.
 *
 * The four tabs arrive in the screens after this one. Until then they render
 * present but disabled with a "coming in a later phase" tooltip, exactly as
 * the sidebar does for unbuilt modules — so the profile does not change shape
 * as they land, and nobody has to relearn where anything is.
 */

/**
 * The four profile tabs. Built ones are real links; the rest render present
 * but disabled with a "coming in a later phase" tooltip, exactly as the
 * sidebar does — so the profile does not change shape as they land.
 */
const TABS = [
  { label: 'General Information', path: '.', end: true, screen: 3, built: true },
  { label: 'Needs', path: 'needs', end: false, screen: 4, built: true },
  { label: 'Important People', path: 'people', end: false, screen: 5, built: false },
  { label: 'Future Plans', path: 'future-plans', end: false, screen: 6, built: false },
]

export function ResidentProfileRoute() {
  const { residentId } = useParams<{ residentId: string }>()

  const load = useCallback(
    () => getResidentProfile((residentId ?? '') as ResidentId),
    [residentId],
  )
  const resource = useResource<ResidentProfile>(load, [residentId])

  return (
    <div className={styles.page}>
      <Link to="/residents" className={styles.backLink}>
        <Icon name="arrows-round/arrow-left-02-round" size={16} />
        All residents
      </Link>

      {resource.kind === 'loading' ? (
        <p className={styles.loadingNote} role="status">
          Loading resident…
        </p>
      ) : resource.kind === 'error' ? (
        <div className={styles.errorPanel}>
          <p className={styles.errorTitle}>This resident could not be loaded</p>
          <p className={styles.errorBody}>
            <code>{residentId}</code> did not resolve to a resident. Nothing is shown
            rather than a partial header, because a subject header that is missing half
            its facts is one somebody can act on — and acting on the wrong subject is
            the failure this header exists to prevent.
          </p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </div>
      ) : (
        // Every record on this page renders in the RESIDENT's site timezone,
        // not the viewer's and not the currently-selected site's. PRD §3.6.
        <SiteTimeZone timeZone={resource.data.site.timeZone}>
          <ProfileHeader profile={resource.data} />

          <nav className={styles.tabs} aria-label="Profile sections">
            {TABS.map((tab) =>
              tab.built ? (
                <NavLink
                  key={tab.label}
                  to={tab.path}
                  end={tab.end}
                  className={({ isActive }) =>
                    [styles.tab, styles.tabBuilt, isActive ? styles.tabActive : '']
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  {tab.label}
                </NavLink>
              ) : (
                <Tooltip
                  key={tab.label}
                  content={`${tab.label} — coming in a later phase`}
                >
                  <span
                    className={styles.tab}
                    role="link"
                    aria-disabled="true"
                    aria-label={`${tab.label} — coming in a later phase`}
                    tabIndex={0}
                  >
                    {tab.label}
                    <span className={styles.tabPhase}>S{tab.screen}</span>
                  </span>
                </Tooltip>
              ),
            )}
          </nav>

          {/* The header above stays mounted across every tab — that is what
              makes it safe to write against a subject (§2.4), and it only
              holds because the tabs are children of this layout rather than
              separate pages that each rebuild it. */}
          <Outlet context={resource.data} />
        </SiteTimeZone>
      )}
    </div>
  )
}
