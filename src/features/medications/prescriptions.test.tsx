import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import {
  PRN_WITHOUT_MAXIMUM,
  medications,
  medicationsFor,
} from '@/data/fixtures/medications'
import type { ResidentId } from '@/data/types'
import { MarChartRoute } from './MarChartRoute'
import { MedicationsTab } from './MedicationsTab'
import { PrescriptionsTab } from './PrescriptionsTab'
import { hasUnenforceable, requirementsFor } from './requirements'
import { joinTimes, quantityWithUnit, unitFor } from './units'
import { pluralise } from '@/lib/format'

/**
 * What was prescribed. PRD §5.3, §6.4.
 *
 * What is under test is the block: that a prescription states what following
 * it requires of somebody, and that where a requirement cannot be met because
 * something is unrecorded the block says so and turns critical.
 */

/** The resident who carries the PRN with no 24-hour maximum. */
const GAP_RESIDENT = medications.find(
  (med) => med.id === PRN_WITHOUT_MAXIMUM,
)!.residentId

function renderPrescriptions(residentId: ResidentId = GAP_RESIDENT) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          {
            path: 'medications',
            element: <MedicationsTab />,
            children: [
              { index: true, element: <MarChartRoute /> },
              { path: 'prescriptions', element: <PrescriptionsTab /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [`/residents/${residentId}/medications/prescriptions`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const loaded = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-requires]')).toBeTruthy())
  return container
}

describe('the fixture reaches the state', () => {
  it('has exactly one PRN with no 24-hour maximum', () => {
    // Every PRN was in this state before the field existed, which would have
    // fired the critical block on all 23 of them. A warning that fires on
    // everything is indistinguishable from a screen that always looks like
    // that — the alarm right, and nobody able to act on it.
    const missing = medications.filter(
      (med) => med.isPrn && med.maximumIn24Hours.kind === 'not_recorded',
    )
    expect(missing.map((med) => med.id)).toEqual([PRN_WITHOUT_MAXIMUM])

    const prn = medications.filter((med) => med.isPrn)
    expect(prn.length).toBeGreaterThan(5)
  })

  it('says the schedule is the limit rather than leaving scheduled drugs blank', () => {
    // `not_applicable` is a claim, not an absence: this drug is given at fixed
    // times and there is no separate ceiling.
    for (const med of medications.filter((entry) => !entry.isPrn)) {
      expect(med.maximumIn24Hours.kind).toBe('not_applicable')
    }
  })
})

describe('what this requires of you', () => {
  it('states the obligation, not just the data', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    const blocks = container.querySelectorAll('[data-requires]')
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block.textContent).toMatch(/What this requires of you/)
      expect(block.querySelectorAll('li').length).toBeGreaterThan(0)
    }
  })

  it('turns critical where a requirement cannot be met', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    const blocked = container.querySelector('[data-requires="unenforceable"]')!
    expect(blocked).toBeTruthy()

    // It says which requirement, and why it cannot run — not merely that
    // something is missing.
    expect(blocked.textContent).toMatch(/and what is missing/)
    expect(blocked.textContent).toMatch(/No 24-hour maximum is recorded/)
    expect(blocked.textContent).toMatch(/check the prescription before a further dose/)
  })

  it('leaves the other prescriptions uncritical', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    // A block that fires on every card is the volume failure: right, and
    // unactionable. Exactly one card on this resident carries it.
    const all = container.querySelectorAll('[data-requires]')
    const blocked = container.querySelectorAll('[data-requires="unenforceable"]')
    expect(blocked.length).toBe(1)
    expect(all.length).toBeGreaterThan(blocked.length)
  })

  it('derives the requirement from the drug rather than storing a sentence', () => {
    const controlled = medications.find((med) => med.isControlledDrug)!
    const ordinary = medications.find(
      (med) => !med.isControlledDrug && !med.isPrn && med.intervalDays === 1,
    )!
    const patch = medications.find((med) => med.stockUnit === 'patches')!

    // Change what the drug is and the obligation changes with it, because it
    // was never a sentence somebody remembered to write.
    expect(requirementsFor(controlled).some((r) => /Two signatures/.test(r.text))).toBe(
      true,
    )
    expect(requirementsFor(ordinary).some((r) => /Two signatures/.test(r.text))).toBe(
      false,
    )
    expect(requirementsFor(patch).some((r) => /Rotate the site/.test(r.text))).toBe(
      true,
    )
    expect(
      requirementsFor(patch).some((r) => /not due: that is the schedule/.test(r.text)),
    ).toBe(true)
  })

  it('marks only the unenforceable requirement, not the whole list', () => {
    const gap = medications.find((med) => med.id === PRN_WITHOUT_MAXIMUM)!
    const requirements = requirementsFor(gap)

    expect(hasUnenforceable(requirements)).toBe(true)
    // The block turns because the list has a hole in it; the items that are
    // enforceable are still enforceable.
    expect(requirements.filter((r) => r.unenforceable).length).toBe(1)
    expect(requirements.filter((r) => !r.unenforceable).length).toBeGreaterThan(0)
  })

  it('counts a recorded maximum as a requirement rather than a gap', () => {
    const withMax = medications.find(
      (med) => med.isPrn && med.maximumIn24Hours.kind === 'recorded',
    )!
    const requirements = requirementsFor(withMax)
    expect(hasUnenforceable(requirements)).toBe(false)
    expect(requirements.some((r) => /No more than .* in 24 hours/.test(r.text))).toBe(
      true,
    )
  })
})

