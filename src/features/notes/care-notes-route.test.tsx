import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOTES_PER_PAGE } from './PagedNotes'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { SignInAs } from '@/test/sign-in-as'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { CareNote, IsoDateTime } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { useSession } from '@/app/session/use-session'
import * as client from '@/data/access/client'
import { resetSessionNotes } from '@/data/access/note-store'
import { NOW, atTime, daysAgo } from '@/data/fixtures/generate'
import { CareNotesRoute } from './CareNotesRoute'

/**
 * `/care-notes`, the cross-resident view. PRD §6.3.
 *
 * The screen is four questions and then a bounded feed. What is under test is
 * that it opens on the supervisory one, that every figure carries its
 * denominator, that no claim about absence is made without naming what it was
 * made over, and that the feed says what it leaves out.
 */

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetSessionNotes()
})

/**
 * A day the feed has notes on, and a user driven by the same clock.
 *
 * **"All notes" is bounded to today**, and the fixtures are generated up to
 * `NOW` — so in the small hours today holds almost nothing, and three tests
 * asserting on the feed's rows went red at 04:42 having been green all the
 * previous day. They were measuring the hour the suite ran (§8).
 *
 * Pinned to the middle of yesterday, which is a whole day of notes whatever
 * time it is when the suite starts.
 */
function pinnedToADayWithNotes() {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: atTime(daysAgo(1, NOW), 15, 0) })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

/** Every figure in a string, grouping separators removed. */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\b[\d,]*\d\b/g)].map((match) =>
    Number(match[0].replace(/,/g, '')),
  )
}

/**
 * Rule 4, asserted as a property rather than as a sentence: the figure names a
 * count, a population and a site, however those happen to be joined up.
 */
function carriesDenominatorFor(figure: Element | null, total: number) {
  expect(figure).toBeTruthy()
  expect(figure?.textContent).toMatch(new RegExp(`\\b${total}\\b`))
  expect(figure?.textContent).toMatch(/residents/i)
  expect(figure?.textContent).toMatch(/Court|Lodge/)
}

/** Ashgrove is the thin site, and nothing is waiting on a senior there. */
function GoToAshgrove() {
  const { sites, setActiveSite } = useSession()
  return (
    <button
      type="button"
      onClick={() => setActiveSite(sites.find((s) => s.id === 'site-ashgrove-lodge')!)}
    >
      go to ashgrove
    </button>
  )
}

