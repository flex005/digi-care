import type {
  CustomRisk,
  CustomRiskId,
  RiskLevel,
  RiskStatus,
  RiskTemplateId,
} from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'

/**
 * The scoring instruments. PRD §6.6.
 *
 * **Four of the nine templates score; all four are published scales.** Falls
 * Risk carries the Morse Fall Scale, Pressure Ulcer Risk the Waterlow Score,
 * Nutritional Risk the Malnutrition Universal Screening Tool, and Skin
 * Integrity the Braden Scale. Each was sourced and cross-checked against
 * independent references before being entered here; the item weights and band
 * thresholds are those instruments', not ours.
 *
 * **The other five record findings and reach a level by judgement** —
 * choking and dysphagia, behaviour support, environmental risk, COSHH, and
 * moving and handling. Nothing scores them, and that is not a gap waiting to
 * be filled.
 *
 * **Moving and Handling is the one that moved, and the reason is worth
 * keeping.** It sat in the scored set carrying an invented instrument,
 * because the architecture had one shared placeholder and no way to say
 * otherwise. Its named framework is the Manual Handling Operations
 * Regulations assessment — Task, Individual, Load, Environment — which is a
 * qualitative checklist. There is nothing in TILE to weight and no total to
 * band, so sourcing it correctly would produce no instrument at all. It is
 * unscored now because that is what it always was. Anybody who later gives it
 * a band table has misread what TILE is.
 *
 * `PLACEHOLDER_INSTRUMENT` survives, and nothing scored uses it: it is what
 * `instrumentFor` answers for the five judged templates, whose draw the
 * fixture generator discards, and it is what the placeholder banner is keyed
 * to. The banner still shows on the full risk list, because `sourced` means
 * *backed by a published scale* and a template that was never meant to carry
 * a score will never be one.
 *
 * **One of the four runs the other way.** Braden counts capacity rather than
 * risk, so its highest total is its least-risk end. That is `higherIsWorse`
 * on the instrument, and it is read rather than assumed everywhere two
 * scores are compared.
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

export interface Band {
  from: number
  to: number
  level: RiskLevel
}

/**
 * One instrument: what it asks, and what its totals mean.
 *
 * `sourced` is the whole reason this is a record rather than two loose arrays.
 * Three screens decide whether to print "this is a placeholder" and they now
 * have one fact to ask rather than a list of template ids to keep in step.
 */
export interface Instrument {
  items: InstrumentItem[]
  bands: Band[]
  /** True where the items and thresholds are a published scale's. */
  sourced: boolean
  /**
   * Which direction a rising total means.
   *
   * True everywhere but Braden, where the scale runs the other way: a higher
   * Braden total is *less* pressure risk. Held on the instrument rather than
   * assumed by whoever compares two scores, because the assumption was
   * hardcoded in `compareScores` and would have called a resident getting
   * better "Deteriorated" on the one screen where it matters.
   */
  higherIsWorse: boolean
}

/** The open end of a top band. Every non-negative total falls in some band. */
const NO_CEILING = Number.MAX_SAFE_INTEGER

/* ------------------------------------------------------------------ Morse */

/**
 * The Morse Fall Scale, for Falls Risk.
 *
 * Six items, maximum 125. Bands 0–24 low, 25–44 moderate, 45+ high.
 *
 * **Some institutions band 25–50 and 51+ instead.** That variant is recorded
 * here and deliberately not built: the thresholds below are the ones the
 * sources agree on, and a home that uses the other one is a setting somebody
 * has to ask for rather than a second table sitting unused in the code.
 */
