import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { resetSessionAdministrations } from '@/data/access/mar-store'
import { teamMembers } from '@/data/access/team-store'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { OmissionsRoute } from './OmissionsRoute'

/**
 * Omissions across the home. PRD §6.4.
 *
 * The sentence: these doses were missed across the home, and this is how long
 * ago. What is under test is that no row can render without its resident, that
 * the wait is what orders the list, and that every figure is a fraction of
 * doses rather than of people.
 */

afterEach(() => {
  // A closure is written into the MAR overlay, and a closure left over from one
  // test would be a closed row the next test never closed.
  resetSessionAdministrations()
})

function renderOmissions(as?: StaffRole) {
  const router = createMemoryRouter(
    [{ path: '/medications', element: <OmissionsRoute /> }],
    { initialEntries: ['/medications'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          {as === undefined ? null : <SignInAs as={as} />}
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const ready = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-omission]')).toBeTruthy())
  return container
}

describe('no dose renders without its resident', () => {
  it('names a person on every row', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // The first cross-resident medication screen. A row carrying a drug, a
    // dose and a time with nobody attached to it is the wrong-subject failure
    // with a dosage on it (§2.4).
    const rows = container.querySelectorAll('[data-omission]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const link = row.querySelector('a[href^="/residents/"]')
      expect(link, 'a row with no resident link').toBeTruthy()
      expect(link?.textContent?.trim().length).toBeGreaterThan(0)
      expect(row.textContent).toMatch(/Room \d+|Room not recorded/)
    }
  })

  it('leads with the subject, before the dose', async () => {
    const { container } = renderOmissions()
    await ready(container)

    const row = container.querySelector('[data-omission]')!
    const who = row.children[0]
    const dose = row.children[2]
    expect(
      who.compareDocumentPosition(dose) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('the wait is the finding', () => {
  it('sorts oldest first', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // Same ordering and same reason as the flagged care-note queue: a dose
    // missed three days ago is a different problem from one missed this
    // morning, and reading them in arrival order buries the first.
    const waits = [
      ...container.querySelectorAll('[data-omission] [data-unrecorded-detail]'),
    ]
      .map((node) => node.textContent ?? '')
      .map((text) => {
        // Minutes, hours or days — the figure switches unit so it can be
        // ranked at a glance, and the sort has to be checked across all three.
        const match = /missed (\d+) (minute|hour|day)s? ago/.exec(text)
        if (!match) return 0
        const scale = match[2] === 'day' ? 1440 : match[2] === 'hour' ? 60 : 1
        return Number(match[1]) * scale
      })

    expect(waits.length).toBeGreaterThan(1)
    for (let i = 1; i < waits.length; i += 1) {
      expect(waits[i - 1]!).toBeGreaterThanOrEqual(waits[i]!)
    }
  })

  it('states when the dose was due, then how long ago', async () => {
    const { container } = renderOmissions()
    await ready(container)
    const chip = container.querySelector('[data-omission] [data-state="unrecorded"]')
    expect(chip?.textContent).toMatch(/no record/i)
    expect(chip?.textContent).toMatch(/\d{2}:\d{2}, \d{2}\/\d{2}/)
    expect(chip?.textContent).toMatch(/missed .+ ago/i)
  })

  it('separates rows the days-ago figure cannot', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // "missed 6 days ago" repeated on six consecutive rows, so the key the
    // list is sorted by was the one thing a reader could not see.
    //
    // Not asserted as "every detail is unique": two residents can miss the
    // same round on the same day, and the resident column is what separates
    // those. What the round and the day have to add is *resolution* — more
    // distinct chips than the days-ago figure could produce on its own.
    // Scoped to the rows: the tiles above carry a chip of their own whose
    // detail is not a wait, and a page-wide sweep counted it as one.
    const details = [
      ...container.querySelectorAll('[data-omission] [data-unrecorded-detail]'),
    ].map((node) => node.textContent ?? '')
    const agoOnly = details.map((text) => /missed .+ ago/.exec(text)?.[0] ?? '')
    expect(new Set(details).size).toBeGreaterThan(new Set(agoOnly).size)
    expect(details.every((text) => /\d{2}:\d{2}, \d{2}\/\d{2}/.test(text))).toBe(true)
  })
})

describe('the denominator is doses, not residents', () => {
  it('measures the banner against doses due', async () => {
    const { container } = renderOmissions()
    await ready(container)

    const tiles = container.querySelector('[data-omissions]')
    expect(tiles?.textContent).toMatch(/doses with no record/i)
    expect(tiles?.textContent).toMatch(/of [\d,]+ doses due this week/i)
    // Never a count of people. An omission is a fraction of doses.
    expect(tiles?.textContent).not.toMatch(/of \d+ residents/i)
  })

  it('states the ordering once, and the count nowhere but the banner', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // The banner and this line said the same sentence twice. The count lives
    // on the banner; this carries the ordering, which is what makes the list
    // mean anything.
    const line = container.querySelector('[class*="resultLine"]')
    expect(line?.textContent).toMatch(/oldest first/i)
    expect(line?.textContent).not.toMatch(/doses due this week/i)
  })

  it('narrows the figure with the filter, and says which filter', async () => {
    const user = userEvent.setup()
    const { container } = renderOmissions()
    await ready(container)
    const all = container.querySelectorAll('[data-omission]').length

    await user.click(screen.getByRole('button', { name: 'Not escalated' }))
    await waitFor(() =>
      expect(container.querySelectorAll('[data-omission]').length).toBeLessThan(all),
    )

    // Rule 3c, in its most direct form: a figure above a list must not be a
    // count of a different set. The caption carries the filter so the number
    // is never bare.
    const shown = container.querySelectorAll('[data-omission]').length
    /*
     * The claim over the filtered set sits on the line above the list, where
     * the filter that produced it is named beside it. The tiles above are the
     * whole week and each carries its own denominator, so narrowing the list
     * cannot turn one of them into a claim about a set nobody is looking at.
     */
    const line = container.querySelector('[data-result-line]')
    expect(line?.querySelector('[data-numeric]')?.textContent).toBe(String(shown))
    expect(line?.textContent).toMatch(/not yet escalated/i)
    // And the week's total is still stated, so the smaller number is not a
    // surprise.
    expect(line?.textContent).toMatch(new RegExp(`of ${all}\\b`, 'i'))
  }, 30000)
})

describe('escalation', () => {
  it('differs by more than the word', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // The same mark the MAR cell uses, so a reader moving between the two
    // screens meets one mechanism.
    const escalated = container.querySelector('[data-omission][data-escalated="true"]')
    const plain = container.querySelector('[data-omission][data-escalated="false"]')
    if (escalated) expect(escalated.querySelector('svg')).toBeTruthy()
    if (plain) expect(plain.querySelector('svg')).toBeNull()
  })

  it('says it in words as well, never by the mark alone', async () => {
    const { container } = renderOmissions()
    await ready(container)
    const escalated = container.querySelector('[data-omission][data-escalated="true"]')
    if (escalated) expect(escalated.textContent).toMatch(/escalated/i)
    const plain = container.querySelector('[data-omission][data-escalated="false"]')
    if (plain) expect(plain.textContent).toMatch(/not escalated/i)
  })

  it('filters, and says the filter is why a list is short', async () => {
    const user = userEvent.setup()
    const { container } = renderOmissions()
    await ready(container)
    const all = container.querySelectorAll('[data-omission]').length

    await user.click(screen.getByRole('button', { name: 'Not escalated' }))
    await waitFor(() =>
      expect(container.querySelectorAll('[data-omission]').length).toBeLessThan(all),
    )
    for (const row of container.querySelectorAll('[data-omission]')) {
      expect(row.getAttribute('data-escalated')).toBe('false')
    }
  }, 30000)
})

describe('the fixture reaches this screen', () => {
  it('has enough omissions, across enough people, to be reviewable', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // At three-in-total this screen had three rows, all the same drug on the
    // same day, and neither the sort nor the filters did any visible work.
    const rows = container.querySelectorAll('[data-omission]')
    expect(rows.length).toBeGreaterThan(5)
    const people = new Set(
      [...rows].map((row) => row.querySelector('a[href^="/residents/"]')?.textContent),
    )
    expect(people.size).toBeGreaterThan(3)
  })
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderOmissions()
    await ready(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 60000)
})

/**
 * Closing an omission. CW PRD MED-01.
 *
 * Closing records who looked and why, and fills nothing. What is under test is
 * that a closed row keeps its hatched gap with the closure beside it as a
 * separate fact, that the screen counts the closures against the omissions
 * they close, and that the control will not record a closure nobody explained.
 */
describe('a closed omission', () => {
  it('keeps the hatched gap and states the closure beside it, not inside it', async () => {
    const { container } = renderOmissions()
    await ready(container)

    // The fixtures close some older omissions and leave the rest open, so both
    // must be on the week's list. A list with no closed row would pass every
    // assertion below by never running them.
    const closed = container.querySelectorAll('[data-omission][data-closure="closed"]')
    const open = container.querySelectorAll('[data-omission][data-closure="open"]')
    expect(closed.length, 'no closed omission this week').toBeGreaterThan(0)
    expect(open.length, 'no open omission this week').toBeGreaterThan(0)

    for (const row of closed) {
      const gap = row.querySelector('[data-state="unrecorded"]')
      const closure = row.querySelector('[data-omission-closure="closed"]')
      expect(gap, 'a closed omission lost its hatch').toBeTruthy()
      expect(gap?.textContent).toMatch(/no record/i)
      expect(closure).toBeTruthy()
      expect(gap!.contains(closure)).toBe(false)
      expect(closure?.textContent).toMatch(
        /^Closed by .+, \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}.*: \S/,
      )
      // Nothing about the row reads as a recorded dose.
      expect(row.querySelector('[data-state="recorded"]')).toBeNull()
    }
    for (const row of open) {
      expect(row.querySelector('[data-omission-closure]')).toBeNull()
    }
  })

  it('counts the closures out of the omissions, and the gap count does not fall', async () => {
    const { container } = renderOmissions()
    await ready(container)

    const rows = container.querySelectorAll('[data-omission]').length
    const closed = container.querySelectorAll(
      '[data-omission][data-closure="closed"]',
    ).length
    const tile = container.querySelector('[data-metric-tile="Closed"]')
    expect(tile, 'no Closed tile').toBeTruthy()
    // The figure, and what it is out of: the omissions, never the doses due.
    expect(tile!.querySelector('[class*="tileValue"]')?.textContent).toBe(
      String(closed),
    )
    expect(tile!.querySelector('[data-metric-of]')?.textContent).toBe(
      `of ${rows} with no record`,
    )
    // Closed rows are still omissions: the hatched figure counts every row.
    const chip = container.querySelector('[data-omissions-chip]')
    expect(chip?.textContent).toContain(`${rows} with no record`)
  })

  it('filters to closed, and says the filter', async () => {
    const user = userEvent.setup()
    const { container } = renderOmissions()
    await ready(container)
    const all = container.querySelectorAll('[data-omission]').length

    await user.click(screen.getByRole('button', { name: 'Closed' }))
    await waitFor(() =>
      expect(container.querySelectorAll('[data-omission]').length).toBeLessThan(all),
    )
    const rows = container.querySelectorAll('[data-omission]')
    for (const row of rows) expect(row.getAttribute('data-closure')).toBe('closed')
    const line = container.querySelector('[data-result-line]')
    expect(line?.querySelector('[data-numeric]')?.textContent).toBe(String(rows.length))
    expect(line?.textContent).toMatch(/omission closed/i)
    expect(line?.textContent).toMatch(new RegExp(`of ${all}\\b`))
  }, 30000)
})

