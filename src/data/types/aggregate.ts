/**
 * Rule 4 — every aggregate carries its denominator. PRD §2.2, §5.1.
 *
 * No bare counts, no bare percentages, anywhere in the product. Not
 * "3 incidents" but "3 incidents across 32 residents". Not "92% compliance"
 * but "92% — 46 of 50 expected notes".
 *
 * `Aggregate` is the type behind every metric, RAG status, dashboard tile and
 * report figure. A component that renders a number without a Coverage
 * alongside it is a bug. There is deliberately no bare number type here.
 */

export type Coverage = { covered: number; total: number }

/**
 * `unit` disambiguates the two shapes Rule 4 needs: a rate derived from
 * coverage ("92% — 46 of 50") and a count where coverage is the population it
 * was measured across ("3 incidents across 32 residents").
 *
 * `insufficient_evidence` is not a milder Red. Red is a finding; this is the
 * absence of one. It renders in the unrecorded treatment, never in a RAG hue,
 * and it always states what is missing and how much. PRD §2.3.
 */
export type Aggregate =
  | { kind: 'insufficient_evidence'; coverage: Coverage; missingDescription: string }
  | {
      kind: 'measured'
      unit: 'count' | 'percentage'
      value: number
      coverage: Coverage
    }

/**
 * The threshold below which a figure cannot support a claim. PRD §2.3:
 * hard-coded to 60% in fixtures for now, configurable per organisation in a
 * later phase. Open item §9.2 — needs a real answer before Phase 12.
 */
export const INSUFFICIENT_EVIDENCE_THRESHOLD = 0.6

/** Coverage as a fraction. Returns 0 for an empty denominator — a zero
 *  denominator is exactly the case that must never read as reassuring. */
export function coverageRatio(coverage: Coverage): number {
  if (coverage.total === 0) return 0
  return coverage.covered / coverage.total
}

/** Whether coverage is too thin to support any claim. PRD §2.3. */
export function isInsufficient(coverage: Coverage): boolean {
  return coverageRatio(coverage) < INSUFFICIENT_EVIDENCE_THRESHOLD
}
