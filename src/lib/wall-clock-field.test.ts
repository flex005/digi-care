import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { instantFromWallClockField, wallClockField } from './format'

/**
 * The `datetime-local` pair, against the defect that produced it.
 *
 * **Both halves were wrong, in opposite directions.** The correction form
 * pre-filled `incident.occurredAt.slice(0, 16)` — raw stored UTC — on a page
 * whose every other timestamp renders in the site's zone, so the form and the
 * record it was correcting showed different times for one incident. And both
 * incident forms saved through `new Date(field)`, which the HTML spec parses
 * as the **viewer's** local time. Together: open a correction, fix a typo in
 * the description, save, and the time the incident happened moves.
 *
 * **Why nothing caught it.** Every fixture site is Europe/London and the
 * machine running the suite sits in Europe/London, so the viewer's zone and
 * the site's zone were the same string and the wrong one gave the right
 * answer. §8's rule about anything deriving from `now` is the same rule one
 * step out: a value derived from the *environment* needs that environment
 * pinned, or the test is only about the machine it was written on.
 *
 * So the viewer's zone is pinned here, to somewhere that is neither site —
 * through `vi.stubEnv`, which restores it afterwards. The zone is process
 * state and vitest runs files sequentially inside a worker, so leaving it
 * changed would quietly re-point every file that ran after this one.
 */

const LONDON = 'Europe/London'
const NEW_YORK = 'America/New_York'

/** Pinned instants, never `now`. BST and GMT, so the offset is not constant. */
const SUMMER = '2026-08-19T07:04:00.000Z' as IsoDateTime
const WINTER = '2026-12-19T07:04:00.000Z' as IsoDateTime

beforeAll(() => {
  // Lagos: UTC+1 year-round. It agrees with London all summer and diverges
  // every winter, which is the shape of the latent bug in the report form.
  vi.stubEnv('TZ', 'Africa/Lagos')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('a field shows the wall clock the site keeps', () => {
  it('pre-fills a summer instant as the site clock, not as UTC', () => {
    // 07:04Z is 08:04 BST. The raw slice this replaced said 07:04.
    expect(wallClockField(SUMMER, LONDON)).toBe('2026-08-19T08:04')
  })

  it('pre-fills a winter instant, when the site is on GMT', () => {
    expect(wallClockField(WINTER, LONDON)).toBe('2026-12-19T07:04')
  })

  it('is the site zone, not one zone hardcoded', () => {
    expect(wallClockField(SUMMER, NEW_YORK)).toBe('2026-08-19T03:04')
  })
})

describe('the field reads back as the instant the site meant', () => {
  /*
   * **The assertion the whole change exists for.** Untouched means untouched:
   * a form opened on an incident and saved without the time field being
   * edited must write back the instant it started with.
   */
  it.each([
    ['summer', SUMMER],
    ['winter', WINTER],
  ])('round-trips a %s instant with the field untouched', (_season, instant) => {
    const field = wallClockField(instant, LONDON)
    expect(instantFromWallClockField(field, LONDON)).toBe(instant)
  })

  it('round-trips for a site that is not the viewer and not London', () => {
    const field = wallClockField(SUMMER, NEW_YORK)
    expect(instantFromWallClockField(field, NEW_YORK)).toBe(SUMMER)
  })

  it('reads an edited time as the site clock rather than the viewer clock', () => {
    // Somebody at this site typing 09:30 on a BST day means 08:30Z. A viewer
    // in Lagos parsing it locally would have written 08:30Z too — which is
    // why this case is pinned in winter as well, below.
    expect(instantFromWallClockField('2026-08-19T09:30', LONDON)).toBe(
      '2026-08-19T08:30:00.000Z',
    )
  })

  it('does not take the viewer zone in winter, when Lagos and London differ', () => {
    // Lagos is UTC+1 all year; London in December is UTC+0. A viewer-local
    // parse writes 08:30Z for this field. The site meant 09:30Z.
    expect(instantFromWallClockField('2026-12-19T09:30', LONDON)).toBe(
      '2026-12-19T09:30:00.000Z',
    )
  })
})

/**
 * The two hours a year when a wall clock is not a function of an instant.
 * Pinned to the real 2026 transitions: BST begins 29/03 01:00 UTC and ends
 * 25/10 01:00 UTC.
 */
describe('the clock change is decided, not stumbled into', () => {
  it('takes the earlier of the two when an hour happens twice', () => {
    // 01:30 on 25/10/2026 exists at 00:30Z (BST) and again at 01:30Z (GMT).
    expect(instantFromWallClockField('2026-10-25T01:30', LONDON)).toBe(
      '2026-10-25T00:30:00.000Z',
    )
  })

  it('shifts forward rather than refusing an hour that never happened', () => {
    // 01:30 on 29/03/2026 does not exist; the clock goes 00:59 GMT to 02:00
    // BST. It lands on 02:30 BST, which is 01:30Z.
    expect(instantFromWallClockField('2026-03-29T01:30', LONDON)).toBe(
      '2026-03-29T01:30:00.000Z',
    )
    expect(wallClockField('2026-03-29T01:30:00.000Z' as IsoDateTime, LONDON)).toBe(
      '2026-03-29T02:30',
    )
  })

  it('is unambiguous on the hours either side of a transition', () => {
    for (const field of ['2026-10-25T00:30', '2026-10-25T02:30']) {
      const back = instantFromWallClockField(field, LONDON)
      expect(wallClockField(back, LONDON)).toBe(field)
    }
  })
})

describe('it refuses what is not a field value', () => {
  it('throws rather than inventing an instant', () => {
    expect(() => instantFromWallClockField('', LONDON)).toThrow(/datetime-local/)
    expect(() => instantFromWallClockField('19/08/2026 08:04', LONDON)).toThrow(
      /datetime-local/,
    )
  })
})