describe('the fields', () => {
  it('never renders a missing field as blank or as a dash', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    for (const field of container.querySelectorAll('[class*="fieldValue"]')) {
      const text = field.textContent!.trim()
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toBe('—') // dash-ok: asserts the dash is absent
      expect(text).not.toBe('-')
    }
  })

  it('says what a missing field means, not only that it is missing', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    const unrecorded = container.querySelectorAll('[data-state="unrecorded"]')
    expect(unrecorded.length).toBeGreaterThan(0)
    for (const gap of unrecorded) {
      // A label alone is a blank with a word on it.
      expect(gap.textContent!.length).toBeGreaterThan('Not recorded'.length)
    }
  })

  it('never leaves the schedule column empty', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    for (const schedule of container.querySelectorAll(
      '[class*="prescriptionSchedule"]',
    )) {
      expect(schedule.textContent).toMatch(
        /every day|every \d+ days|available when needed/,
      )
    }
  })
})

describe('quantities read as a person writes them', () => {
  it('loses the plural at one and closes up millilitres', () => {
    // "1 tablets" is not a clinical figure. It was fixed on the register and
    // written again from scratch on this card, so there is one formatter now.
    expect(quantityWithUnit(1, 'tablets')).toBe('1 tablet')
    expect(quantityWithUnit(2, 'tablets')).toBe('2 tablets')
    expect(quantityWithUnit(1, 'patches')).toBe('1 patch')
    expect(quantityWithUnit(1.25, 'ml')).toBe('1.25ml')
  })

  it('joins round times with a comma and a final and', () => {
    expect(joinTimes(['08:00'])).toBe('08:00')
    expect(joinTimes(['08:00', '20:00'])).toBe('08:00 and 20:00')
    expect(joinTimes(['08:00', '14:00', '20:00'])).toBe('08:00, 14:00 and 20:00')
  })

  it('does not print the measured quantity twice where it is the dose', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    // "2 puffs · 2 puffs measured" says one thing twice.
    for (const field of container.querySelectorAll('[class*="field_"]')) {
      if (!field.textContent!.startsWith('Dose')) continue
      const measured = field.textContent!.match(/(.+) measured$/)
      if (!measured) continue
      expect(field.textContent).not.toContain(`${measured[1]} ${measured[1]} measured`)
    }
  })
})

describe('the count line and the disabled action', () => {
  it('carries the figure with what it counts', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    const line = container.querySelector('[class*="countLine"]')!
    const prescribed = medicationsFor(GAP_RESIDENT)
    expect(line.textContent).toMatch(
      new RegExp(`${prescribed.length} medications? prescribed`),
    )
    expect(line.textContent).toMatch(/controlled drugs?/)
    expect(line.textContent).toMatch(/as required/)
  })

  it('says what prescribing waits on, rather than promising a phase', async () => {
    const user = userEvent.setup()
    const { container } = renderPrescriptions()
    await loaded(container)

    const add = screen.getByRole('button', { name: /Add medication/ })
    expect(add).toBeDisabled()
    await user.hover(add.parentElement!)
    /*
     * "Coming in a later phase" was a promise, and this is not waiting on a
     * phase: prescribing is a prescriber's act and the build has no prescriber.
     * The same distinction as "not held here" — a gap somebody can close
     * against one nothing on any screen can.
     */
    await waitFor(() =>
      expect(screen.getAllByText(/records prescriptions/).length).toBeGreaterThan(0),
    )
  })
})

describe('the sub-tabs', () => {
  it('offers Chart and Prescriptions, with Prescriptions current', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    const strip = screen.getByRole('navigation', { name: 'Medications' })
    expect(within(strip).getByRole('link', { name: 'Chart' })).toBeTruthy()
    expect(within(strip).getByRole('link', { name: 'Prescriptions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('keeps the subject header mounted across both', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    // §2.4 — the write surface's subject never collapses, and the sub-tab is
    // a layout route so it is not rebuilt per screen.
    //
    // Asserted on the elements that hold the claim rather than on the page's
    // `textContent`: the header is a definition list, so "Room" and "14" are a
    // `dt` and a `dd` and the concatenation reads "Room14" (§8).
    const room = [...container.querySelectorAll('dt')].find(
      (term) => term.textContent === 'Room',
    )
    expect(room, 'the subject header does not name the room').toBeTruthy()
    expect(room!.nextElementSibling?.textContent?.trim().length).toBeGreaterThan(0)
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)
    const panel = container.querySelector('[class*="subTabPanel"]') as HTMLElement
    expect((await axe(panel)).violations).toEqual([])
  }, 60000)
})

describe('one function owns how a figure meets its word', () => {
  it('agrees the unit with the balance beneath it, not only inline', () => {
    // The register stacks the figure over its unit, so `quantityWithUnit`
    // cannot be used there — but the rule about which word goes with which
    // number is the same rule. Written at the call site it gave "1 patches".
    expect(unitFor(1, 'patches')).toBe('patch')
    expect(unitFor(2, 'patches')).toBe('patches')
    expect(unitFor(1, 'ml')).toBe('ml')
    expect(unitFor(96.75, 'ml')).toBe('ml')
  })

  it('agrees a plain count with its word', () => {
    expect(pluralise(1, 'day')).toBe('1 day')
    expect(pluralise(14, 'day')).toBe('14 days')
    expect(pluralise(0, 'day')).toBe('0 days')
    expect(pluralise(1, 'dose')).toBe('1 dose')
  })

  it('never writes a bare unit beside a balance on the register', async () => {
    const { container } = renderPrescriptions()
    await loaded(container)

    // "28 ml" is not how a volume is written and "1 tablets" is not a clinical
    // figure. Both came from formatting at the call site.
    expect(container.textContent).not.toMatch(/\d\s+ml\b/)
    expect(container.textContent).not.toMatch(/\b1 (tablets|patches|capsules|puffs)\b/)
  })
})
