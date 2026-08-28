import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MarCellState, Medication, StockBalance } from '@/data/types'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import {
  NEWLY_PRESCRIBED_CD,
  medications,
  stockCounts,
} from '@/data/fixtures/medications'
import { staffHalloran, staffNwosu, staffOkonkwo } from '@/data/fixtures/organisation'
import {
  openDosesAt,
  recordOpeningCount,
  recordRound,
  stockBalanceFor,
} from '@/data/access/client'
import { resetSessionAdministrations } from '@/data/access/mar-store'
import { DoseRow } from './DoseRow'
import { EMPTY_ANSWER, openingCountFor, type Answer } from './round'

/**
 * A controlled drug the register has never held a balance for.
 *
 * The screen-level half of the rule the unit tests hold: with no balance there
 * is nothing to reconcile against, so what the round asks for is a first
 * count — its own entry on the register, two signatures, and no expected
 * figure, because there is nothing yet to expect.
 */

const DUE: MarCellState = {
  kind: 'due',
  windowOpensAt: '2026-08-22T07:00:00.000Z',
  windowClosesAt: '2026-08-22T08:00:00.000Z',
}

const NO_BALANCE: StockBalance = { kind: 'no_balance_recorded' }
const COUNTED: StockBalance = {
  kind: 'counted',
  value: 28,
  countedAt: '2026-08-21T20:05:00.000Z',
  countedBy: staffNwosu,
}

function drug(): Medication {
  const found = medications.find((med) => med.id === NEWLY_PRESCRIBED_CD)
  expect(found, 'the newly prescribed controlled drug is missing').toBeTruthy()
  return found!
}

function renderRow(balance: StockBalance, answer: Answer = EMPTY_ANSWER) {
  const onChange = vi.fn()
  const result = render(
    <SessionProvider>
      <TooltipProvider>
        <SiteTimeZone timeZone="Europe/London">
          <ul>
            <DoseRow
              medication={drug()}
              roundTime="08:00"
              recorded={DUE}
              answer={{ ...answer, choice: 'given' }}
              balance={balance}
              witnesses={[
                { value: staffNwosu.id, label: staffNwosu.displayName },
                { value: staffHalloran.id, label: staffHalloran.displayName },
              ]}
              onChange={onChange}
            />
          </ul>
        </SiteTimeZone>
      </TooltipProvider>
    </SessionProvider>,
  )
  return { ...result, onChange }
}

afterEach(() => resetSessionAdministrations())

describe('the fixture reaches the state', () => {
  it('has one controlled drug with no balance on the register', () => {
    // Without this the branch below renders to nobody and the flow exists only
    // in a test — §8's first standing check.
    expect(stockBalanceFor(NEWLY_PRESCRIBED_CD)).toEqual({
      kind: 'no_balance_recorded',
    })
    expect(drug().isControlledDrug).toBe(true)
  })
})

describe('a drug with no balance asks for an opening count', () => {
  it('says nobody has counted it, in words, not by leaving the field bare', () => {
    const { container } = renderRow(NO_BALANCE)
    const block = container.querySelector('[data-controlled-drug]')!
    expect(block.textContent).toMatch(/No balance recorded for this drug/)
    expect(block.textContent).toMatch(/becomes the opening balance/)
  })

  it('never states a figure the count is supposed to reach', () => {
    const { container } = renderRow(NO_BALANCE)
    const field = screen.getByLabelText(/Opening balance/)
    expect(field).toHaveValue(null)
    expect(field.getAttribute('placeholder')).toBeNull()
    // And no invented starting point either — a balance nobody recorded is not
    // zero, and the screen must not print one.
    expect(container.querySelector('[data-controlled-drug]')!.textContent).not.toMatch(
      /was 0\b/,
    )
  })

  it('asks for one count, not two', () => {
    renderRow(NO_BALANCE)
    expect(screen.getByLabelText(/Opening balance/)).toBeTruthy()
    expect(screen.queryByLabelText(/Stock after/)).toBeNull()
  })

  it('names the witness as signing the balance as well as the dose', () => {
    renderRow(NO_BALANCE)
    expect(
      screen.getByRole('combobox', { name: /signs the dose and the opening balance/ }),
    ).toBeTruthy()
  })

  it('never shows a reconciliation failure, whatever is counted', () => {
    for (const counted of ['0', '1', '999']) {
      const { container, unmount } = renderRow(NO_BALANCE, {
        ...EMPTY_ANSWER,
        openingCount: counted,
      })
      expect(container.querySelector('[data-mismatch]'), counted).toBeNull()
      unmount()
    }
  })
})

describe('a drug with a balance is unchanged', () => {
  it('asks for the stock after, against the balance on the register', () => {
    renderRow(COUNTED)
    expect(screen.getByLabelText(/Stock after: was/)).toBeTruthy()
    expect(screen.queryByLabelText(/Opening balance/)).toBeNull()
  })

  it('still refuses a count that does not reconcile', () => {
    const { container } = renderRow(COUNTED, { ...EMPTY_ANSWER, stockAfter: '99' })
    expect(container.querySelector('[data-mismatch]')).toBeTruthy()
  })
})

describe('what the answer becomes', () => {
  it('is an opening count only where there is no balance and a dose was given', () => {
    const answered: Answer = { ...EMPTY_ANSWER, choice: 'given', openingCount: '40' }
    expect(openingCountFor(answered, NO_BALANCE)).toBe(40)

    // Not on a drug that already has one — that would rewrite where the
    // running total started.
    expect(openingCountFor(answered, COUNTED)).toBe('none')
    // Not on a dose that was not given.
    expect(openingCountFor({ ...answered, choice: 'not_given' }, NO_BALANCE)).toBe(
      'none',
    )
    // And not from an empty field.
    expect(openingCountFor({ ...answered, openingCount: '' }, NO_BALANCE)).toBe('none')
  })
})

