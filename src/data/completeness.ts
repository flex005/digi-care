/**
 * What is missing from a resident's record.
 *
 * Derived from the unions rather than hand-maintained, so a field that gains
 * an unrecorded state is picked up here automatically. This is what powers
 * the hatched "Records incomplete" chip on the residents list and the profile
 * (PRD §6.2), and it is why that chip **lists what is missing** rather than
 * showing a bare count — a count would break Rule 4 and, worse, would tell a
 * manager that something is wrong without telling them what.
 *
 * A missing photograph is deliberately NOT included. It is an identity aid,
 * not a clinical or compliance record, and padding this list with non-clinical
 * gaps would blunt the one signal that matters.
 */

import type { Resident, RiskTemplateId } from './types'
import { CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from './types'

/** Chip-length names for the risk templates. */
const SHORT_RISK_LABELS: Partial<Record<RiskTemplateId, string>> = {
  falls: 'Falls risk',
  choking: 'Dysphagia risk',
  pressure_ulcer: 'Pressure ulcer risk',
  nutrition: 'Nutritional risk',
  moving_handling: 'Moving and handling',
  mental_capacity: 'Mental capacity',
  skin_integrity: 'Skin integrity',
  behaviour: 'Behaviour support',
  environmental: 'Environmental risk',
  coshh: 'COSHH',
}

export interface MissingRecord {
  /** The full sentence, shown on the profile. British English, plain language. */
  label: string
  /**
   * Two or three words, for the residents-list chip. Seven full sentences do
   * not fit in a table cell, and truncating them would turn named gaps back
   * into a vague warning — which is the thing the chip exists to avoid.
   */
  shortLabel: string
  /** Which tab or module would fix it. */
  area: 'general' | 'risk' | 'care-plan' | 'consent' | 'future-plans'
  /**
   * `critical` gaps are the ones a care worker needs closed before entering a
   * room — allergies, resuscitation, falls, who to ring. `standard` gaps are
   * real and are still listed, but a care home always has some of them.
   *
   * The distinction exists because every one of the 32 residents has at least
   * one gap somewhere, so a chip that fired on all of them would be true and
   * useless. The chip fires on `critical`; the profile lists everything.
   */
  severity: 'critical' | 'standard'
}

/**
 * Risk templates whose absence changes how a care worker enters a room, and
 * is dangerous the same day rather than at the next audit.
 *
 * PRD §6.2's written list omits choking; that is an error in the document,
 * to be corrected at the end of Phase 1. Unassessed dysphagia is same-day
 * dangerous — the same class as falls and allergies — so it stays critical
 * and the code leads the document here.
 *
 * Pressure ulcer risk is deliberately NOT critical. It matters, and it is
 * still listed in `missing`; it is a weeks-scale harm, not a today-scale one.
 */
const CRITICAL_RISKS = new Set(['falls', 'choking'])

export function recordCompleteness(resident: Resident): {
  missing: MissingRecord[]
  critical: MissingRecord[]
  isComplete: boolean
  hasCriticalGaps: boolean
} {
  const missing: MissingRecord[] = []

  // The badge strip. Every one of these unrecorded is a resident whose
  // profile header cannot be read as safe.
  if (resident.allergies.kind === 'not_recorded') {
    missing.push({
      label: 'Allergies not recorded',
      shortLabel: 'Allergies',
      area: 'general',
      severity: 'critical',
    })
  }
  if (resident.resuscitation.kind === 'no_decision_recorded') {
    missing.push({
      label: 'No resuscitation decision',
      shortLabel: 'Resuscitation decision',
      area: 'future-plans',
      severity: 'critical',
    })
  }
  if (resident.eolc.kind === 'not_recorded') {
    missing.push({
      label: 'EOLC status not recorded',
      shortLabel: 'EOLC status',
      area: 'future-plans',
      severity: 'standard',
    })
  }
  if (resident.isolation.kind === 'not_recorded') {
    missing.push({
      label: 'Isolation status not recorded',
      shortLabel: 'Isolation status',
      area: 'general',
      severity: 'standard',
    })
  }

  // Risk assessments — named individually, because "3 assessments missing"
  // does not tell a manager whether falls is one of them.
  const unassessed = RISK_ASSESSMENT_TEMPLATES.filter(
    (template) => resident.risks[template.id].kind === 'not_assessed',
  )
  for (const template of unassessed) {
    missing.push({
      label: `${template.name} not assessed`,
      shortLabel: SHORT_RISK_LABELS[template.id] ?? template.name,
      area: 'risk',
      severity: CRITICAL_RISKS.has(template.id) ? 'critical' : 'standard',
    })
  }

  // Identity and clinical fields a care worker needs before entering a room.
  if (resident.nhsNumber.kind === 'unrecorded') {
    missing.push({
      label: 'NHS number not recorded',
      shortLabel: 'NHS number',
      area: 'general',
      severity: 'standard',
    })
  }
  if (resident.gp.kind === 'unrecorded') {
    missing.push({
      label: 'GP not recorded',
      shortLabel: 'GP',
      area: 'general',
      severity: 'critical',
    })
  }
  if (resident.primaryDiagnosis.kind === 'unrecorded') {
    missing.push({
      label: 'Primary diagnosis not recorded',
      shortLabel: 'Primary diagnosis',
      area: 'general',
      severity: 'standard',
    })
  }
  if (resident.dietaryRequirements.kind === 'unrecorded') {
    missing.push({
      label: 'Dietary requirements not recorded',
      shortLabel: 'Dietary requirements',
      area: 'general',
      severity: 'standard',
    })
  }

  // Next of kin — who to ring when something happens.
  if (resident.importantPeople.nextOfKin.kind === 'unrecorded') {
    missing.push({
      label: 'Next of kin not recorded',
      shortLabel: 'Next of kin',
      area: 'general',
      severity: 'critical',
    })
  }

  // Care plan domains never started.
  const notStarted = resident.carePlan.filter(
    (domain) => domain.status.kind === 'not_started',
  )
  if (notStarted.length > 0) {
    missing.push({
      label: `${notStarted.length} of ${resident.carePlan.length} care plan domains not started`,
      shortLabel: 'Care plan domains',
      area: 'care-plan',
      severity: 'standard',
    })
  }

  // Care and support consent, named separately from the aggregate below.
  // "Care is being delivered with no recorded consent to it" is a regulatory
  // failure, and it is not the same fact as "3 of 8 consent types not sought".
  if (resident.consents.care_and_support.kind === 'not_sought') {
    missing.push({
      label: 'No recorded consent to care and support',
      shortLabel: 'Care and support consent',
      area: 'consent',
      severity: 'critical',
    })
  }

  // Consent never sought.
  const notSought = CONSENT_TYPES.filter(
    (type) => resident.consents[type.id].kind === 'not_sought',
  )
  if (notSought.length > 0) {
    missing.push({
      label: `${notSought.length} of ${CONSENT_TYPES.length} consent types not sought`,
      shortLabel: 'Consent types',
      area: 'consent',
      severity: 'standard',
    })
  }

  if (resident.carePlanReview.kind === 'never_scheduled') {
    missing.push({
      label: 'Care plan review never scheduled',
      shortLabel: 'Care plan review',
      area: 'care-plan',
      severity: 'standard',
    })
  }

  const critical = missing.filter((record) => record.severity === 'critical')
  return {
    missing,
    critical,
    isComplete: missing.length === 0,
    hasCriticalGaps: critical.length > 0,
  }
}

/** Anything past its review or expiry date. The `Stale` state. PRD §6. */
export function staleRecords(resident: Resident): string[] {
  const stale: string[] = []

  for (const domain of resident.carePlan) {
    if (domain.status.kind === 'review_due') {
      stale.push(`Care plan review ${domain.status.daysOverdue} days overdue`)
    }
  }
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    const risk = resident.risks[template.id]
    if (risk.kind === 'assessed' && risk.reviewState.kind === 'overdue') {
      stale.push(`${template.name} review ${risk.reviewState.daysOverdue} days overdue`)
    }
  }
  if (resident.carePlanReview.kind === 'overdue') {
    stale.push(`Care plan review ${resident.carePlanReview.daysOverdue} days overdue`)
  }

  return stale
}
