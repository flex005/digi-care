import type {
  CarePlanDomainId,
  Incident,
  IsoDateTime,
  PostIncidentReviewFlag,
  PostIncidentReviewTarget,
  ResidentId,
  RiskTemplateId,
} from '../types'
import { CARE_PLAN_DOMAINS, INCIDENT_TYPES, subjectResidentId } from '../types'
import { RISK_ASSESSMENT_TEMPLATES } from '../types'
import type { ClearableTarget } from './review-flag-store'
import { assertNever } from '@/lib/assert-never'

/**
 * Reading post-incident review flags: what a piece of work would discharge,
 * and whether a discharged one was late.
 *
 * Shared by the two modules that can clear a flag — a risk re-score (Phase 5)
 * and a finalised care plan domain (Phase 6). It lives beside the store rather
 * than inside either feature because both halves of the obligation are the
 * same obligation, and a second copy of this reasoning in the second feature
 * is how the two halves start disagreeing about what "late" means.
 */

/**
 * Whether a completed flag was cleared after its 48 hours.
 *
 * **Derived from the record, never stored, and never erased.** The natural
 * write on clearing a flag is `{ kind: 'completed' }` and move on — which
 * loses the fact that it was late, because the only thing that said so was the
 * *absence* of a completion before `dueBy`.
 *
 * An incident closed late must still read as closed late afterwards. Comparing
 * the completion against the deadline keeps that permanently true rather than
 * true until somebody does the work.
 */
export function wasClearedLate(flag: PostIncidentReviewFlag): boolean {
  return flag.state.kind === 'completed' && flag.state.completed.at > flag.dueBy
}

export interface ClosableFlag {
  incident: Incident
  flag: PostIncidentReviewFlag
  /** "the unwitnessed fall of 21/08" — how the consequence names it. */
  description: string
  overdue: boolean
}

/**
 * Every open flag this piece of work would close, named individually.
 *
 * **Named, not counted.** "This closes 2 post-incident reviews" is a figure;
 * "the unwitnessed fall of 21/08 and the witnessed fall of 04/08, both
 * overdue" is the record. Somebody discharging two obligations should see
 * which two — a count tells them how much work vanished, not what it was.
 *
 * All open flags for this resident and target close together, not just the
 * oldest: two incidents that both flagged mobility recorded the same
 * obligation twice, and leaving one open would ask for the same work again.
 */
export function flagsClosedBy(input: {
  incidents: Incident[]
  residentId: ResidentId
  target: ClearableTarget
  now: IsoDateTime
  formatDate: (at: IsoDateTime) => string
}): ClosableFlag[] {
  const closable: ClosableFlag[] = []

  for (const incident of input.incidents) {
    if (subjectResidentId(incident) !== input.residentId) continue

    for (const flag of incident.reviewFlags) {
      if (flag.state.kind !== 'awaiting') continue
      if (!sameTarget(flag.target, input.target)) continue

      // The phrase, not the name. "the fall — witnessed of 23/08" is a label
      // dropped into prose; "the witnessed fall of 23/08" is the sentence.
      const phrase =
        INCIDENT_TYPES.find((entry) => entry.id === incident.type)?.phrase ??
        incident.type

      closable.push({
        incident,
        flag,
        description: `the ${phrase} of ${input.formatDate(incident.occurredAt)}`,
        overdue: flag.dueBy < input.now,
      })
    }
  }

  return closable
}

/**
 * Same kind, same thing.
 *
 * An exhaustive switch rather than a kind check and a cast: the two members
 * carry different id fields, and comparing the kinds alone would make a
 * mobility care plan flag close on a falls re-score. A third target kind is a
 * compile error here rather than a flag that silently never matches.
 */
function sameTarget(a: PostIncidentReviewTarget, b: ClearableTarget): boolean {
  switch (a.kind) {
    case 'risk_assessment':
      return b.kind === 'risk_assessment' && a.templateId === b.templateId
    case 'care_plan_domain':
      return b.kind === 'care_plan_domain' && a.domainId === b.domainId
    default:
      return assertNever(a)
  }
}

/** A risk template's own name, for the sentences a consequence is made of. */
export function riskTemplateName(id: RiskTemplateId): string {
  return RISK_ASSESSMENT_TEMPLATES.find((entry) => entry.id === id)?.name ?? id
}

/** A care plan domain's own name, for the same sentences. */
export function carePlanDomainName(id: CarePlanDomainId): string {
  return CARE_PLAN_DOMAINS.find((entry) => entry.id === id)?.name ?? id
}
