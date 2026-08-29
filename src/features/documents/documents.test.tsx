import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { DocumentRecord, IsoDate, StaffRef } from '@/data/types'
import { MIN_POPULATION_FOR_A_RATE } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { residentDocuments } from '@/data/access/document-store'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { DocumentsTab } from './DocumentsTab'
import { OrganisationLibraryRoute } from './OrganisationLibraryRoute'
import { ExpiryQueueRoute } from './ExpiryQueueRoute'
import { DOCUMENT_CATEGORIES } from './categories'
import { countExpiry, expiryDecisionCoverage, expiryFinding } from './expiry'
import {
  brokenReferences,
  expectationFor,
  organisationRows,
  residentLibrary,
} from './library'

/**
 * Documents. PRD §6.7, Phase 11.
 *
 * **The module's hazard is that a blank category and an unfiled document look
 * identical.** Everything here is about the difference: seven categories
 * whether or not they hold anything, a category another module says should not
 * be empty, an id that resolves to nothing, and an expiry nobody has decided.
 */

/**
 * A pinned day, and every date-dependent assertion is written against it.
 *
 * Not after it fails at 04:42. `expiryFinding` takes the day as an argument
 * precisely so a test can hold it still — a suite whose colour depends on the
 * hour reads as flakiness and gets retried rather than read.
 */
const TODAY = '2026-08-25' as IsoDate

const staff: StaffRef = staffOkonkwo

const document = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'doc-test-0001',
  owner: { kind: 'resident', residentId: residents[0]!.id },
  category: 'health_clinical',
  title: 'GP summary care record',
  file: { kind: 'described', format: 'PDF', bytes: 1024 * 1024 },
  expiry: { kind: 'not_recorded' },
  filedBy: staff,
  filedOn: '2026-01-04' as IsoDate,
  ...over,
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'documents', element: <OrganisationLibraryRoute /> },
      { path: 'documents/expiry', element: <ExpiryQueueRoute /> },
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'documents', element: <DocumentsTab /> }],
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

const settled = (container: HTMLElement) =>
  waitFor(() =>
    expect(
      container.querySelector(
        '[data-documents-panel], [data-org-row], [data-filter-claim]',
      ),
    ).toBeTruthy(),
  )

/** The running example: a DNAR on file, a broken prescription reference. */
const okafor = residents.find((resident) => resident.id === 'res-okafor')!
/** Photography consent withdrawn, with 14 photographs counted as remaining. */
const brennan = residents.find((resident) => resident.id === 'res-brennan')!

describe('expiry is a decision, not a date field', () => {
  it('renders does-not-expire with the person who decided it', () => {
    const finding = expiryFinding(
      { kind: 'does_not_expire', decidedBy: staff, on: '2026-03-12' as IsoDate },
      TODAY,
    )
    expect(finding).toEqual({
      kind: 'does_not_expire',
      decidedBy: staff,
      on: '2026-03-12',
    })
  })

  it('separates a permanence decision from nobody having decided', () => {
    const decided = expiryFinding(
      { kind: 'does_not_expire', decidedBy: staff, on: '2026-03-12' as IsoDate },
      TODAY,
    )
    const undecided = expiryFinding({ kind: 'not_recorded' }, TODAY)
    expect(decided.kind).not.toBe(undecided.kind)
  })

  it('counts a document expiring today as expiring, not as expired', () => {
    // The boundary is the one place a broken mechanism and a working one give
    // the same answer, so it is asserted rather than assumed.
    expect(expiryFinding({ kind: 'expires', on: TODAY }, TODAY)).toEqual({
      kind: 'expiring',
      on: TODAY,
      inDays: 0,
    })
  })

  it('holds the window at 30 days with room either side', () => {
    const inside = expiryFinding(
      { kind: 'expires', on: '2026-09-24' as IsoDate },
      TODAY,
    )
    const outside = expiryFinding(
      { kind: 'expires', on: '2026-09-25' as IsoDate },
      TODAY,
    )
    expect(inside.kind).toBe('expiring')
    expect(outside.kind).toBe('in_date')
  })

  it('never sums the three findings', () => {
    const counts = countExpiry(
      [
        document({
          id: 'doc-a',
          expiry: { kind: 'expires', on: '2026-01-01' as IsoDate },
        }),
        document({
          id: 'doc-b',
          expiry: { kind: 'expires', on: '2026-09-01' as IsoDate },
        }),
        document({ id: 'doc-c', expiry: { kind: 'not_recorded' } }),
        document({
          id: 'doc-d',
          expiry: { kind: 'does_not_expire', decidedBy: staff, on: TODAY },
        }),
      ],
      TODAY,
    )
    expect(counts).toEqual({ expired: 1, expiring: 1, notRecorded: 1, total: 4 })
  })
})

