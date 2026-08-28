import { held, type SessionHolding } from './session-holding'
import type { CareNote, CareNoteId, CareNoteReview, ResidentId } from '../types'
import { careNotes } from '../fixtures/care-notes'

/**
 * Care notes written during this session. PRD §3.6, CLAUDE.md §6.
 *
 * In memory and nowhere else. No `localStorage`, no `sessionStorage`: record
 * data does not survive a reload, and that is correct and intended rather than
 * a shortcut. A prototype that remembers a care note across reloads invites
 * somebody to treat it as a system of record.
 *
 * **The fixtures are never mutated.** They are exported consts that
 * `fixtures.test.ts` asserts against, and a screen quietly editing them would
 * make those guards test whatever the last click did. So a note written here
 * is appended to a separate list, and a note superseded here is recorded in a
 * separate map and patched on read. Reload and the fixtures are exactly as
 * they were.
 */

const sessionNotes: CareNote[] = []

/**
 * Original note id → the correction note that supersedes it.
 *
 * A map rather than an edit, for the reason above: `supersededBy` on a fixture
 * note has to appear changed on screen without the fixture changing underneath
 * the tests.
 */
const supersessions = new Map<CareNoteId, CareNoteId>()

/**
 * Note id → the review recorded against it **this session**.
 *
 * An overlay rather than an edit, for the same reason as `supersessions`: the
 * fixtures stay exactly as they are, so the guards in `fixtures.test.ts` keep
 * testing the fixtures rather than whatever the last click did.
 *
 * It also buys the undo for nothing. `CareNoteReview` is a closed union in
 * which `reviewed` replaces `flagged_not_reviewed` outright, so the flag's
 * author and timestamp are not carried forward by the type — but the original
 * note is untouched underneath, so clearing the overlay restores who flagged
 * it and when, exactly as it was. An in-place edit could not have undone
 * itself without keeping a second copy.
 *
 * Only session reviews live here, and that is what makes the undo honest: a
 * note the fixtures already had as reviewed was not reviewed by this user and
 * is not theirs to take back.
 */
const sessionReviews = new Map<CareNoteId, CareNoteReview>()

let sequence = 0

export function nextNoteId(): CareNoteId {
  sequence += 1
  return `note-session-${sequence}` as CareNoteId
}

/** Applies anything recorded against this note during the session. */
function patch(note: CareNote): CareNote {
  const by = supersessions.get(note.id)
  const review = sessionReviews.get(note.id)
  if (by === undefined && review === undefined) return note
  return {
    ...note,
    ...(by === undefined ? {} : { supersededBy: by }),
    ...(review === undefined ? {} : { review }),
  }
}

/**
 * Every note for a resident, newest first: the fixtures plus anything written
 * this session, in one list. A note written a moment ago is a care note like
 * any other and sorts by its timestamp, not to the top by virtue of being new.
 */
export function notesFor(residentId: ResidentId): CareNote[] {
  return [...careNotes, ...sessionNotes]
    .filter((note) => note.residentId === residentId)
    .map(patch)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
}

/**
 * Every note for a set of residents, newest first.
 *
 * Used by the cross-resident view, which asks a different question from the
 * profile timeline: what is happening in this home, rather than what happened
 * to this person.
 */
export function notesForResidents(residentIds: ResidentId[]): CareNote[] {
  const wanted = new Set<ResidentId>(residentIds)
  return [...careNotes, ...sessionNotes]
    .filter((note) => wanted.has(note.residentId))
    .map(patch)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
}

export function noteById(id: CareNoteId): CareNote | undefined {
  const found = [...careNotes, ...sessionNotes].find((note) => note.id === id)
  return found === undefined ? undefined : patch(found)
}

/** The most recent note, or nothing — and nothing is a real answer. */
export function latestNoteFor(residentId: ResidentId): CareNote | undefined {
  return notesFor(residentId)[0]
}

export function appendNote(note: CareNote): void {
  sessionNotes.push(note)
}

/**
 * Records that `originalId` has been superseded by `byId`.
 *
 * The original is never removed and never hidden. PRD §6.3: a correction
 * "creates a new linked note and marks the original as superseded **while
 * leaving it visible**". Deleting the thing that was wrong is how a record
 * stops being a record.
 */
export function supersede(originalId: CareNoteId, byId: CareNoteId): void {
  supersessions.set(originalId, byId)
}

/**
 * Records that a senior has reviewed a flagged note.
 *
 * The supervisory loop the queue at `/care-notes` exists to discharge. Without
 * it the queue could only ever grow: a care worker could ask for a second
 * opinion and nobody could record having given one.
 */
export function recordReview(noteId: CareNoteId, review: CareNoteReview): void {
  sessionReviews.set(noteId, review)
}

/**
 * Takes back a review recorded this session.
 *
 * There is no backend to write a correction against, so a mis-click on "mark
 * reviewed" would otherwise be permanent for the life of the session — and the
 * thing it silently removed is a care worker's request for help. This is not
 * an edit to a clinical record: nothing has been written anywhere, and the
 * note returns to the flag it still carries underneath.
 */
export function clearReview(noteId: CareNoteId): void {
  sessionReviews.delete(noteId)
}

/** Whether this session recorded the review, and may therefore take it back. */
export function reviewedThisSession(noteId: CareNoteId): boolean {
  return sessionReviews.has(noteId)
}

/**
 * What this store would lose. Three separate things, not one number.
 *
 * A correction is a new note and a review is a decision about somebody else's,
 * so collapsing them into "5 care notes" would misdescribe what is at stake.
 */
export function noteHoldings(): SessionHolding[] {
  return [
    ...held('care notes you wrote', sessionNotes.length - supersessions.size),
    ...held('corrections you linked to an earlier note', supersessions.size),
    ...held('notes you marked reviewed', sessionReviews.size),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionNotes(): void {
  sessionNotes.length = 0
  supersessions.clear()
  sessionReviews.clear()
  sequence = 0
}
