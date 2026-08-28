import type { Resident } from '@/data/types'
import type { StatusTone } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { scoreTextCapitalised } from '@/features/risk/score'
import { formatDate, formatInstantDate } from '@/lib/format'
import type { TimeZone } from '@/lib/format'

/**
 * The five risk flags of the profile strip, declared rather than hardcoded
 * into a render function. PRD §16.3.
 *
 * Each source is exhaustive over its own union — every one ends in
 * `assertNever`, so a state cannot go unhandled. What a declared list adds is
 * the guarantee one level up: a *flag* cannot quietly go missing from the
 * strip. The strip is the header's entire safety argument, and §2.1 calls the
 * DNAR ambiguity "catastrophic in both directions"; a flag that stopped
 * rendering would restore exactly that, silently.
 *
 * Unlike the residents list, nothing here narrows. Every state of every flag
 * is drawn, including the settled ones — this is the point-of-care surface,
 * and inference has no place on it.
 *
 * **These return data, not elements.** The strip renders three lines per flag —
 * the field, the answer, the attribution — and the answer has to be the one
 * thing carrying the status colour, at the largest size on the card. A
 * component returning a finished pill cannot be laid out that way from
 * outside. The badge components still exist and are still used where a pill is
 * the right shape: the General Information tab, and /dev/states.
 */

/** What the flag says, and how loudly. */
export type FlagState =
  | {
      kind: 'recorded'
      tone: StatusTone
      /** The answer. Largest line on the card, and the only coloured one. */
      answer: string
      /** Who recorded it and when, or what the answer consists of. */
      attribution: string
    }
  | {
      kind: 'unrecorded'
      /** Short, because the field name sits above it. "Not assessed". */
      answer: string
      /** Says what is missing, in words — never the hatch alone. */
      attribution: string
    }

export interface BadgeStripSource {
  id: string
  /** The field. Shown as the card's first line, and named in test failures. */
  name: string
  state: (resident: Resident, timeZone: TimeZone) => FlagState
}

export const BADGE_STRIP_SOURCES: BadgeStripSource[] = [
  {
    id: 'falls',
    name: 'Falls risk',
    state: (resident, timeZone) => {
      const falls = resident.risks.falls
      switch (falls.kind) {
        case 'not_assessed':
          return {
            kind: 'unrecorded',
            answer: 'Not assessed',
            attribution: 'Nobody has assessed falls risk',
          }
        case 'assessed':
          return {
            kind: 'recorded',
            tone:
              falls.level === 'high'
                ? 'critical'
                : falls.level === 'moderate'
                  ? 'caution'
                  : 'positive',
            answer: LEVEL_LABEL[falls.level],
            attribution: `${scoreTextCapitalised(falls.score)} · ${falls.assessedBy.displayName}, ${formatInstantDate(falls.assessedAt, timeZone)}`,
          }
        default:
          return assertNever(falls)
      }
    },
  },
  {
    id: 'allergies',
    name: 'Allergies',
    // Three states, three treatments — including NO KNOWN ALLERGIES, a
    // recorded negative, which §6.2 is explicit must look different again
    // from both a finding and a gap.
    state: (resident, timeZone) => {
      const allergies = resident.allergies
      switch (allergies.kind) {
        case 'not_recorded':
          return {
            kind: 'unrecorded',
            answer: 'Not recorded',
            attribution: 'Nobody has recorded whether there are any',
          }
        case 'none_known':
          return {
            kind: 'recorded',
            tone: 'positive',
            answer: 'None known',
            attribution: `${allergies.recordedBy.displayName}, ${formatInstantDate(allergies.recordedAt, timeZone)}`,
          }
        case 'allergies':
          return {
            kind: 'recorded',
            tone: 'critical',
            // Every substance, never a count and never "+2 more": this is the
            // line somebody reads before giving a drug.
            answer: allergies.items.map((allergy) => allergy.substance).join(', '),
            attribution: allergies.items
              // The reaction as it was written. It is free text on a clinical
              // record, so it can carry a device or a drug name, and lowercasing
              // it to fit a line would take that out.
              .map((allergy) => `${allergy.severity} · ${allergy.reaction}`)
              .join('; '),
          }
        default:
          return assertNever(allergies)
      }
    },
  },
  {
    id: 'resuscitation',
    name: 'Resuscitation',
    // FOR RESUSCITATION is drawn here, though it folds into a claim on the
    // list. This is where somebody acts on it.
    state: (resident, timeZone) => {
      const resus = resident.resuscitation
      switch (resus.kind) {
        case 'no_decision_recorded':
          return {
            kind: 'unrecorded',
            answer: 'No decision',
            attribution: 'Nobody has recorded a decision',
          }
        case 'dnar_in_place':
          return {
            kind: 'recorded',
            tone: 'brand',
            answer: 'DNAR in place',
            attribution: `${resus.signedBy} · ${formatDate(resus.signedOn)}`,
          }
        case 'for_resuscitation':
          return {
            kind: 'recorded',
            tone: 'positive',
            answer: 'For resuscitation',
            attribution: `${resus.recordedBy.displayName}, ${formatInstantDate(resus.recordedAt, timeZone)}`,
          }
        default:
          return assertNever(resus)
      }
    },
  },
  {
    id: 'eolc',
    name: 'End of life care',
    state: (resident, timeZone) => {
      const eolc = resident.eolc
      switch (eolc.kind) {
        case 'not_recorded':
          return {
            kind: 'unrecorded',
            answer: 'Not recorded',
            attribution: 'Nobody has recorded a decision',
          }
        case 'not_applicable':
          return {
            kind: 'recorded',
            tone: 'positive',
            answer: 'Not applicable',
            attribution: `${eolc.recordedBy.displayName}, ${formatInstantDate(eolc.recordedAt, timeZone)}`,
          }
        case 'in_place':
          // --status-info, departing from source PRD §16.3's grey: grey is
          // reserved for unrecorded, and a recorded EOLC decision rendered
          // grey would read as "nobody has looked". PROGRESS.md, Screen 2.
          return {
            kind: 'recorded',
            tone: 'info',
            answer: 'In place',
            attribution: `Since ${formatDate(eolc.startedOn)} · ${eolc.recordedBy.displayName}`,
          }
        default:
          return assertNever(eolc)
      }
    },
  },
  {
    id: 'isolation',
    name: 'Isolation',
    state: (resident, timeZone) => {
      const isolation = resident.isolation
      switch (isolation.kind) {
        case 'not_recorded':
          return {
            kind: 'unrecorded',
            answer: 'Not recorded',
            attribution: 'Nobody has recorded a status',
          }
        case 'not_isolating':
          return {
            kind: 'recorded',
            tone: 'positive',
            answer: 'Not isolating',
            attribution: `${isolation.recordedBy.displayName}, ${formatInstantDate(isolation.recordedAt, timeZone)}`,
          }
        case 'isolating':
          return {
            kind: 'recorded',
            tone: 'caution',
            answer: `Isolating · ${isolation.reason}`,
            attribution: `Since ${formatDate(isolation.since)} · ${isolation.recordedBy.displayName}`,
          }
        default:
          return assertNever(isolation)
      }
    },
  },
]

const LEVEL_LABEL: Record<'low' | 'moderate' | 'high', string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}
