import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { residentsBySite } from '@/data/fixtures/residents'
import { cycle, gapsAgainst } from '@/data/fixtures/medication-cycle'
import { queryRow, stopHere } from '@/data/access/cycle-store'
import { CycleRoute } from './CycleRoute'

/**
 * The pharmacy cycle. PRD §6.4.
 *
 * The screen's whole argument is that it is a comparison rather than a list,
 * and that each row is read on its own.
 */

function renderCycle() {
  const router = createMemoryRouter([{ path: '/', element: <CycleRoute /> }], {
    initialEntries: ['/'],
  })
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

const settled = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-cycle]')).toBeTruthy())

describe('every row is a change a prescriber already made', () => {
  it('names the prescriber and the date on every row', () => {
    /*
     * A care home that could invent a prescription would be the most dangerous
     * thing in this product. Every row carries whose decision it was recording.
     */
    for (const row of cycle.rows) {
      expect(row.prescriber, row.drug).toMatch(/^Dr /)
      expect(row.changedOn, row.drug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('finds what is on the MAR and not in the cycle, by comparing', () => {
    const residents = residentsBySite('site-rosewood-court').map((one) => one.id)
    const gaps = gapsAgainst(cycle.rows, residents)
    expect(gaps.length).toBeGreaterThan(0)

    const named = new Set(cycle.rows.map((row) => row.drug.toLowerCase()))
    for (const gap of gaps) {
      expect(named.has(gap.drug.toLowerCase()), gap.drug).toBe(false)
      expect(gap.rounds, gap.drug).not.toBe('')
      /*
       * The register's `form` is form *and* strength, so putting the dose in
       * front of it read "30mg · 30mg · capsules". A repeated segment is the
       * tell that two owners agreed the same fact.
       */
      const parts = gap.form.split(' · ')
      expect(new Set(parts).size, gap.form).toBe(parts.length)
    }
  })
})

describe('one click acts on one row', () => {
  it('offers exactly as many accept controls as there are rows, each naming its own', async () => {
    const { container } = renderCycle()
    await settled(container)

    /*
     * The guard against "accept all", stated as the property rather than as a
     * ban on a name: an assertion control that does not belong to exactly one
     * row is one click asserting medication changes nobody read.
     */
    const rows = [...container.querySelectorAll('[data-cycle-row]')].map((row) =>
      row.getAttribute('data-cycle-row'),
    )
    expect(rows.length).toBeGreaterThan(1)

    const accepts = [...container.querySelectorAll('[data-accept]')].map((control) =>
      control.getAttribute('data-accept'),
    )
    expect(accepts).toHaveLength(rows.length)
    expect([...new Set(accepts)]).toHaveLength(rows.length)
    for (const target of accepts) expect(rows, String(target)).toContain(target)
  })

  it('holds the cycle open after one row is accepted', async () => {
    const user = userEvent.setup()
    const { container } = renderCycle()
    await settled(container)

    const first = container.querySelector<HTMLButtonElement>('[data-accept]')!
    const target = first.getAttribute('data-accept')!
    await user.click(first)

    await waitFor(() =>
      expect(
        container
          .querySelector(`[data-cycle-row="${target}"]`)!
          .querySelector('[data-row-action="accepted"]'),
      ).toBeTruthy(),
    )

    // Every other row is exactly where it was, and the cycle cannot be closed.
    const outstanding = container.querySelectorAll('[data-accept]')
    expect(outstanding.length).toBeGreaterThan(0)
    expect(
      container.querySelector<HTMLButtonElement>('[data-close-cycle]')!.disabled,
    ).toBe(true)
  })

  it('refuses a query with no question and a stop with no reason', () => {
    /*
     * A query with nothing in it records that somebody was unhappy and not what
     * about, which is the same as not recording it.
     */
    expect(() => queryRow('cycle-guard-1', '  ', staffOkonkwo)).toThrow(/asked/i)
    expect(() => stopHere('cycle-guard-1', '', staffOkonkwo)).toThrow(/why/i)
  })
})

describe('the fourth tally is the finding', () => {
  it('hatches what is on the MAR and not in the cycle', async () => {
    const { container } = renderCycle()
    await settled(container)

    /*
     * A drug the home is still giving that the pharmacy has stopped supplying
     * appears on neither side's list. It cannot be a quiet count.
     */
    const gap = container.querySelector('[data-tally="gap"]')!
    expect(gap.getAttribute('data-state')).toBe('unrecorded')
    expect(container.querySelector('[data-cycle-gap]')).toBeTruthy()
  })

  it('carries a denominator on the count of what has been handled', async () => {
    const { container } = renderCycle()
    await settled(container)

    const state = container.querySelector('[data-cycle-state]')!
    expect(state.textContent).toMatch(/\d+ of \d+ handled/)
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderCycle()
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})
