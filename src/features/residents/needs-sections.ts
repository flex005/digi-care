import type { CarePlanDomainId } from '@/data/types'
import { CARE_PLAN_DOMAINS, NEED_GROUPS } from '@/data/types'

/**
 * The Needs tab's sections. Source PRD §16.2.
 *
 * §16.2 groups needs into five — physical care, cognitive and mental health,
 * social and emotional, communication, clinical — and maps each to the care
 * plan domains it draws on. Between them those five claim **nine of the ten
 * domains**. `end_of_life` belongs to none of them, because §16.2 handles end
 * of life under Future Plans instead.
 *
 * Rendering only the five would therefore drop a care plan domain off this
 * screen entirely, and **absence from a list is the same bug as a blank cell**
 * (CLAUDE.md §1). A reader scanning the Needs tab would see nine domains and
 * have no way to know a tenth existed.
 *
 * So the leftovers are computed rather than hardcoded: any domain no group
 * claims lands in a final section. If `NEED_GROUPS` and `CARE_PLAN_DOMAINS`
 * ever drift apart again, the domain surfaces here instead of vanishing, and
 * `needs.test.tsx` asserts every domain appears exactly once across all
 * sections.
 */

export interface NeedsSection {
  id: string
  name: string
  /**
   * The one-line, plain-English answer to "what is this section for", shown
   * under the title and above the divider — the same treatment General
   * Information uses.
   *
   * This is where a bare count used to be ("4 care plan domains"). A count of
   * the rows directly beneath it told the reader nothing they could not see,
   * and it was a denominator-less figure on a screen about missing evidence,
   * which is the one thing CLAUDE.md §1 forbids anywhere in the product.
   */
  /**
   * Only where a reader would misread the section without it. Most headings
   * do not need one: a description that restates its own heading is a line
   * between the reader and the record.
   */
  description?: string
  domainIds: CarePlanDomainId[]
}

const GROUPED: NeedsSection[] = NEED_GROUPS.map((group) => ({
  id: group.id,
  name: group.name,
  domainIds: [...group.domains],
}))

const claimed = new Set<CarePlanDomainId>(
  GROUPED.flatMap((section) => section.domainIds),
)

const UNCLAIMED: CarePlanDomainId[] = CARE_PLAN_DOMAINS.map(
  (domain) => domain.id,
).filter((id) => !claimed.has(id))

export const NEEDS_SECTIONS: NeedsSection[] =
  UNCLAIMED.length === 0
    ? GROUPED
    : [
        ...GROUPED,
        {
          id: 'other',
          name: 'Other care plan domains',
          description:
            'Part of the care plan; end of life wishes are recorded on the Future Plans tab.',
          domainIds: UNCLAIMED,
        },
      ]

/** Every domain the tab renders. Used by the guard. */
export const RENDERED_DOMAIN_IDS: CarePlanDomainId[] = NEEDS_SECTIONS.flatMap(
  (section) => section.domainIds,
)
