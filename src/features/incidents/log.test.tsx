import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { incidents } from '@/data/fixtures/incidents'
import { IncidentLogRoute } from './IncidentLogRoute'

/**
 * The incident log. PRD §6.5.
 *
 * The fourth queue in the shape `/care-notes`, omissions and handover already
 * share, so most of what matters here is that it matches them. What is
 * specific: two findings that are never summed, and no acknowledge control on
 * a row.
 */

const AT_SITE = incidents.filter(
  (incident) => incident.siteId === 'site-rosewood-court',
)

function renderLog() {
  const router = createMemoryRouter(
    [
      { path: '/incidents', element: <IncidentLogRoute /> },
      { path: '/incidents/:incidentId', element: <p>detail</p> },
      { path: '/incidents/new', element: <p>form</p> },
    ],
    { initialEntries: ['/incidents'] },
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
  await waitFor(() => expect(container.querySelector('[data-incident]')).toBeTruthy())
  return container
}

describe('two findings, never one and never summed', () => {
  it('leads with unacknowledged and puts undecided beside it', async () => {
    const { container } = renderLog()
    await listed(container)

    const lead = container.querySelector('[data-finding="unacknowledged"]')!
    const secondary = container.querySelector('[data-finding="undecided"]')!
    expect(lead).toBeTruthy()
    expect(secondary).toBeTruthy()

    // The lead is the thing still fixable by whoever is looking, so it takes
    // the hatch. The secondary is graver but older and sits on a plain
    // surface — a second hatch would make them look like the same failure.
    expect(
      lead.querySelector('[data-state="unrecorded"]') ?? lead.className,
    ).toBeTruthy()
    expect(lead.className).not.toBe(secondary.className)
    expect(
      lead.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('never adds them together', async () => {
    const { container } = renderLog()
    await listed(container)

    const unacknowledged = AT_SITE.filter(
      (incident) => incident.status.kind === 'reported_not_acknowledged',
    ).length
    const undecided = AT_SITE.filter(
      (incident) => incident.notification.kind === 'not_yet_decided',
    ).length

    // An incident can be in both, so a total would double-count — and they are
    // different failures, which is the reason that matters.
    const both = AT_SITE.filter(
      (incident) =>
        incident.status.kind === 'reported_not_acknowledged' &&
        incident.notification.kind === 'not_yet_decided',
    ).length
    expect(
      both,
      'no incident is in both findings, so the overlap is untested',
    ).toBeGreaterThan(0)

    const figures = [
      ...container.querySelectorAll('[data-finding] [data-numeric]'),
    ].map((node) => node.textContent)
    expect(figures).toContain(String(unacknowledged))
    expect(figures).toContain(String(undecided))
    expect(figures).not.toContain(String(unacknowledged + undecided))
  })

  it('gives both figures their denominator', async () => {
    const { container } = renderLog()
    await listed(container)

    for (const card of container.querySelectorAll('[data-finding]')) {
      expect(card.textContent, card.getAttribute('data-finding')!).toMatch(
        /Of \d[\d,]* /,
      )
      expect(card.textContent).toMatch(/Rosewood Court/)
    }
  })
})

describe('no acknowledging from the list', () => {
  it('offers exactly one control per row, and it opens', async () => {
    const { container } = renderLog()
    await listed(container)

    // Acknowledging without reading is the failure the unacknowledged state
    // exists to make visible, and a one-tap control on a list invites it.
    for (const row of container.querySelectorAll('[data-incident]')) {
      expect(row.querySelectorAll('button').length).toBe(0)
      expect(row.textContent).toMatch(/Open$/)
    }
    // Anchored, because /Acknowledge/i also matches the "Not acknowledged"
    // filter pill — a loose pattern that fires on the control the screen is
    // supposed to have proves nothing about the one it must not (§8).
    expect(screen.queryByRole('button', { name: /^Acknowledge/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Acknowledge/i })).toBeNull()
  })

  it('lands on the detail screen, where the account is', async () => {
    const { container } = renderLog()
    await listed(container)

    const row = container.querySelector('[data-incident]')!
    expect(row.getAttribute('href')).toMatch(/^\/incidents\/inc-/)
  })
})

describe('the fourth queue matches the other three', () => {
  it('opens on its own finding rather than on everything', async () => {
    const { container } = renderLog()
    await listed(container)

    const active = container.querySelector('[data-status-filter][aria-pressed="true"]')!
    expect(active.getAttribute('data-status-filter')).toBe('not_acknowledged')
  })

  it('orders oldest first, because the wait is the finding', async () => {
    const { container } = renderLog()
    await listed(container)

    const ids = [...container.querySelectorAll('[data-incident]')].map((row) =>
      row.getAttribute('data-incident'),
    )
    const reported = ids.map(
      (id) => incidents.find((incident) => incident.id === id)!.reported.at,
    )
    expect(reported).toEqual([...reported].sort())
    expect(container.querySelector('[class*="resultLine"]')!.textContent).toMatch(
      /Oldest first/,
    )
  })

  it('names the filter on the figure when one is narrowing the list', async () => {
    const user = userEvent.setup()
    const { container } = renderLog()
    await listed(container)

    // Rule 3c: a count over a filtered set carries the filter, or it is false.
    const line = container.querySelector('[class*="resultLine"]')!
    expect(line.textContent).toMatch(/of \d[\d,]* shown/)

    await user.click(container.querySelector('[data-status-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelector('[class*="resultLine"]')!.textContent).toBe(
        'Oldest first',
      ),
    )
  })

  it('names a resident on every row, or says nobody was involved', async () => {
    const user = userEvent.setup()
    const { container } = renderLog()
    await listed(container)
    await user.click(container.querySelector('[data-status-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelectorAll('[data-incident]').length).toBeGreaterThan(5),
    )

    for (const row of container.querySelectorAll('[data-incident]')) {
      const who = row.firstElementChild!
      expect(who.textContent!.trim().length).toBeGreaterThan(0)
      expect(who.textContent).not.toBe('—') // dash-ok: asserts the dash is absent
    }

    // And the no-resident case is a claim with a name, never an empty column.
    const nobody = [...container.querySelectorAll('[data-incident]')].find((row) =>
      row.textContent?.includes('No resident involved'),
    )
    expect(nobody, 'no row reaches the no-resident case').toBeTruthy()
    expect(nobody!.textContent).toMatch(/recorded by/)
  })
})

describe('the row', () => {
  it('renders a closed incident quietly, with no chip', async () => {
    const user = userEvent.setup()
    const { container } = renderLog()
    await listed(container)
    await user.click(container.querySelector('[data-status-filter="closed"]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-status="closed"]')).toBeTruthy(),
    )

    const closed = container.querySelector('[data-status="closed"]')!
    // Recorded and unremarkable renders quietly (§3b) — a column of closed
    // pills would drown the rows that are the reason to open this screen.
    expect(closed.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(closed.textContent).toMatch(/Closed/)
  })

  it('shows how long an unacknowledged incident has waited', async () => {
    const { container } = renderLog()
    await listed(container)

    const waiting = container.querySelector(
      '[data-status="reported_not_acknowledged"]',
    )!
    expect(waiting.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(waiting.textContent).toMatch(/waiting/)
  })

  it('gets a reader from the second finding to the rows it counts', async () => {
    const user = userEvent.setup()
    const { container } = renderLog()
    await listed(container)
    await user.click(container.querySelector('[data-status-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelectorAll('[data-incident]').length).toBeGreaterThan(5),
    )

    // The secondary figure is not a dead number: the per-row line is how
    // somebody finds the incidents behind it.
    const owed = [...container.querySelectorAll('[data-owed]')]
    expect(owed.length).toBeGreaterThan(0)
    expect(
      owed.some((node) => node.textContent?.includes('notification undecided')),
    ).toBe(true)
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderLog()
    await listed(container)
    expect((await axe(container)).violations).toEqual([])
  }, 60000)

  it('puts the report action in the head, not the filter row', async () => {
    const { container } = renderLog()
    await listed(container)

    const action = screen.getByRole('link', { name: /Report an incident/ })
    const filters = container.querySelector('[class*="filters"]')!
    expect(filters.contains(action)).toBe(false)
    const head = container.querySelector<HTMLElement>('[class*="logHead"]')!
    expect(within(head).getByRole('link')).toBe(action)
  })
})
