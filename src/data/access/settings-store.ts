import { held as heldItem, type SessionHolding } from './session-holding'
import type { Site, SiteId } from '../types'
import { INSUFFICIENT_EVIDENCE_THRESHOLD, MIN_POPULATION_FOR_A_RATE } from '../types'
import { sites as fixtureSites } from '../fixtures/organisation'
import { DUE_SOON_DAYS, REVIEW_INTERVAL_MONTHS } from '@/lib/review-interval'
import { ROUND_TIMES, ROUND_WINDOW_MINUTES } from '@/data/fixtures/rounds'
import { GAP_THRESHOLD_WAKING_MINUTES, MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'

/**
 * The figures this build runs on, and which of them can honestly move. Phase 15.
 *
 * **Settable if and only if it is read at render.** A figure baked into fixture
 * generation cannot be changed by a control: the records were already produced
 * against the old value, so the control would move a label and not the data —
 * which is the largest "control that does nothing" available, on the screen
 * where somebody most reasonably expects otherwise.
 *
 * Only one of the §9.2b figures turns out to be baked. `MEDICATION_LOOKAHEAD_HOURS`
 * decides which MAR records are generated as `due`, so changing it means
 * regenerating rather than re-rendering. Everything else here is read while a
 * screen draws, and changing it genuinely changes what that screen says.
 *
 * In memory and nowhere else, like every other write in this build — and that
 * is exactly why every screen says when one has been changed.
 */

export interface AdjustableFigure {
  id: string
  label: string
  /** What changing it does, in one line. */
  effect: string
  unit: string
  value: number
  /** What it was before anybody touched it. */
  fallback: number
  /**
   * Fixed at fixture generation.
   *
   * Rendered read-only with its value and the reason, never as a control.
   */
  fixedAtGeneration: boolean
  /** Where the reader can see the change take effect. */
  seenOn: string
}

const FIGURES: AdjustableFigure[] = [
  {
    /*
     * **Settable because it is the only way to see the state it produces.**
     * AM v2.0's AUTH-08 expires a governance session after eight hours of
     * inactivity and warns in the last ten minutes, which is a state nobody
     * reviewing this build will ever reach: the warning is 470 minutes away
     * and the sign-out 480. A figure nobody can reach is a branch nothing
     * tests, which is the standing check about a fixture reaching every state,
     * one level up — here the thing that cannot reach it is the clock.
     *
     * It is read while the shell draws, so it qualifies under the rule the
     * rest of this list obeys, and lowering it does exactly what it says
     * rather than moving a label.
     */
    id: 'session-timeout-minutes',
    label: 'Minutes of inactivity before a session ends',
    effect:
      'The warning appears in the last ten minutes and the session ends at zero, destroying everything it wrote. Lower it to see either.',
    unit: 'minutes',
    value: 480,
    fallback: 480,
    fixedAtGeneration: false,
    seenOn: 'Every screen, in the bar above the content',
  },
  {
    id: 'min-population-for-a-rate',
    label: 'Smallest population a rate may be drawn from',
    effect:
      'Below this, a figure renders Insufficient Evidence instead of a percentage: everywhere in the product.',
    unit: 'records',
    value: MIN_POPULATION_FOR_A_RATE,
    fallback: MIN_POPULATION_FOR_A_RATE,
    fixedAtGeneration: false,
    seenOn: 'Compliance, Reports, Documents, Reviews',
  },
  {
    id: 'insufficient-evidence-threshold',
    label: 'Share of a panel’s checks that must support a figure',
    effect:
      'Below this share, a Key Question renders Insufficient Evidence rather than a rating.',
    unit: 'per cent',
    value: Math.round(INSUFFICIENT_EVIDENCE_THRESHOLD * 100),
    fallback: Math.round(INSUFFICIENT_EVIDENCE_THRESHOLD * 100),
    fixedAtGeneration: false,
    seenOn: 'Compliance',
  },
  {
    id: 'due-soon-days',
    label: 'How long before a deadline it reads as approaching',
    effect:
      'Moves which reviews read as due soon and which documents read as expiring.',
    unit: 'days',
    value: DUE_SOON_DAYS,
    fallback: DUE_SOON_DAYS,
    fixedAtGeneration: false,
    seenOn: 'Reviews, Care Plans, Documents',
  },
  {
    id: 'gap-threshold-waking-minutes',
    label: 'Waking time between care notes that counts as an omission',
    effect: 'Moves which stretches on the care note timeline render as a gap.',
    unit: 'minutes',
    value: GAP_THRESHOLD_WAKING_MINUTES,
    fallback: GAP_THRESHOLD_WAKING_MINUTES,
    fixedAtGeneration: false,
    seenOn: 'Care Notes',
  },
  {
    id: 'review-interval-months',
    label: 'How long a completed review buys before the next one',
    effect:
      'Applies to reviews completed from now on. Review dates already in the record were set against the old value and do not move.',
    unit: 'months',
    value: REVIEW_INTERVAL_MONTHS,
    fallback: REVIEW_INTERVAL_MONTHS,
    fixedAtGeneration: false,
    seenOn: 'Reviews, Care Plans, Risk Assessments',
  },
  {
    /*
     * **Round times, refused rather than engineered around.** AM v2.0's
     * SETT-01 makes them configurable, and they cannot be: every
     * `Medication.roundTimes` and every MAR record in the fixtures was
     * produced against these four, and `clock.ts` reads them before any
     * fixture module loads to decide whether a round is running. Changing them
     * would move the windows under records already written.
     *
     * A pending change with an effective date was considered and is a
     * scheduling feature: this build has no scheduler, no job and no
     * persistence, so the date would be a promise nobody keeps — a control
     * that does nothing in a more convincing costume than most.
     */
    id: 'round-times',
    label: 'The times this home gives medication',
    effect:
      'Fixed at fixture generation: every dose and every MAR record was produced against these four times, and the clock reads them to decide whether a round is running. Changing them would move the windows under records already on the chart. A change that takes effect later needs something to make it take effect, and this build has no scheduler.',
    unit: ROUND_TIMES.join(' · '),
    value: ROUND_TIMES.length,
    fallback: ROUND_TIMES.length,
    fixedAtGeneration: true,
    seenOn: 'The MAR chart, the round, the Dashboard',
  },
  {
    id: 'round-window-minutes',
    label: 'How long a round stays open',
    effect:
      'Fixed at fixture generation, for the same reason as the round times: the MAR was produced against this window, so changing it would relabel doses rather than move them.',
    unit: 'minutes',
    value: ROUND_WINDOW_MINUTES,
    fallback: ROUND_WINDOW_MINUTES,
    fixedAtGeneration: true,
    seenOn: 'The round, the Dashboard',
  },
  {
    id: 'medication-lookahead-hours',
    label: 'How far ahead a screen looks for medication about to fall due',
    effect:
      'Fixed at fixture generation: the MAR records were produced against this value, so changing it would move the label and not a single dose. It needs the record regenerating, not re-rendering.',
    unit: 'hours',
    value: MEDICATION_LOOKAHEAD_HOURS,
    fallback: MEDICATION_LOOKAHEAD_HOURS,
    fixedAtGeneration: true,
    seenOn: 'Dashboard, the profile header',
  },
]

export function figures(): AdjustableFigure[] {
  return FIGURES
}

function figure(id: string): AdjustableFigure {
  const found = FIGURES.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No adjustable figure with id ${id}`)
  return found
}

/**
 * Sets a figure for this session.
 *
 * Refuses a figure fixed at generation rather than accepting it and doing
 * nothing, because a setter that silently ignores its argument is the same
 * defect as a control that does nothing, one layer down.
 */
export function setFigure(id: string, value: number): void {
  const entry = figure(id)
  if (entry.fixedAtGeneration) {
    throw new Error(`${entry.label} is fixed at fixture generation and cannot be set`)
  }
  entry.value = value
}

/** Everything that is no longer at its documented default. */
export function changedFigures(): AdjustableFigure[] {
  return FIGURES.filter((entry) => entry.value !== entry.fallback)
}

// ---------------------------------------------------------------------------
// The live readers. Every consumer calls these rather than the constant.
// ---------------------------------------------------------------------------

export const minPopulationForARate = () => figure('min-population-for-a-rate').value
export const insufficientEvidenceThreshold = () =>
  figure('insufficient-evidence-threshold').value / 100
export const dueSoonDays = () => figure('due-soon-days').value
export const gapThresholdWakingMinutes = () =>
  figure('gap-threshold-waking-minutes').value
export const reviewIntervalMonths = () => figure('review-interval-months').value
export const sessionTimeoutMinutes = () => figure('session-timeout-minutes').value

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

/**
 * A site's name and zone, as they stand this session.
 *
 * Both are honestly settable: the zone is read wherever a clinical timestamp
 * renders, and changing it changes what every one of them says — which is the
 * whole reason §3.6 exists. The name is read wherever a screen labels itself.
 */
const siteOverrides = new Map<SiteId, { name?: string; timeZone?: string }>()

export function siteAsConfigured(site: Site): Site {
  const held = siteOverrides.get(site.id)
  if (held === undefined) return site
  return {
    ...site,
    name: held.name ?? site.name,
    timeZone: held.timeZone ?? site.timeZone,
  }
}

export function configuredSites(): Site[] {
  return fixtureSites.map(siteAsConfigured)
}

export function setSiteName(id: SiteId, name: string): void {
  siteOverrides.set(id, { ...siteOverrides.get(id), name })
}

export function setSiteTimeZone(id: SiteId, timeZone: string): void {
  siteOverrides.set(id, { ...siteOverrides.get(id), timeZone })
}

/**
 * What this store would lose.
 *
 * Not clinical writing, and it goes on the list anyway: a home's timezone
 * decides what every clinical timestamp in the product says, so somebody who
 * corrected it and then signed out has lost a change that was affecting every
 * screen.
 */
export function settingsHoldings(): SessionHolding[] {
  return [
    ...heldItem('figures you changed in Settings', changedFigures().length),
    ...heldItem('home names or timezones you changed', siteOverrides.size),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionSettings(): void {
  siteOverrides.clear()
  for (const entry of FIGURES) entry.value = entry.fallback
}

/** Named zones a home might plausibly be in. Not a free-text field. */
export const TIME_ZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Atlantic/Canary',
] as const
