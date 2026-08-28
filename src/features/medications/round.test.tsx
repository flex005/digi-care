import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signingCodeFor } from '@/data/access/team-store'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { NOW, atTime, daysAgo } from '@/data/fixtures/generate'
import { resetSessionAdministrations } from '@/data/access/mar-store'
import { medications } from '@/data/fixtures/medications'
import { MedicationsRoute } from './MedicationsRoute'
import { OmissionsRoute } from './OmissionsRoute'
import { RoundRoute } from './RoundRoute'

/**
 * The medication round. PRD §6.4.
 *
 * The sentence: these doses are due now, for this person, and you are about to
 * sign for them.
 *
 * **The clock is pinned, and to a specific hour for a specific reason** (§8).
 * The round the screen shows comes from the wall clock, and what has been
 * recorded against it depends on how much of the day the fixtures have already
 * generated — so an unpinned run would ask whether the hour the suite happened
 * to start at left anybody unrecorded. Pinned to 08:05 yesterday, the 08:00
 * round is the current one and Emmanuel Okafor's pinned morphine omission sits
 * in it, so there is guaranteed to be a resident with an unanswered dose
 * whatever time of day the suite runs.
 */
const PINNED = atTime(daysAgo(1, NOW), 8, 5)

function renderRound(path = '/medications/round') {
  const router = createMemoryRouter(
    [
      {
        path: '/medications',
        element: <MedicationsRoute />,
        children: [
          { index: true, element: <OmissionsRoute /> },
          { path: 'round', element: <RoundRoute /> },
        ],
      },
    ],
    { initialEntries: [path] },
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

const loaded = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-round-bar]')).toBeTruthy())
  return container
}

/** Opens the first resident in the queue who still has an unanswered dose. */
async function openUnanswered(container: HTMLElement) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const pending = container.querySelector<HTMLButtonElement>(
    '[data-queue][data-done="false"]',
  )
  expect(pending, 'no resident in this round has an unanswered dose').toBeTruthy()
  await user.click(pending!)
  await waitFor(() => expect(container.querySelector('[data-dose]')).toBeTruthy())
  return { user, container }
}

/**
 * Answers every due dose Given, completing the controlled-drug block where the
 * dose has one.
 *
 * A controlled drug is not a third button, it is two more required facts, so
 * "click Given on everything" is not enough to finish a round — which is the
 * behaviour under test as much as it is a step in the setup.
 */
/**
 * What one dose of this drug takes off the balance.
 *
 * Read from the fixture rather than assumed to be one: morphine oral solution
 * is counted in millilitres and a 2.5mg dose is 1.25ml of it, so a test that
 * subtracts one would fail on correct code.
 */
function doseQuantityOf(row: HTMLElement): number {
  const id = row.getAttribute('data-dose')
  const medication = medications.find((med) => med.id === id)
  expect(medication, `no medication for ${id}`).toBeTruthy()
  return medication!.doseQuantity
}

async function answerAllGiven(
  container: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
) {
  for (const dose of [
    ...container.querySelectorAll('[data-dose][data-settled="false"]'),
  ]) {
    const row = dose as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Given' }))

    const cd = row.querySelector('[data-controlled-drug]')
    if (!cd) continue

    await user.click(within(row).getByRole('combobox', { name: /Witness/ }))
    await user.click(screen.getAllByRole('option')[0]!)

    // The count has to be worked out, not copied — the screen no longer says
    // what it should be, so the test does the arithmetic a nurse would: in the
    // unit the drug is counted in, and by the quantity one dose takes.
    const stock = within(row).getByRole('spinbutton')
    const before = Number(
      within(row)
        .getByText(/Stock after: was/)
        .textContent!.match(/[\d.]+/)![0],
    )
    // `fireEvent.change`, not `user.type`: a number input drops the partial
    // value "95." mid-keystroke, so a decimal count typed key by key lands as
    // "955" in the field.
    fireEvent.change(stock, {
      target: {
        value: String(Math.round((before - doseQuantityOf(row)) * 100) / 100),
      },
    })
  }
}

/**
 * Opens the first resident in the queue who has a PRN medication.
 *
 * Walks the queue rather than assuming the resident the round opens on happens
 * to have one. It did, until the controlled drug pool grew and the draw
 * shifted — an assertion resting on which drugs a resident was dealt is
 * testing the fixture, not the rule (§8).
 */
