import type { RiskLevel, RiskTemplateId } from '@/data/types'
import { riskTemplateName } from '@/data/access/review-flags'
import type { Term } from '@/lib/vocabulary'

/**
 * What a re-score changes.
 *
 * The first place in this build where recording something **clears a clinical
 * obligation somebody else raised**. Reading those obligations moved to
 * `data/access/review-flags` once a finalised care plan domain could clear the
 * other half of the same flag: one derivation of "what would this close" and
 * one of "was it late", shared, rather than two that drift.
 */

/**
 * What changes on the profile when the level moves.
 *
 * Named per screen rather than as "the profile updates", because a manager
 * deciding whether to record this needs to know it changes how this person
 * reads on every list somebody else is working from.
 */
export function badgeStripChange(
  templateId: RiskTemplateId,
  from: RiskLevel,
  to: RiskLevel,
  labelOf: (level: RiskLevel) => string,
): string {
  return `The profile badge strip changes from ${riskTemplateName(templateId)}, ${labelOf(
    from,
  ).toUpperCase()} to ${riskTemplateName(templateId)}, ${labelOf(
    to,
  ).toUpperCase()}, on every screen it appears.`
}

/**
 * Nobody is notified of a level rise, so the screen says who has to be told.
 *
 * Takes the term rather than holding the word: this is a module function with
 * no hook to call, so the screen that renders it supplies the form.
 */
export function notificationNote(
  residentName: string,
  level: string,
  staff: Term,
): string {
  return `Tell ${staff.many} on shift that ${residentName}'s risk has risen to ${level}.`
}
