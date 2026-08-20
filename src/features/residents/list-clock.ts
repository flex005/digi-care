import { NOW } from '@/data/fixtures/generate'

/**
 * One instant for the whole session, and the same one the fixtures were
 * generated against.
 *
 * Not `Date.now()` per render: two figures on the same screen would then be
 * measured against different instants, so a row could read "2 hours ago" while
 * the 48-hour window it feeds had moved underneath it. React's compiler
 * objects to the impure call for the same reason it is wrong here — a value
 * that changes when a component happens to re-render.
 *
 * The day this is a real backend, the clock comes from it.
 */
export const LIST_CLOCK = NOW.getTime()