export const MORSE: Instrument = {
  sourced: true,
  higherIsWorse: true,
  items: [
    {
      id: 'history_of_falling',
      question: 'History of falling',
      guidance: 'A fall on this admission, or within the last three months.',
      choices: [
        { label: 'No', points: 0 },
        { label: 'Yes', points: 25 },
      ],
    },
    {
      id: 'secondary_diagnosis',
      question: 'Secondary diagnosis',
      guidance: 'Two or more medical diagnoses on the record.',
      choices: [
        { label: 'No', points: 0 },
        { label: 'Yes', points: 15 },
      ],
    },
    {
      id: 'ambulatory_aid',
      question: 'Ambulatory aid',
      guidance: 'What they hold on to when they walk.',
      choices: [
        { label: 'None, bed rest, wheelchair or nurse assist', points: 0 },
        { label: 'Crutches, cane or walker', points: 15 },
        { label: 'Furniture', points: 30 },
      ],
    },
    {
      id: 'iv_access',
      question: 'Intravenous therapy or heparin lock',
      guidance: 'In place now, whether or not it is running.',
      choices: [
        { label: 'No', points: 0 },
        { label: 'Yes', points: 20 },
      ],
    },
    {
      id: 'gait',
      question: 'Gait',
      guidance: 'Observed walking, not reported.',
      choices: [
        { label: 'Normal, bed rest or wheelchair', points: 0 },
        { label: 'Weak', points: 10 },
        { label: 'Impaired', points: 20 },
      ],
    },
    {
      id: 'mental_status',
      question: 'Mental status',
      guidance: 'Ask what they can manage, and compare it with what they can.',
      choices: [
        { label: 'Oriented to own ability', points: 0 },
        { label: 'Overestimates ability or forgets limitations', points: 15 },
      ],
    },
  ],
  bands: [
    { from: 0, to: 24, level: 'low' },
    { from: 25, to: 44, level: 'moderate' },
    { from: 45, to: NO_CEILING, level: 'high' },
  ],
}

/* --------------------------------------------------------------- Waterlow */

/**
 * The Waterlow Score, for Pressure Ulcer Risk.
 *
 * Ten items, maximum 46.
 *
 * **Two simplifications, both deliberate, both visible to the assessor.**
 * The worksheet lets more than one factor apply at once under Tissue
 * Malnutrition and under Major Surgery or Trauma, and this screen's item
 * format is one choice per item — so those two ask for the single highest
 * applicable factor, and their guidance says so on screen rather than leaving
 * a scorer to assume the form asked for everything. A total from this build
 * can therefore read lower than the same worksheet filled in on paper, which
 * is the direction worth knowing about.
 *
 * Sex and age are one item for the same reason: the worksheet scores them as
 * two separate additive factors, so the ten choices below are those sums.
 *
 * ## Why three bands and not four
 *
 * Waterlow's own thresholds are four-tier: 10+ at risk, 15+ high risk, 20+
 * very high risk. `RiskLevel` is a closed three-member union, and widening it
 * is a fixture type-shape change — the thing CLAUDE.md §9 says to stop and ask
 * about — so the fourth tier is merged rather than added.
 *
 * **It is merged upwards, and the direction is the decision.** Everything the
 * worksheet calls 15 or more is `high` here, so it takes the full high-risk
 * treatment: the badge strip, the notification note, the consequences block.
 * Merging downwards instead would have split the worksheet's high-risk tier
 * across `moderate` and `high` and quietly demoted some of it. Where a
 * three-way union has to hold a four-way scale, the join goes where being
 * wrong is safest.
 */
