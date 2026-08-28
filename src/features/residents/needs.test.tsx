import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { NeedsTab } from './NeedsTab'
import { NEEDS_SECTIONS, RENDERED_DOMAIN_IDS } from './needs-sections'

/**
 * The Needs tab. PRD §6.2, source PRD §16.2.
 *
 * The failure this screen is most exposed to is not a blank cell — it is a
 * missing row. A Needs tab showing only the domains somebody got round to
 * writing reads as a complete picture of a person's needs, and nothing on the
 * screen says otherwise.
 */

function renderNeeds(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'needs', element: <NeedsTab /> }],
      },
    ],
    { initialEntries: [`/residents/${id}/needs`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('every care plan domain is on the screen', () => {
  /**
   * §16.2's five need groups claim only nine of the ten domains —
   * `end_of_life` belongs to none of them. Rendering the five alone would drop
   * a domain silently, so the leftovers are computed and rendered rather than
   * hardcoded.
   */
  it('renders every domain exactly once across all sections', () => {
    const all = CARE_PLAN_DOMAINS.map((domain) => domain.id).sort()
    expect([...RENDERED_DOMAIN_IDS].sort()).toEqual(all)
    expect(new Set(RENDERED_DOMAIN_IDS).size).toBe(RENDERED_DOMAIN_IDS.length)
  })

  it('keeps the five §16.2 groups, and adds a section only for leftovers', () => {
    // Five groups plus, at most, one catch-all. More than that means the
    // grouping has drifted from the specification.
    expect(NEEDS_SECTIONS.length).toBeGreaterThanOrEqual(5)
    expect(NEEDS_SECTIONS.length).toBeLessThanOrEqual(6)
    const other = NEEDS_SECTIONS.find((section) => section.id === 'other')
    expect(other?.domainIds).toContain('end_of_life')
    // The catch-all explains itself rather than appearing unlabelled.
    expect(other?.description).toMatch(/Future Plans/)
  })

  /**
   * A description is optional now, and that is the rule under test: one
   * belongs on a section only where a reader would misread it without one.
   * The five need groups do not — "Cognitive and mental health needs" over a
   * list of its own domains explains itself, and a sentence restating it is a
   * line between the reader and the record.
   *
   * The catch-all still has one, asserted separately above, because a domain
   * sitting under "Other" with nothing in it reads as unrecorded when it is
   * actually recorded on another tab.
   */
  it('keeps any section description in words, never as a count of its own rows', () => {
    for (const section of NEEDS_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.name} has an empty description`,
      ).not.toBe('')
      // "4 care plan domains" told the reader nothing they could not see, and
      // a bare figure is the one thing forbidden everywhere (CLAUDE.md §1).
      expect(
        section.description,
        `${section.name} describes itself with a bare count`,
      ).not.toMatch(/^\d+ /)
    }
  })

  it.each(residents.map((resident) => [resident.fullLegalName, resident.id] as const))(
    '%s: all ten domains rendered',
    async (name, id) => {
      const { container } = renderNeeds(id)
      await waitFor(() =>
        expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
      )
      for (const domain of CARE_PLAN_DOMAINS) {
        const row = container.querySelector(`[data-domain="${domain.id}"]`)
        expect(
          row,
          `${name}: ${domain.name} is missing from the Needs tab`,
        ).toBeTruthy()
        expect(row?.textContent?.trim()).not.toBe('')
      }
    },
  )
})

describe('a domain with no content says so', () => {
  it('hatches an unwritten domain rather than showing an empty summary', async () => {
    // Ismail Sowande, admitted yesterday: every domain not_started.
    const { container } = renderNeeds('res-sowande')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = container.querySelector(`[data-domain="${domain.id}"]`)
      expect(
        row?.querySelector('[data-state="unrecorded"]'),
        `${domain.name} has no content but did not render the hatch`,
      ).toBeTruthy()
    }
  })

  it('gives support level its own labelled answer on every domain', async () => {
    // Never folded into the status badge beside it, and never a blank —
    // "Independent" and "nobody has assessed them" are opposite claims.
    const { container } = renderNeeds('res-okafor')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = container.querySelector(`[data-domain="${domain.id}"]`)
      expect(row?.textContent, `${domain.name} has no support level`).toMatch(
        /Support level/,
      )
    }
  })

  it('never lets "not assessed" and "Independent" look alike', async () => {
    const { container } = renderNeeds('res-sowande')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    // Support level unassessed is hatched, never rendered as a settled pill.
    const row = container.querySelector('[data-domain="mobility"]')
    expect(row?.textContent).toMatch(/Support level not assessed/)
    expect(row?.textContent).not.toMatch(/Independent/)
  })

  it('opens the editor from the domain, without the gap giving way to it', async () => {
    // Beside the hatch, never instead of it. The affordance arriving is
    // exactly when a gap quietly stops reading as one, so the row is checked
    // for both — the link, and the sentence saying nothing is written.
    const { container } = renderNeeds('res-sowande')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )

    const links = container.querySelectorAll('[data-domain-editor]')
    expect(links.length).toBe(CARE_PLAN_DOMAINS.length)

    for (const domain of CARE_PLAN_DOMAINS) {
      const link = container.querySelector(`[data-domain-editor="${domain.id}"]`)
      expect(link, domain.id).toHaveAttribute(
        'href',
        `/residents/res-sowande/care-plan/${domain.id}`,
      )
    }

    const row = container.querySelector('[data-domain="mobility"]')
    expect(row?.textContent).toMatch(/No care plan content/)
  })
})

describe('the Stale state', () => {
  it('shows a domain past its review date as overdue, with how long', async () => {
    // Grace Adeyemi's mobility domain was finalised 14 months ago and never
    // reviewed — PRD §5.3 gap 7. Unlike General Information, this tab has a
    // real Stale state, because domains carry review dates.
    const { container } = renderNeeds('res-adeyemi')
    await waitFor(() =>
      expect(container.querySelector('[data-domain="mobility"]')).toBeInTheDocument(),
    )
    const row = container.querySelector('[data-domain="mobility"]')
    expect(row?.textContent).toMatch(/Review due/)
    /*
     * How long, in whatever unit reads best — not "days" specifically.
     *
     * This asserted `/days overdue/` and broke when the lateness gained an
     * owner that renders long overdue periods in months. It was pinning the
     * unit in order to check that a duration is stated at all, so a legitimate
     * change to the rendering had to relax it (§8). The property is that the
     * row says *how long*, and a bare "Review due" with no figure fails this.
     */
    expect(row?.textContent).toMatch(/\b\d+ (day|week|month|year)s? overdue/)
  })
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderNeeds('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderNeeds('res-adeyemi')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
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

describe('a revision in progress', () => {
  /*
   * The domain that carries a signed version and an unsigned rewrite, found
   * by property rather than pinned — it is a fixture case today and a thing
   * anybody can create with the editor, and either should satisfy this.
   */
  const revised = residents.flatMap((resident) =>
    resident.carePlan
      .filter(
        (domain) =>
          domain.versions.kind === 'finalised' && domain.draft.kind === 'draft',
      )
      .map((domain) => ({ resident, domain })),
  )[0]

  it('has a fixture reaching it at all', () => {
    expect(
      revised,
      'no resident has a signed domain with a draft over it',
    ).toBeDefined()
  })

  it('says a revision is being written, quietly and without a treatment', async () => {
    /*
     * Nothing this tab claimed was false while it said nothing — but
     * "somebody is rewriting this" is a fact about the current plan, and a
     * reader who does not know it may act on a version about to be
     * superseded.
     */
    const { container } = renderNeeds(revised!.resident.id)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-domain="${revised!.domain.domainId}"]`),
      ).toBeInTheDocument(),
    )

    const row = container.querySelector(`[data-domain="${revised!.domain.domainId}"]`)
    const line = row?.querySelector('[data-revision]')
    expect(line?.textContent).toMatch(/revision is in progress, not yet signed/)
    if (revised!.domain.draft.kind !== 'draft') throw new Error('expected a draft')
    expect(line?.textContent).toContain(revised!.domain.draft.updatedBy.displayName)

    // Quiet: plain text at the weight the settled facts sit at. No pill, no
    // hatch — this tab is read-only and the revision is context, not a call
    // to action.
    expect(line?.tagName).toBe('P')
    expect(
      line?.querySelector('[class*="statusPill"], [class*="unrecorded"]'),
    ).toBeNull()
  })

  it('does not move the status: only a signature does that', async () => {
    // The signed version is still in force and still what staff follow. A
    // revision that changed the status would say the plan had stopped being
    // the plan because somebody started typing.
    const { container } = renderNeeds(revised!.resident.id)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-domain="${revised!.domain.domainId}"]`),
      ).toBeInTheDocument(),
    )

    const row = container.querySelector(`[data-domain="${revised!.domain.domainId}"]`)
    expect(revised!.domain.status.kind).toBe('complete')
    expect(row?.textContent).toMatch(/Complete/)
    expect(row?.textContent).not.toMatch(/In progress/)
    expect(row?.textContent).not.toMatch(/Not started/)
  })

  it('says nothing extra where the draft is the only thing there', async () => {
    // `in_progress` already says a draft exists and who is writing it.
    // Saying it twice in one cell is volume drowning a distinction.
    const partWritten = residents.flatMap((resident) =>
      resident.carePlan
        .filter((domain) => domain.status.kind === 'in_progress')
        .map((domain) => ({ resident, domain })),
    )[0]
    expect(partWritten).toBeDefined()

    const { container } = renderNeeds(partWritten!.resident.id)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-domain="${partWritten!.domain.domainId}"]`),
      ).toBeInTheDocument(),
    )

    const row = container.querySelector(
      `[data-domain="${partWritten!.domain.domainId}"]`,
    )
    expect(row?.textContent).toMatch(/In progress/)
    expect(row?.querySelector('[data-revision]')).toBeNull()
  })
})