describe('coverage is about whether anything can answer, not about the answer', () => {
  it('counts a lapsed date as a decision somebody made', () => {
    const lapsed = Array.from({ length: MIN_POPULATION_FOR_A_RATE }, (_, index) =>
      document({
        id: `doc-lapsed-${index}`,
        expiry: { kind: 'expires', on: '2020-01-01' as IsoDate },
      }),
    )
    const aggregate = expiryDecisionCoverage(lapsed, 'Rosewood Court')
    expect(aggregate.kind).toBe('measured')
    expect(aggregate.coverage).toEqual({
      covered: MIN_POPULATION_FOR_A_RATE,
      total: MIN_POPULATION_FOR_A_RATE,
    })
  })

  it('renders Insufficient Evidence below the population floor', () => {
    const thin = Array.from({ length: MIN_POPULATION_FOR_A_RATE - 1 }, (_, index) =>
      document({ id: `doc-thin-${index}` }),
    )
    expect(expiryDecisionCoverage(thin, 'Ashgrove Lodge').kind).toBe(
      'insufficient_evidence',
    )
  })
})

describe("a resident's library", () => {
  it('lists all seven categories whatever the resident holds', async () => {
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const rendered = [...container.querySelectorAll('[data-category]')].map((section) =>
      section.getAttribute('data-category'),
    )
    expect(rendered).toEqual(DOCUMENT_CATEGORIES.map((category) => category.id))
  })

  it('puts legal and authority first, because that is the emergency order', () => {
    expect(DOCUMENT_CATEGORIES[0]?.id).toBe('legal_authority')
    const alphabetical = [...DOCUMENT_CATEGORIES]
      .map((category) => category.label)
      .sort((a, b) => a.localeCompare(b))
    expect(DOCUMENT_CATEGORIES.map((category) => category.label)).not.toEqual(
      alphabetical,
    )
  })

  it('renders the third finding as a gap, never as a milder amber', async () => {
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const gap = container.querySelector('[data-finding="not_recorded"]')!
    expect(gap.getAttribute('data-state')).toBe('unrecorded')
    expect(container.querySelector('[data-finding="expired"]')).not.toHaveAttribute(
      'data-state',
      'unrecorded',
    )
  })

  it('states the denominator on every finding', async () => {
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const onFile = residentDocuments(okafor.id).length
    for (const kind of ['expired', 'expiring', 'not_recorded']) {
      const finding = container.querySelector(`[data-finding="${kind}"]`)!
      // The number and what it counts, rather than the sentence around them.
      expect(finding.textContent).toMatch(new RegExp(`\\b${onFile}\\b`))
      expect(finding.textContent).toContain('documents on file')
    }
  })

  it('offers nothing to open, because nothing opens in this build', async () => {
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const panel = container.querySelector('[data-documents-panel]')!
    expect(
      within(panel as HTMLElement).queryByRole('button', { name: 'Open' }),
    ).toBeNull()
    expect(
      within(panel as HTMLElement).queryByRole('link', { name: 'Open' }),
    ).toBeNull()
  })
})

