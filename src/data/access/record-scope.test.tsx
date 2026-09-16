import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { residents } from '@/data/fixtures/residents'
import { staffAluko, staffOkonkwo } from '@/data/fixtures/organisation'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { getResident, getResidentsBySite, getRound } from './client'
import { isNotYours } from './record-not-yours'
import { resetViewerScope, setViewer, viewerHomes } from './viewer-scope'

/**
 * A record is read at the home that holds it. Phase 29.
 *
 * **The switcher was the visible half.** A manager appointed to one home could
 * type another home's resident URL and read the whole profile: `getResident`
 * took an id and no home, and the shell's gate is per module rather than per
 * record. Every screen reading that record was wrong in the same way, which is
 * why the check is at the loader rather than on the route.
 *
 * **The assertion that matters is the one with a viewer set.** "No viewer
 * means no scope" is deliberate — every product screen sits behind the sign-in
 * gate, so a loader reached without one is a sign-in screen or a test — but it
 * is also exactly the shape somebody could satisfy the rule with by never
 * setting a viewer, and nothing would say so. So the refusals here are
 * asserted with a viewer set, by name.
 */

const ELSEWHERE = residents.find((r) => r.siteId === 'site-ashgrove-lodge')!
const THEIRS = residents.find((r) => r.siteId === 'site-rosewood-court')!

afterEach(() => resetViewerScope())

describe('a viewer who is set is refused another home’s records', () => {
  it('refuses a resident, naming the record’s home and the viewer’s', async () => {
    // Deborah Aluko is appointed to Rosewood Court and to nothing else.
    setViewer(staffAluko.id)
    expect(viewerHomes()).toEqual(['site-rosewood-court'])

    await expect(getResident(ELSEWHERE.id)).rejects.toSatisfy(isNotYours)
    await getResident(ELSEWHERE.id).catch((error: unknown) => {
      if (!isNotYours(error)) throw new Error('expected a refusal')
      /*
       * Both homes, because the panel names both. A refusal saying only "not
       * yours" leaves a reader unable to tell a mistake from a boundary.
       */
      expect(error.what).toContain(ELSEWHERE.fullLegalName)
      expect(error.home).toBe('Ashgrove Lodge')
      expect(error.yours).toEqual(['Rosewood Court'])
    })
  })

  it('refuses a home’s list and a home’s round, not only a resident', async () => {
    setViewer(staffAluko.id)
    await expect(getResidentsBySite('site-ashgrove-lodge')).rejects.toSatisfy(
      isNotYours,
    )
    await expect(getRound('site-ashgrove-lodge')).rejects.toSatisfy(isNotYours)
  })

  it('reads their own home exactly as before', async () => {
    setViewer(staffAluko.id)
    await expect(getResident(THEIRS.id)).resolves.toMatchObject({ id: THEIRS.id })
    await expect(getResidentsBySite('site-rosewood-court')).resolves.toBeInstanceOf(
      Array,
    )
  })

  it('lets an admin appointed to both read either', async () => {
    setViewer(staffOkonkwo.id)
    await expect(getResident(ELSEWHERE.id)).resolves.toMatchObject({ id: ELSEWHERE.id })
    await expect(getResident(THEIRS.id)).resolves.toMatchObject({ id: THEIRS.id })
  })

  it('scopes nothing when nobody is signed in', async () => {
    // A loader reached with no viewer is a sign-in screen or a test.
    expect(viewerHomes()).toBeUndefined()
    await expect(getResident(ELSEWHERE.id)).resolves.toMatchObject({ id: ELSEWHERE.id })
  })

  it('follows the record rather than a copy, when homes change mid-session', async () => {
    setViewer(staffAluko.id)
    await expect(getResident(ELSEWHERE.id)).rejects.toSatisfy(isNotYours)

    const { setSites } = await import('./team-store')
    setSites(staffAluko.id, ['site-rosewood-court', 'site-ashgrove-lodge'])
    /*
     * Derived at call time rather than copied at sign-in: an admin reassigning
     * somebody's homes takes effect on the next read, where a copied scope
     * would go stale at precisely the moment access changed.
     */
    await expect(getResident(ELSEWHERE.id)).resolves.toMatchObject({ id: ELSEWHERE.id })

    const { resetSessionTeam } = await import('./team-store')
    resetSessionTeam()
  })
})

describe('the pointer ends with the session that set it', () => {
  it('is cleared when the session provider goes, not only on sign-out', async () => {
    /*
     * A test signed in at Rosewood, its provider unmounted, and the next test
     * — signed in as nobody — was refused Ashgrove as that leftover viewer.
     */
    const { useSession } = await import('@/app/session/use-session')
    const { useEffect } = await import('react')
    function SignIn() {
      const { signInAs, sites } = useSession()
      useEffect(() => {
        signInAs(
          {
            ...residents[0]!,
            id: staffAluko.id,
            siteIds: ['site-rosewood-court'],
          } as never,
          sites[0]!,
        )
      }, [signInAs, sites])
      return null
    }
    const view = render(
      <SessionProvider>
        <SignIn />
      </SessionProvider>,
    )
    await waitFor(() => expect(viewerHomes()).toEqual(['site-rosewood-court']))
    view.unmount()
    expect(viewerHomes()).toBeUndefined()
  })
})

describe('the screen says which home the record belongs to', () => {
  it('renders the refusal rather than an error or a not-found', async () => {
    setViewer(staffAluko.id)
    const router = createMemoryRouter(
      [{ path: 'residents/:residentId', element: <ResidentProfileRoute /> }],
      { initialEntries: [`/residents/${ELSEWHERE.id}`] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )

    await waitFor(() =>
      expect(container.querySelector('[data-not-your-home]')).toBeTruthy(),
    )
    const panel = container.querySelector('[data-not-your-home]')!
    expect(panel.textContent).toContain('Ashgrove Lodge')
    expect(panel.textContent).toContain('Rosewood Court')

    /*
     * Not "could not be loaded", which would misdescribe a record that loaded
     * perfectly, and not a not-found, which would have the product lying about
     * what is on the record.
     */
    expect(container.textContent).not.toMatch(/could not be loaded/i)
    expect(container.textContent).not.toMatch(/did not resolve to a resident/i)
  }, 30000)
})
