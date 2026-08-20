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

import type { Resident } from './types'
import { CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from './types'

export interface MissingRecord {
  /** Shown in the chip. British English, plain language. */
  label: string
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

/** Risk templates whose absence changes how a care worker enters a room. */
const CRITICAL_RISKS = new Set(['falls', 'pressure_ulcer', 'choking'])

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
      area: 'general',
      severity: 'critical',
    })
  }
  if (resident.resuscitation.kind === 'no_decision_recorded') {
    missing.push({
      label: 'No resuscitation decision',
      area: 'future-plans',
      severity: 'critical',
    })
  }
  if (resident.eolc.kind === 'not_recorded') {
    missing.push({
      label: 'EOLC status not recorded',
      area: 'future-plans',
      severity: 'standard',
    })
  }
  if (resident.isolation.kind === 'not_recorded') {
    missing.push({
      label: 'Isolation status not recorded',
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
      area: 'risk',
      severity: CRITICAL_RISKS.has(template.id) ? 'critical' : 'standard',
    })
  }

  // Identity and clinical fields a care worker needs before entering a room.
  if (resident.nhsNumber.kind === 'unrecorded') {
    missing.push({
      label: 'NHS number not recorded',
      area: 'general',
      severity: 'standard',
    })
  }
  if (resident.gp.kind === 'unrecorded') {
    missing.push({ label: 'GP not recorded', area: 'general', severity: 'critical' })
  }
  if (resident.primaryDiagnosis.kind === 'unrecorded') {
    missing.push({
      label: 'Primary diagnosis not recorded',
      area: 'general',
      severity: 'critical',
    })
  }
  if (resident.dietaryRequirements.kind === 'unrecorded') {
    missing.push({
      label: 'Dietary requirements not recorded',
      area: 'general',
      severity: 'standard',
    })
  }

  // Next of kin — who to ring when something happens.
  if (resident.importantPeople.nextOfKin.kind === 'unrecorded') {
    missing.push({
      label: 'Next of kin not recorded',
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
      area: 'care-plan',
      severity: notStarted.length > 4 ? 'critical' : 'standard',
    })
  }

  // Consent never sought.
  const notSought = CONSENT_TYPES.filter(
    (type) => resident.consents[type.id].kind === 'not_sought',
  )
  if (notSought.length > 0) {
    missing.push({
      label: `${notSought.length} of ${CONSENT_TYPES.length} consent types not sought`,
      area: 'consent',
      severity: 'standard',
    })
  }

  if (resident.carePlanReview.kind === 'never_scheduled') {
    missing.push({
      label: 'Care plan review never scheduled',
      area: 'care-plan',
      severity: 'critical',
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
