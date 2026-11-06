import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 08:20 BST on
 * 16/09/2026, inside the 08:00 window, on a day three residents' patches are
 * not due (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T07:20:00Z')
})

import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, MedicationId, ResidentId } from '@/data/types'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { recordRound } from '@/data/access/client'
import { patchedRecords } from '@/data/access/mar-store'
import { endSession } from '@/data/access/session-losses'

/**
 * **A round is recordable on a patch's day off.** Kavanagh's fentanyl and
 * Salami's and Amadi's buprenorphine are changed every third day, and on
 * 16/09/2026 none is due. The round leaves each patch off; `openDosesAt` used to
 * demand it, so answering every dose the round shows was refused as "short 1 of
 * N" and the round could never be signed. Residents and doses are literals: this
 * asks no helper which doses are open.
 */
const AT = '2026-09-16T07:20:00.000Z' as IsoDateTime

beforeEach(() => endSession())

const ROUNDS: [string, string[]][] = [
  ['res-kavanagh', ['med-res-kavanagh-amlodipine']],
  ['res-salami', ['med-res-salami-metformin', 'med-res-salami-amlodipine']],
  ['res-amadi', ['med-res-amadi-lansoprazole']],
]

describe('the 08:00 round on a patch’s day off', () => {
  it.each(ROUNDS)(
    'records %s’s round with every dose the round shows answered',
    async (person, doses) => {
      const patch = patchedRecords().find(
        (record) =>
          record.residentId === person &&
          record.date === '2026-09-16' &&
          record.roundTime === '08:00' &&
          record.medicationId.includes('transdermal-patch'),
      )
      expect(patch?.state.kind).toBe('not_due')
      await expect(
        recordRound({
          residentId: person as ResidentId,
          date: '2026-09-16',
          roundTime: '08:00',
          doses: doses.map((medicationId) => ({
            medicationId: medicationId as MedicationId,
            state: {
              kind: 'not_given',
              reason: 'resident_refused',
              note: '',
              recordedAt: AT,
              recordedBy: staffAkinyemi,
            },
          })),
          openingCounts: [],
          by: staffAkinyemi,
          at: AT,
        }),
      ).resolves.toBe(doses.length)
    },
  )
})
