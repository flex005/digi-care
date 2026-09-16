import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  /**
   * A description is optional now, and that is the rule under test: one
   * belongs on a section only where a reader would misread it without one.
   * Most headings do not, and a description restating its own heading is a
   * line between the reader and the record.
   *
   * So this asserts the shape of the ones that survive rather than demanding
   * one everywhere: plain English, never a bare count of the section's own
   * rows, which told the reader nothing they could not already see.
   */
  it('keeps any section description in words, never as a bare count', () => {
    for (const section of GENERAL_INFORMATION_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.title} has an empty description`,
      ).not.toBe('')
      expect(
        section.description,
        `${section.title} describes itself with a bare count`,
      ).not.toMatch(/^\d+ /)
    }
  })

  it('gives the two paragraph-length fields the full row', () => {
    // Four sentences of medical history in a column sized for "she / her" is
    // a grey ribbon nobody reads, and what nobody reads is functionally
    // missing.
    const full = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.width === 'full',
    ).map((field) => field.id)
    expect(full).toEqual(['medical-history', 'communication'])
  })

  it('puts the allergies banner on Clinical, and nowhere else', () => {
    const withBanner = GENERAL_INFORMATION_SECTIONS.filter(
      (section) => section.banner !== undefined,
    ).map((section) => section.id)
    expect(withBanner).toEqual(['clinical'])
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
    '%s: every field renders something',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<ProfileSections resident={resident} siteName="Rosewood Court" />),
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
        ).not.toBe('—') // dash-ok: asserts the dash is absent
      }
      unmount()
    },
  )

  it('hatches an unrecorded field rather than leaving it blank', () => {
    // Ismail Sowande was admitted yesterday: almost nothing is recorded.
    // This is the Partial state, and the tab's real test.
    const newcomer = residents.find((r) => r.id === 'res-sowande')!
    const { container } = render(
      atSite(<ProfileSections resident={newcomer} siteName="Rosewood Court" />),
    )

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
  it('sit above the Clinical fields, not among them', async () => {
    const withAllergies = residents.find((r) => r.allergies.kind === 'allergies')!
    const { container } = renderTab(withAllergies.id)
    await waitFor(() => expect(screen.getByText('Clinical')).toBeVisible())

    // Row twelve of sixteen reads like any other row. This is the one field
    // on the tab where being easy to miss has a body count, so it is a
    // full-width panel between the section header and the first field.
    const clinical = screen.getByText('Clinical').closest('section')!
    const panel = clinical.querySelector('[data-allergies]')
    expect(panel, 'the allergies panel is not inside the Clinical section').toBeTruthy()
    // Before the fields, not after them.
    const firstField = clinical.querySelector('[data-field]')!
    expect(
      panel!.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // And not a field row itself.
    expect(container.querySelector('[data-field="allergies"]')).toBeNull()
  })

  /**
   * The dead end this closes. DNAR and the primary contact both carried a
   * phase-tagged stub; allergies — the field §2.1 names as the one a blank
   * cell gets fatally wrong, and the one every medication screen reads — had
   * no control at all. A reader looking at "Not recorded" had nowhere to go
   * and nothing telling them the writing of it is simply unbuilt.
   */
  it('offer a way to record them, as DNAR and the primary contact do', async () => {
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')!
    renderTab(notRecorded.id)
    expect(
      await screen.findByRole('button', { name: /record allergies/i }),
    ).toBeVisible()
  })

  it('name the resident, and say what an unrecorded allergy means', async () => {
    const user = userEvent.setup()
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')!
    renderTab(notRecorded.id)
    await user.click(await screen.findByRole('button', { name: /record allergies/i }))

    // PRD §2.4: never "Are you sure?". And it says what an unrecorded allergy
    // means for whoever gives medication.
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain(notRecorded.preferredName)
    expect(dialog.textContent).toMatch(
      /must not be given on the assumption there are none/i,
    )
  }, 20000)

  it('offer a way to change a recorded allergy too', async () => {
    // The most consequential of the three to change, and it had no affordance
    // either.
    const withAllergies = residents.find((r) => r.allergies.kind === 'allergies')!
    renderTab(withAllergies.id)
    expect(
      await screen.findByRole('button', { name: /change allergy record/i }),
    ).toBeVisible()
  })

  it('say plainly that unrecorded is not the same as none', async () => {
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')!
    const { container } = renderTab(notRecorded.id)
    await waitFor(() => expect(screen.getByText('Clinical')).toBeVisible())

    const panel = container.querySelector('[data-allergies="not_recorded"]')
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // The field, then the answer, then why the answer is not "none". The
    // pattern is reinforcement; these words are the carrier.
    expect(panel?.textContent).toMatch(/Allergies and adverse reactions/)
    expect(panel?.textContent).toMatch(/Not recorded/)
    expect(
      screen.getByText(/not be given on the assumption there are none/i),
    ).toBeVisible()
    // The header's risk flag states it independently. Both are load-bearing.
    const flags = screen.getByRole('list', { name: 'Risk flags' })
    expect(flags.textContent).toMatch(/Allergies/)
    expect(flags.textContent).toMatch(/Nobody has recorded whether there are any/)
  })

  it('show a recorded negative as settled, not as a gap', async () => {
    const noneKnown = residents.find((r) => r.allergies.kind === 'none_known')!
    const { container } = renderTab(noneKnown.id)
    await waitFor(() =>
      expect(screen.getAllByText('No known allergies').length).toBeGreaterThan(0),
    )
    const panel = container.querySelector('[data-allergies="none_known"]')
    // Somebody asked and confirmed. Settled, with an author — never hatched.
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(panel?.textContent).toMatch(/Recorded by/)
  })

  it('name the substance, the reaction and the author when there are some', async () => {
    const withAllergies = residents.find((r) => r.allergies.kind === 'allergies')!
    const status = withAllergies.allergies
    if (status.kind !== 'allergies') throw new Error('fixture changed shape')
    const { container } = renderTab(withAllergies.id)
    await waitFor(() => expect(screen.getByText('Clinical')).toBeVisible())

    const panel = container.querySelector('[data-allergies="allergies"]')
    for (const allergy of status.items) {
      expect(panel?.textContent).toContain(allergy.substance)
      expect(panel?.textContent).toContain(allergy.reaction)
    }
    expect(panel?.textContent).toMatch(/Recorded by/)
  })
})

describe('the three answer types stay apart', () => {
  it('renders a value, a recorded negative and a gap differently in one section', async () => {
    /*
     * The resident who carries all three at once in Care team: a recorded GP,
     * a recorded "no consultants involved", and no pharmacy on file.
     *
     * **Derived, not named.** It was pinned to one id, and the id moved the
     * moment the fixture generator's random stream shifted — which it does for
     * any change to what is drawn. The property is what this test is about;
     * which resident happens to hold it is not (§8).
     */
    const subject = residents.find(
      (resident) =>
        resident.gp.kind === 'recorded' &&
        resident.consultants.kind === 'none_involved' &&
        resident.pharmacy.kind === 'unrecorded',
    )
    expect(
      subject,
      'no resident carries a value, a recorded negative and a gap at once',
    ).toBeTruthy()

    const { container } = renderTab(subject!.id)
    await waitFor(() =>
      expect(container.querySelector('[data-field="gp"]')).toBeTruthy(),
    )

    const gp = container.querySelector('[data-field="gp"]')
    const consultants = container.querySelector('[data-field="consultants"]')
    const pharmacy = container.querySelector('[data-field="pharmacy"]')

    // A recorded value: plain, with its author.
    expect(gp?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(gp?.textContent).toMatch(/Recorded by/)

    // A recorded NEGATIVE: settled, info-toned, with its author. Somebody
    // asked and confirmed — this is a claim, not an absence.
    expect(consultants?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(consultants?.querySelector('[data-tone="info"]')).toBeTruthy()
    expect(consultants?.textContent).toMatch(/No consultants or specialists involved/)
    expect(consultants?.textContent).toMatch(/Recorded by/)

    // A gap: hatched, saying what is missing.
    expect(pharmacy?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(pharmacy?.textContent).toMatch(/Pharmacy not recorded/)
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
    /*
     * Not a disabled Edit button either — that would be inventing a feature in
     * order to disable it.
     *
     * Anchored, because `/edit/i` matches "Edited by" and every other label
     * that merely contains the word: an absence assertion that can be
     * satisfied by something present is the shape that has gone wrong three
     * times in this build.
     */
    expect(screen.queryByRole('button', { name: /^Edit/i })).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderTab('res-sowande')
    await waitFor(() => expect(screen.getByText('Identity')).toBeVisible())
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
