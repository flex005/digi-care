import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import type { ResidentId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getResidentProfile } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Tooltip } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { CrossSiteBanner } from '@/features/group/CrossSiteBanner'
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
 * Tabs for modules not yet built render present but disabled with a "coming in
 * a later phase" tooltip, exactly as the sidebar does — so the profile does not
 * change shape as they land, and nobody has to relearn where anything is.
 */

/**
 * The profile tabs. Built ones are real links; the rest render present but
 * disabled, exactly as the sidebar does for unbuilt modules.
 *
 * **How many there are is not stated here.** A prose count is a number that
 * has to be edited every time the list changes and is wrong in between — the
 * same class of thing as a hardcoded nav-item count, which §8 already names.
 * Anything that needs the figure derives it from `TABS`.
 *
 * `path` is the segment this tab links to, and it is what
 * `profile.test.tsx` checks against the router: a screen that is routed but
 * has no tab is unreachable, and a tab pointing at nothing is a dead link.
 * Both are the same defect from opposite ends.
 */
export const TABS = [
  { label: 'General Information', path: '.', end: true, screen: 3, built: true },
  { label: 'Needs', path: 'needs', end: false, screen: 4, built: true },
  { label: 'Important People', path: 'people', end: false, screen: 5, built: true },
  { label: 'Future Plans', path: 'future-plans', end: false, screen: 6, built: true },
  { label: 'Care Notes', path: 'notes', end: false, screen: 7, built: true },
  { label: 'Medications', path: 'medications', end: false, screen: 8, built: true },
  {
    label: 'Risk Assessments',
    path: 'risk-assessments',
    end: false,
    screen: 9,
    built: true,
  },
  { label: 'Care Plan', path: 'care-plan', end: false, screen: 10, built: true },
  { label: 'Goals', path: 'goals', end: false, screen: 11, built: true },
  { label: 'Consent', path: 'consent', end: false, screen: 12, built: true },
  { label: 'Documents', path: 'documents', end: false, screen: 13, built: true },
]

/**
 * What every tab reads, plus a way to ask for the record again.
 *
 * `refresh` exists because the session stores are real writes: a draft saved
 * in the care plan editor changes what the Needs tab, the domain list and the
 * profile header say about the same resident. Without it the screen that
 * performed the write is the only one that has not heard about it — and it is
 * the one somebody is about to act on.
 */
export interface ProfileContext extends ResidentProfile {
  refresh: () => void
}

export function ResidentProfileRoute() {
  const { residentId } = useParams<{ residentId: string }>()
  const [revision, setRevision] = useState(0)

  const load = useCallback(
    () => getResidentProfile((residentId ?? '') as ResidentId),
    [residentId],
  )
  const resource = useResource<ResidentProfile>(load, [residentId, revision])
  const refresh = useCallback(() => setRevision((current) => current + 1), [])

  return (
    <div className={styles.page}>
      <Link to="/residents" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
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
            its facts is one somebody can act on, and acting on the wrong subject is the
            failure this header exists to prevent.
          </p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </div>
      ) : (
        // Every record on this page renders in the RESIDENT's site timezone,
        // not the viewer's and not the currently-selected site's. PRD §3.6.
        <SiteTimeZone timeZone={resource.data.site.timeZone}>
          {/*
           * Two site names on one screen — the top bar's and this record's —
           * with nothing saying which governs the timestamps. The banner says
           * which, and offers the switch rather than performing it.
           */}
          <CrossSiteBanner recordSite={resource.data.site} />
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
                  content={`${tab.label} (coming in a later phase)`}
                >
                  <span
                    className={styles.tab}
                    role="link"
                    aria-disabled="true"
                    aria-label={`${tab.label} (coming in a later phase)`}
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
          <Outlet context={{ ...resource.data, refresh }} />
        </SiteTimeZone>
      )}
    </div>
  )
}
