import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * A round in progress. PRD §6.4, Phase 12.
 *
 * **The state was unreachable and the screen was right to say zero**, which is
 * the worst pair a figure can offer: correct, and indistinguishable from
 * broken. The generator recorded every round in the past, including one that
 * opened four minutes ago, so no dose in the fixture was ever inside its
 * window and the Dashboard's due-now segment could not be non-zero on any
 * fresh load.
 *
 * The fixtures are generated at module load against `new Date()`, so asking
 * what the home looks like at another hour means faking the clock before the
 * import. That is what this does, and it is the only way to prove the branch
 * is reached rather than to hold it by construction.
 */
async function freshLoadAt(hour: number, minute: number) {
  vi.resetModules()
  const when = new Date()
  when.setHours(hour, minute, 0, 0)
  // Timers advance, or the fixture's own promises never settle.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(when)

  const { sites } = await import('@/data/fixtures/organisation')
  const { loadToday } = await import('./today')
  const { roundsToday, todayDoses } = await import('./series')

  const site = sites[0]!
  const iso = when.toISOString() as never
  const today = await loadToday(site, iso)
  const doses = todayDoses(roundsToday(site, today.residents, iso))
  vi.useRealTimers()
  return doses
}

describe('a round in progress is reachable', () => {
  afterEach(() => vi.useRealTimers())

  it('has doses inside their window twenty minutes into a round', async () => {
    const doses = await freshLoadAt(8, 20)

    expect(doses.dueNow).toBeGreaterThan(0)
    // Nothing is recorded yet twenty minutes in, and nothing is missing:
    // the hour has not run out on anybody.
    expect(doses.noRecord).toBe(0)
    expect(doses.recorded + doses.noRecord + doses.dueNow + doses.notDueYet).toBe(
      doses.total,
    )
  }, 30000)

  it('has none an hour later, and the same doses are missing instead', async () => {
    const inWindow = await freshLoadAt(8, 20)
    const after = await freshLoadAt(9, 30)

    /*
     * The window is what separates a dose somebody is about to give from one
     * nobody gave. An hour on, the same doses are a finding.
     */
    expect(after.dueNow).toBe(0)
    expect(after.noRecord).toBeGreaterThan(0)
    // The day holds what the day holds, whichever hour it is read at.
    expect(after.total).toBe(inWindow.total)
  }, 30000)
})
