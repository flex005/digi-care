import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { SignInAs } from '@/test/sign-in-as'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { GAP_NOTE_IDS, careNotesFor } from '@/data/fixtures/care-notes'
import { NOW, atTime, daysAhead } from '@/data/fixtures/generate'
import { residents } from '@/data/fixtures/residents'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { resetSessionNotes } from '@/data/access/note-store'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import * as client from '@/data/access/client'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { NotesTab } from './NotesTab'
import { NoteDetail } from './NoteDetail'
import { reviewOutcomeText } from './review-wording'

/**
 * Care notes. PRD §6.3.
 *
 * Two rules under test that no other screen has needed yet:
 *
 *  1. **A gap is a rendered object.** The stretches between the notes are on
 *     the page. A list that jumps from 09:15 to 15:40 has said nothing about
 *     the six hours in between.
 *  2. **A submitted note is never edited.** Not by anybody, at any access
 *     level. The only route to a changed record is a second note.
 */

afterEach(() => {
  resetSessionNotes()
  vi.restoreAllMocks()
})

function renderNotes(path: string, extra?: React.ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { path: 'notes', element: <NotesTab /> },
          { path: 'notes/:noteId', element: <NoteDetail /> },
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
          {extra}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const timeline = async (container: HTMLElement) => {
  await waitFor(() =>
    expect(container.querySelector('[data-note], [data-gap]')).toBeInTheDocument(),
  )
  return container
}

describe('the stretches between notes are on the page', () => {
  it('renders gap markers as rows, not as the space between rows', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)
    expect(container.querySelectorAll('[data-gap]').length).toBeGreaterThan(0)
  })

  /**
   * Pinned, and for the reason §8 names.
   *
   * The newest gap on this timeline is measured against *now*, and the waking
   * figure only appears where the gap overlaps the waking window. Run in the
   * small hours the newest gap lies entirely inside the night, so the screen
   * correctly says nothing about waking hours and the assertion fails on
   * correct code. It went red at 04:42 one morning having been green all the
   * previous day.
   *
   * Pinned to the afternoon, where a gap reaching back to the previous day
   * necessarily crosses waking hours.
   */
  it('states elapsed and waking time separately on an omission', async () => {
    const pinned = atTime(NOW, 15, 0)
    vi.useFakeTimers({ shouldAdvanceTime: true, now: pinned })
    try {
      // The waking figure depends on a window this build invented. Anyone who
      // disagrees with it can still read the elapsed figure.
      const { container } = renderNotes('/residents/res-okafor/notes')
      await timeline(container)
      const omission = container.querySelector('[data-gap="omission"]')
      expect(omission?.textContent).toMatch(/hours?/)
      expect(omission?.textContent).toMatch(/waking hours/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hatches an omission, because it is a hole in the record', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)
    const omission = container.querySelector('[data-gap="omission"]')
    expect(omission?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  /**
   * The clock is pinned here, and that is the point of the test rather than
   * a detail of it.
   *
   * The open gap is the only item on this timeline measured against *now*.
   * Every other gap sits between two fixed notes and cannot move. So the
   * unpinned version of this test asked whether the resident it named
   * happened to be carrying an open hole at the hour the suite ran, and the
   * answer changed through the day: it passed around midnight and failed from
   * early morning to late evening. It was measuring the clock, not the rule.
   *
   * Pinned to 15:00 the day after the fixtures' own anchor. Every note in the
   * set is written at or before `NOW`, so from that instant the newest note
   * for any resident is at least the whole 07:00–15:00 waking window behind —
   * comfortably past the four-hour threshold — and the open gap is therefore
   * guaranteed rather than hoped for. What is under test is the ordering:
   * that the open gap is built first and rendered above every note.
   */
  it('puts the open gap first, measured against now', async () => {
    const pinned = atTime(daysAhead(1, NOW), 15, 0)
    vi.useFakeTimers({ shouldAdvanceTime: true, now: pinned })
    try {
      const { container } = renderNotes('/residents/res-adeyemi/notes')
      await timeline(container)
      const open = container.querySelector('[data-gap][data-open="true"]')
      expect(open?.textContent).toMatch(/to now/)
      expect(container.querySelector('[data-gap]')).toBe(open)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the timeline is read against a rail of clock times', () => {
  it('puts the time in a column of its own on the profile timeline', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    // The subject is settled by the header above, so what the reader scans is
    // when. The cross-resident view keeps its own shape, because there the
    // reader is scanning across people and the name has to lead.
    const notes = container.querySelectorAll('[data-note]')
    expect(notes.length).toBeGreaterThan(0)
    for (const note of notes) {
      expect(note.getAttribute('data-layout')).toBe('railed')
    }
  })

  it('keeps the full stamp on the note, zone included', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    // The rail carries a bare time and never a zone. A clinical timestamp
    // without its zone is ambiguous (CLAUDE.md §6), so the rail is an aid to
    // scanning and never the record.
    const note = container.querySelector('[data-note]')
    expect(note?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('marks an overnight stretch as a time no notes are expected', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    // Quiet is not hidden, and it is not unexplained either. Without this a
    // reader comparing an eleven-hour overnight against a five-hour omission
    // has no way to know the longer one is the untroubling one.
    const overnight = container.querySelector('[data-gap="overnight"]')
    expect(overnight).toBeTruthy()
    expect(overnight?.textContent).toMatch(/No notes expected between/)
  })
})

describe('a filtered timeline never claims a gap', () => {
  /**
   * The one decision on this screen that is not obvious. A six-hour hole in
   * "Medication notes only" is a hole in the filter, not in the record.
   * Rendering it as "No care note recorded" would be the product making a
   * false claim about somebody's care.
   */
  it('hides gap markers while a filter is active, and says why', async () => {
    const user = userEvent.setup()
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)
    expect(container.querySelectorAll('[data-gap]').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('combobox', { name: /category/i }))
    await user.click(await screen.findByRole('option', { name: 'Medication' }))

    await waitFor(() =>
      expect(container.querySelectorAll('[data-gap]')).toHaveLength(0),
    )
    expect(screen.getByText(/gap markers are hidden/i)).toBeVisible()
    expect(
      // The claim it must still make: the real gaps are behind the filter.
      screen.getByText(/clear the filters to see where the real gaps are/i),
    ).toBeVisible()
  }, 20000)
})

describe('a resident nobody has written up', () => {
  /**
   * Ismail Sowande, admitted yesterday, with not one care note. Pinned in the
   * fixtures rather than left to probability: before it was pinned, no
   * resident had zero notes, so this branch — which the residents list, the
   * profile header and this timeline all render — had never been seen against
   * real data.
   */
  it('says so in words rather than showing an empty list', async () => {
    const { container } = renderNotes('/residents/res-sowande/notes')
    await waitFor(() => expect(screen.getByText('Never written up')).toBeVisible())

    expect(container.querySelectorAll('[data-note]')).toHaveLength(0)
    expect(container.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // And no gap markers: nobody knows when this record was supposed to
    // start, so a gap "since the beginning" would be invented.
    expect(container.querySelectorAll('[data-gap]')).toHaveLength(0)
  })

  it('is a real resident in the fixtures, not only a unit test', () => {
    const newcomer = residents.find((r) => r.id === 'res-sowande')!
    expect(newcomer).toBeDefined()
    expect(careNotesFor(newcomer.id)).toHaveLength(0)
  })
})

describe('a submitted note is never edited', () => {
  it('offers no edit control, and says why there is none', async () => {
    renderNotes(`/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /add correction note/i }),
      ).toBeVisible(),
    )

    // The rule, and the reason it is not a missing feature — now one line
    // above the control it explains rather than a card with two paragraphs,
    // longer than the note it described.
    expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument()
    expect(screen.getByText(/never edited or deleted/i)).toBeVisible()
  })

  it('writes a correction as a second note, and leaves the first visible', async () => {
    const user = userEvent.setup()
    renderNotes(`/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add correction note' })).toBeVisible(),
    )
    await user.click(screen.getByRole('button', { name: 'Add correction note' }))

    // A write surface, so it names the subject. §2.4.
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/Correct this note about Emmanuel/)
    expect(within(dialog).getByText('Emmanuel')).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: /what was actually the case/i }),
      'He declined personal care but accepted a wash later the same morning.',
    )

    const submit = within(dialog).getByRole('button', {
      name: /Record this correction/,
    })
    // Mood has no default and the form will not submit without one. A note
    // that starts with a mood selected records a mood nobody observed.
    expect(submit).toBeDisabled()
    await user.click(within(dialog).getByRole('radio', { name: 'Settled' }))
    await user.click(submit)

    await waitFor(() =>
      expect(screen.getByText(/Correction recorded for Emmanuel/)).toBeVisible(),
    )
    expect(
      screen.getByText(/still on the timeline, marked as superseded/i),
    ).toBeVisible()
  }, 30000)

  it('shows the correction chain in both directions', async () => {
    // Somebody arriving from a link lands on exactly one of the two, and
    // either read alone is misleading.
    renderNotes(`/residents/res-okafor/notes/${GAP_NOTE_IDS.supersededOriginal}`)
    await waitFor(() => expect(screen.getByText('Already corrected')).toBeVisible())
    expect(
      screen.getByRole('link', { name: 'Open the correction' }),
    ).toBeInTheDocument()

    renderNotes(`/residents/res-okafor/notes/${GAP_NOTE_IDS.correctionNote}`)
    await waitFor(() =>
      expect(screen.getAllByText('This is a correction').length).toBeGreaterThan(0),
    )
  })
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderNotes('/residents/res-hutchinson/notes')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk flags' })).toBeInTheDocument()
  })

  /**
   * 20s, down from 120s on 29/08/2026 — and the number came down because the
   * cause went, not because it was retuned again.
   *
   * The raise had happened three times and bought a phase each time. What it
   * was hiding: this timeline drew all 394 of `res-okafor`'s notes, so axe
   * walked every one of them and took 33 seconds. The screen now draws a
   * 30-day window, the scan is **3.1 seconds**, and the ceiling is a real
   * signal again rather than a place for the cost to keep growing.
   *
   * Left at 20s rather than the 5s default: files run in parallel, and a test
   * that fails on how busy the machine was is measuring the machine, not
   * accessibility (§8). 20s is roughly six times the measured cost — loose
   * enough to survive load, tight enough that a return to anything like the
   * old behaviour fails here instead of being absorbed.
   */
  it('has no detectable accessibility violations', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)
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
  }, 20000)
})

