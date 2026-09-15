import { describe, expect, it } from 'vitest'
import type { RouteObject } from 'react-router-dom'
import { router } from './routes'
import { TABS } from '@/features/residents/ResidentProfileRoute'
import { navItems } from './nav-items.icons'
import { MEDICATION_TABS } from '@/features/medications/MedicationsRoute'
import { MEDICATION_SUBTABS } from '@/features/medications/MedicationsTab'
import { projectReviews } from '@/features/reviews/projection'
import { residents } from '@/data/fixtures/residents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import type { IsoDateTime } from '@/data/types'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { GoalsTab } from '@/features/goals/GoalsTab'
import { goals } from '@/data/fixtures/goals'

const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

/**
 * **A screen that cannot be reached from the navigation is not built.**
 *
 * This exists because the MAR chart was written, styled, routed and covered by
 * seventeen tests, and no user could open it: the route was registered and no
 * tab was ever added. 517 tests were green. Every state on the screen rendered
 * correctly to nobody.
 *
 * It is a different failure from the ones §8 already names. Those are about a
 * state nothing reaches; this is about a whole screen nothing reaches, and no
 * amount of testing *the screen* can find it — the test renders the route
 * directly, which is the one thing a user cannot do.
 *
 * **Bidirectional, because a tab pointing at nothing is the same defect the
 * other way round**: a link that 404s tells a user the product is broken, and
 * a screen with no link tells them it does not exist. Both are unreachable
 * screens; they differ only in which half is missing.
 */

/**
 * The shell route, found by what it is rather than by where it sits.
 *
 * It used to be `router.routes[0]`, and it stopped being the first route the
 * day four authentication screens were added outside the shell — a legitimate
 * change that broke four guards at once, none of them about authentication.
 * An assertion that holds a shape by its index is asserting the order of a
 * list nobody promised to keep.
 */
function shellRoute(): RouteObject {
  const shell = router.routes.find(
    (route: RouteObject) => route.path === '/' && (route.children?.length ?? 0) > 0,
  )
  expect(shell, 'the application shell route is missing').toBeTruthy()
  return shell as RouteObject
}

/** The children of the `residents/:residentId` layout route, from the router. */
function profileRouteSegments(): string[] {
  const shell = shellRoute()
  const profile = (shell?.children ?? []).find(
    (route: RouteObject) => route.path === 'residents/:residentId',
  )
  expect(profile, 'the resident profile layout route is missing').toBeTruthy()

  return (
    (profile?.children ?? [])
      .map((child: RouteObject) => (child.index ? '.' : (child.path ?? '')))
      // Detail screens beneath a tab are reached from the tab, not from the tab
      // strip: `notes/:noteId` is opened by a note on the Care Notes tab. A
      // parameterised segment is never a tab.
      .filter((path) => !path.includes(':'))
  )
}

/**
 * Profile screens reached from somewhere other than the tab strip.
 *
 * **Not an exemption list.** An exception list is where a guard goes to die,
 * so each entry names where the screen is reached from *and* supplies the
 * links that place actually produces — and the test fails if the screen stops
 * appearing among them. Declaring a route here does not excuse it from being
 * reachable; it moves the proof somewhere else and still demands one.
 *
 * The whole-plan review is deliberately not a tab: each module already answers
 * for its own records, and a second place to see the same thing is where the
 * two start disagreeing.
 */
