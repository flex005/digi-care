import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026, after every round of the day has opened, so a `not_due` cell
 * today can only be a dose with nothing scheduled (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import { medications } from '@/data/fixtures/medications'
import { openDosesAt } from '@/data/access/client'
import { patchedRecords } from '@/data/access/mar-store'

/**
 * `openDosesAt` is the list `recordRound` refuses a short round by. **Checked
 * here against the raw records, not against itself**: a test that asked it
 * which doses were open would agree with whatever it believed. Ported from the
 * Care Worker build, where this check found it counting a patch's day off as an
 * open dose (06/11/2026).
 */
describe('openDosesAt, against the raw records', () => {
  it('is every dose due or omitted at the round, never one with nothing due and never an as-required drug, for everybody today', () => {
    const prn = new Set(
      medications.filter((entry) => entry.isPrn).map((entry) => entry.id),
    )
    const today = patchedRecords().filter((record) => record.date === '2026-09-16')
    const people = [...new Set(today.map((record) => record.residentId))]
    let compared = 0
    for (const person of people)
      for (const round of ['08:00', '14:00', '18:00', '20:00']) {
        const raw = today
          .filter(
            (record) =>
              record.residentId === person &&
              record.roundTime === round &&
              (record.state.kind === 'due' || record.state.kind === 'omitted') &&
              !prn.has(record.medicationId),
          )
          .map((record) => record.medicationId)
          .sort()
        expect(
          [...openDosesAt(person, '2026-09-16', round)].sort(),
          `${person} at ${round}`,
        ).toEqual(raw)
        compared += 1
      }
    expect(compared).toBeGreaterThan(80)
  })

  it('names an omitted dose, and leaves out a patch on its day off', () => {
    // Adeyemi's 08:00 metformin closed with nothing recorded: still open.
    expect(openDosesAt('res-adeyemi' as ResidentId, '2026-09-16', '08:00')).toEqual([
      'med-res-adeyemi-metformin',
    ])
    // Kavanagh's 08:00 doses are recorded, and her fentanyl patch is changed
    // every third day: today it is not due, so nothing at 08:00 is open.
    expect(openDosesAt('res-kavanagh' as ResidentId, '2026-09-16', '08:00')).toEqual([])
  })
})
