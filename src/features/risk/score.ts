import type { RiskScore } from '@/data/types'

/**
 * How a score reads where the instrument produced one.
 *
 * **Owned here rather than interpolated at the call site**, because
 * `${status.score}` compiled fine and rendered `[object Object]` the moment
 * the field became a union — TypeScript cannot see inside a template string,
 * so the compiler that catches every other shape change is blind to this one.
 * Same reason `quantityWithUnit` exists (CLAUDE.md §6).
 */
export function scoreText(score: RiskScore): string {
  return score.kind === 'scored' ? `score ${score.value}` : 'findings recorded'
}

/** "Score 24", for the one place it starts a sentence. */
export function scoreTextCapitalised(score: RiskScore): string {
  const text = scoreText(score)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