describe('the pinned lapsed DNACPR', () => {
  it('is in force on the profile and lapsed in the library', async () => {
    /*
     * The case somebody should meet in review, and it is pinned rather than
     * drawn: a resuscitation decision the badge strip shows as in force,
     * resting on a document that expired. Held by reference to the record
     * rather than by a count the spread could move.
     */
    const resuscitation = okafor.futurePlans.resuscitation
    expect(resuscitation.kind).toBe('dnar_in_place')
    if (resuscitation.kind !== 'dnar_in_place') return

    const form = residentDocuments(okafor.id).find(
      (record) => record.id === resuscitation.documentId,
    )
    expect(form).toBeDefined()
    expect(form!.expiry.kind).toBe('expires')

    const finding = expiryFinding(form!.expiry, TODAY)
    expect(finding.kind).toBe('expired')
    // A document cannot lapse before the decision it records was made.
    if (form!.expiry.kind !== 'expires') return
    expect(form!.expiry.on > resuscitation.signedOn).toBe(true)
  })

  it('renders it as a finding in Legal and authority', async () => {
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const resuscitation = okafor.futurePlans.resuscitation
    if (resuscitation.kind !== 'dnar_in_place') throw new Error('needs a DNAR')

    const row = container.querySelector(
      `[data-document="${resuscitation.documentId}"]`,
    )!
    expect(row.closest('[data-category]')).toHaveAttribute(
      'data-category',
      'legal_authority',
    )
    expect(row.querySelector('[data-expiry="expired"]')).toBeTruthy()
  })
})

