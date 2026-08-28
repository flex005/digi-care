import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { ImportantPeople, ImportantPerson, StaffRef } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { ImportantPeopleTab, PeopleSections } from './ImportantPeopleTab'
import { PrimaryContactPanel, primaryContactsIn } from './PrimaryContactPanel'
import {
  IMPORTANT_PEOPLE_CATEGORIES,
  IMPORTANT_PEOPLE_SECTIONS,
} from './important-people-sections'

/**
 * Important People. PRD §6.2, source PRD §16.2.
 *
 * The failure this tab is exposed to is a missing category, not a blank field.
 * "No advocate recorded" and "assessed as not needing one" are the same empty
 * space if the row simply is not there.
 */

function renderPeople(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'people', element: <ImportantPeopleTab /> }],
      },
    ],
    { initialEntries: [`/residents/${id}/people`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

/*
 * A router, because these sections link into the document library from
 * Phase 16 onwards and a section rendered without one is a section rendered
 * somewhere the app never puts it.
 */
const atSite = (ui: React.ReactNode) => (
  <TooltipProvider>
    <ToastProvider>
      <SiteTimeZone timeZone="Europe/London">
        <RouterProvider
          router={createMemoryRouter([{ path: '/', element: <>{ui}</> }], {
            initialEntries: ['/'],
          })}
        />
      </SiteTimeZone>
    </ToastProvider>
  </TooltipProvider>
)

describe('every category is declared, and none can go missing', () => {
  it('covers all seven members of ImportantPeople', () => {
    expect(IMPORTANT_PEOPLE_CATEGORIES).toHaveLength(7)
    expect(IMPORTANT_PEOPLE_SECTIONS).toHaveLength(3)
  })

  it('gives every category a unique id', () => {
    const ids = IMPORTANT_PEOPLE_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /**
   * A description is optional now, and that is the rule under test: one
   * belongs on a section only where a reader would misread it without one.
   * Most headings do not, and a description that restates its own heading is
   * a line between the reader and the record.
   *
   * So this asserts the shape of the ones that exist rather than demanding
   * one everywhere: plain English, never a bare count of the section's own
   * rows, which told the reader nothing they could not already see.
   */
  it('keeps any section description in words, never as a count of its own rows', () => {
    for (const section of IMPORTANT_PEOPLE_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.title} has an empty description`,
      ).not.toBe('')
      expect(section.description).not.toMatch(/^\d+ /)
    }
  })
})

describe('no category is ever an empty row', () => {
  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s: every category renders something',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<PeopleSections resident={resident} />),
      )

      for (const category of IMPORTANT_PEOPLE_CATEGORIES) {
        const cell = container.querySelector(`[data-field="${category.id}"]`)
        expect(cell, `${name}: "${category.id}" is not rendered at all`).toBeTruthy()
        expect(
          cell?.textContent?.trim(),
          `${name}: "${category.label}" rendered an empty row`,
        ).not.toBe('')
        expect(
          cell?.textContent?.trim(),
          `${name}: "${category.label}" rendered an em dash`,
        ).not.toBe('—') // dash-ok: asserts the dash is absent
      }
      unmount()
    },
  )

  it('hatches an unrecorded category and says what the gap costs', () => {
    // Ismail Sowande, admitted yesterday. Almost nothing is recorded.
    const newcomer = residents.find((r) => r.id === 'res-sowande')!
    const { container } = render(atSite(<PeopleSections resident={newcomer} />))

    const missing = IMPORTANT_PEOPLE_CATEGORIES.filter((category) =>
      category.isUnrecorded(newcomer.importantPeople),
    )
    expect(missing.length).toBeGreaterThan(3)

    for (const category of missing) {
      const cell = container.querySelector(`[data-field="${category.id}"]`)
      expect(
        cell?.querySelector('[data-state="unrecorded"]'),
        `${category.label} is unrecorded but did not render the hatch`,
      ).toBeTruthy()
      // Not just "not recorded" — what the absence costs. This is the tab
      // where every gap has a consequence and none of them is obvious from
      // the field name. Asserted structurally rather than on the words, so
      // the copy can be rewritten without rewriting the guard.
      const detail = cell?.querySelector('[data-unrecorded-detail]')
      expect(
        detail?.textContent?.trim(),
        `${category.label} does not say what the gap costs`,
      ).toBeTruthy()
    }
  })
})

describe('who this home rings first', () => {
  const staff: StaffRef = {
    id: 'staff-1',
    displayName: 'A. Okonkwo',
    fullName: 'Adaeze Okonkwo',
    role: 'registered_manager',
    isActive: true,
  }

  const person = (name: string, isPrimaryContact: boolean): ImportantPerson => ({
    name,
    relationship: 'Daughter',
    contact: { phone: '07700 900000', email: 'family@example.invalid' },
    address: '1 Test Road, Thornfield',
    isPrimaryContact,
    communicationPreference: { kind: 'unrecorded' },
  })

  const people = (overrides: Partial<ImportantPeople>): ImportantPeople => ({
    nextOfKin: { kind: 'unrecorded' },
    emergencyContact: { kind: 'unrecorded' },
    lpaHolder: { kind: 'unrecorded' },
    socialWorker: { kind: 'unrecorded' },
    advocate: { kind: 'unrecorded' },
    familyWithVisitingRights: { kind: 'not_recorded' },
    otherProfessionals: { kind: 'not_recorded' },
    ...overrides,
  })

  const recordedAt = '2026-03-12T09:00:00Z' as const

  it('names the one person who holds it', () => {
    const { container } = render(
      atSite(
        <PrimaryContactPanel
          people={people({
            nextOfKin: {
              kind: 'recorded',
              value: person('Helen Adeleke', true),
              recordedBy: staff,
              recordedAt,
            },
          })}
          residentName="Emmanuel"
        />,
      ),
    )
    expect(container.querySelector('[data-primary-contact="recorded"]')).toBeTruthy()
    expect(screen.getByText('Helen Adeleke')).toBeVisible()
  })

  it('hatches it when nobody holds it, rather than showing nothing', () => {
    const { container } = render(
      atSite(<PrimaryContactPanel people={people({})} residentName="Ismail" />),
    )
    expect(container.querySelector('[data-primary-contact="none"]')).toBeTruthy()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(
      screen.getByText(/not the same as there being nobody to ring/i),
    ).toBeVisible()
  })

  it('has a resident in the fixtures with nobody holding it', async () => {
    /*
     * A state that only exists in a unit test is a state nobody reviews, so
     * the fixture set has to reach it.
     *
     * **The property is asserted; the resident is derived.** It was pinned to
     * one id, which moved as soon as the generator's random stream shifted —
     * the id was never what this was about (§8).
     */
    const withNobody = residents.filter(
      (resident) => primaryContactsIn(resident.importantPeople).length === 0,
    )
    expect(
      withNobody.length,
      'no resident in the fixtures has nobody holding the primary contact',
    ).toBeGreaterThan(0)

    const { container } = renderPeople(withNobody[0]!.id)
    await waitFor(() =>
      expect(container.querySelector('[data-primary-contact]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-primary-contact="none"]')).toBeTruthy()
  })

  it('refuses to choose when two people are marked as primary', () => {
    // Cannot happen in the fixtures. The screen must not resolve a
    // contradiction the record contains — picking one silently is how the
    // wrong family member finds out.
    const { container } = render(
      atSite(
        <PrimaryContactPanel
          people={people({
            nextOfKin: {
              kind: 'recorded',
              value: person('Helen Adeleke', true),
              recordedBy: staff,
              recordedAt,
            },
            advocate: {
              kind: 'recorded',
              value: person('Daniel Okonjo', true),
              recordedBy: staff,
              recordedAt,
            },
          })}
          residentName="Emmanuel"
        />,
      ),
    )
    expect(container.querySelector('[data-primary-contact="conflict"]')).toBeTruthy()
    expect(screen.getByText(/Helen Adeleke.*Daniel Okonjo/s)).toBeVisible()
  })
})

describe('the primary contact control', () => {
  it('names both the person and the resident, and writes nothing', async () => {
    const user = userEvent.setup()
    renderPeople('res-okafor')
    const buttons = await screen.findAllByRole('button', {
      name: 'Make primary contact',
    })
    await user.click(buttons[0]!)

    // §2.4 — never "Are you sure?". The subject is in the sentence.
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toMatch(/the primary contact for Emmanuel\?/)
    expect(dialog.textContent).toMatch(/Whoever holds it now loses it/)

    /*
     * Scoped to the dialog. `screen.getByRole` for this name matched the
     * dialog's confirm *and* every row button behind it, and passed only
     * because Radix had already hidden the background from the accessibility
     * tree — which it had not always done by this point, so the query threw on
     * roughly one run in three. A name that more than one element can satisfy
     * is not a name.
     */
    await user.click(
      within(dialog).getByRole('button', { name: 'Make primary contact' }),
    )

    // And is honest about the half that does not exist yet, rather than
    // faking a save on a read-only fixture.
    await waitFor(() =>
      expect(screen.getByText(/No change was made to Emmanuel's record/)).toBeVisible(),
    )
    expect(screen.getByText(/only the write is missing/i)).toBeVisible()
  }, 20000)
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderPeople('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderPeople('res-sowande')
    await waitFor(() =>
      expect(screen.getByText('Family and next of kin')).toBeVisible(),
    )
    /**
     * Scoped to the panel under test, not the whole rendered page.
     *
     * These tests mount the profile route, so `container` also holds the
     * subject header, the tab strip and the shell — dragged through axe on
     * every pass by every tab. `profile.test.tsx` axes that shell once,
     * because it is the test that is about it; this one is about this tab.
     */
    const panel = container.querySelector('[class*="tabPanel"]') ?? container
    const results = await axe(panel)
    expect(results).toHaveNoViolations()
  }, 30000)
})