export const WATERLOW: Instrument = {
  sourced: true,
  higherIsWorse: true,
  items: [
    {
      id: 'build_weight_for_height',
      question: 'Build and weight for height',
      guidance: 'Body mass relative to height.',
      choices: [
        { label: 'Average', points: 0 },
        { label: 'Above average', points: 1 },
        { label: 'Obese', points: 2 },
        { label: 'Below average', points: 3 },
      ],
    },
    {
      id: 'appetite',
      question: 'Appetite',
      guidance: 'What they have actually been eating, not what is offered.',
      choices: [
        { label: 'Average', points: 0 },
        { label: 'Poor', points: 1 },
        { label: 'Nasogastric tube or fluids only', points: 2 },
        { label: 'Nil by mouth, or anorexic', points: 3 },
      ],
    },
    {
      id: 'continence',
      question: 'Continence',
      guidance: 'The usual pattern, not the last shift.',
      choices: [
        { label: 'Completely continent, or catheterised', points: 0 },
        { label: 'Occasionally incontinent', points: 1 },
        { label: 'Catheterised, and incontinent of faeces', points: 2 },
        { label: 'Doubly incontinent', points: 3 },
      ],
    },
    {
      id: 'tissue_malnutrition',
      question: 'Tissue malnutrition',
      guidance:
        'The worksheet allows more than one; this form takes the highest that applies.',
      choices: [
        { label: 'None of these', points: 0 },
        { label: 'Smoking', points: 1 },
        { label: 'Anaemia', points: 2 },
        { label: 'Peripheral vascular disease', points: 5 },
        { label: 'Cardiac failure', points: 5 },
        { label: 'Terminal cachexia', points: 8 },
      ],
    },
    {
      id: 'skin_type',
      question: 'Skin type in the visual risk area',
      guidance: 'What the skin looks like where the pressure falls.',
      choices: [
        { label: 'Healthy', points: 0 },
        { label: 'Tissue paper', points: 1 },
        { label: 'Dry', points: 1 },
        { label: 'Oedematous', points: 1 },
        { label: 'Clammy, or raised temperature', points: 1 },
        { label: 'Discoloured', points: 2 },
        { label: 'Broken, or a spot', points: 3 },
      ],
    },
    {
      id: 'mobility',
      question: 'Mobility',
      guidance: 'How much they move themselves.',
      choices: [
        { label: 'Fully mobile', points: 0 },
        { label: 'Restless or fidgety', points: 1 },
        { label: 'Apathetic', points: 2 },
        { label: 'Restricted', points: 3 },
        { label: 'Inert, or in traction', points: 4 },
        { label: 'Chairbound', points: 5 },
      ],
    },
    {
      id: 'sex_and_age',
      question: 'Sex and age',
      guidance: 'Scored as two factors on the worksheet; these are their sums.',
      choices: [
        { label: 'Male, 14 to 49', points: 2 },
        { label: 'Female, 14 to 49', points: 3 },
        { label: 'Male, 50 to 64', points: 3 },
        { label: 'Female, 50 to 64', points: 4 },
        { label: 'Male, 65 to 74', points: 4 },
        { label: 'Female, 65 to 74', points: 5 },
        { label: 'Male, 75 to 80', points: 5 },
        { label: 'Female, 75 to 80', points: 6 },
        { label: 'Male, 81 or over', points: 6 },
        { label: 'Female, 81 or over', points: 7 },
      ],
    },
    {
      id: 'neurological_deficit',
      question: 'Neurological deficit',
      guidance: 'Recorded diagnoses affecting sensation or movement.',
      choices: [
        { label: 'None', points: 0 },
        { label: 'Diabetes, multiple sclerosis or CVA', points: 4 },
        { label: 'Motor or sensory deficit, or paraplegia', points: 5 },
      ],
    },
    {
      id: 'medication',
      question: 'Medication',
      guidance: 'On the current chart.',
      choices: [
        { label: 'None of these', points: 0 },
        {
          label: 'Cytotoxics, long-term or high-dose steroids, anti-inflammatories',
          points: 4,
        },
      ],
    },
    {
      id: 'major_surgery_or_trauma',
      question: 'Major surgery or trauma',
      guidance:
        'The worksheet allows more than one; this form takes the highest that applies.',
      choices: [
        { label: 'None', points: 0 },
        { label: 'Orthopaedic surgery below the waist, or to the spine', points: 5 },
        { label: 'On the operating table for more than two hours', points: 5 },
      ],
    },
  ],
  bands: [
    { from: 0, to: 9, level: 'low' },
    { from: 10, to: 14, level: 'moderate' },
    { from: 15, to: NO_CEILING, level: 'high' },
  ],
}

/* ------------------------------------------------------------------- MUST */

