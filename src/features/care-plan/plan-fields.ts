import type { CarePlanDomainRecord, CarePlanText, CarePlanVersion } from '@/data/types'

/**
 * The three fields a care plan domain is made of, and whose voice each is
 * written in. Source PRD §3.3.
 *
 * **Two of the three are the resident speaking and one is not**, and that is
 * the whole reason this is a declaration rather than three hand-written boxes.
 * "I like to wash at the sink myself" and "Offer an arm on the corridor" are
 * different kinds of sentence with different authors, and a screen that asks
 * for both in the same tone gets a clinical summary in all three.
 */

export type PlanFieldId = keyof CarePlanText

export interface PlanField {
  id: PlanFieldId
  label: string
  /** Whose sentence this is. Drives the placeholder and the guidance. */
  voice: 'resident' | 'staff'
  guidance: string
  /** In the voice of the field, and italic. Never an example of the answer. */
  placeholder: string
  /** What the hatch says when the box is empty. Names this field's absence. */
  emptyNote: string
}

/**
 * Keyed by field id, so the compiler holds that every field is declared.
 *
 * The render order is this object's key order — insertion order for string
 * keys is guaranteed — so there is one list rather than a declaration and a
 * separate ordering that can disagree with it.
 */
const FIELDS: Record<PlanFieldId, Omit<PlanField, 'id'>> = {
  currentNeeds: {
    label: 'What I need help with',
    voice: 'resident',
    guidance:
      'In their own words. What they can do, what they find hard, what they want help with.',
    placeholder: '“I can manage most of it myself, but…”',
    emptyNote:
      'Not written: a plan that does not say what this person needs cannot be signed',
  },
  preferences: {
    label: 'How I like it done',
    voice: 'resident',
    guidance: 'Their preferences: timing, who, how, and what they would rather avoid.',
    placeholder: '“I would rather you…”',
    emptyNote:
      'Not written: a plan that does not say how they want it done cannot be signed',
  },
  agreedActions: {
    label: 'What staff will do',
    voice: 'staff',
    guidance:
      'Written to whoever reads this on shift. What you will actually do, specifically enough to follow.',
    placeholder: 'Offer an arm on the corridor and…',
    emptyNote:
      'Not written: a plan that says nothing about what will be done cannot be signed',
  },
}

export const PLAN_FIELDS: PlanField[] = (Object.keys(FIELDS) as PlanFieldId[]).map(
  (id) => ({ id, ...FIELDS[id] }),
)

/** An empty plan, for a domain nobody has started. */
export const EMPTY_PLAN: CarePlanText = {
  currentNeeds: '',
  preferences: '',
  agreedActions: '',
}

/**
 * The version staff are following today, or nothing.
 *
 * **Current is last**, which the type holds: `history` is non-empty wherever
 * it exists, so there is no "finalised with no versions" to guard against at
 * every call site.
 */
export function currentVersion(record: CarePlanDomainRecord): CarePlanVersion | 'none' {
  return record.versions.kind === 'finalised' ? record.versions.history.at(-1)! : 'none'
}

/** How many versions have been signed. Zero where none has. */
export function versionCount(record: CarePlanDomainRecord): number {
  return record.versions.kind === 'finalised' ? record.versions.history.length : 0
}

/**
 * What is in the boxes when the editor opens.
 *
 * **A draft, or nothing. Never the previous version.** Carrying last year's
 * words forward into this year's boxes turns a review into a formality — the
 * plan reads as re-agreed when nobody re-agreed it, and the resident's voice
 * becomes whatever they said the first time somebody asked. The previous
 * version renders *beneath* the box instead, where somebody has to choose to
 * type it again.
 *
 * **And never an assessment.** A Waterlow score cannot be turned into "I need
 * help to walk" without putting words in somebody's mouth.
 */
export function editorStartsFrom(record: CarePlanDomainRecord): CarePlanText {
  if (record.draft.kind !== 'draft') return EMPTY_PLAN
  return {
    currentNeeds: record.draft.currentNeeds,
    preferences: record.draft.preferences,
    agreedActions: record.draft.agreedActions,
  }
}

/** Which fields are still empty. Finalising requires all three. */
export function outstandingFields(text: CarePlanText): PlanField[] {
  return PLAN_FIELDS.filter((field) => text[field.id].trim() === '')
}

export interface FieldComparison {
  field: PlanField
  was: string
  now: string
  changed: boolean
}

/**
 * One version against the one before it, field by field.
 *
 * Every field appears, changed or not. **An unchanged field is a fact about
 * the review** — somebody looked at it and left it — and dropping it from the
 * diff would make the screen a list of edits rather than a record of what the
 * plan now says.
 */
export function compareVersions(
  was: CarePlanText,
  now: CarePlanText,
): FieldComparison[] {
  return PLAN_FIELDS.map((field) => ({
    field,
    was: was[field.id],
    now: now[field.id],
    changed: was[field.id] !== now[field.id],
  }))
}
