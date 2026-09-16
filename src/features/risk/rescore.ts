import type { RiskLevel, RiskTemplateId } from '@/data/types'
import { riskTemplateName } from '@/data/access/review-flags'

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
 */
export function notificationNote(residentName: string, level: string): string {
  return `Tell staff on shift that ${residentName}'s risk has risen to ${level}.`
}
