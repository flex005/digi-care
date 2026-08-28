import { held, type SessionHolding } from './session-holding'
import type { StaffRef } from '../types'
import { now } from '../fixtures/clock'

/**
 * What the home has accepted from this cycle. PRD §6.4.
 *
 * **Row by row, and there is no accept-all.** One click asserting nineteen
 * medication changes nobody read is the handover failure with prescriptions in
 * it: a signature covering things the signer did not look at. The store has no
 * function that could implement one, which is the point — the refusal lives
 * where it cannot be worked around from a screen.
 *
 * Session only, like every other write here.
 */
export interface CycleAction {
  kind: 'accepted' | 'queried' | 'stopped_here'
  by: StaffRef
  at: string
  /** Why, where the act needs one. A query with no question is a shrug. */
  note: string
}

const actions = new Map<string, CycleAction>()

const act = (kind: CycleAction['kind'], by: StaffRef, note: string): CycleAction => ({
  kind,
  by,
  at: now().toISOString(),
  note,
})

/** The home has read this change and recorded that it received it. */
export function acceptRow(rowId: string, by: StaffRef): CycleAction {
  const entry = act('accepted', by, '')
  actions.set(rowId, entry)
  return entry
}

/**
 * The home does not agree with this row and has asked the pharmacy.
 *
 * The question is required: a query with nothing in it records that somebody
 * was unhappy and not what about, which is the same as not recording it.
 */
export function queryRow(rowId: string, question: string, by: StaffRef): CycleAction {
  if (question.trim() === '') {
    throw new Error('A query has to say what is being asked.')
  }
  const entry = act('queried', by, question.trim())
  actions.set(rowId, entry)
  return entry
}

/**
 * A drug the pharmacy has stopped supplying, stopped here too.
 *
 * The reason is required for the same reason a `not_given` needs one: stopping
 * a medication is a clinical act, and one with no reason cannot be read later
 * by anybody deciding whether it was right.
 */
export function stopHere(rowId: string, reason: string, by: StaffRef): CycleAction {
  if (reason.trim() === '') {
    throw new Error('Stopping a medication here has to say why.')
  }
  const entry = act('stopped_here', by, reason.trim())
  actions.set(rowId, entry)
  return entry
}

/** What this store would lose. */
export function cycleHoldings(): SessionHolding[] {
  return held('pharmacy cycle rows you acted on', actions.size)
}

/** Emptied on sign out, and by tests. */
export function resetSessionCycle(): void {
  actions.clear()
}

export const actionFor = (rowId: string): CycleAction | undefined => actions.get(rowId)

export const acceptedCount = (rowIds: string[]): number =>
  rowIds.filter((id) => actions.get(id)?.kind === 'accepted').length

/** Every row read and acted on. What "close the cycle" waits for. */
export const allHandled = (rowIds: string[]): boolean =>
  rowIds.length > 0 && rowIds.every((id) => actions.has(id))
