import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { BadgeStrip } from './BadgeStrip'
import { BADGE_STRIP_SOURCES } from './badge-strip-sources'

/**
 * The profile header. PRD §2.4, §6.2, §16.3.
 *
 * This is the point-of-care surface and the one every write surface carries,
 * so what is pinned here is that nothing about a person's safety can be left
 * to inference — the opposite of the residents list, which runs on a declared
 * convention because it is a management index.
 */

function renderProfile(id: string) {
  const router = createMemoryRouter(
    [{ path: '/residents/:residentId', element: <ResidentProfileRoute /> }],
    { initialEntries: [`/residents/${id}`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const atSite = (ui: React.ReactNode) => (
  <SiteTimeZone timeZone="Europe/London">{ui}</SiteTimeZone>
)

describe('the badge strip draws every state, for every resident', () => {
  /**
   * The list narrows and relies on a convention. The header may not. A care
   * worker reads this in seconds before entering a room (PRD §1), and §2.1
   * calls the DNAR ambiguity "catastrophic in both directions".
   */
  it('declares five badges, and the strip is built from that declaration', () => {
    expect(BADGE_STRIP_SOURCES).toHaveLength(5)
  })

  it('renders all five badges for all 32 residents, whatever their states', () => {
    for (const resident of residents) {
      const { container, unmount } = render(atSite(<BadgeStrip resident={resident} />))
      const strip = within(container).getByRole('list', { name: 'Risk flags' })
      expect(
        within(strip).getAllByRole('listitem'),
        `${resident.fullLegalName} is missing a flag`,
      ).toHaveLength(BADGE_STRIP_SOURCES.length)

      // Every badge says something. None of them is an empty slot.
      for (const item of within(strip).getAllByRole('listitem')) {
        expect(item.textContent?.trim()).not.toBe('')
      }
      unmount()
    }
  })

  it('shows a recorded negative differently from a gap and from a finding', () => {
    // PRD §6.2's three-way allergy distinction, on real residents. The three
    // now read as a field, an answer and an attribution rather than a pill, so
    // these assert the card's whole text — the distinction is what matters,
    // not the phrasing of any one line.
    const noneKnown = residents.find((r) => r.allergies.kind === 'none_known')!
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')!
    const hasAllergies = residents.find((r) => r.allergies.kind === 'allergies')!

    const settled = render(atSite(<BadgeStrip resident={noneKnown} />))
    const settledCard = settled.container.querySelector('[data-state="recorded"]')
    // A recorded negative is settled, not hatched — and it still says a person
    // recorded it, which is what makes it a record rather than an absence.
    expect(settledCard?.textContent).toContain('Allergies')
    expect(settledCard?.textContent).toContain('None known')
    settled.unmount()

    const gap = render(atSite(<BadgeStrip resident={notRecorded} />))
    const gapCard = gap.container.querySelector('[data-state="unrecorded"]')
    expect(gapCard).toBeInTheDocument()
    expect(gapCard?.textContent).toContain('Allergies')
    expect(gapCard?.textContent).toContain('Not recorded')
    // The words, not the hatch, carry it — the card says what is missing.
    expect(gapCard?.textContent).toMatch(/nobody has recorded/i)
    gap.unmount()

    render(atSite(<BadgeStrip resident={hasAllergies} />))
    const substance =
      hasAllergies.allergies.kind === 'allergies'
        ? hasAllergies.allergies.items[0].substance
        : ''
    // Every substance named, never a count.
    expect(screen.getByText(new RegExp(substance))).toBeVisible()
  })

  it('draws "for resuscitation" here, unlike the list', () => {
    // The list folds the settled value into a claim. The header must not:
    // this is where somebody acts on it.
    const forResus = residents.find(
      (r) => r.resuscitation.kind === 'for_resuscitation',
    )!
    render(atSite(<BadgeStrip resident={forResus} />))
    expect(screen.getByText('For resuscitation')).toBeVisible()
  })
})

describe('the subject header', () => {
  it('takes its subject from the route parameter', async () => {
    renderProfile('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByText('Beryl Hutchinson')).toBeVisible()
  })

  it('carries the site, so it survives the top bar scrolling away', async () => {
    renderProfile('res-brennan')
    // Nathaniel Brennan is at Ashgrove, not the session's active site — the
    // header must name HIS site, never the selected one.
    await waitFor(() => expect(screen.getByText('Ashgrove Lodge')).toBeVisible())
  })

  it('states that nothing is due rather than showing an empty panel', async () => {
    renderProfile('res-hutchinson')
    const panel = await screen.findByLabelText('Medication due in the next 2 hours')
    expect(panel.textContent?.trim()).not.toBe('')
  })

  it('refuses to render a partial header for an unknown subject', async () => {
    renderProfile('res-nobody')
    expect(await screen.findByText(/could not be loaded/i)).toBeVisible()
    // No name, no badges — acting on the wrong subject is the failure this
    // header exists to prevent, so it shows nothing rather than something.
    expect(screen.queryByRole('list', { name: 'Risk flags' })).not.toBeInTheDocument()
  })
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderProfile('res-okafor')
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument(),
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)
})
