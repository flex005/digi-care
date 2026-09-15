import { held, type SessionHolding } from './session-holding'
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'
import type {
  CarePlanDomainId,
  ConsentTypeId,
  RiskTemplateId,
  SiteId,
} from '@/data/types'

/**
 * Which templates, domains and consent types a home uses. AM v2.0 SETT-01,
 * Phase 22.
 *
 * **These are the settings that reach back.** A setting is either a claim
 * about the future — what happens to records made from now on — or a term in a
 * claim the record already makes. Review frequency is the first: changing it
 * moves nothing already written. These three are the second, and it is why
 * they are held here rather than as a flag on the thing itself.
 *
 * `RiskStatus` has two members. Deactivate a template and `not_assessed` means
 * either *nobody has done this* or *this home does not do this* — the setting
 * has changed what a record already on file is saying, which is the blank
 * meaning two things that §1 exists to refuse. The same is true of a care plan
 * domain and of a consent type, whose `not_sought` says nobody has been asked.
 *
 * So the state lives beside the record rather than inside it, and every screen
 * that iterates one of these lists renders the **pair**: what the home decided
 * about this item, and what this resident's record says about it. Four
 * combinations, all four written out in `configuredState`.
 *
 * **Nothing is deleted and no record is touched.** Deactivating a template
 * does not clear an assessment; it says the home no longer asks the question.
 * The assessment stays with its author, its score and its date, because
 * somebody did it.
 */

type Key = `${SiteId}:${string}`

/** Deactivated only. Absent means active, so a new template is on by default. */
const off = new Set<Key>()
let changes = 0

const key = (siteId: SiteId, id: string): Key => `${siteId}:${id}`

export const isActive = (siteId: SiteId, id: string): boolean =>
  !off.has(key(siteId, id))

export function setActive(siteId: SiteId, id: string, active: boolean): void {
  if (active) off.delete(key(siteId, id))
  else off.add(key(siteId, id))
  changes += 1
}

export const activeTemplates = (siteId: SiteId): RiskTemplateId[] =>
  RISK_ASSESSMENT_TEMPLATES.filter((template) => isActive(siteId, template.id)).map(
    (template) => template.id,
  )

export const activeDomains = (siteId: SiteId): CarePlanDomainId[] =>
  CARE_PLAN_DOMAINS.filter((domain) => isActive(siteId, domain.id)).map(
    (domain) => domain.id,
  )

export const activeConsentTypes = (siteId: SiteId): ConsentTypeId[] =>
  CONSENT_TYPES.filter((type) => isActive(siteId, type.id)).map((type) => type.id)

/**
 * How one item renders for one resident, as the pair.
 *
 * The four states, and the two that matter are the deactivated ones:
 *
 *  - **`in_use`** — the home asks this and the record answers it. Unchanged.
 *  - **`in_use_unanswered`** — the home asks and nobody has. The hatch, as
 *    before: a gap somebody can close.
 *  - **`retired_answered`** — somebody did it and the home has since stopped
 *    asking. **The record stays, quietly**, with its author and date. Hiding it
 *    would delete work somebody did; hatching it would call a completed record
 *    a gap.
 *  - **`retired_unanswered`** — the home does not ask this and nobody has
 *    answered. **Plain text, never hatched.** The hatch says nobody has looked;
 *    here the home has decided there is nothing to look at, which is a
 *    different fact and not a gap anybody can close.
 */
export type ConfiguredState =
  'in_use' | 'in_use_unanswered' | 'retired_answered' | 'retired_unanswered'

export function configuredState(
  siteId: SiteId,
  id: string,
  answered: boolean,
): ConfiguredState {
  if (isActive(siteId, id)) return answered ? 'in_use' : 'in_use_unanswered'
  return answered ? 'retired_answered' : 'retired_unanswered'
}

/** Whether a state counts towards what a home is expected to hold. */
export const countsTowardsExpected = (state: ConfiguredState): boolean =>
  state === 'in_use' || state === 'in_use_unanswered'

export function siteConfigHoldings(): SessionHolding[] {
  return [...held('templates, domains and consent types you turned on or off', changes)]
}

/** Emptied on sign out, and by tests. */
export function resetSessionSiteConfig(): void {
  off.clear()
  changes = 0
}
