import type { ContactState, IsoDateTime, StaffRef } from '@/data/types'
import type { ContactChoice } from './ResponseSection'

/**
 * One of the three contact answers, as the record holds it.
 *
 * **One owner, because both forms build this now.** It was a closure inside
 * `assembleReport`, which meant the correction modal could only have it by
 * writing a second copy — and the interesting part is not the mapping but the
 * rule inside it: `not_required` is a decision, so it carries a reason and the
 * name of whoever decided. A second copy is where that stops being true.
 */
export function contactState(
  choice: ContactChoice | '',
  notRequiredReason: string,
  by: StaffRef,
  at: IsoDateTime,
): ContactState {
  return choice === 'contacted'
    ? { kind: 'contacted', at, by, outcome: '' }
    : choice === 'not_required'
      ? {
          kind: 'not_required',
          reason: notRequiredReason.trim(),
          recordedBy: by,
          recordedAt: at,
        }
      : { kind: 'not_yet' }
}

/** The stored state read back as the choice a form shows. */
export function contactChoiceOf(state: ContactState): ContactChoice {
  return state.kind === 'contacted'
    ? 'contacted'
    : state.kind === 'not_required'
      ? 'not_required'
      : 'not_yet'
}