/**
 * The Malnutrition Universal Screening Tool, for Nutritional Risk.
 *
 * Three steps, total 0–6, and the one instrument here whose own tiers map
 * onto `RiskLevel` with nothing merged: 0 is low, 1 is medium, 2 or more is
 * high, which is exactly MUST's own overall risk categories.
 *
 * MUST's steps 4 and 5 — the management guidelines and the care plan that
 * follow from the score — are not items and are not scored. What this build
 * holds is the screening total and the level it produces; what to do about it
 * is the assessment's findings and its interventions, which is where the rest
 * of this form already puts it.
 */
export const MUST: Instrument = {
  sourced: true,
  higherIsWorse: true,
  items: [
    {
      id: 'bmi',
      question: 'Step 1: body mass index',
      guidance: 'kg/m². Use the most recent height and weight on the record.',
      choices: [
        { label: 'Over 20, or obese at over 30', points: 0 },
        { label: '18.5 to 20', points: 1 },
        { label: 'Under 18.5', points: 2 },
      ],
    },
    {
      id: 'weight_loss',
      question: 'Step 2: unplanned weight loss in the past 3 to 6 months',
      guidance: 'Unplanned. Weight lost on purpose is not this item.',
      choices: [
        { label: 'Under 5%', points: 0 },
        { label: '5 to 10%', points: 1 },
        { label: 'Over 10%', points: 2 },
      ],
    },
    {
      id: 'acute_disease',
      question: 'Step 3: acute disease effect',
      guidance:
        'Acutely ill, and no or unlikely nutritional intake for more than five days. Both, not either.',
      choices: [
        { label: 'No', points: 0 },
        { label: 'Yes', points: 2 },
      ],
    },
  ],
  bands: [
    { from: 0, to: 0, level: 'low' },
    { from: 1, to: 1, level: 'moderate' },
    { from: 2, to: NO_CEILING, level: 'high' },
  ],
}

/* ----------------------------------------------------------------- Braden */

/**
 * The Braden Scale, for Skin Integrity.
 *
 * Six items, total 6–23, and **the one instrument in this build where a
 * higher total is better.** Every other scale here counts risk upwards;
 * Braden counts capacity, so 23 is a resident at no particular risk and 6 is
 * one at the greatest. That is `higherIsWorse: false`, and it is not
 * cosmetic: `compareScores` decided improvement by asking whether the number
 * went up, so without this a resident recovering would have been reported as
 * having deteriorated.
 *
 * **The choices are listed highest-points-first, against this file's
 * convention, on purpose.** Everywhere else the choices run mild to severe
 * and that is also ascending points. Here severity descends as points
 * ascend, so listing them descending is what keeps *mild to severe* reading
 * the same way down every item on every screen. The order is the convention;
 * the numbers are what inverted.
 *
 * The bands mirror the others too: `NO_CEILING` sits on the **low** band,
 * because it is the least-risk end that is open here. `scoreRangeFor` clamps
 * it to the instrument's real maximum of 23.
 */
