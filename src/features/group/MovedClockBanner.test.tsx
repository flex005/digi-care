import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The banner names the instant the record was drawn at and the real time, **on
 * the home's clock**. It printed `getHours()`, the machine's: on a machine an
 * hour ahead of UTC all year that was the home's clock in summer and an hour
 * fast in winter ("Real time 17:30" at 16:30 in London). One season cannot see
 * that, so each case is read in both, on machines in four zones. Every instant
 * is a full one with a `Z` (CLAUDE.md §8).
 */
const SEASONS = [
  { season: 'summer', at: '2026-09-16T15:30:00Z' },
  { season: 'winter', at: '2026-11-02T16:30:00Z' },
]
const MACHINES = ['Europe/London', 'Africa/Lagos', 'UTC', 'America/New_York']
/** The runner's environment. This build's app types carry no Node globals. */
const env = (
  globalThis as unknown as { process: { env: Record<string, string | undefined> } }
).process.env

async function bannerAt(machine: string, realTime: string, search = '') {
  const was = env.TZ
  env.TZ = machine
  try {
    vi.setSystemTime(new Date(realTime))
    vi.resetModules()
    window.history.replaceState(null, '', `/${search}`)
    const { MovedClockBanner } = await import('./MovedClockBanner')
    const { container, unmount } = render(<MovedClockBanner />)
    const text = container.querySelector('p')?.textContent ?? ''
    unmount()
    return text
  } finally {
    if (was === undefined) delete env.TZ
    else env.TZ = was
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('the moved-clock banner is on the home’s clock', () => {
  it.each(MACHINES)(
    'names the 14:00 round and the real time 16:30 in summer and in winter, on a machine in %s',
    async (machine) => {
      for (const { season, at } of SEASONS) {
        const said = await bannerAt(machine, at)
        expect(said, season).toContain('14:20')
        expect(said, season).toContain('Showing the 14:00 round')
        expect(said, season).toContain('Real time 16:30.')
      }
    },
  )

  it.each(MACHINES)(
    'says nothing at 14:30 in summer and in winter, when the home is mid-round, on a machine in %s',
    async (machine) => {
      for (const { season, at } of [
        { season: 'summer', at: '2026-09-16T13:30:00Z' },
        { season: 'winter', at: '2026-11-02T14:30:00Z' },
      ])
        expect(await bannerAt(machine, at), season).toBe('')
    },
  )

  it.each(MACHINES)(
    'reads ?at=08:20 as 08:20 on the home’s clock in winter, on a machine in %s',
    async (machine) => {
      const said = await bannerAt(machine, '2026-11-02T16:30:00Z', '?at=08:20')
      expect(said).toContain('08:20')
      expect(said).toContain('Real time 16:30.')
    },
  )
})