async function openWithPrn(container: HTMLElement) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const queue = [...container.querySelectorAll<HTMLButtonElement>('[data-queue]')]

  for (const item of queue) {
    await user.click(item)
    await waitFor(() => expect(container.querySelector('[data-dose]')).toBeTruthy())
    const prn = container.querySelector('[data-prn]')
    if (prn) return { user, row: prn as HTMLElement }
  }

  throw new Error('no resident in this round has a PRN medication')
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: PINNED })
})

afterEach(() => {
  vi.useRealTimers()
  resetSessionAdministrations()
})

describe('the round is the trolley, in the order it goes', () => {
  it('orders the queue by room number, with unrecorded rooms last', async () => {
    const { container } = renderRound()
    await loaded(container)

    /*
     * Read off the cell's own state rather than off its text. The marker used
     * to be an em dash, and when the dash went the queries kept matching
     * nothing: `indexOf('—')` returned -1 for ever, so the assertion under it
     * stopped running while the test went on passing.
     */
    const cells = [...container.querySelectorAll('[data-queue] [data-queue-room]')]
    expect(cells.length).toBeGreaterThan(1)

    const states = cells.map((cell) => cell.getAttribute('data-queue-room'))
    const numeric = cells
      .filter((cell) => cell.getAttribute('data-queue-room') === 'recorded')
      .map((cell) => Number(cell.textContent!.trim()))
    expect(numeric.length).toBeGreaterThan(1)
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b))

    // A resident whose room nobody has recorded is still on the round. Absent
    // from the list is the same bug as a blank cell.
    const unrecorded = states.indexOf('unrecorded')
    if (unrecorded !== -1) expect(unrecorded).toBe(states.length - 1)
  })

  it('keeps residents already recorded in the list, marked', async () => {
    const { container } = renderRound()
    await loaded(container)

    // A round you cannot see the shape of is one you lose your place in.
    const items = [...container.querySelectorAll('[data-queue]')]
    for (const item of items) {
      const status = item.querySelector('[class*="queueStatus"]')!.textContent!
      const done = item.getAttribute('data-done') === 'true'
      // Three states, and the partial one is the point: a resident with two
      // doses signed and one omitted read "nothing recorded yet" from a
      // hardcoded string, which was false on the commonest shape there is.
      expect(status).toMatch(
        /^(Recorded|\d+ due · nothing recorded yet|\d+ of \d+ recorded)$/,
      )
      expect(status === 'Recorded').toBe(done)
    }
  })

  it('shows a dose somebody has already signed for as a record, not a blank', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderRound()
    await loaded(container)

    /*
     * Walks the rounds and the residents in them, rather than taking whichever
     * resident the screen opens on.
     *
     * The state this is about is a *resident* part way through: one dose
     * recorded, another still open, in the same round. Which round the screen
     * opens on depends on the hour, and not every round is deep enough to
     * contain the state — at 14:00 this home gives each resident a single
     * dose, so nobody there can be part way through anything. The round
     * selector is on the screen for the same reason a nurse uses it.
     */
    let settled: Element[] = []
    const rounds = [...container.querySelectorAll('[data-slot]')]
    expect(rounds.length).toBeGreaterThan(1)

    for (const slot of rounds) {
      await user.click(slot)
      await waitFor(() => expect(container.querySelector('[data-queue]')).toBeTruthy())

      for (const entry of container.querySelectorAll('[data-queue]')) {
        await user.click(entry)
        await waitFor(() => expect(container.querySelector('[data-dose]')).toBeTruthy())
        const found = [
          ...container.querySelectorAll('[data-dose][data-settled="true"]'),
        ]
        const open = container.querySelector('[data-dose][data-settled="false"]')
        if (found.length > 0 && open !== null) {
          settled = found
          break
        }
      }
      if (settled.length > 0) break
    }

    // It rendered these as unanswered, which put a second signature over
    // somebody else's and made a complete record look like a gap.
    expect(settled.length, 'no fixture reaches a part-recorded round').toBeGreaterThan(
      0,
    )
    for (const dose of settled) {
      expect(dose.textContent).toMatch(/Given|Not given/)
      // Author and time, always visible.
      expect(dose.textContent).toMatch(/\d{2}:\d{2}/)
      expect(
        within(dose as HTMLElement).queryByRole('button', { name: 'Given' }),
      ).toBeNull()
    }
  })
})