describe('a reference that resolves to nothing', () => {
  it('is a row in its category, hatched and unlinked', async () => {
    const broken = brokenReferences(okafor, residentDocuments(okafor.id))
    expect(broken.length).toBeGreaterThan(0)

    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const row = container.querySelector('[data-row="referenced_not_on_file"]')!
    expect(row.querySelector('[data-broken-reference]')).toBeTruthy()
    expect(row.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // Never a link that fails on click.
    expect(within(row as HTMLElement).queryByRole('link')).toBeNull()
    expect(within(row as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('names the id and the module that holds it', async () => {
    const broken = brokenReferences(okafor, residentDocuments(okafor.id))
    const first = broken[0]!

    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)

    const hatch = container.querySelector(`[data-broken-reference="${first.id}"]`)!
    expect(hatch.textContent).toContain(first.id)
    expect(hatch.textContent).toContain(first.origin)
  })
})

describe('empty is not always emptiness', () => {
  it('renders a quiet emptiness where nothing implies a document', () => {
    const resident = residents.find((candidate) =>
      residentLibrary(
        candidate,
        residentDocuments(candidate.id),
        TODAY,
      ).categories.some((category) => category.state.kind === 'empty'),
    )
    expect(resident).toBeDefined()
  })

  it("renders a gap where another module's record says a document exists", () => {
    const sites = residents.flatMap((resident) =>
      residentLibrary(resident, residentDocuments(resident.id), TODAY)
        .categories.filter((category) => category.state.kind === 'expected_but_empty')
        .map((category) => `${resident.id}/${category.id}`),
    )
    // Enough to reach the branch, few enough not to drown the distinction.
    expect(sites.length).toBeGreaterThan(0)
    expect(sites.length).toBeLessThan(
      residents.length * DOCUMENT_CATEGORIES.length * 0.2,
    )
  })

  it("carries Phase 10's counted photographs through to the library", () => {
    /*
     * The sharpest case in the module, and it is cross-module: withdrawing
     * photography consent recorded 14 photographs it could not undo, and the
     * Photographs category holds nothing. Two records disagreeing, derived
     * rather than remembered.
     */
    const photography = brennan.consents.photography
    expect(photography.kind).toBe('withdrawn')

    const expectation = expectationFor(brennan, 'photographs_media')
    expect(expectation?.missing).toContain('14')
    expect(
      residentDocuments(brennan.id).filter(
        (record) => record.category === 'photographs_media',
      ),
    ).toHaveLength(0)
  })

  it('renders that gap in the hatch rather than as "No documents"', async () => {
    const { container } = renderAt(`/residents/${brennan.id}/documents`)
    await settled(container)

    const section = container.querySelector('[data-category="photographs_media"]')!
    expect(section.querySelector('[data-empty="expected"]')).toBeTruthy()
    expect(section.querySelector('[data-empty="nothing"]')).toBeNull()
    expect(section.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })
})

describe('the organisation library', () => {
  it('orders categories by what is expiring, not alphabetically', () => {
    const documents = DOCUMENT_CATEGORIES.map((category, index) =>
      document({
        id: `doc-org-${index}`,
        category: category.id,
        expiry:
          category.id === 'photographs_media'
            ? { kind: 'expires', on: '2026-01-01' as IsoDate }
            : { kind: 'does_not_expire', decidedBy: staff, on: TODAY },
      }),
    )
    const rows = organisationRows(documents, TODAY)
    expect(rows[0]?.id).toBe('photographs_media')
  })

  it('carries the denominator on the coverage figure', async () => {
    const { container } = renderAt('/documents')
    await settled(container)

    const figure = container.querySelector('[data-emphasis="lead"]')!
    expect(figure.textContent).toMatch(/\d+ of \d+ documents/)
  })
})

describe('expiry tracking', () => {
  it('names the filter in the claim it makes', async () => {
    const { container } = renderAt('/documents/expiry')
    await settled(container)

    const claim = container.querySelector('[data-filter-claim]')!
    expect(claim.textContent).toContain('the documents that have expired')
    expect(claim.textContent).toMatch(/of \d+ documents at/)
  })

  it('changes the claim with the filter', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/documents/expiry')
    await settled(container)

    await user.click(container.querySelector('[data-filter="not_recorded"]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-filter-claim]')!.textContent).toContain(
        'the documents with no expiry recorded',
      ),
    )
  })
})

describe('filing a document', () => {
  const openDrawer = async (
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement,
  ) => {
    await user.click(container.querySelector('[data-add-document]')!)
    return waitFor(() => {
      const drawer = window.document.querySelector('[data-drawer-section="subject"]')
      expect(drawer).toBeTruthy()
      return drawer!
    })
  }

  it('answers the subject first and names it', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    const subject = await openDrawer(user, container)

    expect(subject.textContent).toContain(okafor.fullLegalName)
    // §2.4: the subject comes from the route, never from what was last viewed.
    expect(
      window.document.querySelector(`[data-subject*="${okafor.fullLegalName}"]`),
    ).toBeTruthy()
  })

  it('offers no default answer on whether it expires', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    await openDrawer(user, container)

    for (const choice of ['expires', 'does_not_expire']) {
      const option = window.document.querySelector(`[data-choice="${choice}"] input`)!
      expect((option as HTMLInputElement).checked).toBe(false)
    }
  })

  it('waits on everything it has not been told', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    await openDrawer(user, container)

    const waiting = window.document.querySelector('[data-waiting]')!
    expect(waiting.textContent).toContain('which category it belongs in')
    expect(waiting.textContent).toContain('what this document is')
    expect(waiting.textContent).toContain('a file')
    expect(
      window.document.querySelector<HTMLButtonElement>('[data-file-document]')!
        .disabled,
    ).toBe(true)
  })

  it('says the file is not stored where the file is chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    await openDrawer(user, container)

    const section = window.document.querySelector('[data-drawer-section="file"]')!
    expect(section.querySelector('[data-not-stored]')).toBeTruthy()
    expect(section.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('locks the subject once a file is chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    await openDrawer(user, container)

    expect(window.document.querySelector('[data-subject-locked]')).toBeNull()
    await user.click(window.document.querySelector('[data-choose-file="PDF"]')!)
    await waitFor(() =>
      expect(window.document.querySelector('[data-subject-locked]')).toBeTruthy(),
    )
  })

  it('files a document with no expiry answer as a gap, never as permanent', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`/residents/${okafor.id}/documents`)
    await settled(container)
    await openDrawer(user, container)

    await user.selectOptions(
      window.document.querySelector('[data-field="category"]')!,
      'correspondence',
    )
    await user.type(
      window.document.querySelector('[data-field="title"]')!,
      'Letter from the GP practice',
    )
    await user.click(window.document.querySelector('[data-choose-file="PDF"]')!)
    await user.click(window.document.querySelector('[data-file-document]')!)

    const row = await waitFor(() => {
      const found = [...container.querySelectorAll('[data-row="document"]')].find(
        (candidate) => candidate.textContent?.includes('Letter from the GP practice'),
      )
      expect(found).toBeTruthy()
      return found!
    })

    expect(row.querySelector('[data-expiry="not_recorded"]')).toBeTruthy()
    expect(row.querySelector('[data-expiry="does_not_expire"]')).toBeNull()
    // And it says plainly that there is nothing to open.
    expect(row.querySelector('[data-file="not_retrievable"]')).toBeTruthy()
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the resident library', async () => {
    await check(`/residents/${okafor.id}/documents`)
  }, 30000)

  it('has no violations on the organisation library', async () => {
    await check('/documents')
  }, 30000)

  it('has no violations on expiry tracking', async () => {
    await check('/documents/expiry')
  }, 30000)
})

