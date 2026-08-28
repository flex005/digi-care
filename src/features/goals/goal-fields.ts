import type { Goal } from '@/data/types'

/**
 * The three fields a goal is made of, and whose voice each is written in.
 *
 * **The care plan editor's shape exactly**: two in the resident's own words
 * and one written to staff. That is not a coincidence to be tidied away — a
 * goal and a care plan domain are both a person's account of what they want
 * plus what the home will do about it, and a reader who has learned one form
 * should not have to learn the other.
 *
 * `howWeWillKnow` is the goal's version of agreed actions, and it is what
 * makes "achieved" checkable rather than an opinion. Without it, closing a
 * goal as achieved is one person's view of another person's life.
 */

export type GoalFieldId = 'statement' | 'whyItMatters' | 'howWeWillKnow'

export interface GoalField {
  id: GoalFieldId
  label: string
  voice: 'resident' | 'staff'
  guidance: string
  /** In the voice of the field, and italic. Never an example of the answer. */
  placeholder: string
  /** What the hatch says when the box is empty. Names this field's absence. */
  emptyNote: string
}

const FIELDS: Record<GoalFieldId, Omit<GoalField, 'id'>> = {
  statement: {
    label: 'What I want',
    voice: 'resident',
    guidance:
      'In their own words, and first person. Something they want to be able to do, not something the home will do for them.',
    placeholder: '“I want to be able to…”',
    emptyNote: 'Not written: a goal nobody has stated is not a goal',
  },
  whyItMatters: {
    label: 'Why it matters to me',
    voice: 'resident',
    guidance:
      'Also theirs. What makes this worth doing, in the words they used for it.',
    placeholder: '“Because I…”',
    emptyNote:
      'Not written, without it, nobody reading this later knows why it was chosen',
  },
  howWeWillKnow: {
    label: 'How we will know it has happened',
    voice: 'staff',
    guidance:
      'Written to whoever reads this on shift. Specific enough that two people would agree whether it had happened.',
    placeholder: 'Walks the corridor unaided on three consecutive days.',
    emptyNote:
      'Not written, without it, “achieved” is one person’s opinion about somebody else’s life',
  },
}

export const GOAL_FIELDS: GoalField[] = (Object.keys(FIELDS) as GoalFieldId[]).map(
  (id) => ({ id, ...FIELDS[id] }),
)

export type GoalText = Pick<Goal, GoalFieldId>

export const EMPTY_GOAL: GoalText = {
  statement: '',
  whyItMatters: '',
  howWeWillKnow: '',
}

/** Which fields are still empty. Setting a goal requires all three. */
export function outstandingGoalFields(text: GoalText): GoalField[] {
  return GOAL_FIELDS.filter((field) => text[field.id].trim() === '')
}
