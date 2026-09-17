import { afterEach, describe, expect, it } from 'vitest'
import type { CareNote, IsoDate, IsoDateTime, MedicationId } from '@/data/types'
import { careNotes } from '@/data/fixtures/care-notes'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { appendNote, recordReview } from '@/data/access/note-store'
import { recordAdministration } from '@/data/access/mar-store'
import { acceptRow } from '@/data/access/cycle-store'
import { setFigure } from '@/data/access/settings-store'
import {
  endSession,
  sessionHasWrites,
  sessionLossTotal,
  sessionLosses,
} from '@/data/access/session-losses'

/**
 * What signing out destroys. PRD §6.7.
 *
 * Signing out is the only action in this build that destroys work rather than
 * failing to save it, so the confirmation names what would go item by item.
 * These guards are about that list being true.
 */

afterEach(() => {
  endSession()
})

const note = (over: Partial<CareNote> = {}): CareNote => ({
  ...careNotes[0]!,
  id: 'note-session-guard' as CareNote['id'],
  ...over,
})

describe('the list is what is actually there', () => {
  it('says nothing when nothing has been written', () => {
    expect(sessionLosses()).toEqual([])
    expect(sessionHasWrites()).toBe(false)
    expect(sessionLossTotal()).toBe(0)
  })

  it('names each kind of writing separately rather than as one number', () => {
    appendNote(note())
    recordReview(careNotes[1]!.id, {
      kind: 'reviewed',
      flaggedBy: staffOkonkwo,
      flaggedAt: careNotes[1]!.recordedAt,
      reason: { kind: 'not_given' },
      reviewedBy: staffOkonkwo,
      reviewedAt: careNotes[1]!.recordedAt,
      outcome: { kind: 'no_further_action' },
    })

    const losses = sessionLosses()
    const phrases = losses.map((entry) => entry.what)
    /*
     * A care note somebody wrote and a review somebody recorded are different
     * acts, and one number covering both would misdescribe what is at stake.
     */
    expect(phrases).toContain('care notes you wrote')
    expect(phrases).toContain('notes you marked reviewed')
    expect(new Set(phrases).size).toBe(phrases.length)
  })

  it('reaches writes the activity log never sees', () => {
    /*
     * The whole reason this file exists. Nine of the client's write functions
     * never reach the session log, among them every medication round — a loss
     * list built on the log would have been silently missing them and looked
     * complete.
     */
    recordAdministration(
      'med-guard-1' as MedicationId,
      '2026-08-27' as IsoDate,
      '08:00',
      {
        kind: 'given',
        givenBy: staffOkonkwo,
        givenAt: careNotes[0]!.recordedAt as IsoDateTime,
        witness: { kind: 'not_required' },
      },
    )
    acceptRow('cycle-guard-losses', staffOkonkwo)

    const phrases = sessionLosses().map((entry) => entry.what)
    expect(phrases).toContain('doses you signed for')
    expect(phrases).toContain('pharmacy cycle rows you acted on')
  })

  it('sums the button’s figure from the same list the rows come from', () => {
    /*
     * Three notes and one cycle row, so the sum (4) and the number of rows (2)
     * cannot be each other. With one of each the two are equal and the
     * assertion holds whether the total is summed or counted, which is an
     * assertion that cannot fail.
     */
    appendNote(note({ id: 'note-total-1' as CareNote['id'] }))
    appendNote(note({ id: 'note-total-2' as CareNote['id'] }))
    appendNote(note({ id: 'note-total-3' as CareNote['id'] }))
    acceptRow('cycle-guard-total', staffOkonkwo)

    /*
     * One derivation. A total computed apart from its parts is the two-clocks
     * failure: the sum stays plausible while disagreeing with what is above it,
     * and nobody can say which is right.
     */
    const rows = sessionLosses()
    const listed = rows.reduce((running, one) => running + one.count, 0)
    expect(sessionLossTotal()).toBe(listed)
    expect(listed).toBeGreaterThan(rows.length)
  })

  it('counts a settings change, because losing it changes every timestamp', () => {
    setFigure('due-soon-days', 9)
    expect(sessionLosses().map((one) => one.what)).toContain(
      'figures you changed in Settings',
    )
  })
})

describe('signing out empties everything, not most things', () => {
  it('leaves nothing behind in any store', () => {
    appendNote(note())
    recordAdministration(
      'med-guard-2' as MedicationId,
      '2026-08-27' as IsoDate,
      '08:00',
      {
        kind: 'given',
        givenBy: staffOkonkwo,
        givenAt: careNotes[0]!.recordedAt as IsoDateTime,
        witness: { kind: 'not_required' },
      },
    )
    acceptRow('cycle-guard-end', staffOkonkwo)
    setFigure('due-soon-days', 11)
    expect(sessionHasWrites()).toBe(true)

    endSession()

    expect(sessionLosses()).toEqual([])
    expect(sessionLossTotal()).toBe(0)
  })
})