describe('every figure carries its denominator', () => {
  it('states progress as residents done out of residents on the round', async () => {
    const { container } = renderRound()
    await loaded(container)

    const bar = container.querySelector('[data-round-bar]')!
    expect(bar.textContent).toMatch(/\d+ of \d+ residents done/)
  })

  it('says how much of every other round is recorded, not just that it exists', async () => {
    const { container } = renderRound()
    await loaded(container)

    const slots = [...container.querySelectorAll('[data-slot]')]
    expect(slots.length).toBeGreaterThan(1)
    for (const slot of slots) {
      // A bare round time would say a round exists and nothing about whether
      // anybody has been round it.
      expect(slot.textContent).toMatch(/\d+ of \d+/)
    }
  })
})

describe('the subject is on screen the whole time it is being written to', () => {
  it('names the resident, their room and their date of birth', async () => {
    const { container } = renderRound()
    await loaded(container)
    await openUnanswered(container)

    const strip = container.querySelector('[data-subject]')!
    expect(strip.textContent).toMatch(/Room \d+|Room not recorded/)
    expect(strip.textContent).toMatch(/Born \d{2}\/\d{2}\/\d{4}/)
    // The identity comes from the entry being written, so the strip and the
    // submit button must be about the same person.
    expect(strip.getAttribute('data-subject')).toMatch(/^res-/)
  })

  it('shows an allergy state beside them, never a blank', async () => {
    const { container } = renderRound()
    await loaded(container)
    await openUnanswered(container)

    const strip = container.querySelector('[data-subject]')!
    expect(strip.textContent).toMatch(
      /ALLERG|No known allergies|not recorded|Not recorded/i,
    )
  })
})

describe('no dose can be left blank', () => {
  it('renders the hatch and says so for a dose with no answer', async () => {
    const { container } = renderRound()
    await loaded(container)
    await openUnanswered(container)

    const unanswered = container.querySelector('[data-dose][data-answer="none"]')!
    expect(unanswered).toBeTruthy()
    expect(unanswered.textContent).toMatch(/Nothing recorded for this dose yet/)
  })

  it('holds the submit until every dose has an answer, and names what is missing', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    const submit = screen.getByRole('button', {
      name: /Record \d{2}:\d{2} medications/,
    })
    expect(submit).toBeDisabled()

    // Named, not counted. This is a screen used standing up with a trolley.
    const open = [...container.querySelectorAll('[data-dose][data-settled="false"]')]
    const foot = container.querySelector('[class*="roundFoot"]')!
    expect(foot.textContent).toMatch(/Waiting on:/)
    const firstDrug = open[0]!.querySelector('[class*="doseDrug"]')!.textContent!.trim()
    expect(foot.textContent).toContain(firstDrug)

    await answerAllGiven(container, user)
    await waitFor(() =>
      expect(foot.textContent).toMatch(/have an answer|has an answer/),
    )
  })

  it('counts what the signature covers, not what the round contains', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    const total = container.querySelectorAll('[data-dose]').length
    const open = container.querySelectorAll('[data-dose][data-settled="false"]').length
    await answerAllGiven(container, user)

    const foot = container.querySelector('[class*="roundFoot"]')!
    await waitFor(() => expect(foot.textContent).toMatch(/an answer\./))
    if (open < total) {
      // "All 3 doses have an answer" over a signature that records one claims
      // two doses this person did not give.
      expect(foot.textContent).toContain(`The ${open}`)
      expect(foot.textContent).not.toContain(`All ${total}`)
    } else {
      expect(foot.textContent).toContain(`All ${total}`)
    }
  })

  it('never states the balance the count is supposed to reach', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderRound()
    await loaded(container)

    /*
     * Finds a resident with an open controlled drug rather than assuming the
     * first pending one has one. Which round the screen opens on depends on
     * the hour, and not every round has a controlled drug in it: taking
     * whoever came first made this pass on the clock and fail on the data.
     */
    let cd: HTMLElement | undefined
    for (const slot of container.querySelectorAll('[data-slot]')) {
      await user.click(slot)
      await waitFor(() => expect(container.querySelector('[data-queue]')).toBeTruthy())

      for (const entry of container.querySelectorAll('[data-queue]')) {
        await user.click(entry)
        await waitFor(() => expect(container.querySelector('[data-dose]')).toBeTruthy())
        cd = [...container.querySelectorAll('[data-dose][data-settled="false"]')].find(
          (dose) => dose.textContent?.includes('Controlled drug'),
        ) as HTMLElement
        if (cd) break
      }
      if (cd) break
    }
    expect(cd, 'no controlled drug is open in any round today').toBeTruthy()
    await user.click(within(cd).getByRole('button', { name: 'Given' }))

    const stock = within(cd).getByRole('spinbutton')
    const before = Number(
      within(cd)
        .getByText(/Stock after: was/)
        .textContent!.match(/\d+/)![0],
    )

    // A stock count is an independent check. A field that offers the expected
    // figure turns it into a confirmation prompt, and the reconciliation guard
    // can never fire on a number the screen supplied.
    expect(stock).toHaveValue(null)
    expect(stock.getAttribute('placeholder')).toBeNull()
    expect(cd.textContent).not.toContain(String(before - doseQuantityOf(cd)))
    // The starting point stays: a delta cannot be counted without it.
    expect(cd.textContent).toContain(String(before))
  })

  it('refuses Not given without a reason', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    const dose = container.querySelector(
      '[data-dose][data-settled="false"]',
    ) as HTMLElement
    await user.click(within(dose).getByRole('button', { name: 'Not given' }))

    // A recorded negative is a complete record; one without a reason is not.
    expect(dose.textContent).toMatch(/A reason is required/)
    const submit = screen.getByRole('button', {
      name: /Record \d{2}:\d{2} medications/,
    })
    expect(submit).toBeDisabled()
  })
})