const REACHED_FROM_ELSEWHERE: {
  path: string
  from: string
  links: () => string[] | Promise<string[]>
}[] = [
  {
    path: 'care-plan/review',
    from: 'the review queue',
    links: () =>
      projectReviews(residents.slice(0, 1), NOW_ISO).items.map((item) => item.to),
  },
  {
    path: 'goals/new',
    from: 'the goals tab',
    /*
     * Proved by rendering the tab rather than by reading the router.
     *
     * The link is in JSX rather than in data, so the proof has to render it —
     * and it renders for a resident with no goals, which is the state where
     * setting one is the only thing the screen offers.
     */
    links: async () => {
      const withGoals = new Set(goals.map((goal) => goal.residentId))
      const subject = residents.find((resident) => !withGoals.has(resident.id))
      expect(subject, 'no resident has an empty goals tab to render').toBeTruthy()

      const router = createMemoryRouter(
        [
          {
            path: 'residents/:residentId',
            element: <ResidentProfileRoute />,
            children: [{ path: 'goals', element: <GoalsTab /> }],
          },
        ],
        { initialEntries: [`/residents/${subject!.id}/goals`] },
      )
      const { container, unmount } = render(
        <SessionProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </SessionProvider>,
      )
      await waitFor(() =>
        expect(container.querySelector('[data-no-goals]')).toBeTruthy(),
      )
      const hrefs = [...container.querySelectorAll('a')].map(
        (link) => link.getAttribute('href') ?? '',
      )
      unmount()
      return hrefs
    },
  },
]

describe('every profile screen is reachable', () => {
  it('gives every routed tab screen a tab', () => {
    const routed = profileRouteSegments().sort()
    const tabbed = TABS.map((tab) => tab.path).sort()
    const elsewhere = REACHED_FROM_ELSEWHERE.map((entry) => entry.path)

    // The direction that caught the MAR chart.
    const unreachable = routed.filter(
      (path) => !tabbed.includes(path) && !elsewhere.includes(path),
    )
    expect(
      unreachable,
      `routed but with no tab pointing at it: a user cannot open ${unreachable.join(', ')}`,
    ).toEqual([])
  })

  it('proves the screens that are not tabs are reached from where they claim', async () => {
    for (const entry of REACHED_FROM_ELSEWHERE) {
      const links = await entry.links()
      expect(
        links.some((link) => link.endsWith(`/${entry.path}`)),
        `${entry.path} claims to be reached from ${entry.from}, and ${entry.from} does not link to it`,
      ).toBe(true)
    }
  }, 20000)

  it('gives every tab a route to land on', () => {
    const routed = profileRouteSegments()
    // A built tab must resolve. An unbuilt one is deliberately routeless: it
    // renders disabled, so there is nothing to land on and nothing to check.
    const dangling = TABS.filter((tab) => tab.built)
      .map((tab) => tab.path)
      .filter((path) => !routed.includes(path))

    expect(
      dangling,
      `a tab points at a route that does not exist: ${dangling.join(', ')}`,
    ).toEqual([])
  })

  it('counts the tabs from the declaration, never from prose', () => {
    // The same class of thing as a hardcoded nav-item count (§8): a figure
    // written down separately is one that is wrong between edits.
    expect(TABS.length).toBe(new Set(TABS.map((tab) => tab.path)).size)
    const elsewhere = REACHED_FROM_ELSEWHERE.map((entry) => entry.path)
    const tabbedSegments = profileRouteSegments().filter(
      (path) => !elsewhere.includes(path),
    )
    expect(TABS.length).toBeGreaterThanOrEqual(tabbedSegments.length)
  })
})

/** Top-level route paths, from the router. */
/**
 * Every top-level destination in the router, inside the shell and outside it.
 *
 * **It read the shell's children only, and that was the whole router until
 * four authentication screens landed as siblings of the shell.** After that
 * `/sign-in`, `/sign-out` and both invitation routes were outside every
 * assertion in this file, including the one that exists to catch a screen with
 * no way in — so the guard covered less than its own name claimed. That is the
 * medium-blindness failure §8 names: when a concept gains a new place to live,
 * every check naming that concept is now narrower than its success message.
 */
function topLevelPaths(): string[] {
  const shell = shellRoute()
  const children = shell?.children ?? []

  // The index route is a real destination — from Phase 12 it is the Dashboard,
  // and the sidebar's first item points at it. Reporting it as `/` is what
  // stops the front door counting as unreachable.
  const index = children.some((route: RouteObject) => route.index === true) ? ['/'] : []

  const named = (routes: readonly RouteObject[]) =>
    routes
      .map((route: RouteObject) => route.path ?? '')
      .filter(
        (path) => path !== '' && path !== '/' && !path.includes(':') && path !== '*',
      )
      .map((path) => (path.startsWith('/') ? path : `/${path}`))

  return [...index, ...named(children), ...named(router.routes)]
}

