import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { OmissionsRoute } from './OmissionsRoute'

/**
 * Omissions across the home. PRD §6.4.
 *
 * The sentence: these doses were missed across the home, and this is how long
 * ago. What is under test is that no row can render without its resident, that
 * the wait is what orders the list, and that every figure is a fraction of
 * doses rather than of people.
 */

function renderOmissions() {
  const router = createMemoryRouter(
    [{ path: '/medications', element: <OmissionsRoute /> }],
    { initialEntries: ['/medications'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
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
