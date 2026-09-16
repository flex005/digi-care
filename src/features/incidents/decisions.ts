import type { Incident, IsoDateTime, PostIncidentReviewFlag } from '@/data/types'
import { CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'

/**
 * What nobody has decided about an incident yet.
 *
 * **The screen's hierarchy sentence, made structural** (Rule 5). "These are the
 * decisions nobody has made about it yet" is not a heading somewhere down the
 * page — it is a block above the facts, because a manager opening an incident
 * should see what is owed before they see what happened.
 *
 * **When nothing is outstanding it does not render at all**, and that absence
 * is safe only because everything it would have listed is also stated in full
 * further down. An empty version of this block would be a claim ("nothing is
 * owed") drawn in the treatment reserved for gaps.
 */
export interface OutstandingDecision {
  id: string
  name: string
  /** Why it is owed, and what would settle it. */
  detail: string
  action: string
  /**
   * The phase that builds the action, where it is not this one.
   *
   * A control that clears a clinical obligation without the work records a
   * review that did not happen, so anything that cannot be done yet says which
   * phase does it and is disabled — exactly as the export stub does.
   */
  availableInPhase: number | 'now'
}

const templateName = (id: string) =>
  RISK_ASSESSMENT_TEMPLATES.find((entry) => entry.id === id)?.name ?? id

const domainName = (id: string) =>
  CARE_PLAN_DOMAINS.find((entry) => entry.id === id)?.name ?? id

export function flagName(flag: PostIncidentReviewFlag): string {
  return flag.target.kind === 'risk_assessment'
    ? templateName(flag.target.templateId)
    : domainName(flag.target.domainId)
}

/** What would clear a flag, and the phase that builds it. */
export function flagClearedBy(flag: PostIncidentReviewFlag): {
  action: string
  phase: number
  sentence: string
} {
  return flag.target.kind === 'risk_assessment'
    ? {
        action: 'Re-score',
        phase: 5,
        sentence: 'Cleared by re-scoring the assessment, which arrives in Phase 5.',
      }
    : {
        action: 'Review',
        phase: 6,
        sentence: 'Cleared by a care plan review, which arrives in Phase 6.',
      }
}

export function isOverdue(flag: PostIncidentReviewFlag, now: IsoDateTime): boolean {
  return flag.state.kind === 'awaiting' && flag.dueBy < now
}

export function outstandingDecisions(
  incident: Incident,
  now: IsoDateTime,
): OutstandingDecision[] {
  const decisions: OutstandingDecision[] = []

  /*
   * Two notification states are outstanding, not one.
   *
   * `not_yet_decided` is a decision nobody has taken. `required_not_yet_notified`
   * is a duty somebody accepted and has not discharged — worse, and the one
   * that would otherwise sit quietly because a decision *was* made.
   */
  if (incident.notification.kind === 'not_yet_decided') {
    decisions.push({
      id: 'notification',
      name: 'Whether the CQC must be told',
      detail:
        'Nobody has recorded a decision either way, and the incident cannot be closed without one.',
      action: 'Decide',
      availableInPhase: 'now',
    })
  }

  if (incident.notification.kind === 'required_not_yet_notified') {
    decisions.push({
      id: 'notification-outstanding',
      name: 'The CQC has not been notified',
      detail:
        'Somebody decided this must be notified and there is nothing in the record to show that it was.',
      action: 'Record the notification',
      availableInPhase: 'now',
    })
  }

  for (const flag of incident.reviewFlags) {
    if (flag.state.kind !== 'awaiting') continue
    const cleared = flagClearedBy(flag)
    decisions.push({
      id: `flag-${flag.target.kind}-${flagName(flag)}`,
      name: `${flagName(flag)} has not been reviewed`,
      detail: isOverdue(flag, now)
        ? `Flagged when this incident was closed, and now past its 48 hours. ${cleared.sentence}`
        : `Flagged when this incident was closed. ${cleared.sentence}`,
      action: cleared.action,
      availableInPhase: cleared.phase,
    })
  }

  // A closed incident with no root cause is a review that stopped short. It is
  // stated below as a gap either way; here it is the thing somebody owes.
  if (
    incident.status.kind === 'closed' &&
    incident.review.rootCause.kind !== 'recorded'
  ) {
    decisions.push({
      id: 'root-cause',
      name: 'No root cause was recorded',
      detail:
        'This incident was closed without anybody writing down why it happened, so nothing here explains it.',
      action: 'Record',
      availableInPhase: 'now',
    })
  }

  return decisions
}

/**
 * "Three things are owed on this incident".
 *
 * **Owed, not "decided".** The block lists a fourth kind beyond the decisions:
 * a closed incident with no root cause recorded. That is not a pending
 * decision — it is a record that *asserted it was finished and is not*, which
 * is arguably worse, because closure made a claim. A heading that said
 * "decisions" would have been narrower than its own contents.
 */
export function outstandingHeading(count: number): string {
  const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
  const word = words[count] ?? String(count)
  return count === 1
    ? 'One thing is owed on this incident'
    : `${word} things are owed on this incident`
}