describe('closing the supervisory loop', () => {
  /**
   * The undo is tested here rather than on the queue for a reason worth
   * keeping: recording a review takes the note off the flagged queue, and the
   * feed is bounded to today, so a note flagged three days ago is on neither
   * screen afterwards. The note detail is the one place it stays put.
   */
  const openFlagged = async () => {
    const { container } = renderNotes(
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`,
    )
    await waitFor(() => expect(container.querySelector('[data-note]')).toBeTruthy())
    return container
  }

  // Marking reviewed now asks what was done, with nothing chosen, so every
  // confirmation here answers it first.
  const confirm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /mark reviewed/i }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('radio', { name: 'No further action needed' }),
    )
    await user.click(within(dialog).getByRole('button', { name: /mark reviewed/i }))
  }

  it('records who reviewed it and when', async () => {
    const user = userEvent.setup()
    const container = await openFlagged()
    await confirm(user)

    // Both halves of the supervision are on the record afterwards, and the
    // reviewer is the session user rather than anything typed into a form.
    // Asserted on the supervision panel: the chip is deliberately not on this
    // screen, because the panel states the same fact and carries the wait.
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="reviewed"]')).toBeTruthy(),
    )
    const record = container.querySelector('[data-supervision="reviewed"]')
    expect(record?.textContent).toMatch(/reviewed/i)
    expect(record?.textContent).toContain('A. Okonkwo')
    expect(record?.textContent).toMatch(/waited/i)
  }, 30000)

  it('takes the review back and restores the flag exactly', async () => {
    const user = userEvent.setup()
    const container = await openFlagged()
    const flagBefore = container.querySelector('[data-supervision="waiting"]')
      ?.firstElementChild?.textContent
    expect(flagBefore).toBeTruthy()

    await confirm(user)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="reviewed"]')).toBeTruthy(),
    )

    await user.click(screen.getByRole('button', { name: /undo review/i }))

    // Who flagged it and when survive the round trip. The store overlays
    // rather than edits, so the flag underneath is untouched — if that ever
    // becomes an in-place write, this fails.
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="waiting"]')).toBeTruthy(),
    )
    expect(
      container.querySelector('[data-supervision="waiting"]')?.firstElementChild
        ?.textContent,
    ).toBe(flagBefore)
  }, 30000)

  it('offers no undo on a review this session did not record', async () => {
    // A note the fixtures already carried as reviewed was signed off by
    // somebody else. Taking that back is not this user's to do.
    const reviewed = careNotesFor('res-okafor' as ResidentId).find(
      (note) => note.review.kind === 'reviewed',
    )
    expect(reviewed, 'no already-reviewed fixture note to test against').toBeTruthy()

    const { container } = renderNotes(`/residents/res-okafor/notes/${reviewed!.id}`)
    await waitFor(() => expect(container.querySelector('[data-note]')).toBeTruthy())
    // Anchored, because `/undo review/i` also matches a label that merely
    // ends with the phrase.
    expect(screen.queryByRole('button', { name: /^Undo review/i })).toBeNull()
  }, 20000)

  /*
   * **Reached by signing in, not by setting a flag.** This asserted a session
   * mode that no control in the product could set, so it was proving a branch
   * nobody could reach. The auditor reaches it now, and the pair below is what
   * makes either half evidence: a control absent for everybody is not a
   * permission, it is a missing button.
   */
  it('offers a read-only auditor neither control', async () => {
    renderNotes(
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`,
      <SignInAs as="auditor" />,
    )

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Mark reviewed/i })).toBeNull(),
    )
  }, 20000)

  it('offers the same note a senior carer the control to review it', async () => {
    renderNotes(
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`,
      <SignInAs as="senior_carer" />,
    )

    // Countersigning is what the role is for. The matrix said `record` here
    // for sixteen phases, which would have hidden this control from the one
    // person whose job it is.
    expect(await screen.findByRole('button', { name: /^Mark reviewed/i })).toBeVisible()
  }, 20000)
})

describe('the supervision record is both halves', () => {
  /**
   * A review that erased who raised it would be half a record rendering as a
   * whole one. "Reviewed by M. Halloran" alone reads as routine sign-off;
   * "flagged by C. Nwosu on 19/08, reviewed by M. Halloran on 21/08" is the
   * supervision, and the distance between the two is what gets asked about.
   */
  it('names who flagged it as well as who reviewed it', async () => {
    const reviewed = careNotesFor('res-okafor' as ResidentId).find(
      (note) => note.review.kind === 'reviewed',
    )!
    const { container } = renderNotes(`/residents/res-okafor/notes/${reviewed.id}`)
    await waitFor(() => expect(container.querySelector('[data-note]')).toBeTruthy())

    const review = reviewed.review as Extract<
      typeof reviewed.review,
      { kind: 'reviewed' }
    >
    // Both halves are on the supervision record. The chip carries the wait,
    // because a chip is scanned and this is read.
    const record = container.querySelector('[data-supervision="reviewed"]')
    expect(record?.textContent).toContain(review.flaggedBy.displayName)
    expect(record?.textContent).toContain(review.reviewedBy.displayName)
  })

  it('states the wait rather than leaving two timestamps to subtract', async () => {
    // The queue sorts on the wait because the wait is the finding. That does
    // not stop being true once the note leaves the queue.
    const reviewed = careNotesFor('res-okafor' as ResidentId).find(
      (note) => note.review.kind === 'reviewed',
    )!
    const { container } = renderNotes(`/residents/res-okafor/notes/${reviewed.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision]')).toBeTruthy(),
    )

    const record = container.querySelector('[data-supervision="reviewed"]')
    expect(record?.textContent).toMatch(/flagged/i)
    expect(record?.textContent).toMatch(/reviewed/i)
    expect(record?.textContent).toMatch(/waited/i)
    expect(record?.textContent).toMatch(/\d+ (hour|minute|day)/i)
  })

  it('states the wait on a note still waiting', async () => {
    const { container } = renderNotes(
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-supervision]')).toBeTruthy(),
    )
    const record = container.querySelector('[data-supervision="waiting"]')
    expect(record?.textContent).toMatch(/nobody has looked at it yet/i)
    expect(record?.textContent).toMatch(/\d+ (hour|minute|day)/i)
  })

  it('says when one person flagged and cleared it themselves', async () => {
    // A real state, and not a second opinion. **No fixture reaches it** — the
    // fixture reviewer is never one of the note authors — so it is built the
    // way a user reaches it: somebody writes a note, flags it, and then clears
    // their own flag.
    const author = staffOkonkwo
    const written = await client.submitCareNote({
      residentId: 'res-okafor' as ResidentId,
      category: 'behaviour',
      body: 'Asked for a second opinion on his refusal pattern.',
      mood: { kind: 'not_recorded' },
      shift: { kind: 'auto', value: 'late' },
      author,
      // The app's clock, not the wall clock: a note recorded hours ahead
      // of the instant the screen calls now is a record in the future.
      at: NOW.toISOString() as IsoDateTime,
      flag: { kind: 'flagged', reason: { kind: 'not_given' } },
    })
    await client.recordNoteReview({
      noteId: written.id,
      by: author,
      // The app's clock, not the wall clock: a note recorded hours ahead
      // of the instant the screen calls now is a record in the future.
      at: NOW.toISOString() as IsoDateTime,
      outcome: { kind: 'no_further_action' },
    })

    const { container } = renderNotes(`/residents/res-okafor/notes/${written.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision]')).toBeTruthy(),
    )

    // Stated, not judged. Raising a question and answering it yourself is a
    // legitimate thing to do; it is simply not what the flag asked for, and
    // only both names on the record let a reader tell.
    expect(container.querySelector('[data-supervision]')?.textContent).toMatch(
      /no second opinion was given/i,
    )
  }, 20000)
})

describe('a flag says why, and a review says what was done', () => {
  /**
   * CW PRD CN-01 and CN-02, in the shared type since 17/09/2026. The reason is
   * optional to give and never optional in the record, and the outcome is
   * chosen from four with nothing pre-chosen.
   */
  const okafor = () => careNotesFor('res-okafor' as ResidentId)

  const flaggedWith = (kind: 'given' | 'not_given') =>
    okafor().find(
      (note) => note.review.kind !== 'not_flagged' && note.review.reason.kind === kind,
    )

  it("quotes the flagger's reason, on the timeline and on the note", async () => {
    const flagged = okafor().find(
      (note) => note.id === GAP_NOTE_IDS.flaggedNotReviewed,
    )!
    const review = flagged.review as Extract<
      typeof flagged.review,
      { kind: 'flagged_not_reviewed' }
    >
    // Held by reference to the fixture rather than a string typed here.
    expect(review.reason.kind).toBe('given')
    const words = review.reason.kind === 'given' ? review.reason.text : ''

    const timelineView = renderNotes('/residents/res-okafor/notes')
    await timeline(timelineView.container)
    const card = timelineView.container.querySelector(
      `[data-note="${flagged.id}"] [data-flag-reason]`,
    )
    expect(card?.textContent).toContain(words)
    expect(card?.textContent).not.toMatch(/no reason given/i)
    timelineView.unmount()

    const { container } = renderNotes(`/residents/res-okafor/notes/${flagged.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="waiting"]')).toBeTruthy(),
    )
    const row = container.querySelector(
      '[data-supervision="waiting"] [data-flag-reason]',
    )
    expect(row?.textContent).toContain(words)
  }, 30000)

  it('says no reason was given, plainly and not hatched, when none was', async () => {
    const flagged = flaggedWith('not_given')
    expect(flagged, 'no fixture flag without a reason on this resident').toBeTruthy()

    const { container } = renderNotes(`/residents/res-okafor/notes/${flagged!.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision]')).toBeTruthy(),
    )

    const row = container.querySelector('[data-supervision] [data-flag-reason]')
    expect(row?.textContent).toMatch(/No reason given/)
    // The flagger was asked and chose not to say: an answer, not a gap.
    expect(row?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(row?.closest('[data-state="unrecorded"]')).toBeNull()
  }, 20000)

  it('shows what a fixture review said was done, in its own row', async () => {
    const reviewed = okafor().find((note) => note.review.kind === 'reviewed')!
    const { container } = renderNotes(`/residents/res-okafor/notes/${reviewed.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="reviewed"]')).toBeTruthy(),
    )
    const outcome = container.querySelector(
      '[data-supervision="reviewed"] [data-review-outcome]',
    )
    const review = reviewed.review as Extract<
      typeof reviewed.review,
      { kind: 'reviewed' }
    >
    expect(outcome?.textContent).toContain(reviewOutcomeText(review.outcome))
    // Never merged with who reviewed it: the name has a row of its own.
    expect(outcome?.textContent).not.toContain(review.reviewedBy.displayName)
  }, 20000)
})

