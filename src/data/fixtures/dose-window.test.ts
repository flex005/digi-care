import { describe, expect, it, vi } from 'vitest'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { formatTime } from '@/lib/format'

/**
 * **A dose window is when a dose may safely be given, on the home's clock.**
 *
 * On 25/10/2026 the UK left British Summer Time and every fixture window moved
 * an hour against Rosewood: a 20:00 dose read "from 19:00 GMT", and at 20:20 a
 * dose was "due now, until 20:00". The windows were built with `setHours`, the
 * machine's clock, which matched London only while both were an hour ahead of
 * UTC. Nothing failed, because every test was pinned inside one season.
 *
 * **One instant proves nothing; the pair is the test.** The same dose is read
 * at 19:30 on the home's clock in September (BST, UTC+1) and in November
 * (GMT, UTC+0), half an hour before its round, and must show the same local
 * window both times. Both pins are full instants written with a `Z`, as
 * CLAUDE.md §8 asks of anything derived from `now`. The window is rendered in
 * the site's own zone, read from the site, not from the machine.
 *
 * **And the machine's zone is varied too**, because the old defect was
 * invisible on a machine in London: it read the machine's clock, which there
 * was the home's. Lagos is UTC+1 all year, the machine this was found on; UTC
 * and New York disagree with London in a different season each. Node applies
 * a change to `process.env.TZ` at once, and it is put back afterwards.
 */
const MACHINE_ZONES = ['Europe/London', 'Africa/Lagos', 'UTC', 'America/New_York']
/** The runner's environment. This build's app types carry no Node globals. */
const env = (
  globalThis as unknown as { process: { env: Record<string, string | undefined> } }
).process.env
const OKAFOR = 'res-okafor' as ResidentId
const ROSEWOOD = 'site-rosewood-court'

async function eightPmWindowsAt(at: string) {
  vi.resetModules()
  window.history.replaceState(null, '', `/?at=${at}`)
  const { getMarRecords } = await import('@/data/access/client')
  const { sites } = await import('./organisation')
  const zone = sites.find((site) => site.id === ROSEWOOD)?.timeZone
  if (zone === undefined) throw new Error(`No site ${ROSEWOOD} in the fixtures.`)
  const { records } = await getMarRecords(OKAFOR)
  const due = records.flatMap((record) =>
    record.roundTime === '20:00' && record.state.kind === 'due' ? [record.state] : [],
  )
  return {
    due,
    local: due.map(
      (state) =>
        `${formatTime(state.windowOpensAt, zone)}–${formatTime(state.windowClosesAt, zone)}`,
    ),
  }
}

describe('a dose window, either side of a clock change', () => {
  it.each(MACHINE_ZONES)(
    'shows the same 20:00 window in summer time and in winter time, on a machine in %s',
    async (machine) => {
      const was = env.TZ
      env.TZ = machine
      try {
        await bothSeasons(machine)
      } finally {
        if (was === undefined) delete env.TZ
        else env.TZ = was
      }
    },
  )
})

async function bothSeasons(machine: string) {
  // The zone change took: a machine in New York is behind UTC in September.
  if (machine === 'America/New_York')
    expect(new Date('2026-09-16T12:00:00Z').getTimezoneOffset()).toBe(240)

  const summer = await eightPmWindowsAt('2026-09-16T18:30:00Z')
  const winter = await eightPmWindowsAt('2026-11-02T19:30:00Z')

  // Okafor has 20:00 doses on both nights, so neither half passes empty.
  expect(summer.due.length).toBeGreaterThan(0)
  expect(winter.due.length).toBe(summer.due.length)

  for (const window of [...summer.local, ...winter.local])
    expect(window).toBe('20:00–21:00')

  // And the two really do sit either side of the change: the same local
  // window is a different UTC instant, an hour apart.
  const opens = (state: { windowOpensAt: IsoDateTime }) =>
    new Date(state.windowOpensAt).getUTCHours()
  expect(summer.due.map(opens)).toEqual(summer.due.map(() => 19))
  expect(winter.due.map(opens)).toEqual(winter.due.map(() => 20))
}
