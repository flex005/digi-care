import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026, twenty minutes into the 20:00 round. Each figure below was
 * measured at this instant (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { ResidentId, SiteId } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { openDosesAt } from '@/data/access/client'

/**
 * The 20:00 round at Rosewood Court, as figures written out by hand.
 *
 * **This build's side of a gap with the Care Worker build**, which reads the
 * same fixtures and holds one more dose open on this round: Grace Adeyemi's
 * never-counted oxycodone, signed here and still to give there. The reason is
 * in `docs/AM_PRD_STATUS.md`, under "Deliberate departures from the PRD"; the
 * Care Worker side is held by its `dashboard.test.tsx` (21 across 16) and
 * `badge-denominator.test.tsx` (6 of 26). A change on this side fails here
 * rather than quietly making that entry wrong.
 *
 * Asked of `openDosesAt`, the round's own derivation of what is still to
 * answer. Counted a second way from the raw dose records at the pin (state
 * `due`, not as-required, 20:00 on 16/09/2026): 20 doses, 16 residents, and 5
 * on the four residents below. At 20:20 no dose at this round can be an
 * omission yet, because its window has not closed, so the two agree.
 */
const ROSEWOOD = 'site-rosewood-court' as SiteId
const DAY = '2026-09-16'
const ROUND = '20:00'

/** The residents N. Eze is given, written out rather than asked of the team. */
const EZES_FOUR = [
  'res-okafor',
  'res-adeyemi',
  'res-hutchinson',
  'res-pemberton',
] as ResidentId[]

const openAt = (ids: ResidentId[]) =>
  ids.map((id) => ({ id, open: openDosesAt(id, DAY, ROUND) }))

describe('Rosewood Court’s 20:00 round, twenty minutes in', () => {
  it('has 20 doses open across 16 residents', () => {
    const everyone = openAt(residentsBySite(ROSEWOOD).map((resident) => resident.id))
    expect(everyone.reduce((sum, entry) => sum + entry.open.length, 0)).toBe(20)
    expect(everyone.filter((entry) => entry.open.length > 0)).toHaveLength(16)
  })

  it('has 5 open on N. Eze’s four residents, and Adeyemi’s oxycodone not among them', () => {
    const hers = openAt(EZES_FOUR)
    expect(hers.reduce((sum, entry) => sum + entry.open.length, 0)).toBe(5)
    expect(hers.find((entry) => entry.id === 'res-adeyemi')?.open).not.toContain(
      'med-res-adeyemi-oxycodone-oral-solution',
    )
  })
})