describe('the form asks why a note is flagged', () => {
  const openComposer = async (user: ReturnType<typeof userEvent.setup>) => {
    renderNotes('/residents/res-okafor/notes')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Write a care note' })).toBeVisible(),
    )
    await user.click(screen.getByRole('button', { name: 'Write a care note' }))
    const dialog = await screen.findByRole('dialog')
    // The name the wait for it to close uses, so that wait cannot pass by
    // naming a dialog that never existed.
    expect(dialog).toHaveAccessibleName('Write a care note about Emmanuel')
    return dialog
  }

  const writeBody = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    body: string,
  ) => {
    await user.type(
      within(dialog).getByRole('textbox', { name: /what happened/i }),
      body,
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Settled' }))
  }

  it('records the reason in the words given, and shows it on the note', async () => {
    const submit = vi.spyOn(client, 'submitCareNote')
    const user = userEvent.setup()
    const dialog = await openComposer(user)
    const body = 'Would not come down for lunch and said the room was too loud.'
    await writeBody(user, dialog, body)

    // Asked only once the note is flagged.
    expect(
      within(dialog).queryByRole('textbox', { name: /why are you flagging this/i }),
    ).toBeNull()
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Flag for a senior to review' }),
    )
    await user.type(
      within(dialog).getByRole('textbox', { name: /why are you flagging this/i }),
      'Second day running. Is the dining room too much now?',
    )
    await user.click(
      within(dialog).getByRole('button', { name: /Record this note for Emmanuel/ }),
    )

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    expect(submit.mock.calls[0]![0].flag).toEqual({
      kind: 'flagged',
      reason: {
        kind: 'given',
        text: 'Second day running. Is the dining room too much now?',
      },
    })

    // The composer's own textarea holds the same words until it closes.
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Write a care note about Emmanuel' }),
      ).toBeNull(),
    )
    const written = (await screen.findByText(body)).closest('[data-note]')
    expect(written?.querySelector('[data-flag-reason]')?.textContent).toContain(
      'Second day running. Is the dining room too much now?',
    )
  }, 30000)

  it('records no reason given when left blank, and drops a reason when unflagged', async () => {
    const submit = vi.spyOn(client, 'submitCareNote')
    const user = userEvent.setup()
    const dialog = await openComposer(user)
    const body = 'Asked twice where her husband was during the afternoon.'
    await writeBody(user, dialog, body)

    const flag = within(dialog).getByRole('checkbox', {
      name: 'Flag for a senior to review',
    })
    await user.click(flag)
    await user.type(
      within(dialog).getByRole('textbox', { name: /why are you flagging this/i }),
      'Words for a flag about to be withdrawn.',
    )
    // Unticked, the words go; ticked again, the field starts blank.
    await user.click(flag)
    expect(
      within(dialog).queryByRole('textbox', { name: /why are you flagging this/i }),
    ).toBeNull()
    await user.click(flag)
    expect(
      within(dialog).getByRole('textbox', { name: /why are you flagging this/i }),
    ).toHaveValue('')

    await user.click(
      within(dialog).getByRole('button', { name: /Record this note for Emmanuel/ }),
    )
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    expect(submit.mock.calls[0]![0].flag).toEqual({
      kind: 'flagged',
      reason: { kind: 'not_given' },
    })

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Write a care note about Emmanuel' }),
      ).toBeNull(),
    )
    const written = (await screen.findByText(body)).closest('[data-note]')
    expect(written?.querySelector('[data-flag-reason]')?.textContent).toMatch(
      /No reason given/,
    )
  }, 30000)
})

