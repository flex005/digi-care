import { now as appNow } from '@/data/fixtures/clock'
import type { SessionAct, StaffRef } from '../types'

/**
 * What this session has written. PRD §6.7, Phase 14.
 *
 * **Narrow on purpose, because the wide version would be fabricated.** The two
 * things a real activity log answers are *who read this person's record* and
 * *who did something that left no trace on a record* — a login, an export, a
 * permission change. This build has no authentication, no reads to log and no
 * exports, so a log claiming to hold them would be a screen inventing its own
 * evidence, which is the failure the whole product is organised against.
 *
 * What it does hold is real and has one genuine use: showing a reviewer
 * exactly what a demonstration session changed. Everything here happened, in
 * this browser tab, in the last few minutes.
 *
 * In memory and nowhere else, and gone on reload — like every other write in
 * this build.
 */

const acts: SessionAct[] = []

let sequence = 0

/**
 * Records one write.
 *
 * **Called from the client and from nowhere else**, so the log has one owner
 * rather than a call at each screen, where the third screen would forget.
 *
 * **It does not follow that every write is logged, and the comment here used
 * to say it did.** Ten of the client's write functions call `logged()` and
 * nine do not: a medication round, a PRN dose, a controlled drug opening
 * count, a post-incident review flag closed, a care plan draft saved, a whole
 * plan review completed, and every undo. That is a real hole in this log — and
 * the reason the sign-out screen, which must not be missing anything, asks the
 * stores rather than asking here.
 */
export function logAct(input: {
  module: string
  what: string
  to: string
  by: StaffRef
}): void {
  sequence += 1
  /*
   * **Stamped here, from the clock, not taken from the record.** A care plan
   * finalisation carries a date and a care note an instant, and the log is not
   * about either: it is about this session, in order, and every entry in it
   * happened a moment ago. Taking the record's own timestamp would have meant
   * widening a date into an invented midnight — which the instant-kinds guard
   * caught in this very function.
   */
  acts.push({ id: `act-${sequence}`, at: appNow().toISOString(), ...input })
}

/** Newest first, because the question is what just happened. */
export function sessionActs(): SessionAct[] {
  return [...acts].reverse()
}

export function sessionActCount(): number {
  return acts.length
}

/**
 * Emptied on sign out, and by tests.
 *
 * **This log is not the source for what signing out destroys.** It records
 * what passed through `client.ts`'s `logged()` wrapper, which is six modules
 * of twelve — the docblock above claimed every write in the product goes
 * through one function there, and it does not. `session-losses.ts` asks each
 * store instead.
 */
export function resetSessionLog(): void {
  acts.length = 0
  sequence = 0
}
