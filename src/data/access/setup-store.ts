import { held, type SessionHolding } from './session-holding'

/**
 * Which steps of the organisation setup wizard have been confirmed. AM v2.0
 * AUTH-05, Phase 23.
 *
 * **"First login only" cannot be true here, and this store is the honest
 * version of it.** There are no accounts, no server and nothing persists: a
 * flag saying the wizard has run would live in this tab and reset on reload, so
 * it would describe the tab rather than the organisation. The wizard is
 * therefore a screen you can open whenever you want, and the screen says that
 * nothing remembers whether it has run.
 *
 * What *can* honestly be remembered is progress within this session, which is
 * what AM v2.0's "resumes where it was left" needs: the steps somebody
 * confirmed, so leaving the wizard and coming back lands on the next one.
 *
 * **It records confirmation, never data.** Every value the wizard writes goes
 * through the owner that already holds it — the organisation and site names
 * through the settings store, templates through the site configuration, the
 * invitation through the team store. This holds only which steps somebody said
 * were done, so the wizard cannot become a second record of any of them.
 */

export type SetupStepId = 'organisation' | 'site' | 'templates' | 'invite'

/** Steps 1 and 2 are required; 3 and 4 can be skipped. */
export const REQUIRED_STEPS: readonly SetupStepId[] = ['organisation', 'site']

const confirmed = new Set<SetupStepId>()
const skipped = new Set<SetupStepId>()

export const isConfirmed = (step: SetupStepId): boolean => confirmed.has(step)
export const isSkipped = (step: SetupStepId): boolean => skipped.has(step)

export function confirmStep(step: SetupStepId): void {
  skipped.delete(step)
  confirmed.add(step)
}

export function skipStep(step: SetupStepId): void {
  if (REQUIRED_STEPS.includes(step)) throw new Error(`${step} is required.`)
  confirmed.delete(step)
  skipped.add(step)
}

export const requiredDone = (): boolean =>
  REQUIRED_STEPS.every((step) => confirmed.has(step))

/** The first step nobody has confirmed or skipped: where the wizard resumes. */
export function resumeAt(order: readonly SetupStepId[]): SetupStepId | undefined {
  return order.find((step) => !confirmed.has(step) && !skipped.has(step))
}

export function setupHoldings(): SessionHolding[] {
  return [...held('setup steps you confirmed', confirmed.size)]
}

/** Emptied on sign out, and by tests. */
export function resetSessionSetup(): void {
  confirmed.clear()
  skipped.clear()
}