describe('the confirmation names the subject and what is being signed', () => {
  it('lists every dose with its answer, and holds the signature until a PIN', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    const strip = container.querySelector('[data-subject]')!
    const name = strip
      .querySelector('[class*="subjectMeta"]')!
      .textContent!.split(' ·')[0]!
    const doses = [...container.querySelectorAll('[data-dose][data-settled="false"]')]
    await answerAllGiven(container, user)

    await user.click(
      screen.getByRole('button', { name: /Record \d{2}:\d{2} medications/ }),
    )

    const dialog = await screen.findByRole('alertdialog')
    // Never "Are you sure?" — the sentence names the person. §2.4.
    expect(within(dialog).getByRole('heading').textContent).toContain(name)
    for (const dose of doses) {
      const drug = dose.querySelector('[class*="doseDrug"]')!.textContent!.trim()
      expect(dialog.textContent).toContain(drug)
    }

    // What the signature covers, and no more. Listing a dose somebody else
    // signed would put this signature over theirs.
    const settled = [...container.querySelectorAll('[data-dose][data-settled="true"]')]
    for (const dose of settled) {
      const drug = dose.querySelector('[class*="doseDrug"]')!.textContent!.trim()
      expect(dialog.textContent).not.toContain(drug)
    }
    if (settled.length > 0) {
      expect(dialog.textContent).toMatch(/already on the record and not signed again/)
    }

    const confirm = within(dialog).getByRole('button', { name: 'Confirm and sign' })
    expect(confirm).toBeDisabled()

    // The PIN signs the record, not the device unlock, and the dialog says so.
    expect(dialog.textContent).toMatch(/not by whoever unlocked the device/)

    await user.type(
      within(dialog).getByLabelText(/signing code/i),
      signingCodeFor(staffOkonkwo.id),
    )
    await waitFor(() => expect(confirm).toBeEnabled())
  })

  it('records the round and says it is held in memory only', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    const before = container
      .querySelector('[data-subject]')!
      .getAttribute('data-subject')
    await answerAllGiven(container, user)
    await user.click(
      screen.getByRole('button', { name: /Record \d{2}:\d{2} medications/ }),
    )
    const dialog = await screen.findByRole('alertdialog')
    await user.type(
      within(dialog).getByLabelText(/signing code/i),
      signingCodeFor(staffOkonkwo.id),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Confirm and sign' }))

    // A prototype that lets somebody believe a medication record persisted is
    // the one place that mistake would be dangerous, so the toast says so.
    const toast = await screen.findByText(/medications recorded/)
    expect(
      toast.closest('[role]')?.textContent ?? toast.parentElement?.textContent,
    ).toMatch(/held in memory/)

    await waitFor(() =>
      expect(
        container.querySelector(`[data-queue="${before}"]`)?.getAttribute('data-done'),
      ).toBe('true'),
    )
  })
})

