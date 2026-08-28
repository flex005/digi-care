import type { Aggregate } from './aggregate'

/**
 * CQC compliance — PRD §2.3, §6.7, Phase 12.
 *
 * This is where **Insufficient Evidence** finally lives. It was approved
 * before Phase 0, used in reviews and documents since, and this is the first
 * screen it was designed for.
 */

/** The five, in CQC's order. Never alphabetical, never re-ordered by rating. */
export type KeyQuestionId = 'safe' | 'effective' | 'caring' | 'responsive' | 'well_led'

/** A finding. Insufficient Evidence is deliberately not a member. */
export type Rating = 'green' | 'amber' | 'red'

export type MeasuredAggregate = Extract<Aggregate, { kind: 'measured' }>
export type InsufficientAggregate = Extract<
  Aggregate,
  { kind: 'insufficient_evidence' }
>

/**
 * What one check found when it was run.
 *
 * Two members, and the second is not a milder first. `insufficient` means the
 * population is below `MIN_POPULATION_FOR_A_RATE` — the figure exists and
 * cannot support a claim, so no rating is attached to it at all.
 */
export type CheckReading =
  | {
      kind: 'measured'
      aggregate: MeasuredAggregate
      rating: Rating
      /** What the figure counted, in words: "20 of 1,219 doses". */
      detail: string
      /**
       * Where the evidence is weaker than the figure makes it look.
       *
       * Fire and legionella are evidenced by *a document existing* rather than
       * by an assessment record, and a tick that hid that would be the screen
       * overstating its own evidence.
       */
      caveat?: string
    }
  | {
      kind: 'insufficient'
      aggregate: InsufficientAggregate
      detail: string
      /**
       * Carried on both members, because a caveat is about the **evidence**
       * rather than about the figure. The fire and legionella checks are
       * always below the population floor — one document at one site — and
       * they are exactly the checks whose evidence needs qualifying, so a
       * caveat only the measured member could hold would never be seen.
       */
      caveat?: string
    }

/**
 * A check, before it is run.
 *
 * **`not_held` is a member of the declaration, not an outcome of running.**
 * Nothing computes it and nothing can: it is the statement that this product
 * has no module recording the thing. Keeping it here means the check list is
 * complete on the screen — absence from a list is the same bug as a blank
 * cell — while the runner never has to invent a reading for it.
 */
export type CheckDefinition =
  | {
      kind: 'derived'
      id: string
      name: string
      /** The module the figure comes from: "Medications · last 7 days". */
      from: string
    }
  | {
      kind: 'not_held'
      id: string
      name: string
      /** "Staff training is not recorded in diGi-Care." Never "the home has not…". */
      statement: string
    }

/** A check with its reading, ready to render. */
export type CheckResult =
  | {
      kind: 'derived'
      definition: Extract<CheckDefinition, { kind: 'derived' }>
      reading: CheckReading
    }
  | { kind: 'not_held'; definition: Extract<CheckDefinition, { kind: 'not_held' }> }

/**
 * What a Key Question panel says.
 *
 * **Insufficient Evidence is not a fourth colour.** It renders in the
 * unrecorded treatment and states its coverage instead of a rating, because it
 * is the absence of a finding rather than a milder one.
 *
 * `usable` and `total` exclude `not_held` checks entirely — they never count
 * toward coverage and never contribute to a rating, because nothing on any
 * screen can change them.
 */
export type PanelVerdict =
  | {
      kind: 'rated'
      rating: Rating
      usable: number
      total: number
      /**
       * The check the rating came from, named on the panel.
       *
       * **Worst-of without this is unreadable.** Five panels each saying "Red
       * — worst of nine checks" tell a reader nothing; five panels each naming
       * a different check and its figure tell them five things. The rule is
       * unchanged and honest; what changes is that the screen says which check
       * is driving it, so a manager knows where to go.
       */
      driver: { id: string; name: string; detail: string; value: number }
    }
  | { kind: 'insufficient_evidence'; usable: number; total: number }
