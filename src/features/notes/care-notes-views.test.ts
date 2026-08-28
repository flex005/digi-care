import { describe, expect, it } from 'vitest'
import type {
  CareNote,
  CareNoteId,
  IsoDateTime,
  Resident,
  ResidentId,
} from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { careNotes } from '@/data/fixtures/care-notes'
import { staffHalloran, staffNwosu } from '@/data/fixtures/organisation'
import {
  authorsIn,
  byAuthor,
  byShift,
  flaggedNotReviewed,
  withoutNoteOnShift,
  withoutNoteToday,
} from './care-notes-views'

/**
 * The four questions `/care-notes` exists to answer. PRD §6.3.
 *
 * These are pure functions taking `now` and a timezone, so "today" means the
 * site's day rather than the machine's and the answers can be pinned.
 */

const TZ = 'Europe/London'

const at = (day: number, hour: number): IsoDateTime =>
  `2026-01-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z` as IsoDateTime

const resident = (id: string, name: string) =>
  ({
    id: `res-${id}` as ResidentId,
    fullLegalName: name,
    preferredName: name.split(' ')[0],
  }) as Resident

const note = (
  id: string,
  residentId: string,
  recordedAt: IsoDateTime,
  overrides: Partial<CareNote> = {},
): CareNote =>
  ({
    id: `note-${id}` as CareNoteId,
    residentId: `res-${residentId}` as ResidentId,
    category: 'general',
    body: 'Settled.',
    mood: { kind: 'not_recorded' },
    recordedBy: staffNwosu,
    recordedAt,
    shift: { kind: 'auto', value: 'early' },
    review: { kind: 'not_flagged' },
    supersededBy: 'none',
    corrects: 'none',
    ...overrides,
  }) as CareNote

describe('flagged and not yet reviewed', () => {
  it('sorts by how long each has waited, oldest first', () => {
    // A supervisory queue sorted newest first buries the note that has been
    // waiting three days under the one that arrived this morning.
    const residents = [
      resident('a', 'Ada Nwachukwu'),
      resident('b', 'Beryl Hutchinson'),
    ]
    const flagged = (id: string, res: string, when: IsoDateTime) =>
      note(id, res, when, {
        review: {
          kind: 'flagged_not_reviewed',
          flaggedBy: staffNwosu,
          flaggedAt: when,
        },
      })

    const items = flaggedNotReviewed(
      [flagged('new', 'a', at(14, 9)), flagged('old', 'b', at(12, 9))],
      residents,
    )
    expect(items.map((item) => item.note.id)).toEqual(['note-old', 'note-new'])
  })

  it('excludes reviewed and unflagged notes', () => {
    const residents = [resident('a', 'Ada Nwachukwu')]
    const items = flaggedNotReviewed(
      [
        note('plain', 'a', at(12, 9)),
        note('done', 'a', at(12, 10), {
          review: {
            kind: 'reviewed',
            flaggedBy: staffNwosu,
            flaggedAt: at(12, 10),
            reviewedBy: staffHalloran,
            reviewedAt: at(12, 11),
          },
        }),
      ],
      residents,
    )
    expect(items).toHaveLength(0)
  })

  it('leaves a queue somebody could actually work through', () => {
    // Standing check: volume that drowns a distinction is the same failure as
    // a blank cell. An earlier fixture left 208 notes awaiting review across
    // 28 residents, which is a wall rather than a queue.
    const residents = residentsBySite('site-rosewood-court')
    const ids = new Set(residents.map((entry) => entry.id))
    const items = flaggedNotReviewed(
      careNotes.filter((entry) => ids.has(entry.residentId)),
      residents,
    )
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(residents.length)
  })
})

describe('residents with no note today', () => {
  it('uses the site day, not the viewer day', () => {
    const residents = [resident('a', 'Ada Nwachukwu')]
    // 23:30 UTC on the 12th is 23:30 on the 12th in London in January.
    const items = withoutNoteToday(
      residents,
      [note('n', 'a', at(12, 23))],
      TZ,
      at(12, 23),
    )
    expect(items).toHaveLength(0)
  })

  it('separates "never written up" from "nothing today", never first', () => {
    // Two different failures. Collapsing them loses the worse inside the
    // milder one.
    const residents = [
      resident('a', 'Ada Nwachukwu'),
      resident('b', 'Beryl Hutchinson'),
    ]
    const items = withoutNoteToday(
      residents,
      [note('n', 'a', at(10, 9))],
      TZ,
      at(12, 9),
    )

    expect(items).toHaveLength(2)
    expect(items[0]?.resident.id).toBe('res-b')
    expect(items[0]?.last).toBe('never')
    expect(items[1]?.last).not.toBe('never')
  })
})

describe('by shift', () => {
  it('claims an absence only for the shift and day it names', () => {
    // Rule 3c: this absence claim is legitimate because it carries its filter.
    const residents = [
      resident('a', 'Ada Nwachukwu'),
      resident('b', 'Beryl Hutchinson'),
    ]
    const notes = [
      note('early', 'a', at(12, 9), { shift: { kind: 'auto', value: 'early' } }),
      note('night', 'b', at(12, 23), { shift: { kind: 'auto', value: 'night' } }),
    ]

    expect(
      byShift(notes, residents, 'night', TZ, at(12, 23)).map((i) => i.note.id),
    ).toEqual(['note-night'])
    // Ada was written about today, but not on the night shift. Both facts are
    // true and the screen states which one it is asserting.
    expect(
      withoutNoteOnShift(residents, notes, 'night', TZ, at(12, 23)).map((r) => r.id),
    ).toEqual(['res-a'])
  })
})

describe('by author', () => {
  it('lists only that author, and offers only authors who wrote here', () => {
    const residents = [resident('a', 'Ada Nwachukwu')]
    const notes = [
      note('one', 'a', at(12, 9)),
      note('two', 'a', at(12, 10), { recordedBy: staffHalloran }),
    ]
    expect(byAuthor(notes, residents, staffNwosu.id).map((i) => i.note.id)).toEqual([
      'note-one',
    ])
    expect(
      authorsIn(notes)
        .map(([id]) => id)
        .sort(),
    ).toEqual([staffHalloran.id, staffNwosu.id].sort())
  })
})