describe('every sidebar item agrees with the router', () => {
  /**
   * The other half of the same failure, and the one that was about to bite:
   * `Medications` sat `enabled: false` while its route did not exist, which
   * was correct — and the moment the route landed, nothing would have told
   * anybody to flip it. A module you can reach only by typing the URL is not
   * built (§8).
   */
  it('gives every enabled item a route to land on', () => {
    const routed = topLevelPaths()
    const dangling = navItems
      .filter((item) => item.enabled)
      .map((item) => item.path)
      .filter((path) => !routed.includes(path))

    expect(
      dangling,
      `an enabled sidebar item points at a route that does not exist: ${dangling.join(', ')}`,
    ).toEqual([])
  })

  /**
   * Every top-level route is either in the rail or named here as one that is
   * deliberately not.
   *
   * **Both assertions above start from `navItems`, so a route with no sidebar
   * item at all is invisible to them** — which is exactly what `/dev/states`
   * became the day its "Review" heading came out of the rail. The guard whose
   * docblock says a module reachable only by typing the URL is not built could
   * not see one. The list below is the whole exception, it is short, and each
   * entry says why; an unlisted route with no way in fails.
   */
  const UNLINKED: { path: string; from: string; why: string }[] = [
    {
      path: '/dev/states',
      from: '/',
      why: 'the status kitchen sink, opened by typing the URL at the end of a phase',
    },
    /*
     * The authentication screens. They are siblings of the shell rather than
     * children of it, because there is no sidebar on a screen somebody reaches
     * before they have said who they are — so none of them can have a nav item
     * and all four are named here instead.
     */
    {
      path: '/sign-in',
      from: '/',
      why: 'every route redirects here until somebody signs in',
    },
    {
      path: '/sign-out',
      from: '/',
      why: 'the account menu in the top bar, and the account page',
    },
    {
      path: '/invitation',
      from: '/sign-in',
      why: 'the "I have been invited" link, which stands in for the email a real deployment would send',
    },
    {
      path: '/me/permissions',
      from: '/',
      why: 'the account menu in the top bar; it is the account page, and every refusal links to it',
    },
    { path: '/residents/new', from: '/residents', why: 'Add resident on the list' },
    {
      path: '/documents/expiry',
      from: '/documents',
      why: 'the expiry tile in the library',
    },
    {
      path: '/compliance/pack',
      from: '/compliance',
      why: 'the inspection pack control',
    },
    {
      path: '/compliance/notifications',
      from: '/compliance',
      why: 'the statutory notifications panel',
    },
    {
      path: '/incidents/new',
      from: '/incidents',
      why: 'Report an incident on the log',
    },
  ]

  it('names every route that has no way in from the navigation', () => {
    /*
     * Reached from a screen rather than from the rail is a way in; reached
     * from nothing is not, and the two assertions above cannot tell them apart
     * because both start from `navItems`. So the exception list carries the
     * screen each route is opened from, and an unlisted route with no sidebar
     * item fails here rather than shipping unreachable.
     */
    const linked = new Set(navItems.map((item) => item.path))
    const excused = new Map(
      UNLINKED.map((entry) => [
        entry.path.startsWith('/') ? entry.path : `/${entry.path}`,
        entry,
      ]),
    )

    const orphans = topLevelPaths().filter((path) => {
      if (path === '*' || path.includes(':')) return false
      const href = path.startsWith('/') ? path : `/${path}`
      return !linked.has(href) && !excused.has(href)
    })

    expect(
      orphans,
      `these routes exist and nothing points at them: ${orphans.join(', ')}`,
    ).toEqual([])
  })

  it('keeps the exception list from outliving what it excuses', () => {
    /*
     * An entry naming a route that no longer exists narrows nothing for
     * anybody and still reads as a decision somebody took — the dead `/team`
     * permission exceptions, one file over.
     */
    const routed = new Set(topLevelPaths())
    for (const entry of UNLINKED) {
      expect(
        routed.has(entry.path),
        `${entry.path} is excused and no longer exists`,
      ).toBe(true)
      // And the screen it says it is reached from is itself a route.
      expect(
        routed.has(entry.from),
        `${entry.path} says it is reached from ${entry.from}, which is not a route`,
      ).toBe(true)
    }
  })

  it('leaves no built route sitting behind a disabled item', () => {
    // The direction that catches a screen shipped without its navigation. A
    // route that exists while its sidebar item is disabled is reachable only
    // by typing the URL.
    const routed = topLevelPaths()
    const hidden = navItems
      .filter((item) => !item.enabled && routed.includes(item.path))
      .map((item) => item.path)

    expect(
      hidden,
      `these routes exist but their sidebar item is still disabled: ${hidden.join(', ')}`,
    ).toEqual([])
  })
})