function renderCareNotes(extra?: React.ReactNode) {
  const router = createMemoryRouter(
    [{ path: '/care-notes', element: <CareNotesRoute /> }],
    { initialEntries: ['/care-notes'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          {extra}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const loaded = async () =>
  waitFor(() => expect(screen.getByText(/Flagged and not yet reviewed/i)).toBeVisible())

describe('it opens on the supervisory question', () => {
  it('defaults to flagged-and-unreviewed, not a feed', async () => {
    renderCareNotes()
    await loaded()
    // §6.3: "everything newest first" is a screen nobody opens twice.
    expect(
      screen.getByRole('button', { name: 'Flagged, not reviewed' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers the four questions the timeline cannot answer, then the feed', async () => {
    renderCareNotes()
    await loaded()

    // Order is the argument. The four questions come first because they are
    // what this screen is for; All notes is last because §6.3 calls a feed a
    // screen nobody opens twice, and it earns its place only as a fallback.
    const tabs = screen.getByRole('group', { name: 'What to look at' })
    const labels = [...tabs.querySelectorAll('button')].map((node) =>
      node.textContent?.trim(),
    )
    expect(labels).toEqual([
      'Flagged, not reviewed',
      'No note today',
      'By author',
      'By shift',
      'All notes',
    ])
  })

  it('never opens on the feed', async () => {
    renderCareNotes()
    await loaded()
    expect(screen.getByRole('button', { name: 'All notes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('the feed says what it leaves out', () => {
  /**
   * The one view §6.3 warns about. At this site the record is twelve thousand
   * notes, so an unbounded feed is volume that drowns the distinction it was
   * meant to show — and a silent cap is worse, because the screen then reads
   * as "this is everything" when it is not.
   */
  it('holds the whole record and says which page of it is showing', async () => {
    const user = pinnedToADayWithNotes()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))

    /*
     * It was bounded to the day while still called All notes, which is the one
     * thing a tab of that name must not be: somebody looking for Tuesday's
     * note found nothing and could not tell that from its not existing.
     *
     * Paging is what lets the whole record be here, and the claim above the
     * list carries both figures — how many there are and which of them are on
     * the screen — because a page of fifteen with no total tells a reader the
     * home wrote fifteen.
     */
    await waitFor(() =>
      expect(container.querySelector('[data-notes-claim]')).toBeTruthy(),
    )
    const claim = container.querySelector('[data-notes-claim]')
    const [total, from, to] = numbersIn(claim?.textContent ?? '')
    expect(total).toBeGreaterThan(NOTES_PER_PAGE)
    expect(from).toBe(1)
    expect(to).toBe(NOTES_PER_PAGE)

    // And the page holds a page, not the record.
    expect(container.querySelectorAll('[data-layout="row"]').length).toBe(
      NOTES_PER_PAGE,
    )
    expect(container.querySelector('[data-notes-pager]')).toBeTruthy()
  }, 20000)

  it('makes no absence claim from an empty row', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))

    // A resident missing from a feed of today's notes has not been shown to
    // be neglected, only to be absent from this window. So the feed lists
    // notes and never names a resident as missing — the absence question is
    // the "No note today" view's, and it answers it with names.
    await waitFor(() =>
      expect(container.querySelector('[data-notes-claim]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-quiet]')).toBeNull()
    expect(container.querySelector('[data-missed]')).toBeNull()
  }, 20000)
})

describe('Rule 3c is on the screen, not only in the code', () => {
  /**
   * Without a banner the product simply declines to make a claim, and a
   * reader cannot tell a suppressed claim from one that came back empty.
   * "Nothing here" and "nothing here that matches what you asked for" look
   * identical, and the first is the one that gets acted on.
   */
  it('says what an author filter costs, and does not claim a gap', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By author' }))
    // A named member of staff, chosen from the tabs rather than a dropdown.
    const staff = [...container.querySelectorAll('[data-author-tab]')].find(
      (tab) => tab.getAttribute('data-author-tab') !== 'all',
    )!
    await user.click(staff)

    await waitFor(() =>
      expect(container.querySelector('[data-filter-notice="suppressed"]')).toBeTruthy(),
    )
    const notice = container.querySelector('[data-filter-notice="suppressed"]')
    expect(notice?.textContent).toMatch(/absence from this filter/i)
  }, 30000)

  it('marks a shift claim as scoped rather than suppressed', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By shift' }))

    // The opposite case, and they must not read alike: this absence claim is
    // legitimate because the shift and the day are in the sentence making it.
    await waitFor(() =>
      expect(container.querySelector('[data-filter-notice="scoped"]')).toBeTruthy(),
    )
    const notice = container.querySelector('[data-filter-notice="scoped"]')
    expect(notice?.textContent).toMatch(/does not say nobody did/i)
  }, 20000)
})

describe('the queue scans like a queue', () => {
  /**
   * A supervisor works down this screen looking for what is waiting and on
   * whom. As stacked blocks three notes filled a screen and the action sat on
   * a line of its own, so finding the next name meant reading every note.
   */
  it('lays each note out in four aligned columns', async () => {
    const { container } = renderCareNotes()
    await loaded()

    const row = container.querySelector('[data-layout="row"]')
    expect(row).toBeTruthy()
    // resident · flag · note · action, and the action is in the row rather
    // than under it.
    expect(row?.querySelector('a[href^="/residents/"]')).toBeTruthy()
    expect(row?.textContent).toMatch(/Room \d+|Room not recorded/)
  })

  it('names the resident on every row, since the reader does not know who yet', async () => {
    const { container } = renderCareNotes()
    await loaded()

    // A cross-resident note with no name on it cannot be read at all.
    const rows = container.querySelectorAll('[data-layout="row"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.textContent).toMatch(/Room \d+|Room not recorded/)
    }
  })

  it('puts the count and its reason on one line above the list', async () => {
    const { container } = renderCareNotes()
    await loaded()

    // Not a display card with half a screen of nothing beside it: one figure
    // stated in a line, with the ordering named on the same line.
    const head = container.querySelector('[data-emphasis="inline"]')
    expect(head).toBeTruthy()
    expect(container.querySelector('[data-emphasis="lead"]')).toBeNull()
    expect(head?.textContent).toMatch(/oldest first/i)
  })
})

describe('one concept, one treatment, across screens', () => {
  it('hatches a flagged note nobody has reviewed', async () => {
    const { container } = renderCareNotes()
    await loaded()

    // Nobody has looked at it: that is a gap, and the handover renders the
    // same concept hatched as "Not reviewed". Amber would mean recorded and
    // needing attention, which is a finding somebody made — this is the
    // absence of one.
    const rows = container.querySelectorAll('[data-layout="row"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.querySelector('[data-state="unrecorded"]')).toBeTruthy()
      expect(row.querySelector('[data-tone="caution"]')).toBeNull()
    }
  })

  it('says what the gap is in words, not by pattern alone', async () => {
    const { container } = renderCareNotes()
    await loaded()

    const flag = container.querySelector(
      '[data-layout="row"] [data-state="unrecorded"]',
    )
    // The label says what is missing; the detail says how long it has been
    // waiting, which is what the queue is sorted on and what ranks one row
    // against another. The author is on the note detail, where it is read.
    expect(flag?.textContent).toMatch(/flagged, not reviewed/i)
    expect(flag?.querySelector('[data-unrecorded-detail]')?.textContent).toMatch(
      // Minutes, hours or days: the figure switches unit past two days so a
      // reader can rank rows without doing arithmetic. "79 hours" was correct
      // and unrankable.
      /waiting \d+ (minute|hour|day)s?/i,
    )
  })

  it('renders a recorded mood quietly, at every score', async () => {
    const user = pinnedToADayWithNotes()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))

    // Rule 3b. A green "Good" beside a note flagged for senior review is
    // reassurance competing with the finding.
    await waitFor(() =>
      expect(container.querySelector('[data-layout="row"]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-tone="positive"]')).toBeNull()
    /*
     * Paged now, so the settled mood may not be on the first page. Walks
     * forward until it finds one rather than asserting the first fifteen
     * notes happen to contain a recorded mood.
     */
    let settled = container.querySelector('[data-emphasis="settled"]')
    let guard = 0
    while (settled === null && guard < 10) {
      const next = container.querySelector<HTMLButtonElement>('[data-notes-next]')
      if (!next || next.disabled) break
      await user.click(next)
      await waitFor(() =>
        expect(container.querySelector('[data-layout="row"]')).toBeTruthy(),
      )
      settled = container.querySelector('[data-emphasis="settled"]')
      guard += 1
    }
    expect(
      settled,
      'no fixture reaches a recorded mood in the first pages',
    ).toBeTruthy()
  }, 30000)

  it('keeps mood off the queue entirely', async () => {
    const user = pinnedToADayWithNotes()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))

    // The finding on this screen is that a note is waiting for review. A
    // hatched "Mood not recorded" on the same row competes with the flag for
    // exactly the attention the screen is asking for. It is a real gap and it
    // is stated on the note detail, where it is the only claim being made.
    await waitFor(() =>
      expect(container.querySelector('[data-layout="row"]')).toBeTruthy(),
    )
    for (const row of container.querySelectorAll('[data-layout="row"]')) {
      expect(row.textContent).not.toMatch(/mood/i)
    }
  }, 30000)
})

describe('every figure carries its denominator', () => {
  /**
   * Asserted on the figure element and on what it has to contain — a number,
   * a population, a site — rather than on the sentence that joins them.
   *
   * The previous version matched the exact string the card form happened to
   * produce, so changing the figure's shape from a card to a line broke a
   * test about Rule 4 without Rule 4 being broken. A test pinned to copy is a
   * test that fires on rewording and stays silent on the thing it names.
   */
  it('states the population the flagged count was taken across', async () => {
    const { container } = renderCareNotes()
    await loaded()
    // Rule 4. Never a bare count.
    carriesDenominatorFor(container.querySelector('[data-emphasis="inline"]'), 28)
  })

  it('names the window and the population on the absence claim', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'No note today' }))

    // Rule 3c: an absence claim carries what it was made over, or it is
    // false. "Today" measured from midnight says 28 of 28 at ten past
    // midnight, which a reader who cannot see the site's clock cannot tell
    // from a home that has stopped writing — so the figure carries the time.
    await waitFor(() =>
      expect(container.querySelector('[data-emphasis="inline"]')?.textContent).toMatch(
        /\d{2}:\d{2}/,
      ),
    )
    carriesDenominatorFor(container.querySelector('[data-emphasis="inline"]'), 28)
  }, 20000)

  it('names the shift and the day before claiming a shift wrote nothing', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By shift' }))

    // The claim names its shift and its day, and says what it is not
    // claiming. Both live on the filter notice now rather than in a paragraph
    // repeating the figure beside it.
    await waitFor(() =>
      expect(container.querySelector('[data-filter-notice="scoped"]')).toBeTruthy(),
    )
    const notice = container.querySelector('[data-filter-notice="scoped"]')
    expect(notice?.textContent).toMatch(/shift, today/i)
    expect(notice?.textContent).toMatch(/does not say nobody did/i)
  }, 20000)
})