describe('the expiry queue pages, and says so', () => {
  /**
   * "Everything on file" is 346 rows at Rosewood Court. Paging is right here
   * and wrong on the note timeline, and the difference is worth keeping
   * straight: this list makes no claim about the stretches *between* its rows,
   * so a page boundary invents nothing. The timeline does, which is why it
   * takes a window instead.
   *
   * What paging does risk is the denominator. A reader shown twenty-five rows
   * has been told the site holds twenty-five unless the sentence says
   * otherwise, so the claim carries the slice as well as both totals.
   */

  const showEverything = async (
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement,
  ) => {
    await user.click(container.querySelector('[data-filter="all"]')!)
  }

  it('draws a page rather than the whole library', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/documents/expiry')
    await waitFor(() =>
      expect(container.querySelector('[data-expiry-queue]')).toBeTruthy(),
    )
    await showEverything(user, container)

    await waitFor(() =>
      expect(container.querySelector('[data-documents-pager]')).toBeTruthy(),
    )
    const drawn = container.querySelectorAll('[data-queue-row]').length
    expect(drawn).toBeGreaterThan(0)
    expect(drawn).toBeLessThanOrEqual(25)
  }, 30000)

  it('states the slice as well as what it is a slice of', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/documents/expiry')
    await waitFor(() =>
      expect(container.querySelector('[data-expiry-queue]')).toBeTruthy(),
    )
    await showEverything(user, container)
    await waitFor(() =>
      expect(container.querySelector('[data-documents-pager]')).toBeTruthy(),
    )

    const claim = container.querySelector('[data-filter-claim]')?.textContent ?? ''
    const drawn = container.querySelectorAll('[data-queue-row]').length
    // The rows on screen, named — not left for the reader to infer.
    expect(claim).toMatch(/On screen: 1 to \d+/i)
    // And the totals it is a slice of, both still there.
    const figures = [...claim.matchAll(/[\d,]+/g)].map((m) =>
      Number(m[0].replace(/,/g, '')),
    )
    expect(Math.max(...figures)).toBeGreaterThan(drawn)
  }, 30000)

  it('moves through the pages and keeps the claim honest', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/documents/expiry')
    await waitFor(() =>
      expect(container.querySelector('[data-expiry-queue]')).toBeTruthy(),
    )
    await showEverything(user, container)
    await waitFor(() =>
      expect(container.querySelector('[data-documents-pager]')).toBeTruthy(),
    )

    const first = container
      .querySelector('[data-queue-row]')
      ?.getAttribute('data-queue-row')
    await user.click(container.querySelector('[data-documents-next]')!)

    await waitFor(() => {
      const now = container
        .querySelector('[data-queue-row]')
        ?.getAttribute('data-queue-row')
      expect(now).not.toBe(first)
    })
    expect(container.querySelector('[data-filter-claim]')?.textContent).toMatch(
      /On screen: 26 to \d+/i,
    )
  }, 30000)
})
