import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { DocumentId, IsoDate, IsoDateTime, SiteId } from '@/data/types'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { documents, documentsForSite } from '@/data/fixtures/documents'
import { now } from '@/data/fixtures/clock'
import { zonedDate } from '@/lib/format'
import { DOCUMENT_CATEGORIES } from './categories'
import { countExpiry, expiryFinding } from './expiry'
import { CategoryLibraryRoute } from './CategoryLibraryRoute'
import { OrganisationLibraryRoute } from './OrganisationLibraryRoute'

/**
 * One category of the home's library. PRD §6.7.
 *
 * The module's hazard is a screen that disagrees with the row a reader
 * followed to reach it, so the four figures here are counted over the same
 * documents the row counted.
 */
const ROSEWOOD = 'site-rosewood-court'

/** From the clock the fixtures were built against, never a date typed here. */
const TODAY: IsoDate = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'documents', element: <OrganisationLibraryRoute /> },
      { path: 'documents/category/:categoryId', element: <CategoryLibraryRoute /> },
      { path: 'documents/:documentId', element: <p>viewer</p> },
      { path: 'residents/:residentId/documents', element: <p>resident</p> },
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

/*
 * The screen loads this home's documents, so the test counts this home's. The
 * first version filtered only the site-owned ones by site and left every other
 * home's residents in, which made the expected total 119 against a screen
 * showing 109 — a test measuring a different set from the thing under test.
 */
const inCategory = (id: string) =>
  documentsForSite(ROSEWOOD as SiteId).filter((entry) => entry.category === id)

describe('the module leads into a category', () => {
  it('opens every category from its own name', async () => {
    const { container } = renderAt('/documents')
    await waitFor(() =>
      expect(container.querySelectorAll('[data-org-row]').length).toBeGreaterThan(0),
    )
    for (const row of container.querySelectorAll('[data-org-row]')) {
      const id = row.getAttribute('data-org-row')
      const link = row.querySelector(`[data-open-category="${id}"]`)
      expect(link?.getAttribute('href'), String(id)).toBe(`/documents/category/${id}`)
    }
  })
})

describe('the documents in a category', () => {
  it('lists only this category, expired first, and opens each one', async () => {
    const { container } = renderAt('/documents/category/health_clinical')
    await waitFor(() =>
      expect(container.querySelectorAll('[data-queue-row]').length).toBeGreaterThan(0),
    )

    const rows = [...container.querySelectorAll('[data-queue-row]')]
    const mine = new Map(
      documents
        .filter((entry) => entry.category === 'health_clinical')
        .map((entry) => [entry.id, entry]),
    )

    for (const row of rows) {
      const id = row.getAttribute('data-queue-row') as DocumentId
      expect(mine.has(id), id).toBe(true)
      const opens = row.querySelector('[data-action="open"]')
      const not = row.querySelector('[data-action="not_retrievable"]')
      // Exactly one way in, or a stated reason there is none.
      expect(Boolean(opens) !== Boolean(not), id).toBe(true)
      if (opens) expect(opens.getAttribute('href')).toBe(`/documents/${id}`)
    }

    // Expired first: the order is the finding.
    const rank = ['expired', 'expiring', 'not_recorded', 'in_date', 'does_not_expire']
    const ranked = rows.map((row) =>
      rank.indexOf(
        expiryFinding(
          mine.get(row.getAttribute('data-queue-row') as DocumentId)!.expiry,
          TODAY,
        ).kind,
      ),
    )
    expect(ranked).toEqual([...ranked].sort((a, b) => a - b))
  })

  it('carries the same four figures as the row that led here', async () => {
    const { container } = renderAt('/documents/category/health_clinical')
    const figures = await waitFor(() => {
      const found = container.querySelector('[data-category-figures]')
      expect(found).toBeTruthy()
      return found!
    })
    const counts = countExpiry(inCategory('health_clinical'), TODAY)

    const of = (what: string) =>
      figures.querySelector(`[data-org-count="${what}"]`)?.textContent ?? ''
    expect(of('total')).toContain(String(counts.total))
    expect(of('expired')).toContain(String(counts.expired))
    expect(of('expiring')).toContain(String(counts.expiring))
    expect(of('not_recorded')).toContain('with no expiry recorded')
  })

  it('says a category nobody has filed in holds nothing, and what it is for', async () => {
    const empty = DOCUMENT_CATEGORIES.find(
      (entry) =>
        documents.filter((document) => document.category === entry.id).length === 0,
    )
    if (empty === undefined) return
    const { container } = renderAt(`/documents/category/${empty.id}`)
    const said = await waitFor(() => {
      const found = container.querySelector('[data-category-empty]')
      expect(found).toBeTruthy()
      return found!
    })
    expect(said.textContent).toContain(empty.holds)
    // Empty is not a gap: nothing says a document ought to be here.
    expect(said.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  it('says so when the address is not a category', async () => {
    const { container } = renderAt('/documents/category/not_a_category')
    await waitFor(() => expect(container.textContent).toContain('Not a category'))
    expect(container.querySelector('[data-queue-row]')).toBeNull()
  })
})