describe('by author', () => {
  it('picks nobody by default', async () => {
    const user = userEvent.setup()
    renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By author' }))

    // Opening a supervision view already pointed at a named member of staff
    // is a decision this screen should not make. The behaviour is that nobody
    // is selected and no notes are listed, and that stays true however the
    // screen words the prompt — so it is asserted rather than the sentence.
    /*
     * Staff are tabs now and All staff is one of them, so opening the view
     * shows everybody rather than nothing. The rule that mattered is
     * unchanged and is what this asserts: **no named member of staff is
     * chosen for the reader.** Opening a supervision view already pointed at
     * one person is a decision this screen must not make.
     */
    await waitFor(() =>
      expect(document.querySelector('[data-author-tab="all"]')).toBeTruthy(),
    )
    expect(
      document.querySelector('[data-author-tab="all"]')?.getAttribute('aria-pressed'),
    ).toBe('true')

    for (const tab of document.querySelectorAll('[data-author-tab]')) {
      if (tab.getAttribute('data-author-tab') === 'all') continue
      expect(tab.getAttribute('aria-pressed'), 'a person was chosen by default').toBe(
        'false',
      )
    }
  }, 20000)
})

describe('the queue can be worked down', () => {
  /**
   * The loop this screen exists to close. Before it there was no write
   * anywhere in the product that could record a review, so a care worker could
   * ask for a second opinion and nobody could record having given one — the
   * queue could only grow.
   */
  it('offers the action on the row, not only in the note', async () => {
    const { container } = renderCareNotes()
    await loaded()

    // Six flags cleared from the detail screen would be six round trips.
    const row = container.querySelector('[data-layout="row"]')
    expect(
      within(row as HTMLElement).getByRole('button', { name: /mark reviewed/i }),
    ).toBeVisible()
  })

  it('names the resident and the note in the confirmation', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    const row = container.querySelector('[data-layout="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: /mark reviewed/i }))

    // PRD §2.4: never "Are you sure?". Which note matters as much as which
    // resident — a senior working a queue of six is confirming one of six,
    // and the rows differ only in their body text.
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toMatch(/Okafor/)
    expect(dialog.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(dialog.textContent).toMatch(/\d{2}:\d{2}/)
  }, 20000)

  it('takes the note off the queue once reviewed', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    const row = container.querySelector('[data-layout="row"]') as HTMLElement
    /*
     * The note that was reviewed, by its own id, rather than a count taken
     * before the queue had finished rendering. The count version failed
     * intermittently and could only fail that way: `before` was read while
     * rows were still arriving, so the target it computed was a number the
     * queue had already passed.
     */
    const reviewed = row.getAttribute('data-note')
    expect(reviewed).toBeTruthy()

    await user.click(within(row).getByRole('button', { name: /mark reviewed/i }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: /mark reviewed/i,
      }),
    )

    await waitFor(() =>
      expect(container.querySelector(`[data-note="${reviewed}"]`)).toBeNull(),
    )
    // And the rest of the queue is still there: reviewing one note must not
    // empty the list, which a count-based assertion would not have noticed.
    expect(container.querySelectorAll('[data-layout="row"]').length).toBeGreaterThan(0)
  }, 30000)

  it('says it went nowhere, in the words the other writes use', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    const row = container.querySelector('[data-layout="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: /mark reviewed/i }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: /mark reviewed/i,
      }),
    )

    // Nothing in this build reaches a server, and a supervisory sign-off that
    // looks persistent is the one most likely to be relied on.
    const status = await screen.findByText(/held in memory and will be gone on reload/i)
    expect(status).toBeVisible()
  }, 30000)
})

