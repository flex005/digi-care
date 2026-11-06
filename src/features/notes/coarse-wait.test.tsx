import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026, when Emmanuel Okafor's flagged note has waited 83 hours 39
 * minutes (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/care-notes?at=2026-09-16T19:20:00Z')
})

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { careNotes, GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { coarseWait, ReviewState } from './note-parts'

/**
 * A wait in one unit, rounded once. The defect was a value rounded to the hour
 * and then rounded again to the day, which said a flag had waited a day longer
 * than it had.
 */
describe('coarseWait', () => {
  it('rounds days from the minutes, so 83 hours 39 minutes is 3 days, not 4', () => {
    expect(coarseWait(83 * 60 + 39)).toBe('3 days')
  })

  it('still rounds a wait past the half day up', () => {
    expect(coarseWait(84 * 60)).toBe('4 days')
  })

  it('keeps hours under two days and minutes under an hour', () => {
    expect(coarseWait(59)).toBe('59 minutes')
    expect(coarseWait(47 * 60 + 29)).toBe('47 hours')
  })
})

describe('a flagged note’s wait, on the chip', () => {
  it('says 3 days for the note flagged at 08:41 BST on 13/09', () => {
    const note = careNotes.find((entry) => entry.id === GAP_NOTE_IDS.flaggedNotReviewed)
    if (note?.review.kind !== 'flagged_not_reviewed')
      throw new Error('The flagged note changed shape in the fixtures')
    expect(note.review.flaggedAt).toBe('2026-09-13T07:41:00.000Z')
    const { container } = render(<ReviewState note={note} />)
    expect(container.textContent).toContain('waiting 3 days')
  })
})
