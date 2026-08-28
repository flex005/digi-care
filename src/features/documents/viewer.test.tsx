import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { documents } from '@/data/fixtures/documents'
import { residents } from '@/data/fixtures/residents'
import { documentReferrers } from './referrers'
import { DocumentViewerRoute } from './DocumentViewerRoute'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { DocumentsTab } from './DocumentsTab'

/**
 * Opening a document. PRD §6.6f.
 *
 * The viewer replaces "not retrievable" for a document whose metadata is real,
 * and replaces nothing else. Half of these guards are about what it left alone.
 */

function renderViewer(id: string) {
  const router = createMemoryRouter(
    [
      { path: 'documents/:documentId', element: <DocumentViewerRoute /> },
      { path: 'documents', element: <p>library</p> },
      { path: 'residents/:residentId', element: <p>profile</p> },
    ],
    { initialEntries: [`/documents/${id}`] },
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

const onFile = documents.find((entry) => entry.file.kind !== 'not_retrievable')!
const settled = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-document-viewer]')).toBeTruthy())

describe('the sample says it is a sample, above the page and not across it', () => {
  it('states what is being shown before the document itself', async () => {
    const { container } = renderViewer(onFile.id)
    await settled(container)

    const banner = container.querySelector('[data-sample-banner]')!
    expect(banner.textContent).toMatch(/sample document/i)
    expect(banner.textContent).toMatch(/no file storage/i)

    /*
     * Above, not across. A watermark would make the sample unreadable, and an
     * interface that obscures its own content is a lesson already paid for
     * once in this build.
     */
    const stage = banner.parentElement!
    const page = stage.querySelector('[data-document-sample]')!
    expect(
      banner.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // The page is a sibling of the notice, not its container: nothing this
    // screen says about the document is laid over the document.
    expect(page.contains(banner)).toBe(false)
  })

  it('puts this record’s own name and dates on the sample', async () => {
    const owned = documents.find(
      (entry) =>
        entry.owner.kind === 'resident' && entry.file.kind !== 'not_retrievable',
    )!
    const ownership = owned.owner
    const resident =
      ownership.kind === 'resident'
        ? residents.find((one) => one.id === ownership.residentId)
        : undefined
    const { container } = renderViewer(owned.id)
    await settled(container)

    // The body is representative; the identity on it is not invented.
    const page = container.querySelector('[data-document-sample]')!
    expect(page.textContent).toContain(resident!.fullLegalName)
  })
})

describe('the rail carries what points at the document', () => {
  it('does not lowercase a title that carries an acronym', async () => {
    const dnar = documents.find((entry) => entry.title.includes('DNAR'))!
    const { container } = renderViewer(dnar.id)
    await settled(container)

    /*
     * "DNAR form" lowercased to fit a sentence is "dnar form", with the one
     * word that identifies the document removed. A value whose correct
     * rendering depends on where it appears cannot be rendered by whoever
     * happens to be appending it.
     */
    expect(container.querySelector('[data-sample-banner]')!.textContent).toContain(
      'DNAR',
    )
    expect(
      container.querySelector('[data-document-sample]')!.textContent,
    ).not.toContain('dnar')
  })

  it('counts one decision once, however many fields hold it', async () => {
    const dnar = documents.find((entry) => entry.title.includes('DNAR'))!
    const referrers = documentReferrers(dnar.id, residents)
    /*
     * A resident's resuscitation decision is stored on the resident and again
     * under future plans, and it is one decision. Two readings of one field
     * break together, so listing both would have made one record rely on the
     * document twice.
     */
    const futurePlans = referrers.filter((entry) => entry.to.endsWith('/future-plans'))
    expect(futurePlans).toHaveLength(1)
  })

  it('links every module that references it, and says so when nothing does', async () => {
    const referenced = documents.find(
      (entry) =>
        entry.file.kind !== 'not_retrievable' &&
        documentReferrers(entry.id, residents).length > 0,
    )!
    const expected = documentReferrers(referenced.id, residents)

    const { container } = renderViewer(referenced.id)
    await settled(container)

    /*
     * The broken-reference relationship seen from the other end: not "a module
     * says this exists and it does not", but "if this went, here is what would
     * break".
     */
    const links = [...container.querySelectorAll('[data-referrer]')]
    expect(links).toHaveLength(expected.length)
    /*
     * Compared as a set of pairs, not looked up by destination: two modules can
     * point at the same document from the same screen, and a lookup by
     * destination would take whichever came first and call it a match.
     */
    const shown = links.map(
      (link) => `${link.getAttribute('data-referrer')} :: ${link.textContent}`,
    )
    for (const referrer of expected) {
      expect(
        shown.some(
          (entry) =>
            entry.startsWith(`${referrer.to} :: `) && entry.includes(referrer.label),
        ),
        `${referrer.to} ${referrer.label}`,
      ).toBe(true)
    }
    expect(container.querySelector('[data-no-referrers]')).toBeNull()
  })

  it('says nothing points at it rather than showing an empty list', async () => {
    const orphan = documents.find(
      (entry) =>
        entry.file.kind !== 'not_retrievable' &&
        documentReferrers(entry.id, residents).length === 0,
    )!
    const { container } = renderViewer(orphan.id)
    await settled(container)

    const zero = container.querySelector('[data-no-referrers]')!
    expect(zero.textContent).toMatch(
      /No record in the product points at this document/i,
    )
    expect(container.querySelector('[data-referrer]')).toBeNull()
  })
})

describe('what the viewer left alone', () => {
  it('keeps "cannot open, not on file" on a broken reference', async () => {
    const router = createMemoryRouter(
      [
        {
          path: 'residents/:residentId',
          element: <ResidentProfileRoute />,
          children: [{ path: 'documents', element: <DocumentsTab /> }],
        },
      ],
      { initialEntries: ['/residents/res-okafor/documents'] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <ToastViewport />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
    await waitFor(() =>
      expect(
        container.querySelector('[data-row="referenced_not_on_file"]'),
      ).toBeTruthy(),
    )

    /*
     * That message is the product working. A module claiming a document exists
     * that the library cannot produce is a finding, and it is a different thing
     * from a document on file in a build with no file storage.
     */
    const broken = container.querySelector(
      '[data-row="referenced_not_on_file"]',
    ) as HTMLElement
    expect(within(broken).getByText('Cannot open, not on file')).toBeTruthy()
    expect(broken.querySelector('[data-action="open"]')).toBeNull()
    expect(broken.querySelector('a[href^="/documents/"]')).toBeNull()
  })

  it('never renders a page for an id nobody recognised', async () => {
    const { container } = renderViewer('doc-does-not-exist')
    await waitFor(() =>
      expect(container.textContent).toContain('No document with that id'),
    )
    // Not somebody else's document under an unrecognised id.
    expect(container.querySelector('[data-document-sample]')).toBeNull()
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderViewer(onFile.id)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})
