import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import {
  GAP_MEDICATION_IDS,
  NEWLY_PRESCRIBED_CD,
  medications,
  movementsFor,
  stockCountsFor,
  marRecordsAll,
} from '@/data/fixtures/medications'
import { buildRegister, registerBalance, registerState } from './register'
import { MedicationsRoute } from './MedicationsRoute'
import { OmissionsRoute } from './OmissionsRoute'
import { RegisterRoute } from './RegisterRoute'
import { RegisterLedgerRoute } from './RegisterLedgerRoute'

/**
 * The controlled drug register. PRD §6.4.
 *
 * What is under test is the thing the register exists to protect: that a drug
 * nobody has counted and a drug whose count does not come out stay two
 * different findings, that the balance column adds up, and that a register
 * that was never opened does not render as an empty one.
 */

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/medications',
        element: <MedicationsRoute />,
        children: [
          { index: true, element: <OmissionsRoute /> },
          { path: 'register', element: <RegisterRoute /> },
          { path: 'register/:medicationId', element: <RegisterLedgerRoute /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const listed = async (container: HTMLElement) => {
  await waitFor(() =>
    expect(container.querySelector('[data-register-row]')).toBeTruthy(),
  )
  return container
}

describe('two findings, never one and never a sum', () => {
  it('renders them as separate cards with separate treatments', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    const findings = container.querySelectorAll('[class*="finding_"]')
    expect(findings.length).toBe(2)

    const discrepancy = container.querySelector('[class*="findingDiscrepancy"]')!
    const never = container.querySelector('[class*="findingNever"]')!
    expect(discrepancy.textContent).toMatch(/reconcile/)
    expect(never.textContent).toMatch(/never counted/i)

    // An absence is not a milder finding, so it does not take the finding's
    // treatment. The hatch and critical are different classes, not shades.
    expect(discrepancy.className).not.toBe(never.className)
  })

  it('gives both figures a denominator', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    // No bare counts anywhere (§4). "1" on its own is not a finding, it is a
    // digit — the denominator is what makes it one.
    for (const card of container.querySelectorAll('[class*="findingDetail"]')) {
      expect(card.textContent).toMatch(/Of \d[\d,]* controlled drugs? at /)
    }
  })

  it('puts the findings above the drugs that are fine', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    const states = [...container.querySelectorAll('[data-register-row]')].map((row) =>
      row.getAttribute('data-state'),
    )
    expect(states[0]).toBe('discrepancy')
    expect(states[1]).toBe('never_counted')
    // A register sorted by name buries the two rows somebody has to act on.
    expect(states.slice(2).every((state) => state === 'reconciled')).toBe(true)
  })
})

describe('the balance column', () => {
  it('carries its unit on every figure', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    // A controlled drug balance of 28 that could be millilitres or tablets is
    // a wrong clinical figure, so the figure never appears without its unit.
    const counted = container.querySelectorAll('[data-balance="counted"]')
    expect(counted.length).toBeGreaterThan(0)
    for (const cell of counted) {
      expect(cell.textContent).toMatch(/\d/)
      expect(cell.textContent).toMatch(/(ml|tablets|patches) remaining/)
    }
  })

  it('renders no balance as the hatched state, never a zero and never a dash', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    const none = container.querySelector('[data-balance="no_balance_recorded"]')!
    expect(none).toBeTruthy()
    expect(none.textContent).toMatch(/No balance/)
    expect(none.textContent).toMatch(/nobody has counted/)
    expect(none.textContent).not.toMatch(/^\s*0\s*$/)
    expect(none.textContent).not.toContain('—') // dash-ok: asserts the dash is absent
  })

  it('has more than one unit in the column, so the unit does its job', () => {
    // Sixteen drugs all counted in millilitres is the same problem as sixteen
    // drugs with one balance: the column the unit protects cannot be wrong,
    // so what it prevents is untestable.
    const units = new Set(
      medications.filter((med) => med.isControlledDrug).map((med) => med.stockUnit),
    )
    expect(units.size).toBeGreaterThan(1)
  })
})

