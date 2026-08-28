import { held, type SessionHolding } from './session-holding'
import type { DocumentId, DocumentRecord, ResidentId, SiteId } from '../types'
import { documentsForResident, documentsForSite } from '../fixtures/documents'
import { residentsBySite } from '../fixtures/residents'

/**
 * Documents added during this session. PRD §6.7, CLAUDE.md §6.
 *
 * In memory and nowhere else, like every other write in this build, and the
 * fixtures are never mutated — a session document is appended to a separate
 * list so `fixtures.test.ts` keeps testing the fixtures rather than whatever
 * the last click did.
 *
 * **The file is not here and never was.** A document added this session
 * carries `file: { kind: 'not_retrievable' }`, and every screen that renders
 * it says so. There is no blob, no object URL and no download: a control that
 * appears to hand somebody a file and hands them nothing is worse than one
 * that says plainly it cannot.
 */

const sessionDocuments: DocumentRecord[] = []

let sequence = 0

export function nextSessionDocumentId(): DocumentId {
  sequence += 1
  return `doc-session-${String(sequence).padStart(4, '0')}` as DocumentId
}

export function addSessionDocument(document: DocumentRecord): DocumentRecord {
  sessionDocuments.push(document)
  return document
}

/** What this store would lose. */
export function documentHoldings(): SessionHolding[] {
  return held('documents you filed', sessionDocuments.length)
}

/** Emptied on sign out, and by tests. */
export function resetSessionDocuments(): void {
  sessionDocuments.length = 0
  sequence = 0
}

/** Everything on file for a resident, fixtures plus this session's adds. */
export function residentDocuments(residentId: ResidentId): DocumentRecord[] {
  return [
    ...documentsForResident(residentId),
    ...sessionDocuments.filter(
      (document) =>
        document.owner.kind === 'resident' && document.owner.residentId === residentId,
    ),
  ]
}

/**
 * Everything at a site — residents' documents and the home's own.
 *
 * A session document belonging to a resident counts towards their site, which
 * is why this asks the fixture set which residents live here rather than
 * filtering on the document's own owner alone.
 */
export function siteDocuments(siteId: SiteId): DocumentRecord[] {
  const here = new Set(residentsBySite(siteId).map((resident) => resident.id))

  const fromSession = sessionDocuments.filter((document) =>
    document.owner.kind === 'site'
      ? document.owner.siteId === siteId
      : here.has(document.owner.residentId),
  )

  return [...documentsForSite(siteId), ...fromSession]
}

/** Whether a document was added this session. Tests read it; screens do not. */
export function addedThisSession(id: DocumentId): boolean {
  return sessionDocuments.some((document) => document.id === id)
}