export const BRADEN: Instrument = {
  sourced: true,
  higherIsWorse: false,
  items: [
    {
      id: 'sensory_perception',
      question: 'Sensory perception',
      guidance: 'Ability to respond meaningfully to pressure-related discomfort.',
      choices: [
        { label: 'No impairment', points: 4 },
        { label: 'Slightly limited', points: 3 },
        { label: 'Very limited', points: 2 },
        { label: 'Completely limited', points: 1 },
      ],
    },
    {
      id: 'moisture',
      question: 'Moisture',
      guidance: 'How often the skin is exposed to moisture.',
      choices: [
        { label: 'Rarely moist', points: 4 },
        { label: 'Occasionally moist', points: 3 },
        { label: 'Very moist', points: 2 },
        { label: 'Constantly moist', points: 1 },
      ],
    },
    {
      id: 'activity',
      question: 'Activity',
      guidance: 'Degree of physical activity.',
      choices: [
        { label: 'Walks frequently', points: 4 },
        { label: 'Walks occasionally', points: 3 },
        { label: 'Chairfast', points: 2 },
        { label: 'Bedfast', points: 1 },
      ],
    },
    {
      id: 'mobility',
      question: 'Mobility',
      guidance: 'Ability to change and control body position.',
      choices: [
        { label: 'No limitations', points: 4 },
        { label: 'Slightly limited', points: 3 },
        { label: 'Very limited', points: 2 },
        { label: 'Completely immobile', points: 1 },
      ],
    },
    {
      id: 'nutrition',
      question: 'Nutrition',
      guidance: 'Usual food intake pattern.',
      choices: [
        { label: 'Excellent', points: 4 },
        { label: 'Adequate', points: 3 },
        { label: 'Probably inadequate', points: 2 },
        { label: 'Very poor', points: 1 },
      ],
    },
    {
      id: 'friction_and_shear',
      question: 'Friction and shear',
      guidance: 'How much help they need to move without dragging the skin.',
      choices: [
        { label: 'No apparent problem', points: 3 },
        { label: 'Potential problem', points: 2 },
        { label: 'Problem', points: 1 },
      ],
    },
  ],
  bands: [
    { from: 0, to: 12, level: 'high' },
    { from: 13, to: 14, level: 'moderate' },
    { from: 15, to: NO_CEILING, level: 'low' },
  ],
}

/* ----------------------------------------------------------- The stand-in */

/** The invented instrument, for the templates nobody has sourced yet. */
export const PLACEHOLDER_INSTRUMENT: Instrument = {
  sourced: false,
  higherIsWorse: true,
  items: [
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
  ],
  bands: [
    { from: 0, to: 24, level: 'low' },
    { from: 25, to: 49, level: 'moderate' },
    { from: 50, to: NO_CEILING, level: 'high' },
  ],
}

/**
 * Which instrument a template scores with.
 *
 * Total over the scored four, so adding a fifth is a compile error rather
 * than a silent placeholder — the ceiling pattern `levelFor` uses for the
 * same reason. Every entry is a published scale now; nothing scored is left
 * on the stand-in.
 */
const SCORED_INSTRUMENTS: Record<ScoredTemplateId, Instrument> = {
  falls: MORSE,
  pressure_ulcer: WATERLOW,
  nutrition: MUST,
  skin_integrity: BRADEN,
}

/**
 * The instrument behind a template.
 *
 * **An unscored template gets the placeholder, and nothing renders it.** The
 * four that reach a level by judgement have no instrument at all; the one
 * caller that asks about them is the fixture generator, which draws a value
 * for every template and discards it for those four — the draw has to happen
 * either way or the seeded stream shifts. So this answers for all nine, and
 * what the four get back is only ever used to keep that stream aligned.
 */
export function instrumentFor(id: RiskTemplateId): Instrument {
  return isScored(id)
    ? SCORED_INSTRUMENTS[id as ScoredTemplateId]
    : PLACEHOLDER_INSTRUMENT
}

/** Whether this template's score comes from a published scale. */
export const isSourced = (id: RiskTemplateId): boolean => instrumentFor(id).sourced

export function bandFor(instrument: Instrument, total: number): RiskLevel {
  const band = instrument.bands.find(
    (entry) => total >= entry.from && total <= entry.to,
  )
  // The bands cover every non-negative integer by construction, so this cannot
  // fall through — but a default of "low" would be the worst possible guess.
  return band?.level ?? 'high'
}

/**
 * The highest total this instrument can produce.
 *
 * Derived rather than typed, because the top band is open-ended and anything
 * needing a ceiling — the fixture generator's draw, a reader checking the
 * weighting — would otherwise hold a second copy of a number the items
 * already decide. A copied figure is a second rule (§6), and the original is
 * still free to move.
 */
export const maxScoreOf = (instrument: Instrument): number =>
  instrument.items.reduce(
    (total, item) => total + Math.max(...item.choices.map((choice) => choice.points)),
    0,
  )

