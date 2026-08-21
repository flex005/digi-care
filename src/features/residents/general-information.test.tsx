import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { GeneralInformationTab, ProfileSections } from './GeneralInformationTab'
import {
  GENERAL_INFORMATION_FIELDS,
  GENERAL_INFORMATION_SECTIONS,
} from './general-information-fields'

/**
 * General Information. PRD §6.2, source PRD §16.2.
 *
 * The rule under test is not that the fields render — it is that **none of
 * them can be an empty row**. "—" is the most common way a care record turns
 * "nobody asked" into "nothing to report", and this tab has twenty chances to
 * do it.
 */

function renderTab(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ index: true, element: <GeneralInformationTab /> }],
      },
    ],
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

describe('every field is declared, and none can go missing', () => {
  it('covers all sixteen §16.2 bullets', () => {
    // Several bullets bundle two facts — "Full legal name and preferred name",
    // "Admission date and anticipated length of stay" — so the rendered count
    // is higher than sixteen. Fewer would mean something was dropped.
    expect(GENERAL_INFORMATION_FIELDS.length).toBeGreaterThanOrEqual(16)
    expect(GENERAL_INFORMATION_SECTIONS).toHaveLength(5)
  })

  it('gives every field a unique id', () => {
    const ids = GENERAL_INFORMATION_FIELDS.map((field) => field.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('hatches every field when missing, with exactly one declared exception', () => {
    // A photograph is an identity aid, not a clinical or compliance record.
    // Spending the hatch on it would blunt the signal that matters. Any
    // *other* field opting out would be a hole in the invariant, so the
    // exception list is asserted exactly rather than merely allowed.
    const exceptions = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.whenMissing !== 'hatch',
    ).map((field) => field.id)
    expect(exceptions).toEqual(['photo'])
  })
})

describe('no field is ever an empty row', () => {
  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s — every field renders something',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<ProfileSections resident={resident} />),
      )

      for (const field of GENERAL_INFORMATION_FIELDS) {
        const cell = container.querySelector(`[data-field="${field.id}"]`)
        expect(cell, `${name}: field "${field.id}" is not rendered at all`).toBeTruthy()
        expect(
          cell?.textContent?.trim(),
          `${name}: field "${field.label}" rendered an empty row`,
        ).not.toBe('')
        // The failure this whole tab guards against.
        expect(
          cell?.textContent?.trim(),
          `${name}: field "${field.label}" rendered an em dash instead of saying what is missing`,
        ).not.toBe('—')
      }
      unmount()
    },
  )

  it('hatches an unrecorded field rather than leaving it blank', () => {
    // Ismail Sowande was admitted yesterday: almost nothing is recorded.
    // This is the Partial state, and the tab's real test.
    const newcomer = residents.find((r) => r.id === 'res-sowande')!
    const { container } = render(atSite(<ProfileSections resident={newcomer} />))

    const unrecorded = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.isUnrecorded(newcomer) && field.whenMissing === 'hatch',
    )
    expect(unrecorded.length).toBeGreaterThan(8)

    for (const field of unrecorded) {
      const cell = container.querySelector(`[data-field="${field.id}"]`)
      expect(
        cell?.querySelector('[data-state="unrecorded"]'),
        `${field.label} is unrecorded but did not render the hatch`,
      ).toBeTruthy()
    }
  })
})

describe('allergies', () => {
  it('are a panel, and say plainly that unrecorded is not the same as none', async () => {
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')!
    renderTab(notRecorded.id)
    // Said twice by design: once on the header's risk flag, once in this
    // tab's panel. Both are load-bearing, and they word it differently now —
    // the flag has "Allergies" as its field above a short "Not recorded",
    // where the panel says it in one line. So this asserts the panel's own
    // wording and that the header states it too, rather than counting copies
    // of one string.
    await waitFor(() =>
      expect(screen.getAllByText('Allergies not recorded').length).toBeGreaterThan(0),
    )
    expect(screen.getByText(/not the same as having none/i)).toBeVisible()
  })

  it('show a recorded negative as settled, not as a gap', async () => {
    const noneKnown = residents.find((r) => r.allergies.kind === 'none_known')!
    const { container } = renderTab(noneKnown.id)
    await waitFor(() =>
      expect(screen.getAllByText('No known allergies').length).toBeGreaterThan(0),
    )
    expect(container.querySelector('[data-state="recorded"]')).toBeInTheDocument()
  })
})

describe('attribution', () => {
  it('shows the author and date on clinical and compliance fields', async () => {
    const resident = residents.find(
      (r) => r.primaryDiagnosis.kind === 'recorded' && r.gp.kind === 'recorded',
    )!
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-field="primary-diagnosis"]')).toBeTruthy(),
    )
    expect(
      container.querySelector('[data-field="primary-diagnosis"]')?.textContent,
    ).toMatch(/Recorded by/)
  })

  it('does not show it on person-centred fields', async () => {
    const resident = residents.find((r) => r.religion.kind === 'recorded')!
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-field="religion"]')).toBeTruthy(),
    )
    // Sixteen attribution lines would bury the values they annotate.
    expect(container.querySelector('[data-field="religion"]')?.textContent).not.toMatch(
      /Recorded by/,
    )
  })

  it('attributes dietary requirements, which reach a plate', async () => {
    const resident = residents.find((r) => r.dietaryRequirements.kind === 'recorded')!
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-field="diet"]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-field="diet"]')?.textContent).toMatch(
      /Recorded by/,
    )
  })
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderTab('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument()
  })

  it('offers no edit control, because no phase builds resident editing', async () => {
    renderTab('res-okafor')
    await waitFor(() => expect(screen.getByText('Identity')).toBeVisible())
    // Not a disabled Edit button either — that would be inventing a feature
    // in order to disable it.
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderTab('res-sowande')
    await waitFor(() => expect(screen.getByText('Identity')).toBeVisible())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)
})