describe('a review can be taken back', () => {
  it('offers an auditor no way to review', async () => {
    const { container } = renderCareNotes(<SignInAs as="auditor" />)
    await loaded()

    // PRD §1: zero write. Not a disabled button — the control is not theirs.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Mark reviewed/i })).toBeNull(),
    )
    expect(container.querySelectorAll('[data-layout="row"]').length).toBeGreaterThan(0)
  }, 20000)

  it('offers a senior carer the review the auditor cannot have', async () => {
    renderCareNotes(<SignInAs as="senior_carer" />)
    await loaded()

    /*
     * The queue is many flagged notes, so this is a count rather than an
     * element: `findByRole` throws on more than one, which is the library
     * refusing an ambiguous name and is the right behaviour. What is asserted
     * is that the control is drawn at all for this role, against the assertion
     * above that it is drawn for nobody in the auditor's session.
     */
    await waitFor(() =>
      expect(
        screen.queryAllByRole('button', { name: /^Mark reviewed/i }).length,
      ).toBeGreaterThan(0),
    )
  }, 20000)
})

describe('the states around the queue', () => {
  it('says it is loading rather than showing an empty queue', () => {
    renderCareNotes()
    expect(screen.getByRole('status')).toHaveTextContent(/loading care notes/i)
  })

  it('shows nothing rather than a short queue when the read fails', async () => {
    vi.spyOn(client, 'getCareNotesForSite').mockRejectedValueOnce(new Error('nope'))
    renderCareNotes()

    // A supervisory queue missing an unknown number of its entries reads as a
    // shorter queue than it is, which is the one way this screen can lie.
    expect(
      await screen.findByText(/these care notes could not be loaded/i),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible()
  })
})

describe('nothing waiting is an answer, not a blank', () => {
  /**
   * Ashgrove has no flagged-and-unreviewed notes at all. It is the only
   * fixture that reaches the settled branch of the default view — without it
   * the "nothing to review" state is code nothing renders.
   */
  it('states an empty queue with what it was measured over', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes(<GoToAshgrove />)
    await loaded()
    await user.click(screen.getByRole('button', { name: 'go to ashgrove' }))

    await waitFor(() =>
      expect(container.textContent).toMatch(/nothing is waiting on a senior/i),
    )
    // Rule 3b: stated plainly, not celebrated with a green panel. Rule 4: the
    // denominator is still on the screen — on the heading line, which carries
    // the same figure whether the queue is empty or full.
    carriesDenominatorFor(container.querySelector('[data-emphasis="inline"]'), 4)
    /*
     * Scoped to the queue rather than to the page. The module's count cards
     * carry a hatched card of their own for the residents nobody has written
     * up, which is a different fact and legitimately unrecorded; a page-wide
     * query for the hatch caught it and read it as this queue's.
     */
    const queue = container.querySelector('[data-flagged-queue]')!
    expect(queue.querySelector('[data-state="unrecorded"]')).toBeNull()
  }, 20000)
})

