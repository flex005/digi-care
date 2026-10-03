import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import type { ResidentId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getResidentProfile } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { useTerm, useTerms } from '@/app/session/use-term'
import type { Vocabulary } from '@/lib/vocabulary'
import { CrossSiteBanner } from '@/features/group/CrossSiteBanner'
import { ProfileHeader } from './ProfileHeader'
import styles from './profile.module.css'
import { NotYourHome } from '@/components/status'

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
 *
 * **`label` asks for a form rather than holding a word.** A tab whose name is
 * configurable needs the sentence-initial form, and a renderer that took one
 * string and capitalised it would be the second owner this whole mechanism
 * exists to refuse. Tabs whose name is fixed ignore the argument.
 */
export interface ProfileTab {
  label: (terms: Vocabulary) => string
  path: string
  end: boolean
  screen: number
  built: boolean
}

export const TABS: ProfileTab[] = [
  { label: () => 'General information', path: '.', end: true, screen: 3, built: true },
  { label: () => 'Needs', path: 'needs', end: false, screen: 4, built: true },
  {
    label: () => 'Important people',
    path: 'people',
    end: false,
    screen: 5,
    built: true,
  },
  {
    label: () => 'Future plans',
    path: 'future-plans',
    end: false,
    screen: 6,
    built: true,
  },
  { label: () => 'Care notes', path: 'notes', end: false, screen: 7, built: true },
  {
    label: (terms) => terms.medication.Many,
    path: 'medications',
    end: false,
    screen: 8,
    built: true,
  },
  {
    /*
     * Left fixed: "Risk assessments" is a module name declared in
     * `src/app/nav-items.icons.ts` and keyed by the permission matrix and the
     * activity log, and the compound does not survive the configurable
     * adjective — "Risk Clinical Assessments" is not a phrase anybody writes.
     */
    label: () => 'Risk assessments',
    path: 'risk-assessments',
    end: false,
    screen: 9,
    built: true,
  },
  {
    label: (terms) => terms.carePlan.One,
    path: 'care-plan',
    end: false,
    screen: 10,
    built: true,
  },
  { label: () => 'Goals', path: 'goals', end: false, screen: 11, built: true },
  { label: () => 'Consent', path: 'consent', end: false, screen: 12, built: true },
  // "Family Portal" is the name of a separate product, not this service's word
  // for relatives.
  { label: () => 'Family Portal', path: 'family', end: false, screen: 12, built: true },
  { label: () => 'Documents', path: 'documents', end: false, screen: 13, built: true },
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
  const term = useTerm()
  const terms = useTerms()
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
        All {term.many}
      </Link>

      {resource.kind === 'loading' ? (
        <p className={styles.loadingNote} role="status">
          Loading {term.one}…
        </p>
      ) : resource.kind === 'refused' ? (
        <NotYourHome refusal={resource} />
      ) : resource.kind === 'error' ? (
        <div className={styles.errorPanel}>
          <p className={styles.errorTitle}>This {term.one} could not be loaded</p>
          <p className={styles.errorBody}>
            <code>{residentId}</code> did not resolve to a {term.one}.
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
            {/*
             * **No unbuilt branch any more.** Every tab carries `built: true`,
             * so the disabled "coming in a later phase" arm could not render —
             * the same expired scaffolding as `PendingLink`, which rendered the
             * identical shape and was deleted for the same reason. `built`
             * stays on the declaration because `reachability.test.tsx` reads
             * it: a tab marked built with no route is still a finding.
             */}
            {TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  [styles.tab, styles.tabBuilt, isActive ? styles.tabActive : '']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {tab.label(terms)}
              </NavLink>
            ))}
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
