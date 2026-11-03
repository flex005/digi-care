import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { currentRoundAt } from './round'

/**
 * The round the screen opens on, at 14:20 on the home's clock in September
 * (BST) and in November (GMT), on machines in four zones. It read the hour
 * with `toTimeString`, the machine's clock; on a machine behind UTC that opened
 * the 08:00 round at 14:20, and on a machine in London it was right by
 * accident, so the zone is varied rather than left to whoever runs the suite.
 */
const ROUNDS = ['08:00', '14:00', '18:00', '20:00']
const LONDON = 'Europe/London'
const SUMMER = '2026-09-16T13:20:00Z' as IsoDateTime
const WINTER = '2026-11-02T14:20:00Z' as IsoDateTime
/** The runner's environment. This build's app types carry no Node globals. */
const env = (
  globalThis as unknown as { process: { env: Record<string, string | undefined> } }
).process.env

describe('the round the screen opens on, either side of a clock change', () => {
  it.each(['Europe/London', 'Africa/Lagos', 'UTC', 'America/New_York'])(
    'is the 14:00 round at 14:20 in summer and in winter, on a machine in %s',
    (machine) => {
      const was = env.TZ
      env.TZ = machine
      try {
        expect(currentRoundAt(ROUNDS, SUMMER, LONDON)).toBe('14:00')
        expect(currentRoundAt(ROUNDS, WINTER, LONDON)).toBe('14:00')
      } finally {
        if (was === undefined) delete env.TZ
        else env.TZ = was
      }
    },
  )
})
