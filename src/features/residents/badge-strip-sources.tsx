import type { ReactNode } from 'react'
import type { Resident } from '@/data/types'
import {
  AllergyBadge,
  EolcBadge,
  IsolationBadge,
  ResuscitationBadge,
  RiskBadge,
} from '@/components/status'

/**
 * The five badges of the profile strip, declared rather than hardcoded into
 * a render function. PRD §16.3.
 *
 * Each badge component is exhaustive over its own union — every one ends in
 * `assertNever`, so a state cannot go unhandled. What a declared list adds is
 * the guarantee one level up: a *badge* cannot quietly go missing from the
 * strip. The strip is the header's entire safety argument, and §2.1 calls the
 * DNAR ambiguity "catastrophic in both directions"; a badge that stopped
 * rendering would restore exactly that, silently.
 *
 * Unlike the residents list, nothing here narrows. Every state of every badge
 * is drawn, including the settled ones — this is the point-of-care surface,
 * and inference has no place on it.
 */
export interface BadgeStripSource {
  id: string
  /** Named in tests when a badge goes missing. */
  name: string
  render: (resident: Resident) => ReactNode
}

export const BADGE_STRIP_SOURCES: BadgeStripSource[] = [
  {
    id: 'falls',
    name: 'Falls risk',
    render: (resident) => <RiskBadge name="Falls risk" status={resident.risks.falls} />,
  },
  {
    id: 'allergies',
    name: 'Allergies',
    // Three states, three treatments — including NO KNOWN ALLERGIES, a
    // recorded negative, which §6.2 is explicit must look different again
    // from both a finding and a gap.
    render: (resident) => <AllergyBadge status={resident.allergies} />,
  },
  {
    id: 'resuscitation',
    name: 'Resuscitation decision',
    // FOR RESUSCITATION is drawn here, though it folds into a claim on the
    // list. This is where somebody acts on it.
    render: (resident) => <ResuscitationBadge status={resident.resuscitation} />,
  },
  {
    id: 'eolc',
    name: 'End of life care',
    render: (resident) => <EolcBadge status={resident.eolc} />,
  },
  {
    id: 'isolation',
    name: 'Isolation',
    render: (resident) => <IsolationBadge status={resident.isolation} />,
  },
]