describe('one drug’s ledger', () => {
  const discrepant = GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy

  it('adds up, entry by entry', () => {
    const medication = medications.find((med) => med.id === discrepant)!
    const entries = buildRegister(
      medication,
      stockCountsFor(discrepant),
      movementsFor(discrepant),
      marRecordsAll,
    )
    expect(entries.length).toBeGreaterThan(2)

    // Oldest first is the direction the arithmetic runs. A count sets the
    // balance; everything else moves it by its own quantity.
    const chronological = [...entries].reverse()
    let running = 0
    for (const [index, entry] of chronological.entries()) {
      if (entry.kind === 'opening_count' || entry.kind === 'routine_count') {
        running = entry.counted
      } else if (entry.kind === 'received') {
        running += entry.quantity
      } else {
        running -= entry.quantity
      }
      running = Math.round(running * 100) / 100
      expect(entry.balanceAfter, `entry ${index} (${entry.kind})`).toBe(running)
    }
  })

  it('starts at the opening count and holds nothing before it', () => {
    const medication = medications.find((med) => med.id === discrepant)!
    const entries = buildRegister(
      medication,
      stockCountsFor(discrepant),
      movementsFor(discrepant),
      marRecordsAll,
    )
    // Nothing before the balance existed can say what it left behind.
    expect(entries[entries.length - 1]!.kind).toBe('opening_count')
  })

  it('shows the discrepancy as a flagged row and explains it beneath the table', async () => {
    const { container } = renderAt(`/medications/register/${discrepant}`)
    await screen.findByRole('table')

    const flagged = container.querySelector('[data-entry="routine_count"]')!
    expect(flagged.className).toMatch(/Flagged/)

    const note = container.querySelector('[data-discrepancy]')!
    expect(note).toBeTruthy()
    // Beneath the table, not inside it.
    expect(note.textContent).toMatch(/unaccounted for/)
    expect(screen.getByRole('table').contains(note)).toBe(false)
  })

  it('puts the balance in the rightmost figure column', async () => {
    const { container } = renderAt(`/medications/register/${discrepant}`)
    await screen.findByRole('table')

    const headers = [...container.querySelectorAll('th')].map((th) =>
      th.textContent!.trim(),
    )
    expect(headers).toEqual([
      'Date and time',
      'Entry',
      'Change',
      'Balance after',
      'Signatures',
    ])
  })

  it('shows both signatures on every entry', async () => {
    const { container } = renderAt(`/medications/register/${discrepant}`)
    await screen.findByRole('table')

    // A row with one signature is not a valid register entry. Where the second
    // was never captured it is the hatch, never a blank column.
    for (const row of container.querySelectorAll('tbody tr')) {
      const signatures = row.lastElementChild!
      expect(signatures.textContent).toMatch(/by /)
      expect(
        /Witnessed by|Second signature not recorded|No second signature required/.test(
          signatures.textContent!,
        ),
        signatures.textContent!,
      ).toBe(true)
    }
  })

  it('shows a count as no change of stock, not as a movement', async () => {
    const { container } = renderAt(`/medications/register/${discrepant}`)
    await screen.findByRole('table')

    const count = container.querySelector('[data-entry="opening_count"]')!
    const change = count.children[2]!
    // A count says what the stock is; it does not move it. Rendering it as a
    // change would put the whole balance on the register twice.
    // It says so in words rather than with a dash, which cannot be told
    // apart from a blank.
    expect(change.textContent!.trim()).toBe('No change')
  })
})

describe('a drug that was never counted', () => {
  it('renders no table at all', async () => {
    const { container } = renderAt(`/medications/register/${NEWLY_PRESCRIBED_CD}`)
    await waitFor(() =>
      expect(container.querySelector('[data-empty-register]')).toBeTruthy(),
    )

    /*
     * An empty table with headers would say the register exists and happens to
     * have nothing in it. It was never opened.
     *
     * Scoped to the register card rather than the page: `container` is the
     * whole screen, and a bare `table` selector there would be satisfied by
     * any table anywhere — including one that is supposed to be present.
     */
    const card = container.querySelector('[data-empty-register]')?.closest('section')
    expect(card?.querySelector('table') ?? null).toBeNull()
    expect(screen.queryByText('Balance after')).toBeNull()
  })

  it('says what is missing and what closes it', async () => {
    const { container } = renderAt(`/medications/register/${NEWLY_PRESCRIBED_CD}`)
    const note = await waitFor(() => {
      const found = container.querySelector('[data-empty-register]')
      expect(found).toBeTruthy()
      return found!
    })

    expect(note.textContent).toMatch(/Nothing has ever been counted for this drug/)
    expect(note.textContent).toMatch(/counts the cabinet/)
    expect(note.textContent).toMatch(/two signatures/)
  })

  it('shows no balance in the header either', async () => {
    const { container } = renderAt(`/medications/register/${NEWLY_PRESCRIBED_CD}`)
    await waitFor(() =>
      expect(container.querySelector('[data-empty-register]')).toBeTruthy(),
    )

    const header = container.querySelector('[data-balance]')!
    expect(header.getAttribute('data-balance')).toBe('no_balance_recorded')
    expect(header.textContent).toMatch(/No balance recorded/)
  })

  it('is a different state from a discrepancy, in the data as well as on screen', () => {
    expect(registerState(stockCountsFor(NEWLY_PRESCRIBED_CD))).toEqual({
      kind: 'never_counted',
    })
    expect(registerBalance(stockCountsFor(NEWLY_PRESCRIBED_CD))).toEqual({
      kind: 'no_balance_recorded',
    })
    expect(
      registerState(stockCountsFor(GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy))
        .kind,
    ).toBe('discrepancy')
  })
})

describe('reachable, and it moves', () => {
  it('is a tab in the medications strip', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    const strip = screen.getByRole('navigation', { name: 'Medications' })
    expect(
      within(strip).getByRole('link', { name: 'Controlled drug register' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('opens a drug from its row and comes back', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)

    const row = container.querySelector('[data-register-row]')!
    expect(row.getAttribute('href')).toContain('/medications/register/')
  })
})

describe('accessibility', () => {
  it('has no axe violations on the list', async () => {
    const { container } = renderAt('/medications/register')
    await listed(container)
    expect((await axe(container)).violations).toEqual([])
  })

  it('has no axe violations on a ledger', async () => {
    const { container } = renderAt(
      `/medications/register/${GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy}`,
    )
    await screen.findByRole('table')
    expect((await axe(container)).violations).toEqual([])
  }, 60000)
})
