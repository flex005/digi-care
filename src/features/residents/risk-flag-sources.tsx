import type { ReactNode } from 'react'
import type { Resident } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'

/**
 * The statuses the Risk flags column is built from — declared, not scattered
 * through a render function.
 *
 * The column runs on one rule, stated in its legend:
 *
 *     Anything not shown has been recorded and is unremarkable.
 *
 * That rule is only safe while every contributing status renders **something**
 * when it is unrecorded. If one of them could render nothing, "no badge" would
 * mean either "recorded and fine" or "nobody looked" — the exact ambiguity
 * this product exists to destroy, reintroduced at the level of a column.
 *
 * So the precondition is enforced by construction rather than by care:
 * `renderUnrecorded` is a **required** field, a status can only reach the
 * column by being in this list, and `residents.test.tsx` asserts that every
 * entry's unrecorded branch produces a visible hatched element. A future
 * addition cannot break the rule silently — it cannot be added at all without
 * declaring what it looks like when nobody has looked.
 *
 * **Scope is deliberately four, not five.** EOLC and isolation are on the
 * profile header, where every state of every badge is explicit. Putting them
 * here would mean rendering "EOLC not recorded" and "isolation not recorded"
 * on roughly half the rows, and volume that drowns a distinction is the same
 * failure as a blank cell. The list is a management instrument; the profile is
 * the point-of-care surface. The legend names the four so "not shown" is
 * scoped to a declared set rather than implying the column covers everything.
 */
export interface RiskFlagSource {
  id: string
  /** Named in the legend and in test failures. */
  name: string
  /** True when nobody has recorded this status. */
  isUnrecorded: (resident: Resident) => boolean
  /**
   * What the gap looks like. REQUIRED — this field is the guard. It must
   * render a visible hatched element; the test asserts it does.
   */
  renderUnrecorded: () => ReactNode
  /** Recorded states worth acting on. Empty when the value is settled. */
  renderNotable: (resident: Resident) => ReactNode[]
}

export const RISK_FLAG_SOURCES: RiskFlagSource[] = [
  {
    id: 'falls',
    name: 'Falls risk',
    // PRD §2.1: "No FALLS RISK badge reads to a care worker as 'assessed,
    // he's fine'. It may mean nobody has ever assessed him."
    isUnrecorded: (resident) => resident.risks.falls.kind === 'not_assessed',
    renderUnrecorded: () => <Unrecorded key="falls" label="Falls not assessed" />,
    renderNotable: (resident) => {
      const falls = resident.risks.falls
      if (falls.kind !== 'assessed' || falls.level === 'low') return []
      return [
        <StatusPill
          key="falls"
          tone={falls.level === 'high' ? 'critical' : 'caution'}
          label={`Falls · ${falls.level === 'high' ? 'HIGH' : 'MODERATE'}`}
        />,
      ]
    },
  },
  {
    id: 'choking',
    name: 'Choking and dysphagia risk',
    // Same-day dangerous, which is why it is critical alongside falls.
    isUnrecorded: (resident) => resident.risks.choking.kind === 'not_assessed',
    renderUnrecorded: () => <Unrecorded key="choking" label="Dysphagia not assessed" />,
    renderNotable: (resident) => {
      const choking = resident.risks.choking
      if (choking.kind !== 'assessed' || choking.level !== 'high') return []
      return [<StatusPill key="choking" tone="critical" label="Dysphagia · HIGH" />]
    },
  },
  {
    id: 'allergies',
    name: 'Allergies',
    isUnrecorded: (resident) => resident.allergies.kind === 'not_recorded',
    renderUnrecorded: () => (
      <Unrecorded key="allergies" label="Allergies not recorded" />
    ),
    renderNotable: (resident) => {
      // A recorded "none known" is a complete record and settled — it folds
      // into the "all assessed" claim rather than filling the column with
      // reassurance nobody acts on.
      if (resident.allergies.kind !== 'allergies') return []
      // ONE badge listing every allergen, not one badge per allergen. Three
      // stacked pills said "allergies" three times and made a resident with
      // three mild sensitivities out-shout a resident with no falls
      // assessment. Every substance is still named in full — nothing is
      // summarised to a count and there is no "+2 more"; the reduction is in
      // chrome, not in evidence. `items` is non-empty by construction.
      return [
        <StatusPill
          key="allergies"
          tone="critical"
          label={`Allergies: ${resident.allergies.items
            .map((allergy) => allergy.substance)
            .join(', ')}`}
        />,
      ]
    },
  },
  {
    id: 'resuscitation',
    name: 'Resuscitation decision',
    // §2.1: "For DNAR the same ambiguity is catastrophic in both directions."
    isUnrecorded: (resident) => resident.resuscitation.kind === 'no_decision_recorded',
    renderUnrecorded: () => (
      <Unrecorded key="resus" label="No resuscitation decision" />
    ),
    renderNotable: (resident) => {
      // "For resuscitation" is the settled value. Because the unrecorded case
      // always renders and a DNAR always renders, the absence of a badge here
      // can only mean for-resuscitation — unambiguous, and one fewer pill on
      // every row that does not need one.
      if (resident.resuscitation.kind !== 'dnar_in_place') return []
      return [<StatusPill key="resus" tone="brand" label="DNAR in place" />]
    },
  },
]
