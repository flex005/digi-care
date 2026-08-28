import { held, type SessionHolding } from './session-holding'
import type {
  CareNote,
  HandoverId,
  HandoverSession,
  HandoverSignature,
  HandoverStatus,
  ResidentId,
  SiteId,
} from '../types'
import { handovers, openHandoverFor, unsignedHandoversFor } from '../fixtures/handover'
import { residentsBySite } from '../fixtures/residents'
import { latestNoteFor } from './note-store'

/**
 * Handover changes made during this session. Same discipline as
 * `note-store.ts`: in memory, never touching the fixtures, gone on reload.
 */

const statusChanges = new Map<string, HandoverStatus>()
const signatures = new Map<string, HandoverSignature>()

const statusKey = (id: HandoverId, residentId: ResidentId) => `${id}:${residentId}`
const signKey = (id: HandoverId, side: 'outgoing' | 'incoming') => `${id}:${side}`

/**
 * The status of one resident on one handover.
 *
 * **Every resident at the site has one**, whether or not anybody recorded
 * anything. A resident absent from `entries` is `not_reviewed`, which is a
 * true statement about them rather than a missing row: nobody looked. This is
 * the lookup that makes the fourth state unavoidable rather than optional.
 */
export function statusFor(
  session: HandoverSession,
  residentId: ResidentId,
): HandoverStatus {
  const changed = statusChanges.get(statusKey(session.id, residentId))
  if (changed) return changed
  const entry = session.entries.find((item) => item.residentId === residentId)
  return entry?.status ?? { kind: 'not_reviewed' }
}

function patch(session: HandoverSession): HandoverSession {
  return {
    ...session,
    outgoing: signatures.get(signKey(session.id, 'outgoing')) ?? session.outgoing,
    incoming: signatures.get(signKey(session.id, 'incoming')) ?? session.incoming,
  }
}

export interface HandoverRow {
  residentId: ResidentId
  status: HandoverStatus
  /**
   * The resident's most recent care note, or 'never'.
   *
   * Carried so an unreviewed row is not merely hatched. "Not reviewed" says
   * nobody looked; "no care note recorded for 9 hours 20 minutes" says how
   * long the silence has run. Either alone is weaker than the two together,
   * and the second is the one that tells a nurse which unreviewed resident to
   * go to first.
   */
  lastNote: CareNote | 'never'
}

export interface HandoverBoard {
  session: HandoverSession
  /** Every resident at the site, with the status each currently carries. */
  rows: HandoverRow[]
  reviewed: number
  notReviewed: number
  /** Earlier handovers still missing a signature. The Stale state. */
  unsigned: HandoverSession[]
}

export function boardFor(siteId: SiteId): HandoverBoard | undefined {
  const open = openHandoverFor(siteId)
  if (!open) return undefined
  const session = patch(open)

  // Iterating the site's residents, never the entries. Absence from a list is
  // the same bug as a blank cell.
  const rows: HandoverRow[] = residentsBySite(siteId).map((resident) => ({
    residentId: resident.id,
    status: statusFor(session, resident.id),
    lastNote: latestNoteFor(resident.id) ?? 'never',
  }))

  return {
    session,
    rows,
    reviewed: rows.filter((row) => row.status.kind !== 'not_reviewed').length,
    notReviewed: rows.filter((row) => row.status.kind === 'not_reviewed').length,
    unsigned: unsignedHandoversFor(siteId).map(patch),
  }
}

export function recordStatus(
  id: HandoverId,
  residentId: ResidentId,
  status: HandoverStatus,
): void {
  statusChanges.set(statusKey(id, residentId), status)
}

export function recordSignature(
  id: HandoverId,
  side: 'outgoing' | 'incoming',
  signature: HandoverSignature,
): void {
  signatures.set(signKey(id, side), signature)
}

export function handoverById(id: HandoverId): HandoverSession | undefined {
  const found = handovers.find((session) => session.id === id)
  return found === undefined ? undefined : patch(found)
}

/** Test hook. Nothing in the app calls this. */
/** What this store would lose. */
export function handoverHoldings(): SessionHolding[] {
  return [
    ...held('residents you marked on the handover board', statusChanges.size),
    ...held('handovers you signed', signatures.size),
  ]
}

export function resetHandoverSession(): void {
  statusChanges.clear()
  signatures.clear()
}