/**
 * The lowest total this instrument can produce.
 *
 * Braden's is 6, not 0: every one of its items scores at least 1, so no
 * resident can score below six however they answer. Derived for the same
 * reason as the maximum — the items already decide it.
 */
export const minScoreOf = (instrument: Instrument): number =>
  instrument.items.reduce(
    (total, item) => total + Math.min(...item.choices.map((choice) => choice.points)),
    0,
  )

/**
 * The range a fixture draws a score from, for a level it has already picked.
 *
 * Here rather than in `residents.ts` so the generator and the screens read one
 * band table.
 *
 * **Clamped at both ends, because a band is wider than an instrument.** Bands
 * floor at 0 and the top one is open, deliberately, so `bandFor` can never
 * fall through on any non-negative total. A fixture drawing from them raw
 * would generate scores the instrument cannot produce: Braden's high band
 * starts at 0 and Braden starts at 6, and Waterlow's low band starts at 0
 * while its lowest possible total is 2. Both ends come from the items.
 */
export function scoreRangeFor(
  instrument: Instrument,
  level: RiskLevel,
): { from: number; to: number } {
  const band = instrument.bands.find((entry) => entry.level === level)
  if (!band) throw new Error(`No ${level} band on this instrument`)
  return {
    from: Math.max(band.from, minScoreOf(instrument)),
    to: Math.min(band.to, maxScoreOf(instrument)),
  }
}

/**
 * The four templates whose instrument produces a number.
 *
 * The other five record findings and reach a level without arithmetic — a
 * clinician's judgement rather than a sum. Kept beside the instrument because
 * it is a fact about what this build ships, not about the template list.
 */
export const SCORED_TEMPLATE_IDS = [
  'falls',
  'pressure_ulcer',
  'nutrition',
  'skin_integrity',
] as const

/** The id of a template that produces a number, for the instrument table. */
export type ScoredTemplateId = (typeof SCORED_TEMPLATE_IDS)[number]

export const SCORED_TEMPLATES: ReadonlySet<RiskTemplateId> = new Set<RiskTemplateId>(
  SCORED_TEMPLATE_IDS,
)

export const isScored = (id: RiskTemplateId) => SCORED_TEMPLATES.has(id)

/**
 * Whether the placeholder warning is the right thing to show.
 *
 * It is a claim about a *score* — "the figure above is not a validated
 * clinical scale" — so it only applies to a template that is scored at all.
 * An unscored template's instrument is always `PLACEHOLDER_INSTRUMENT` by
 * construction (see `instrumentFor`), purely to keep the fixture generator's
 * draw count aligned — that `sourced: false` is plumbing, not a warning, and
 * showing the banner from it is the bug this function exists to stop.
 *
 * **Nothing on screen changed to cause it.** `sourced === false` was a
 * genuine "do not trust this number" while some scored template was still on
 * the stand-in; the moment Braden was sourced, the only things left reporting
 * false were templates that never had a score to distrust. §8's entry about a
 * screen's meaning changing because a constant changed, with nothing on the
 * screen edited.
 *
 * The single owner for all three call sites (`AssessmentFormRoute`,
 * `AssessmentListTab`, `RiskQueueRoute`), so they cannot drift on what "still
 * a placeholder" means.
 */
export const needsPlaceholderWarning = (scored: boolean, sourced: boolean): boolean =>
  scored && !sourced

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}

/**
 * The three levels as a control's options.
 *
 * Beside the labels it is built from, and shared: the admission field set, the
 * re-score fields and the routed form all ask for the same judgement, and a
 * second list of the same three is a second thing to keep in step.
 */
export const LEVEL_OPTIONS = (['low', 'moderate', 'high'] as const).map((level) => ({
  value: level,
  label: LEVEL_LABEL[level],
}))

/**
 * How two scores compare.
 *
 * **Every member carries a word**, because the arrow beside it is not readable
 * in greyscale and means nothing to a screen reader. Direction by shape alone
 * is decoration.
 */