describe('the write refuses what the buttons already prevent', () => {
  const at = '2026-08-22T08:10:00.000Z' as const

  it('records an opening balance with two signatures and no expected figure', async () => {
    await recordOpeningCount({
      medicationId: NEWLY_PRESCRIBED_CD,
      counted: 40,
      countedBy: staffOkonkwo,
      witnessedBy: staffNwosu,
      at,
    })

    const balance = stockBalanceFor(NEWLY_PRESCRIBED_CD)
    expect(balance).toMatchObject({ kind: 'counted', value: 40 })

    const written = stockCounts.find((count) => count.countedAt === at)
    expect(written, 'the fixtures were written to').toBeUndefined()
  })

  it('refuses a count signed twice by the same person', async () => {
    await expect(
      recordOpeningCount({
        medicationId: NEWLY_PRESCRIBED_CD,
        counted: 40,
        countedBy: staffOkonkwo,
        witnessedBy: staffOkonkwo,
        at,
      }),
    ).rejects.toThrow(/two different people/)
  })

  it('refuses a second opening balance once the drug has one', async () => {
    await recordOpeningCount({
      medicationId: NEWLY_PRESCRIBED_CD,
      counted: 40,
      countedBy: staffOkonkwo,
      witnessedBy: staffNwosu,
      at,
    })

    // A second "opening" balance would move where the running total started
    // and silently absorb whatever went missing between the two.
    await expect(
      recordOpeningCount({
        medicationId: NEWLY_PRESCRIBED_CD,
        counted: 38,
        countedBy: staffOkonkwo,
        witnessedBy: staffNwosu,
        at: '2026-08-22T09:00:00.000Z',
      }),
    ).rejects.toThrow(/already has a balance/)
  })
})

describe('the round refuses to sign a controlled drug it has no balance for', () => {
  const at = '2026-08-22T08:10:00.000Z' as const

  const given = (witness = staffNwosu): MarCellState => ({
    kind: 'given',
    givenAt: at,
    givenBy: staffOkonkwo,
    witness: { kind: 'witnessed', by: witness },
  })

  /**
   * Every dose still open at this round, answered.
   *
   * **A round with nothing else outstanding is the exception, not the rule.**
   * These two guards used to submit the one controlled drug they were about
   * and nothing else, which worked only while every other dose at that round
   * happened to be signed for already. Raising the omission rate put one
   * unrecorded dose beside it and the round refused for being short, so both
   * tests started failing on a shortfall message rather than on the guard they
   * exist to prove. The open set comes from the round's own derivation, never
   * from a second copy of the rule here.
   */
  const everyOpenDose = (witness = staffNwosu) => [
    // The drug these two guards are about, whether or not it is still open.
    { medicationId: NEWLY_PRESCRIBED_CD, state: given(witness) },
    ...openDosesAt(drug().residentId, '2026-08-22', '08:00')
      .filter((medicationId) => medicationId !== NEWLY_PRESCRIBED_CD)
      .map((medicationId) => ({
        medicationId,
        /*
         * A witness on a drug that does not need one is not a harmless extra:
         * the round reads a required witness as the mark of a controlled drug
         * and then demands an opening count for it. The state has to say what
         * the prescription says.
         */
        state: {
          kind: 'given' as const,
          givenAt: at,
          givenBy: staffOkonkwo,
          witness: medications.find((one) => one.id === medicationId)?.isControlledDrug
            ? { kind: 'witnessed' as const, by: staffNwosu }
            : { kind: 'not_required' as const },
        },
      })),
  ]

  it('refuses the round when the opening count is missing', async () => {
    // The comment on `recordRound` claims this; §8 says a claimed guarantee is
    // a claim to verify. Without it the drug's running total starts wherever
    // the next count happens to say, with the doses before it unaccounted for.
    await expect(
      recordRound({
        residentId: drug().residentId,
        date: '2026-08-22',
        roundTime: '08:00',
        doses: everyOpenDose(),
        openingCounts: [],
        by: staffOkonkwo,
        at,
      }),
    ).rejects.toThrow(/cannot be signed for without an opening count/)

    expect(stockBalanceFor(NEWLY_PRESCRIBED_CD)).toEqual({
      kind: 'no_balance_recorded',
    })
  })

  it('refuses an opening count witnessed by the person signing it', async () => {
    await expect(
      recordRound({
        residentId: drug().residentId,
        date: '2026-08-22',
        roundTime: '08:00',
        doses: everyOpenDose(staffOkonkwo),
        openingCounts: [
          {
            medicationId: NEWLY_PRESCRIBED_CD,
            counted: 40,
            witnessedBy: staffOkonkwo,
          },
        ],
        by: staffOkonkwo,
        at,
      }),
    ).rejects.toThrow(/two different people/)
  })
})

describe('typing into the opening count', () => {
  it('reports what was typed, and nothing else', async () => {
    const user = userEvent.setup()
    const { onChange } = renderRow(NO_BALANCE)
    const field = screen.getByLabelText(/Opening balance/)
    await user.type(field, '4')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ openingCount: '4', stockAfter: '' }),
    )
    expect(within(document.body).queryByText(/does not reconcile/)).toBeNull()
  })
})