describe('closing an omission', () => {
  const manager = () =>
    teamMembers().find(
      (member) =>
        member.role === 'registered_manager' && member.standing.kind === 'has_access',
    )!

  it('is offered on open rows only', async () => {
    const { container } = renderOmissions('registered_manager')
    await ready(container)
    for (const row of container.querySelectorAll('[data-omission]')) {
      const control = within(row as HTMLElement).queryByRole('button', {
        name: 'Close omission',
      })
      if (row.getAttribute('data-closure') === 'open') expect(control).toBeTruthy()
      else expect(control).toBeNull()
    }
  })

  it('names the subject, refuses to confirm without a reason, and records the closure', async () => {
    const user = userEvent.setup()
    const { container } = renderOmissions('registered_manager')
    await ready(container)

    const row = container.querySelector(
      '[data-omission][data-closure="open"]',
    ) as HTMLElement
    const key = row.getAttribute('data-omission')!
    const name = row.querySelector('a[href^="/residents/"]')!.textContent!
    await user.click(within(row).getByRole('button', { name: 'Close omission' }))

    const dialog = await screen.findByRole('alertdialog')
    const title = within(dialog).getByRole('heading')
    // The question names the dose and the person, never "Are you sure?".
    expect(title.textContent).toMatch(
      /^Close the \d{2}:\d{2}, \d{2}\/\d{2}\/\d{4} omission of .+ for .+\?$/,
    )
    expect(dialog.querySelector('[data-confirm-subject]')?.textContent).toBeTruthy()
    // One line at the point of the act: nothing is sent.
    expect(dialog.querySelector('[data-not-performed]')?.textContent).toMatch(
      /^Nobody is notified\./,
    )

    const confirm = within(dialog).getByRole('button', { name: 'Close omission' })
    expect(confirm).toBeDisabled()
    const reason = within(dialog).getByLabelText('Why is it closed?')
    await user.type(reason, '   ')
    expect(confirm).toBeDisabled()

    await user.clear(reason)
    await user.type(reason, 'Pharmacy delivery was late. GP informed.')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    const after = await waitFor(() => {
      const found = container.querySelector(`[data-omission="${key}"]`)
      expect(found?.getAttribute('data-closure')).toBe('closed')
      return found as HTMLElement
    })
    // Still hatched, still "no record", and the closure beside it names who
    // was signed in, and why.
    expect(after.querySelector('[data-state="unrecorded"]')?.textContent).toMatch(
      /no record/i,
    )
    const closure = after.querySelector('[data-omission-closure="closed"]')
    expect(closure?.textContent).toMatch(
      new RegExp(
        `^Closed by ${manager().ref.displayName.replace('.', '\\.')}, .+: Pharmacy delivery was late\\. GP informed\\.$`,
      ),
    )
    expect(within(after).queryByRole('button', { name: 'Close omission' })).toBeNull()
    // The same person's row, still: a closure never lands on somebody else.
    expect(after.querySelector('a[href^="/residents/"]')?.textContent).toBe(name)
  }, 30000)

  it('is not offered to a role that reads Medications', async () => {
    const { container } = renderOmissions('auditor')
    await ready(container)
    expect(
      container.querySelectorAll('[data-omission][data-closure="open"]').length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Close omission' })).toBeNull()
  })
})
