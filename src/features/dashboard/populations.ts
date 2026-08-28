import type { Resident } from '@/data/types'
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'

/**
 * Populations two screens both count, counted once. Phase 12, restyled.
 *
 * **The Dashboard's module bars and the compliance chart ask the same
 * question** — how many risk assessments exist against how many are expected —
 * and a second copy of the arithmetic is a second rule. Two rules drift, and
 * the direction they drift in is invisible: both screens keep rendering a
 * number, and only one of them is right.
 *
 * Each returns recorded against expected. Neither ever returns a percentage,
 * because a proportion without its denominator is the figure this product
 * exists to refuse.
 */
export interface Population {
  recorded: number
  expected: number
}

export function riskAssessments(residents: Resident[]): Population {
  let recorded = 0
  for (const resident of residents) {
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      if (resident.risks[template.id]?.kind === 'assessed') recorded += 1
    }
  }
  return { recorded, expected: residents.length * RISK_ASSESSMENT_TEMPLATES.length }
}

export function carePlanDomains(residents: Resident[]): Population {
  let recorded = 0
  for (const resident of residents) {
    for (const domain of resident.carePlan) {
      if (domain.versions.kind === 'finalised') recorded += 1
    }
  }
  return { recorded, expected: residents.length * CARE_PLAN_DOMAINS.length }
}

export function consentsSought(residents: Resident[]): Population {
  let recorded = 0
  for (const resident of residents) {
    for (const type of CONSENT_TYPES) {
      if (resident.consents[type.id].kind !== 'not_sought') recorded += 1
    }
  }
  return { recorded, expected: residents.length * CONSENT_TYPES.length }
}
