import type { ReviewOutcome } from '@/data/types'
import { REVIEW_OUTCOMES } from '@/data/types'

/**
 * What the reviewing senior said they did, as one string.
 *
 * The one owner of the wording, so a queue row and the supervision record
 * cannot phrase the same outcome two ways. The labels are the shared list's;
 * "Other" carries the reviewer's words after it, as they wrote them.
 *
 * **Said, not checked.** "Care plan updated" is the reviewer's account. Nothing
 * in this build looks at the care plan or the incident log to confirm it.
 */
export function reviewOutcomeText(outcome: ReviewOutcome): string {
  const entry = REVIEW_OUTCOMES.find((option) => option.id === outcome.kind)
  // `satisfies` checks that every entry in the list is a kind of the union, not
  // that every kind has an entry. A kind added to the union and not to the list
  // throws here rather than rendering a plausible label, and a test renders
  // every kind so it throws in the suite first.
  if (entry === undefined) throw new Error(`No label for outcome ${outcome.kind}`)
  return outcome.kind === 'other' ? `${entry.label}: ${outcome.text}` : entry.label
}