/**
 * A module with two screens under one sidebar item.
 *
 * The sidebar names `/medications` and nothing else, so `/medications/round`
 * is reachable only through the strip the layout route renders. That makes the
 * strip the navigation for the second screen, and the same bidirectional check
 * applies to it as to the profile's tabs: a routed screen with no tab cannot be
 * opened, and a tab with no route is a dead link.
 */
function medicationSegments(): string[] {
  const shell = shellRoute()
  const module_ = (shell?.children ?? []).find(
    (route: RouteObject) => route.path === 'medications',
  )
  expect(module_, 'the medications layout route is missing').toBeTruthy()

  return (module_?.children ?? [])
    .map((child: RouteObject) => (child.index ? '.' : (child.path ?? '')))
    .filter((path) => !path.includes(':'))
}

describe('every medications screen is reachable', () => {
  it('gives every routed screen a tab', () => {
    const routed = medicationSegments().sort()
    const tabbed = MEDICATION_TABS.map((tab) => tab.path).sort()

    const unreachable = routed.filter((path) => !tabbed.includes(path))
    expect(
      unreachable,
      `routed but with no tab pointing at it: a user cannot open ${unreachable.join(', ')}`,
    ).toEqual([])
  })

  it('gives every tab a route to land on', () => {
    const routed = medicationSegments()
    const dangling = MEDICATION_TABS.map((tab) => tab.path).filter(
      (path) => !routed.includes(path),
    )

    expect(
      dangling,
      `a tab points at a route that does not exist: ${dangling.join(', ')}`,
    ).toEqual([])
  })
})

/**
 * A tab that itself has tabs.
 *
 * The third level, and the same check for the same reason: the profile's tab
 * strip names `medications` and nothing below it, so `prescriptions` is
 * reachable only through the sub-strip the layout renders. Depth does not
 * change the failure — a routed screen nothing links to cannot be opened, and
 * a link to no route is dead — so the guard follows the nesting rather than
 * stopping where it happened to be written.
 */
function medicationSubSegments(): string[] {
  const shell = shellRoute()
  const profile = (shell?.children ?? []).find(
    (route: RouteObject) => route.path === 'residents/:residentId',
  )
  const tab = (profile?.children ?? []).find(
    (route: RouteObject) => route.path === 'medications',
  )
  expect(tab, "the profile's medications layout route is missing").toBeTruthy()

  return (tab?.children ?? [])
    .map((child: RouteObject) => (child.index ? '.' : (child.path ?? '')))
    .filter((path) => !path.includes(':'))
}

describe("every screen under the profile's medications tab is reachable", () => {
  it('gives every routed sub-screen a sub-tab', () => {
    const routed = medicationSubSegments().sort()
    const tabbed = MEDICATION_SUBTABS.map((tab) => tab.path).sort()

    const unreachable = routed.filter((path) => !tabbed.includes(path))
    expect(
      unreachable,
      `routed but with no sub-tab pointing at it: a user cannot open ${unreachable.join(', ')}`,
    ).toEqual([])
  })

  it('gives every sub-tab a route to land on', () => {
    const routed = medicationSubSegments()
    const dangling = MEDICATION_SUBTABS.map((tab) => tab.path).filter(
      (path) => !routed.includes(path),
    )

    expect(
      dangling,
      `a sub-tab points at a route that does not exist: ${dangling.join(', ')}`,
    ).toEqual([])
  })
})
