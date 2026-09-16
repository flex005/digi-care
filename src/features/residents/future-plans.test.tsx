import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { FuturePlansTab } from './FuturePlansTab'
import { FUTURE_PLANS_SECTIONS, FUTURE_PLAN_ENTRIES } from './future-plans-sections'

/**
 * Future Plans. PRD §6.2.
 *
 * Two things are under test that are not under test anywhere else:
 *
 *  1. The resuscitation decision has three states and the third is rendered
 *     loudly. §2.1 — "for DNAR the same ambiguity is catastrophic in both
 *     directions". A missing badge must never read as either answer.
 *  2. The change confirmation names the resident and the site whose staff are
 *     notified. §2.4 — never "Are you sure?".
 */

function renderPlans(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'future-plans', element: <FuturePlansTab /> }],
      },
    ],
    { initialEntries: [`/residents/${id}/future-plans`] },
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

describe('every entry is declared, and none can go missing', () => {
  it('covers all eight members of FuturePlans', () => {
    // Seven entries plus the resuscitation decision, which is the banner
    // rather than a row — eight facts, all rendered.
    expect(FUTURE_PLAN_ENTRIES).toHaveLength(7)
    expect(FUTURE_PLANS_SECTIONS).toHaveLength(3)
    expect(FUTURE_PLANS_SECTIONS.filter((s) => s.banner !== undefined)).toHaveLength(1)
  })

  it('gives every entry a unique id', () => {
    const ids = FUTURE_PLAN_ENTRIES.map((entry) => entry.id)
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
    for (const section of FUTURE_PLANS_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.title} has an empty description`,
      ).not.toBe('')
      expect(section.description).not.toMatch(/^\d+ /)
    }
  })

  it.each(residents.map((resident) => [resident.fullLegalName, resident.id] as const))(
    '%s: every entry renders something',
    async (name, id) => {
      const { container } = renderPlans(id)
      await waitFor(() =>
        expect(container.querySelector('[data-field]')).toBeInTheDocument(),
      )
      for (const entry of FUTURE_PLAN_ENTRIES) {
        const cell = container.querySelector(`[data-field="${entry.id}"]`)
        expect(cell, `${name}: "${entry.id}" is missing`).toBeTruthy()
        expect(cell?.textContent?.trim()).not.toBe('')
        expect(cell?.textContent?.trim()).not.toBe('—') // dash-ok: asserts the dash is absent
      }
      // And the decision that is not a row.
      expect(container.querySelector('[data-resuscitation]')).toBeTruthy()
    },
  )
})

describe('the resuscitation decision', () => {
  it('renders a DNAR as a recorded decision, not as good or bad news', async () => {
    const { container } = renderPlans('res-okafor')
    await waitFor(() =>
      expect(
        container.querySelector('[data-resuscitation="dnar_in_place"]'),
      ).toBeTruthy(),
    )
    // Said twice by design — once on the header's risk flag, once in this
    // tab's panel. Both are load-bearing, so this scopes to the panel rather
    // than counting copies of the string.
    const panel = container.querySelector('[data-resuscitation]')
    expect(panel?.textContent).toMatch(/DNAR in place/)
    expect(panel?.textContent).toMatch(/Do not attempt cardiopulmonary resuscitation/)
    // Signed, and by whom — a DNAR's signatory is a clinician, not a member
    // of staff in this system.
    expect(panel?.textContent).toMatch(/Signed by Dr/)
  })

  it('renders "for resuscitation" as a decision somebody made', async () => {
    const { container } = renderPlans('res-adeyemi')
    await waitFor(() =>
      expect(
        container.querySelector('[data-resuscitation="for_resuscitation"]'),
      ).toBeTruthy(),
    )
    const panel = container.querySelector('[data-resuscitation]')
    expect(panel?.textContent).toMatch(/For resuscitation/)
    expect(panel?.textContent).toMatch(/CPR is to be attempted/)
  })

  it('hatches an absent decision and says what happens without one', async () => {
    // Arthur Pemberton — nobody has recorded a resuscitation decision.
    const { container } = renderPlans('res-pemberton')
    await waitFor(() =>
      expect(
        container.querySelector('[data-resuscitation="no_decision_recorded"]'),
      ).toBeTruthy(),
    )
    const panel = container.querySelector('[data-resuscitation]')
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // The part a reader cannot infer: an absent decision is not neutral.
    expect(panel?.textContent).toMatch(/In the absence of a decision CPR is attempted/i)
  })
})

describe('changing a DNAR', () => {
  it('names the resident, and promises no notification', async () => {
    const user = userEvent.setup()
    renderPlans('res-okafor')
    const trigger = await screen.findByRole('button', {
      name: 'Change resuscitation decision',
    })
    await user.click(trigger)

    const dialog = await screen.findByRole('alertdialog')
    // §2.4 — the subject is in the sentence, never "Are you sure?".
    expect(dialog.textContent).toMatch(
      /Change the resuscitation decision for Emmanuel\?/,
    )
    expect(dialog.textContent).toMatch(/overrides a signed clinical decision/)
    // A departure from PRD §6.2: nothing notifies anybody, so the confirmation
    // does not say staff are notified. The toast afterwards names the site.
    expect(dialog.textContent).not.toMatch(/notified/)
  }, 20000)

  it('writes nothing, and says so rather than faking a save', async () => {
    const user = userEvent.setup()
    renderPlans('res-okafor')
    await user.click(
      await screen.findByRole('button', { name: 'Change resuscitation decision' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Change decision' }))

    await waitFor(() =>
      expect(screen.getByText(/No change was made to Emmanuel's record/)).toBeVisible(),
    )
    expect(
      screen.getByText(/Nobody on shift at Rosewood Court was notified/),
    ).toBeVisible()
  }, 20000)
})

describe('every entry is date-stamped, signed and version-controlled', () => {
  it('shows all three on a recorded entry', async () => {
    const withPlan = residents.find(
      (r) => r.futurePlans.advanceCarePlan.kind === 'recorded',
    )!
    const { container } = renderPlans(withPlan.id)
    await waitFor(() =>
      expect(container.querySelector('[data-field="advance-care-plan"]')).toBeTruthy(),
    )
    const cell = container.querySelector('[data-field="advance-care-plan"]')
    expect(cell?.textContent).toMatch(/Signed by/)
    expect(cell?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    // Shown even at version 1 — a number that only appears once it is
    // interesting teaches nothing the first time.
    expect(cell?.textContent).toMatch(/version \d+/)
  })
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderPlans('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderPlans('res-pemberton')
    await waitFor(() => expect(screen.getByText('In an emergency')).toBeVisible())
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