describe('the settled states no fixture reaches', () => {
  /**
   * These are the Rule 3b branches — recorded, complete, nothing to do — and
   * **the fixtures never render any of them.** That is by design: they are
   * deliberately messy (CLAUDE.md §6), so at both sites somebody always has no
   * note today and some shift always missed somebody.
   *
   * Which means these are the states nobody has ever looked at, on a screen
   * whose reassuring answers are the most dangerous ones to get wrong. A false
   * "everybody was written up today" is the exact failure this product exists
   * to prevent, and until now it was unexercised code. Constructed here rather
   * than tidied into the fixtures, so the deliberate gaps stay exactly as they
   * are.
   */

  /** Every resident at the site, written up on the night shift, just now. */
  function everybodyWrittenUpTonight(notes: CareNote[], residentIds: string[]) {
    /*
     * The app's generation instant, not the wall clock. The screen asks what
     * "today" is through the same clock, and the two part company the moment
     * the clock moves off real time — these two tests were green all evening
     * and red at 00:02, when the wall clock rolled into a day the screen was
     * not showing.
     */
    const at = NOW.toISOString() as IsoDateTime
    return residentIds.flatMap((id) => {
      const note = notes.find((entry) => entry.residentId === id)
      return note
        ? [
            {
              ...note,
              recordedAt: at,
              shift: { kind: 'auto' as const, value: 'night' as const },
            },
          ]
        : []
    })
  }

  it('says everybody has been written up today, with the population', async () => {
    const residentIds = residentsBySite('site-rosewood-court').map((r) => r.id)
    const real = await client.getCareNotesForSite('site-rosewood-court')
    vi.spyOn(client, 'getCareNotesForSite').mockResolvedValue(
      everybodyWrittenUpTonight(real, residentIds),
    )

    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'No note today' }))

    await waitFor(() =>
      expect(container.textContent).toMatch(/everybody has a care note today/i),
    )
    // Rule 4 does not lapse because the answer is a good one: the figure above
    // the list still names what it was measured across.
    carriesDenominatorFor(container.querySelector('[data-emphasis="inline"]'), 28)
    // Rule 3b: plain text, and never the hatch. Reaching for the unrecorded
    // treatment here would be the product inventing a gap.
    expect(container.querySelector('[data-quiet]')).toBeNull()
  }, 30000)

  it('says a shift wrote about everybody, and still scopes the claim', async () => {
    const residentIds = residentsBySite('site-rosewood-court').map((r) => r.id)
    const real = await client.getCareNotesForSite('site-rosewood-court')
    vi.spyOn(client, 'getCareNotesForSite').mockResolvedValue(
      everybodyWrittenUpTonight(real, residentIds),
    )

    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By shift' }))

    await waitFor(() =>
      expect(container.textContent).toMatch(/has written about everybody today/i),
    )
    // The banner stays up even when the answer is complete. A scoped claim is
    // scoped whether it comes back full or empty.
    expect(container.querySelector('[data-filter-notice="scoped"]')).toBeTruthy()
    expect(container.querySelector('[data-missed]')).toBeNull()
  }, 30000)

  it('says nothing was written today without implying nothing exists', async () => {
    const real = await client.getCareNotesForSite('site-rosewood-court')
    // The generation instant, for the same reason as above.
    const today = NOW.toISOString().slice(0, 10)
    // Only notes from before today, so the feed is empty and the record is not.
    vi.spyOn(client, 'getCareNotesForSite').mockResolvedValue(
      real.filter((note) => !note.recordedAt.startsWith(today)),
    )

    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))

    await waitFor(() =>
      expect(container.querySelector('[data-notes-claim]')).toBeTruthy(),
    )

    /*
     * The whole risk this guards: a day with nothing written must not read as
     * a record with nothing in it. The tab holds the whole record now, so the
     * empty day is stated as a figure of zero beside a non-zero total rather
     * than as an empty screen with a sentence under it.
     */
    const written = /([\d,]+) of them written today/i.exec(container.textContent ?? '')
    expect(
      written,
      'the screen does not say how much of the record is today',
    ).toBeTruthy()
    expect(Number(written![1]!.replace(/,/g, ''))).toBe(0)

    const [total] = numbersIn(
      container.querySelector('[data-notes-claim]')?.textContent ?? '',
    )
    expect(total).toBeGreaterThan(0)
  }, 30000)
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderCareNotes()
    await loaded()
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)

  // The default view was the only one covered, so the three that carry a
  // filter notice were never walked. A view nobody runs axe over is a view
  // with no accessibility claim behind it.
  it('has no detectable violations on the shift view', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'By shift' }))
    await waitFor(() =>
      expect(container.querySelector('[data-filter-notice]')).toBeTruthy(),
    )
    expect(await axe(container)).toHaveNoViolations()
  }, 60000)

  it('has no detectable violations on the feed', async () => {
    const user = userEvent.setup()
    const { container } = renderCareNotes()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'All notes' }))
    await waitFor(() =>
      expect(container.querySelector('[data-notes-claim]')).toBeTruthy(),
    )
    expect(await axe(container)).toHaveNoViolations()
  }, 60000)
})