describe('marking reviewed asks what was done', () => {
  const openConfirmation = async (user: ReturnType<typeof userEvent.setup>) => {
    const { container } = renderNotes(
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.flaggedNotReviewed}`,
    )
    await waitFor(() => expect(container.querySelector('[data-note]')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /^mark reviewed/i }))
    const dialog = await screen.findByRole('alertdialog')
    const confirmButton = () =>
      within(dialog).getByRole('button', { name: /^mark reviewed$/i })
    return { container, dialog, confirmButton }
  }

  it('opens on no outcome, and will not confirm without one', async () => {
    const user = userEvent.setup()
    const { dialog, confirmButton } = await openConfirmation(user)

    expect(
      within(dialog).getByRole('radiogroup', { name: 'Action taken?' }),
    ).toBeVisible()
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(confirmButton()).toBeDisabled()
  }, 20000)

  it('needs words for Other, and records them', async () => {
    const record = vi.spyOn(client, 'recordNoteReview')
    const user = userEvent.setup()
    const { container, dialog, confirmButton } = await openConfirmation(user)

    await user.click(within(dialog).getByRole('radio', { name: 'Other' }))
    expect(confirmButton()).toBeDisabled()
    const words = within(dialog).getByRole('textbox', { name: /what was done/i })
    await user.type(words, '   ')
    expect(confirmButton()).toBeDisabled()
    await user.type(words, 'Asked the GP to see him on Thursday.')
    expect(confirmButton()).toBeEnabled()
    await user.click(confirmButton())

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1))
    expect(record.mock.calls[0]![0].outcome).toEqual({
      kind: 'other',
      text: 'Asked the GP to see him on Thursday.',
    })
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="reviewed"]')).toBeTruthy(),
    )
    expect(
      container.querySelector('[data-supervision="reviewed"] [data-review-outcome]')
        ?.textContent,
    ).toContain('Other: Asked the GP to see him on Thursday.')
  }, 30000)

  it('records the outcome chosen and shows it on the note', async () => {
    const record = vi.spyOn(client, 'recordNoteReview')
    const user = userEvent.setup()
    const { container, dialog, confirmButton } = await openConfirmation(user)

    await user.click(within(dialog).getByRole('radio', { name: 'Care plan updated' }))
    await user.click(confirmButton())

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1))
    expect(record.mock.calls[0]![0].outcome).toEqual({ kind: 'care_plan_updated' })
    await waitFor(() =>
      expect(container.querySelector('[data-supervision="reviewed"]')).toBeTruthy(),
    )
    const outcome = container.querySelector(
      '[data-supervision="reviewed"] [data-review-outcome]',
    )
    expect(outcome?.textContent).toContain('Care plan updated')
    // The flag's reason is carried forward beside it, not replaced by it.
    expect(
      container.querySelector('[data-supervision="reviewed"] [data-flag-reason]')
        ?.textContent,
    ).toMatch(/Third refusal this week/)
  }, 30000)

  it('asks afresh after a cancelled confirmation', async () => {
    const user = userEvent.setup()
    const { dialog, confirmButton } = await openConfirmation(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Incident raised' }))
    expect(confirmButton()).toBeEnabled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: /^mark reviewed/i }))
    const again = await screen.findByRole('alertdialog')
    for (const radio of within(again).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(
      within(again).getByRole('button', { name: /^mark reviewed$/i }),
    ).toBeDisabled()
  }, 30000)
})

describe('the states around the timeline', () => {
  it('says it is loading, subject first and then the record', async () => {
    // Two loads, in this order, and the order is right: the subject header
    // has to resolve before the timeline mounts, because a timeline rendered
    // beside the wrong name is the failure §2.4 exists to prevent.
    //
    // An empty timeline rendered during either load is a resident somebody
    // could read as never written up, which is the worst thing this screen
    // is capable of saying.
    renderNotes('/residents/res-okafor/notes')
    expect(screen.getByRole('status')).toHaveTextContent(/loading resident/i)
    expect(
      await screen.findByText(/loading care notes/i, {}, { timeout: 5000 }),
    ).toBeVisible()
  })

  it('shows nothing rather than a partial history when the read fails', async () => {
    vi.spyOn(client, 'getCareNotes').mockRejectedValueOnce(new Error('nope'))
    renderNotes('/residents/res-okafor/notes')

    expect(
      await screen.findByText(/these care notes could not be loaded/i),
    ).toBeVisible()
    // The distinction the copy has to make: a timeline missing an unknown
    // number of entries reads as a quieter record than it is.
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  it('errors on a note that does not exist, rather than rendering a blank one', async () => {
    // No mock needed: the client rejects an unknown id by design, because
    // returning undefined would leave the caller to decide what a missing
    // subject means.
    renderNotes('/residents/res-okafor/notes/note-does-not-exist')
    expect(await screen.findByText(/this note could not be loaded/i)).toBeVisible()
  })
})

describe('the composer', () => {
  const openComposer = async (user: ReturnType<typeof userEvent.setup>) => {
    renderNotes('/residents/res-okafor/notes')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Write a care note' })).toBeVisible(),
    )
    await user.click(screen.getByRole('button', { name: 'Write a care note' }))
    return screen.findByRole('dialog')
  }

  it('names the subject, and writes a note onto the timeline', async () => {
    const user = userEvent.setup()
    const dialog = await openComposer(user)

    // §2.4 — the write surface names who it is about, twice: in the title and
    // on the button somebody presses.
    expect(dialog.textContent).toMatch(/Write a care note about Emmanuel/)
    expect(within(dialog).getByText('Emmanuel')).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: /what happened/i }),
      'Ate a full breakfast and asked for more tea.',
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Good' }))
    await user.click(
      within(dialog).getByRole('button', { name: /Record this note for Emmanuel/ }),
    )

    await waitFor(() =>
      expect(screen.getByText(/Care note recorded for Emmanuel/)).toBeVisible(),
    )
    expect(
      await screen.findByText('Ate a full breakfast and asked for more tea.'),
    ).toBeVisible()
  }, 30000)

  it('will not change the shift without a reason', async () => {
    // PRD §6.3: "editable with reason" is not editable with an optional
    // reason.
    const user = userEvent.setup()
    const dialog = await openComposer(user)

    await user.type(
      within(dialog).getByRole('textbox', { name: /what happened/i }),
      'Settled evening, watched the football.',
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Settled' }))

    const submit = within(dialog).getByRole('button', {
      name: /Record this note for Emmanuel/,
    })
    expect(submit).toBeEnabled()

    // Move the shift to whichever one the clock did not choose.
    await user.click(within(dialog).getByRole('combobox', { name: /shift this is/i }))
    const options = await screen.findAllByRole('option')
    const other = options.find(
      (option) => !option.textContent?.includes('what the clock says'),
    )!
    await user.click(other)

    expect(
      within(dialog).getByRole('button', { name: /Record this note for Emmanuel/ }),
    ).toBeDisabled()

    await user.type(
      within(dialog).getByRole('textbox', { name: /why is this not/i }),
      'Handover overran and this was written up on the next shift.',
    )
    expect(
      within(dialog).getByRole('button', { name: /Record this note for Emmanuel/ }),
    ).toBeEnabled()
  }, 30000)

  it('offers no composer to a read-only auditor', async () => {
    const { container } = renderNotes(
      '/residents/res-okafor/notes',
      <SignInAs as="auditor" />,
    )

    /*
     * **The record first, then the absence.** An assertion that a control is
     * missing is satisfied by a screen that has not rendered at all, so the
     * notes have to be on the page before the missing composer means anything.
     * Reading them is the whole of an auditor's business here, which makes the
     * wait the second half of the test rather than scaffolding for it.
     */
    await waitFor(() =>
      expect(container.querySelectorAll('article, li').length).toBeGreaterThan(0),
    )
    // Not a disabled button. PRD §1: zero write is not a permission an auditor
    // might be granted.
    expect(
      screen.queryByRole('button', { name: 'Write a care note' }),
    ).not.toBeInTheDocument()
  }, 30000)

  it('offers the composer to a care worker on the same tab', async () => {
    renderNotes('/residents/res-okafor/notes', <SignInAs as="care_worker" />)

    expect(
      await screen.findByRole('button', { name: 'Write a care note' }),
    ).toBeVisible()
  }, 30000)
})

describe('the timeline is windowed, not paginated', () => {
  /**
   * The Phase 6 decision, arriving overdue. `res-okafor` has 394 notes and the
   * tab drew every one of them, which cost the axe scan 33 seconds and, far
   * worse, would have made any paging scheme fabricate a gap: a marker inside
   * page 2 states a span whose ends were chosen by the page break. A window
   * has a stated bound, so every gap inside it is measured between two real
   * notes and the single edge is not a gap at all.
   */

  it('draws a bounded window rather than the whole record', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    const drawn = [...container.querySelectorAll('[data-note]')]
    const held = careNotesFor('res-okafor' as ResidentId)

    expect(held.length).toBeGreaterThan(300)
    expect(drawn.length).toBeGreaterThan(0)
    expect(drawn.length).toBeLessThan(held.length)

    /*
     * The bound itself, not a ratio. "Fewer than a quarter" was the first
     * version of this and it failed at 143 of 394 — a number legitimate
     * fixtures move, asserting a property of the data rather than of the
     * window (§8). What must hold is that nothing outside 30 days is drawn.
     */
    const ids = new Set(drawn.map((row) => row.getAttribute('data-note')))
    const shown = held.filter((note) => ids.has(note.id))
    expect(shown.length).toBe(drawn.length)

    const newest = Math.max(...shown.map((n) => new Date(n.recordedAt).getTime()))
    for (const note of shown) {
      const age = newest - new Date(note.recordedAt).getTime()
      expect(
        age,
        `${note.id} is ${Math.round(age / 86_400_000)} days older than the newest note drawn`,
      ).toBeLessThanOrEqual(30 * 86_400_000)
    }
  }, 20000)

  it('states the bound and what lies past it, rather than a gap marker', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    const edge = container.querySelector('[data-window-edge]')
    expect(edge, 'the window must say where it cuts').toBeTruthy()

    const said = edge!.textContent ?? ''
    // The bound, in the reader's words.
    expect(said).toMatch(/Showing the last 30 days/i)
    // And the real elapsed time across it, so nothing is fabricated and
    // nothing is hidden.
    expect(said).toMatch(/previous note was \d{2}\/\d{2}\/\d{4}/i)
    expect(said).toMatch(/\d+ days? before the one above/i)
  }, 20000)

  it('puts no gap marker at the boundary, because the boundary is not a gap', async () => {
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    const rows = [
      ...container.querySelectorAll('[data-note], [data-gap], [data-window-edge]'),
    ]
    const last = rows[rows.length - 1]
    // A gap marker here would be a claim about a stretch nobody chose to
    // leave empty — the screen inventing a hole out of its own scrolling.
    expect(last?.hasAttribute('data-window-edge')).toBe(true)
    expect(last?.hasAttribute('data-gap')).toBe(false)
  }, 20000)

  it('reaches the older notes rather than hiding them behind the default', async () => {
    const user = userEvent.setup()
    const { container } = renderNotes('/residents/res-okafor/notes')
    await timeline(container)

    const first = container.querySelector('[data-note]')?.getAttribute('data-note')
    await user.click(screen.getByRole('button', { name: /Earlier 30 days/i }))

    await waitFor(() => {
      const now = container.querySelector('[data-note]')?.getAttribute('data-note')
      expect(now).not.toBe(first)
    })
    // Stepping back is what makes a bound honest: everything is still
    // reachable, and the reader can see how far back they have gone.
    expect(container.querySelector('[data-window-edge]')).toBeTruthy()
  }, 30000)
})