export type ScoreChange = 'improved' | 'unchanged' | 'deteriorated'

export function compareScores(
  previous: number,
  next: number,
  /**
   * Taken from the instrument, never assumed.
   *
   * This function read "up is worse" out of a comment for six phases, which
   * was true of every instrument in the build until Braden. On Braden a
   * rising total is a resident at less risk, so the hardcoded version would
   * have printed **Deteriorated** over somebody getting better — on the
   * screen whose whole job is to say which way a re-score went.
   */
  higherIsWorse: boolean,
): ScoreChange {
  if (next === previous) return 'unchanged'
  const rose = next > previous
  return rose === higherIsWorse ? 'deteriorated' : 'improved'
}

export const CHANGE_WORD: Record<ScoreChange, string> = {
  improved: 'Improved',
  unchanged: 'Unchanged',
  deteriorated: 'Deteriorated',
}

/**
 * The risk an address names, from whichever of the two lists holds it.
 *
 * **One lookup, the same reasoning as `resolveDomain`.** `RiskFinding` has
 * been one shape for the nine templates and for a risk a home records for one
 * resident since Phase 30 — its own docblock says so — and only the screen
 * layer ever treated them as two kinds of thing: the nine opened a routed
 * form and a custom risk opened a modal with no running score, no
 * previous-against-new comparison, no consequences and no undo.
 *
 * The kind is kept rather than discarded, because one thing genuinely differs:
 * `IncidentReviewTarget` names a `RiskTemplateId`, and that union is closed on
 * purpose. A custom risk structurally cannot be the target of a post-incident
 * review flag, so the screen asks this rather than inferring it from the shape
 * of an id.
 *
 * **`new_custom` exists because a `CustomRisk` cannot.** A custom care plan
 * domain can be created empty and written later, so its naming dialog creates
 * the record and routes to it. A `CustomRisk` *is* a `RiskFinding`: the level
 * is required and `RiskLevel` has no unrecorded member, so creating one before
 * anybody has judged a level would mean inventing a clinical finding to hold a
 * name — the exact default-the-unknown-to-fine failure §1 exists to prevent.
 * So a first assessment is a state of this screen rather than a record that
 * already exists, and it is the one case where the name is asked for here.
 */
export type ResolvedRisk =
  | {
      kind: 'fixed'
      id: RiskTemplateId
      name: string
      status: RiskStatus
    }
  | {
      kind: 'custom'
      id: CustomRiskId
      name: string
      risk: CustomRisk
    }
  | { kind: 'new_custom' }

/** The address a first custom assessment is written at. Names no template. */
export const NEW_CUSTOM_RISK = 'new'

export function resolveRisk(
  resident: {
    risks: Record<RiskTemplateId, RiskStatus>
    customRisks: CustomRisk[]
  },
  riskId: string | undefined,
): ResolvedRisk | 'no_such_risk' {
  if (riskId === NEW_CUSTOM_RISK) return { kind: 'new_custom' }

  const template = RISK_ASSESSMENT_TEMPLATES.find((entry) => entry.id === riskId)
  if (template) {
    return {
      kind: 'fixed',
      id: template.id,
      name: template.name,
      status: resident.risks[template.id],
    }
  }

  const custom = resident.customRisks.find((entry) => entry.id === riskId)
  if (custom) {
    return { kind: 'custom', id: custom.id, name: custom.name, risk: custom }
  }

  return 'no_such_risk'
}

/**
 * The risk's name as it reads inside a sentence.
 *
 * `domainInSentence`'s twin, for the same reason and with the same hazard. The
 * nine are a closed vocabulary we wrote, so lowercasing "Falls Risk" into a
 * sentence is ours to do. A custom risk carries a name a home typed, and
 * recasing it is the §8 defect twice recorded already — "DNAR" and a
 * resident's own words are not ours to alter.
 */
export const riskInSentence = (risk: { kind: ResolvedRisk['kind']; name: string }) =>
  risk.kind === 'fixed' ? risk.name.toLowerCase() : risk.name
