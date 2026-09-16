import type { RiskLevel, RiskTemplateId } from '@/data/types'

/**
 * The scoring instrument. PRD §6.6.
 *
 * **This is a placeholder, and every screen in the module says so.**
 *
 * The alternative was reproducing Morse, Waterlow, MUST and Braden from
 * memory, which would have put invented weightings behind names that claim
 * clinical authority — worse than an invented instrument that admits it,
 * because the name is what a reader trusts. A real instrument has to be
 * sourced before this module is used with real residents.
 *
 * The banner is the export stub's treatment for the export stub's reason: a
 * control or a figure that does not do what it appears to must say so where
 * it appears, not in a release note.
 */

export const PLACEHOLDER_NOTICE =
  'This instrument is a placeholder, not a validated clinical scale: make no clinical decision from its score.'

export interface InstrumentChoice {
  label: string
  /**
   * Always shown beside the choice.
   *
   * A scorer who cannot see the weighting cannot tell whether the instrument
   * is behaving — and on a placeholder instrument that matters more, not less.
   */
  points: number
}

export interface InstrumentItem {
  id: string
  question: string
  guidance: string
  choices: InstrumentChoice[]
}

export const INSTRUMENT_ITEMS: InstrumentItem[] = [
  {
    id: 'history',
    question: 'Assessment factor 1: recent history',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'Not present', points: 0 },
      { label: 'Present in the last 3 months', points: 15 },
      { label: 'Present in the last month', points: 25 },
    ],
  },
  {
    id: 'mobility',
    question: 'Assessment factor 2: mobility',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'Independent', points: 0 },
      { label: 'Uses an aid', points: 10 },
      { label: 'Requires assistance', points: 20 },
    ],
  },
  {
    id: 'orientation',
    question: 'Assessment factor 3: orientation',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'Oriented', points: 0 },
      { label: 'Intermittently disoriented', points: 15 },
    ],
  },
  {
    id: 'medication',
    question: 'Assessment factor 4: medication',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'No relevant medication', points: 0 },
      { label: 'One relevant medication', points: 5 },
      { label: 'Two or more', points: 10 },
    ],
  },
  {
    id: 'continence',
    question: 'Assessment factor 5: continence',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'Continent', points: 0 },
      { label: 'Occasional assistance', points: 5 },
      { label: 'Dependent', points: 10 },
    ],
  },
  {
    id: 'environment',
    question: 'Assessment factor 6: environment',
    guidance: 'Placeholder item.',
    choices: [
      { label: 'No hazards identified', points: 0 },
      { label: 'Hazards identified and mitigated', points: 5 },
      { label: 'Hazards identified, not mitigated', points: 20 },
    ],
  },
]

const BANDS: { from: number; to: number; level: RiskLevel }[] = [
  { from: 0, to: 24, level: 'low' },
  { from: 25, to: 49, level: 'moderate' },
  { from: 50, to: Number.MAX_SAFE_INTEGER, level: 'high' },
]

export function bandFor(total: number): RiskLevel {
  const band = BANDS.find((entry) => total >= entry.from && total <= entry.to)
  // The bands cover every non-negative integer by construction, so this cannot
  // fall through — but a default of "low" would be the worst possible guess.
  return band?.level ?? 'high'
}

/**
 * The five templates whose instrument produces a number.
 *
 * The other four record findings and reach a level without arithmetic — a
 * clinician's judgement rather than a sum. Kept beside the instrument because
 * it is a fact about what this build ships, not about the template list.
 */
export const SCORED_TEMPLATES: ReadonlySet<RiskTemplateId> = new Set<RiskTemplateId>([
  'falls',
  'pressure_ulcer',
  'nutrition',
  'moving_handling',
  'skin_integrity',
])

export const isScored = (id: RiskTemplateId) => SCORED_TEMPLATES.has(id)

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}

/**
 * How two scores compare.
 *
 * **Every member carries a word**, because the arrow beside it is not readable
 * in greyscale and means nothing to a screen reader. Direction by shape alone
 * is decoration.
 */
export type ScoreChange = 'improved' | 'unchanged' | 'deteriorated'

export function compareScores(previous: number, next: number): ScoreChange {
  if (next === previous) return 'unchanged'
  // A higher score is a higher risk on this instrument, so up is worse.
  return next > previous ? 'deteriorated' : 'improved'
}

export const CHANGE_WORD: Record<ScoreChange, string> = {
  improved: 'Improved',
  unchanged: 'Unchanged',
  deteriorated: 'Deteriorated',
}
