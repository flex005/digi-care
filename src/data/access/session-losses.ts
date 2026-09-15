import { carePlanHoldings, resetSessionCarePlan } from './care-plan-draft-store'
import { cycleHoldings, resetSessionCycle } from './cycle-store'
import { documentHoldings, resetSessionDocuments } from './document-store'
import { handoverHoldings, resetHandoverSession } from './handover-store'
import { marHoldings, resetSessionAdministrations } from './mar-store'
import { activityHoldings, resetSessionActivities } from './activity-store'
import { disclosureHoldings, resetSessionDisclosures } from './family-disclosure-store'
import { familyAccessHoldings, resetSessionFamilyAccess } from './family-access-store'
import { incidentHoldings, resetSessionIncidents } from './incident-store'
import { resetSessionSetup, setupHoldings } from './setup-store'
import { resetSessionSiteConfig, siteConfigHoldings } from './site-config-store'
import { noteHoldings, resetSessionNotes } from './note-store'
import { notificationHoldings, resetSessionNotifications } from './notification-store'
import { residentHoldings, resetSessionResidents } from './resident-store'
import { resetSessionReviewFlags, reviewFlagHoldings } from './review-flag-store'
import { resetSessionSettings, settingsHoldings } from './settings-store'
import { resetSessionTeam, teamHoldings } from './team-store'
import {
  resetSessionWholePlanReviews,
  wholePlanHoldings,
} from './whole-plan-review-store'
import { resetSessionLog, sessionActCount } from './session-log'
import type { SessionHolding } from './session-holding'

/**
 * Everything this session has written, and the only thing that can end it.
 *
 * **Signing out is the one action in this build that destroys work rather than
 * failing to save it.** Every write is held in this browser tab and sent
 * nowhere, so there is no server holding a second copy and no reload that
 * brings any of it back. That makes the confirmation a real one, which means
 * it has to be checkable: a sentence saying "unsaved changes will be lost"
 * cannot be held against what is actually there, and would be equally true of
 * a session in which nothing happened.
 *
 * **So the list is assembled from the stores, not from the activity log.** The
 * log looked like the obvious source and does not hold what it appeared to:
 * nine of the client's nineteen write functions never reach it, among them
 * every medication round, PRN dose, controlled drug opening count, review flag
 * closed and care plan draft saved. A loss list built on the log would have been silently missing the single
 * most consequential thing a care worker records in a shift, and it would have
 * looked complete.
 *
 * **One owner, and a guard that keeps it that way.** Every store holding
 * session state is imported here, and `scripts/check-session-losses.mjs` fails
 * the build if one is added that this file does not ask. A store nobody asked
 * is work nobody warned about.
 */

/** Each store, asked in turn. Order is the order a shift produces them in. */
const SOURCES: (() => SessionHolding[])[] = [
  activityHoldings,
  disclosureHoldings,
  familyAccessHoldings,
  incidentHoldings,
  setupHoldings,
  siteConfigHoldings,
  noteHoldings,
  marHoldings,
  handoverHoldings,
  carePlanHoldings,
  reviewFlagHoldings,
  wholePlanHoldings,
  notificationHoldings,
  residentHoldings,
  documentHoldings,
  cycleHoldings,
  teamHoldings,
  settingsHoldings,
]

/** Everything held, with nothing empty in it. */
export function sessionLosses(): SessionHolding[] {
  return SOURCES.flatMap((ask) => ask())
}

/**
 * How many records would go.
 *
 * Summed from the same list the screen renders, so the figure on the button
 * and the items above it cannot disagree — the two-clocks failure, which is
 * what happens when a total and its parts are derived separately.
 */
export function sessionLossTotal(): number {
  return sessionLosses().reduce((running, entry) => running + entry.count, 0)
}

/**
 * Whether this session has written anything at all.
 *
 * Asked through the same list rather than through a flag somebody sets on
 * write, because a flag is a second rule and two rules drift.
 */
export const sessionHasWrites = (): boolean => sessionLosses().length > 0

/**
 * Ends the session, for real.
 *
 * **Every store, including the ones that hold nothing today.** A reset that
 * skips a store because it happens to be empty is a reset that stops being
 * complete the first time somebody writes to it, and nothing would fail.
 */
export function endSession(): void {
  resetSessionNotes()
  resetSessionIncidents()
  resetSessionSetup()
  resetSessionSiteConfig()
  resetSessionActivities()
  resetSessionDisclosures()
  resetSessionFamilyAccess()
  resetSessionAdministrations()
  resetHandoverSession()
  resetSessionCarePlan()
  resetSessionReviewFlags()
  resetSessionWholePlanReviews()
  resetSessionNotifications()
  resetSessionResidents()
  resetSessionDocuments()
  resetSessionCycle()
  resetSessionTeam()
  resetSessionSettings()
  resetSessionLog()
}

export { sessionActCount }
export type { SessionHolding }