describe('PRN is not part of the round', () => {
  it('keeps as-required medications out of the due list', async () => {
    const { container } = renderRound()
    await loaded(container)
    await openUnanswered(container)

    // Putting one in the due list would make not giving it read as an
    // omission — a claim somebody missed a dose nobody was due to give.
    for (const dose of container.querySelectorAll('[data-dose]')) {
      expect(dose.textContent).not.toMatch(/as required/)
    }
  })

  it('never blocks the round on a dose that was never due', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user } = await openUnanswered(container)

    await answerAllGiven(container, user)
    const submit = screen.getByRole('button', {
      name: /Record \d{2}:\d{2} medications/,
    })
    await waitFor(() => expect(submit).toBeEnabled())
  })
})

describe('a PRN dose is a record with a hole in it until somebody says what it did', () => {
  it('requires a symptom and a reason before the dose can be recorded', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user, row } = await openWithPrn(container)

    await user.click(within(row).getByRole('button', { name: 'Give a dose' }))

    const record = within(row).getByRole('button', { name: 'Record this dose' })
    expect(record).toBeDisabled()

    await user.type(within(row).getByLabelText(/What was observed/), 'Knee pain')
    expect(record).toBeDisabled()
    await user.type(within(row).getByLabelText(/Why it was given/), 'Resident asked')
    await waitFor(() => expect(record).toBeEnabled())
  })

  it('renders the missing outcome as the gap it is, not as a blank', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { user, row } = await openWithPrn(container)

    await user.click(within(row).getByRole('button', { name: 'Give a dose' }))
    await user.type(within(row).getByLabelText(/What was observed/), 'Knee pain')
    await user.type(within(row).getByLabelText(/Why it was given/), 'Resident asked')
    await user.click(within(row).getByRole('button', { name: 'Record this dose' }))

    const given = await waitFor(() => {
      const entry = container.querySelector('[data-prn-given]')
      expect(entry).toBeTruthy()
      return entry as HTMLElement
    })

    // A dose given and never checked is not a complete record.
    expect(given.textContent).toMatch(/No outcome recorded/)
    expect(given.textContent).toMatch(/Given \d{2}:\d{2}/)

    await user.type(within(given).getByLabelText(/What happened afterwards/), 'Relief')
    await user.click(within(given).getByRole('button', { name: 'Record outcome' }))
    await waitFor(() => expect(given.textContent).toMatch(/Outcome: Relief/))
    expect(given.textContent).not.toMatch(/No outcome recorded/)
  })

  it('never lets an unanswered PRN hold up the round', async () => {
    const { container } = renderRound()
    await loaded(container)
    const { row } = await openWithPrn(container)

    const drug = row.querySelector('[class*="doseDrug"]')!.textContent!.trim()
    expect(drug.length).toBeGreaterThan(0)

    // Whatever else the round is waiting on, it is never waiting on this. A
    // dose that was never due cannot be an omission, so it cannot be a reason
    // the round is incomplete.
    const foot = container.querySelector('[class*="roundFoot"]')!
    expect(foot.textContent).not.toContain(drug)

    // And it is on the screen, in its own section, so nobody has to leave the
    // round to give one.
    expect(row.closest('[aria-label="Available if needed"]')).toBeTruthy()
  })
})

describe('the module can be moved around', () => {
  it('links both of its screens from the same strip', async () => {
    const { container } = renderRound()
    await loaded(container)

    const strip = screen.getByRole('navigation', { name: 'Medications' })
    expect(within(strip).getByRole('link', { name: 'Omissions' })).toBeTruthy()
    expect(within(strip).getByRole('link', { name: 'Round' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(container).toBeTruthy()
  })
})

describe('accessibility', () => {
  it('has no axe violations on the round', async () => {
    const { container } = renderRound()
    await loaded(container)
    await openUnanswered(container)

    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
