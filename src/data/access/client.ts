/**
 * The data access layer. PRD §3.1.
 *
 * Every read is promise-shaped, so the day a real API arrives these function
 * bodies change and no component does. No state management library, no
 * data-fetching library, no localStorage — in-memory only, and fixtures reset
 * on reload, which is correct and intended (PRD §3.6).
 */

import type {
  Activity,
  ActivityId,
  AnyConsent,
  ConsentMethod,
  ConsentStatus,
  ConsentTypeId,
  DecisionAuthority,
  DownstreamEffect,
  RiskLevel,
  RiskScore,
  RiskTemplateId,
  CarePlanDomainId,
  DocumentCategoryId,
  DocumentRecord,
  ExpiryDecision,
  FileFacts,
  Goal,
  GoalProgressNote,
  CarePlanText,
  CompletedAgainst,
  CareNote,
  CareNoteCategoryId,
  CareNoteId,
  CareNoteReview,
  FlagReason,
  ReviewOutcome,
  HandoverId,
  HandoverSignature,
  HandoverStatus,
  IsoDate,
  IsoDateTime,
  MarCellState,
  Medication,
  MedicationId,
  MoodRecord,
  NoteShift,
  Organisation,
  Resident,
  ResidentId,
  Site,
  SiteId,
  StaffRef,
  Incident,
  RegisterMovement,
  StockBalance,
  StockCount,
} from '../types'
import { subjectResidentId } from '../types'
import { organisation, sites, staff } from '../fixtures/organisation'
import { configuredSites } from './settings-store'
import { viewerHolds, viewerHomes } from './viewer-scope'
import { RecordNotYours } from './record-not-yours'
import { goalProgressNotes, goals, goalsFor } from '../fixtures/goals'
import { activityById } from '../fixtures/activities'
import { activitiesAt, withActivityEdits } from './activity-store'
import { residentById as fixtureResidentById } from '../fixtures/residents'
import {
  discardDraft,
  finaliseDomain,
  saveDraft,
  undoFinalise,
  withSessionCarePlan,
} from './care-plan-draft-store'
import {
  completeWholePlanReview,
  undoWholePlanReview,
  withSessionWholePlanReview,
} from './whole-plan-review-store'
import type { WholePlanReviewToken } from './whole-plan-review-store'
import type { FinaliseToken } from './care-plan-draft-store'

/**
 * Every read of a resident goes through this session's care plan edits.
 *
 * Shadowed here rather than applied at each call site, for the same reason
 * `patchedIncidents` is: a draft saved on one screen and not seen on the next
 * is two screens disagreeing about the same record, and the one that has not
 * heard is always the one somebody is about to act on.
 *
 * `withSessionCarePlan` returns the same object where nothing has been
 * written, so the reads that never touch a care plan pay nothing for this.
 */
const withSessionEdits = (resident: Resident) =>
  withSessionWholePlanReview(withSessionCarePlan(withResidentEdits(resident)))

/*
 * Residents admitted this session are in the same list as the fixtures, and
 * this is the only place that is true — every screen in the product reads
 * through here, so somebody admitted a minute ago appears on all of them
 * without a single screen knowing they are new.
 */
const residents = () => allResidents().map(withSessionEdits)
const residentById = (id: ResidentId) => {
  const resident = allResidents().find((entry) => entry.id === id)
  return resident ? withSessionEdits(resident) : undefined
}
const residentsBySite = (siteId: SiteId) =>
  residents().filter((resident) => resident.siteId === siteId)
import {
  appendNote,
  clearReview,
  latestNoteFor,
  notesForResidents,
  nextNoteId,
  noteById,
  notesFor,
  recordReview,
  reviewedThisSession,
  supersede,
} from './note-store'
import {
  appendPrn,
  patchedRecords,
  prnFor,
  recordAdministration,
  recordPrnOutcome,
  appendStockCount,
  balanceWithSession,
  patchedStockCounts,
  type PrnAdministration,
} from './mar-store'
import {
  clearReviewFlags,
  patchedIncidents,
  undoClearing,
  type ClearableTarget,
  type ClearingToken,
} from './review-flag-store'

import {
  addSessionDocument,
  nextSessionDocumentId,
  residentDocuments,
  siteDocuments,
} from './document-store'
import { nextReviewFrom } from '@/lib/review-interval'
import { logAct } from './session-log'
import {
  admitResident,
  allResidents,
  editResidentField,
  withResidentEdits,
  type AdmissionInput,
} from './resident-store'
import {
  boardFor,
  handoverById,
  recordSignature,
  recordStatus,
  type HandoverBoard,
} from './handover-store'
import {
  dueWithinLookahead,
  fellDueAt,
  marRecordsAll,
  marRecordsFor,
  medicationsFor,
  registerMovements,
  type MarRecord,
} from '../fixtures/medications'

/** Stand-in for network latency, so Loading is a state we actually see. */
const LATENCY_MS = 120

/**
 * Logs one write to the session activity log.
 *
 * **Here rather than at each screen**, because every write in the product
 * already passes through this file — a call at each call site is a call the
 * third screen forgets, and a log missing a third of what happened is worse
 * than none.
 */
/** The subject of a logged act, named. A log entry with no subject is a receipt. */
function nameOf(residentId: ResidentId): string {
  return fixtureResidentById(residentId)?.fullLegalName ?? 'a resident not on file'
}

function logged<T>(
  value: T,
  entry: { module: string; what: string; to: string; by: StaffRef },
): Promise<T> {
  logAct(entry)
  return resolve(value)
}

function resolve<T>(value: T): Promise<T> {
  return new Promise((done) => {
    setTimeout(() => done(value), LATENCY_MS)
  })
}

function reject(message: string): Promise<never> {
  return new Promise((_, fail) => {
    setTimeout(() => fail(new Error(message)), LATENCY_MS)
  })
}

/**
 * A record in a home this viewer is not appointed to.
 *
 * **One place to be right.** Per route, the next route forgets and the failure
 * is silent, because a route that does not check simply returns the data. Here
 * every screen reading that record is refused by the same line.
 *
 * Returns a rejected promise rather than throwing: `useResource` calls
 * `load()` and chains, so a synchronous throw escapes the chain entirely.
 *
 * **Nobody signed in means no scope, not an empty scope.** Every product
 * screen sits behind the sign-in gate, so a loader reached with no viewer is a
 * sign-in screen or a test; refusing everything there would be a different
 * product rather than a safer one, and it would turn 1,300 tests that never
 * sign in red for a reason unrelated to what they assert — noise that teaches
 * people to work around a check rather than satisfy it.
 */
function notYours(siteId: SiteId, what: string): Promise<never> | undefined {
  if (viewerHolds(siteId)) return undefined
  const named = (id: SiteId) =>
    configuredSites().find((site) => site.id === id)?.name ?? id
  const yours = (viewerHomes() ?? []).map(named)
  return new Promise((_, fail) => {
    setTimeout(() => fail(new RecordNotYours(what, named(siteId), yours)), LATENCY_MS)
  })
}

/** The same question, asked of a record that names its own resident. */
function notYoursResident(resident: {
  siteId: SiteId
  fullLegalName: string
}): Promise<never> | undefined {
  return notYours(resident.siteId, `${resident.fullLegalName}'s record`)
}

export function getOrganisation(): Promise<Organisation> {
  return resolve(organisation)
}

export function getSites(): Promise<Site[]> {
  return resolve(sites)
}

export function getStaff(): Promise<StaffRef[]> {
  return resolve(staff)
}

export function getResidents(): Promise<Resident[]> {
  return resolve(residents())
}

export function getResidentsBySite(siteId: SiteId): Promise<Resident[]> {
  const refused = notYours(siteId, 'The residents of that home')
  if (refused) return refused
  return resolve(residentsBySite(siteId))
}

/**
 * A resident that does not exist is an error, not an empty result. Returning
 * `undefined` would leave the caller to decide what a missing subject means,
 * and a wrong-subject screen is the second-worst failure available (§2.4).
 */
export function getResident(id: ResidentId): Promise<Resident> {
  const resident = residentById(id)
  if (!resident) return reject(`No resident with id ${id}`)
  const refused = notYoursResident(resident)
  if (refused) return refused
  return resolve(resident)
}

export function getCareNotes(residentId: ResidentId): Promise<CareNote[]> {
  return resolve(notesFor(residentId))
}

/** The most recent note, or nothing — and nothing is a real answer. */
export function getLatestCareNote(residentId: ResidentId): Promise<CareNote | 'none'> {
  return resolve(latestNoteFor(residentId) ?? 'none')
}

/** Every note for every resident at a site. The cross-resident view. */
export function getCareNotesForSite(siteId: SiteId): Promise<CareNote[]> {
  const refused = notYours(siteId, 'The care notes of that home')
  if (refused) return refused
  return resolve(notesForResidents(residentsBySite(siteId).map((r) => r.id)))
}

export function getCareNote(id: CareNoteId): Promise<CareNote> {
  const note = noteById(id)
  if (!note) return reject(`No care note with id ${id}`)
  return resolve(note)
}

/**
 * The review state a new note starts in, from whether its author flagged it.
 *
 * A flag is raised by the note's author as they write it (CW PRD CN-02), so who
 * flagged and when are the author and the moment of writing, never a field.
 * A reason given as blank is refused rather than stored as a reason: "given"
 * with nothing in it would render as a reason somebody wrote.
 */
function reviewFromFlag(
  flag: { kind: 'not_flagged' } | { kind: 'flagged'; reason: FlagReason },
  author: StaffRef,
  at: IsoDateTime,
): CareNoteReview {
  if (flag.kind === 'not_flagged') return { kind: 'not_flagged' }
  if (flag.reason.kind === 'given' && flag.reason.text.trim() === '')
    throw new Error('A flag reason was given with no words in it.')
  return {
    kind: 'flagged_not_reviewed',
    flaggedBy: author,
    flaggedAt: at,
    reason:
      flag.reason.kind === 'given'
        ? { kind: 'given', text: flag.reason.text.trim() }
        : { kind: 'not_given' },
  }
}

/**
 * Writes a care note. PRD §6.3, and the first genuine write in the product.
 *
 * In memory, for this session, and gone on reload — see `note-store.ts`.
 *
 * The author and the timestamp come from the session and the clock, never from
 * the form. A composer that let somebody type who wrote a note, or when, would
 * be a forgery surface rather than a care record.
 */
export function submitCareNote(input: {
  residentId: ResidentId
  category: CareNoteCategoryId
  body: string
  mood: MoodRecord
  shift: NoteShift
  author: StaffRef
  at: IsoDateTime
  flag: { kind: 'not_flagged' } | { kind: 'flagged'; reason: FlagReason }
}): Promise<CareNote> {
  if (input.body.trim() === '') return reject('A care note cannot be empty')
  if (!residentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  if (input.shift.kind === 'overridden' && input.shift.reason.trim() === '') {
    // "Editable with reason" is not editable with an optional reason.
    return reject('Changing the shift needs a reason')
  }

  const note: CareNote = {
    id: nextNoteId(),
    residentId: input.residentId,
    category: input.category,
    body: input.body.trim(),
    mood: input.mood,
    recordedBy: input.author,
    recordedAt: input.at,
    shift: input.shift,
    review: reviewFromFlag(input.flag, input.author, input.at),
    supersededBy: 'none',
    corrects: 'none',
  }

  appendNote(note)
  return logged(note, {
    module: 'Care Notes',
    what: `Wrote a care note about ${nameOf(input.residentId)}: ${input.category.replace(/_/g, ' ')}`,
    to: `/residents/${input.residentId}/notes/${note.id}`,
    by: input.author,
  })
}

/**
 * Writes a correction note. PRD §6.3.
 *
 * > There is **no edit control**, ever, for a submitted note. Only "Add
 * > correction note", which creates a new linked note and marks the original
 * > as superseded while leaving it visible.
 *
 * Two records afterwards, not one changed record: the original stays exactly
 * as it was written, wrong, attributed and timestamped, and a second note says
 * what was actually the case. That is what makes it a record rather than a
 * document — the fact that somebody first wrote the wrong thing is itself
 * evidence, and an edit destroys it.
 *
 * The correction carries the corrector and the moment of correcting, never the
 * original author or the original time. Backdating a correction to the note it
 * fixes is forging the record.
 */
export function submitCorrectionNote(input: {
  corrects: CareNoteId
  residentId: ResidentId
  category: CareNoteCategoryId
  body: string
  mood: MoodRecord
  shift: NoteShift
  author: StaffRef
  at: IsoDateTime
  flag: { kind: 'not_flagged' } | { kind: 'flagged'; reason: FlagReason }
}): Promise<CareNote> {
  /*
   * **The same checks a first note gets.** A correction is a care note, and it
   * skipped them: an empty correction could supersede a real note, and a changed
   * shift could go unexplained on the one record meant to put something right.
   */
  if (input.body.trim() === '') return reject('A care note cannot be empty')
  if (input.shift.kind === 'overridden' && input.shift.reason.trim() === '') {
    return reject('Changing the shift needs a reason')
  }
  const original = noteById(input.corrects)
  if (!original) return reject(`No care note with id ${input.corrects}`)
  if (original.residentId !== input.residentId) {
    // A correction that lands on a different resident's record is the
    // wrong-subject failure with a paper trail. §2.4.
    return reject('A correction must be written against the same resident')
  }
  if (original.supersededBy !== 'none') {
    return reject('That note has already been corrected')
  }

  const note: CareNote = {
    id: nextNoteId(),
    residentId: input.residentId,
    category: input.category,
    body: input.body.trim(),
    mood: input.mood,
    recordedBy: input.author,
    recordedAt: input.at,
    shift: input.shift,
    review: reviewFromFlag(input.flag, input.author, input.at),
    supersededBy: 'none',
    corrects: input.corrects,
  }

  appendNote(note)
  supersede(original.id, note.id)
  return logged(note, {
    module: 'Care Notes',
    what: `Corrected an earlier care note about ${nameOf(input.residentId)}`,
    to: `/residents/${input.residentId}/notes/${note.id}`,
    by: input.author,
  })
}

/**
 * Records that a senior has looked at a flagged note.
 *
 * The fourth thing this product can write, and the one the supervisory queue
 * could not discharge without: a care worker asks for a second opinion by
 * flagging a note, and until now nothing anywhere could record having given
 * one. The queue at `/care-notes` could only grow.
 *
 * Who and when come from the session and the clock, never from a form — the
 * same rule as a care note. A reviewer field somebody could type into would be
 * a way to sign off work in another person's name.
 *
 * Only a flagged note can be reviewed. Reviewing an unflagged one would record
 * a second opinion nobody asked for, and reviewing an already-reviewed one
 * would quietly overwrite whoever got there first.
 */
export function recordNoteReview(input: {
  noteId: CareNoteId
  by: StaffRef
  at: IsoDateTime
  outcome: ReviewOutcome
}): Promise<CareNoteReview> {
  const note = noteById(input.noteId)
  if (!note) return reject(`No care note with id ${input.noteId}`)
  if (input.outcome.kind === 'other' && input.outcome.text.trim() === '') {
    // "Other" with nothing said is not an outcome anybody can read later.
    return reject('Say what was done')
  }
  if (note.review.kind === 'not_flagged') {
    return reject('That note was not flagged for review')
  }
  if (note.review.kind === 'reviewed') {
    return reject('That note has already been reviewed')
  }

  // The flag is carried forward rather than replaced. Without it the record
  // would say a senior signed something off and lose the fact that somebody
  // asked them to — and the wait between the two is the supervision.
  const review: CareNoteReview = {
    kind: 'reviewed',
    flaggedBy: note.review.flaggedBy,
    flaggedAt: note.review.flaggedAt,
    reason: note.review.reason,
    reviewedBy: input.by,
    reviewedAt: input.at,
    outcome:
      input.outcome.kind === 'other'
        ? { kind: 'other', text: input.outcome.text.trim() }
        : input.outcome,
  }
  recordReview(input.noteId, review)
  return logged(review, {
    module: 'Care Notes',
    what: `Reviewed a flagged care note about ${nameOf(note.residentId)}`,
    to: `/residents/${note.residentId}/notes/${note.id}`,
    by: input.by,
  })
}

/**
 * Takes back a review recorded during this session.
 *
 * **Not a correction, and not an edit to a clinical record.** Nothing has been
 * written to anything: this build holds the review in memory for the life of
 * the session, and there is no backend against which a correction note could
 * be raised. A mis-click would otherwise silently remove a care worker's
 * request for help until somebody reloaded the page.
 *
 * Refused for a review this session did not record. A note the fixtures
 * already carried as reviewed was signed off by somebody else, and taking that
 * back is not this user's to do.
 */
export function undoNoteReview(input: { noteId: CareNoteId }): Promise<CareNote> {
  if (!reviewedThisSession(input.noteId)) {
    return reject('That review was not recorded in this session')
  }
  clearReview(input.noteId)
  const note = noteById(input.noteId)
  if (!note) return reject(`No care note with id ${input.noteId}`)
  return resolve(note)
}

/**
 * Whether this session recorded the review on a note, and may take it back.
 *
 * **Synchronous, and the only read here that is.** Every other read is
 * promise-shaped so the day a real API arrives these bodies change and no
 * component does — but this is not a question about the record. It is a
 * question about what this browser tab did a moment ago, it has no server-side
 * answer, and against a real backend it would be answered by the response to
 * the write rather than by a fetch. Making it a promise would dress a piece of
 * session state up as a read of the care record.
 */
export function reviewRecordedThisSession(noteId: CareNoteId): boolean {
  return reviewedThisSession(noteId)
}

export function getHandoverBoard(siteId: SiteId): Promise<HandoverBoard> {
  const refused = notYours(siteId, 'That home’s handover')
  if (refused) return refused
  const board = boardFor(siteId)
  if (!board) return reject(`No open handover for ${siteId}`)
  return resolve(board)
}

/**
 * Records what one resident's status is on the open handover.
 *
 * `needs_attention` and `urgent` are refused without a note. A status telling
 * the incoming shift that somebody needs attention, without saying what for,
 * is a signal with nothing behind it, and they cannot act on it.
 */
export function recordHandoverStatus(input: {
  handoverId: HandoverId
  residentId: ResidentId
  status: HandoverStatus
}): Promise<HandoverStatus> {
  const { status } = input
  if (
    (status.kind === 'needs_attention' || status.kind === 'urgent') &&
    status.note.trim() === ''
  ) {
    return reject('Say what needs attention')
  }
  recordStatus(input.handoverId, input.residentId, status)
  /*
   * Only a status somebody recorded is logged. `not_reviewed` is the absence
   * of a status rather than one, carries no author by construction, and
   * inventing one to fill a log entry would be the log fabricating its own
   * evidence.
   */
  if (status.kind === 'not_reviewed') return resolve(status)
  return logged(status, {
    module: 'Handover',
    what: `Recorded ${nameOf(input.residentId)} as ${status.kind.replace(/_/g, ' ')} on the handover`,
    to: '/handover',
    by: status.recordedBy,
  })
}

/**
 * Signs one half of the handover.
 *
 * The signature records what was true at the moment of signing: how many
 * residents had been reviewed and how many had not. Signing a handover with
 * six residents nobody looked at does not mean "all well", it means "handed
 * over, with six holes", and the record has to be able to say which.
 */
export function signHandover(input: {
  handoverId: HandoverId
  side: 'outgoing' | 'incoming'
  by: StaffRef
  at: IsoDateTime
  reviewed: number
  notReviewed: number
}): Promise<HandoverSignature> {
  const session = handoverById(input.handoverId)
  if (!session) return reject(`No handover with id ${input.handoverId}`)
  if (session[input.side].kind === 'signed') {
    return reject('That side of this handover is already signed')
  }

  const signature: HandoverSignature = {
    kind: 'signed',
    by: input.by,
    at: input.at,
    reviewed: input.reviewed,
    notReviewed: input.notReviewed,
  }
  recordSignature(input.handoverId, input.side, signature)
  return logged(signature, {
    module: 'Handover',
    what: `Signed the ${input.side} half of a handover: ${input.reviewed} reviewed, ${input.notReviewed} not`,
    to: '/handover',
    by: input.by,
  })
}

/**
 * Everything the MAR chart needs, in one read.
 *
 * Medications and their records together, because a grid built from two reads
 * that resolved at different moments could render a medication with no row of
 * cells, or cells with no medication to hang them on. Either is a hole, and a
 * hole in a MAR chart is the thing this module exists to prevent.
 */
export function getMarRecords(
  residentId: ResidentId,
): Promise<{ medications: Medication[]; records: MarRecord[] }> {
  if (!residentById(residentId)) return reject(`No resident with id ${residentId}`)
  return resolve({
    medications: medicationsFor(residentId),
    records: marRecordsFor(residentId),
  })
}

export interface Omission {
  record: MarRecord
  medication: Medication
  resident: Resident
  /** When the dose was due. The sort key, and what "how long ago" measures. */
  dueAt: IsoDateTime
  escalatedAt: IsoDateTime | 'not_escalated'
}

/**
 * Every dose across a site with no record against it, oldest first.
 *
 * **One read, joined here.** A dose, its drug and its resident resolve
 * together or not at all — two reads settling separately could render a row
 * naming a medication and a time with no person attached to it, and on a
 * cross-resident medication screen that is the wrong-subject failure with a
 * dosage on it (§2.4).
 *
 * A record whose resident or medication cannot be resolved is dropped rather
 * than rendered subjectless. That is the one case where dropping is right:
 * a row that cannot say who it is about is not a weaker row, it is a
 * dangerous one.
 *
 * **Oldest first**, because the wait is the finding — the same ordering and
 * the same reason as the flagged care-note queue.
 */
export function getOmissions(
  siteId: SiteId,
  since: IsoDateTime,
): Promise<{ omissions: Omission[]; dueInRange: number }> {
  const refused = notYours(siteId, 'That home’s omissions')
  if (refused) return refused
  const atSite = residentsBySite(siteId)
  const byResident = new Map(atSite.map((resident) => [resident.id, resident]))
  const floor = new Date(since).getTime()

  let dueInRange = 0
  const omissions: Omission[] = []

  for (const record of marRecordsAll) {
    const resident = byResident.get(record.residentId)
    if (!resident) continue

    // One owner for "doses due" — the reports module counts the same
    // denominator over two periods and must not derive it a second time.
    const when = fellDueAt(record)
    if (when === 'not_due' || new Date(when).getTime() < floor) continue

    // The denominator: doses that actually fell due in the range. Not cells,
    // most of which are not_due, and not residents — an omission is a
    // fraction of doses (Rule 4).
    dueInRange += 1
    if (record.state.kind !== 'omitted') continue

    const medication = medicationsFor(record.residentId).find(
      (entry) => entry.id === record.medicationId,
    )
    if (!medication) continue

    omissions.push({
      record,
      medication,
      resident,
      dueAt: record.state.dueAt,
      escalatedAt:
        record.state.escalation.kind === 'escalated'
          ? record.state.escalation.at
          : 'not_escalated',
    })
  }

  omissions.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  return resolve({ omissions, dueInRange })
}

/**
 * Everything a medication round needs, in one read.
 *
 * Residents, their medications and the round's cells together, for the reason
 * every read on this module does it: a round assembled from three reads that
 * settled separately could put a dose in front of somebody with the wrong name
 * above it, and this is the screen where that is fatal (§2.4).
 */
/**
 * Every controlled drug at a site, with what the register holds for each.
 *
 * One read for the whole screen. The register is a home-level view — a
 * discrepancy is a finding about the home, not about one resident — while the
 * balance and the ledger are per drug, which is the same split `/care-notes`
 * has against a resident's timeline.
 */
export function getRegister(siteId: SiteId): Promise<{
  medications: Medication[]
  residents: Resident[]
  counts: StockCount[]
  movements: RegisterMovement[]
  records: MarRecord[]
}> {
  const refused = notYours(siteId, 'That home’s controlled drug register')
  if (refused) return refused
  const atSite = residentsBySite(siteId)
  const ids = new Set(atSite.map((resident) => resident.id))
  const controlled = atSite
    .flatMap((resident) => medicationsFor(resident.id))
    .filter((medication) => medication.isControlledDrug)
  const medicationIds = new Set(controlled.map((medication) => medication.id))

  return resolve({
    medications: controlled,
    residents: atSite,
    counts: patchedStockCounts().filter((count) =>
      medicationIds.has(count.medicationId),
    ),
    movements: registerMovements.filter((movement) =>
      medicationIds.has(movement.medicationId),
    ),
    records: patchedRecords().filter(
      (record) => ids.has(record.residentId) && medicationIds.has(record.medicationId),
    ),
  })
}

/**
 * Every incident at a site, newest first. PRD §6.5.
 *
 * One read for the log; the detail screen filters from the same set rather
 * than fetching alone, so a row and the screen it opens can never disagree
 * about what the record says.
 */
export function getIncidents(siteId: SiteId): Promise<{
  incidents: Incident[]
  residents: Resident[]
}> {
  const refused = notYours(siteId, 'The incidents of that home')
  if (refused) return refused
  const atSite = residentsBySite(siteId)
  const ids = new Set(atSite.map((resident) => resident.id))
  return resolve({
    // Read through this session's clearings, so a review discharged by a
    // re-score stops being owed on the screen that says it is owed.
    incidents: patchedIncidents()
      .filter((incident) => incident.siteId === siteId)
      .filter((incident) => {
        const resident = subjectResidentId(incident)
        return resident === 'none' || ids.has(resident)
      }),
    residents: atSite,
  })
}

/** One resident's incidents, for the profile's post-incident review block. */
export function getResidentIncidents(residentId: ResidentId): Promise<Incident[]> {
  if (!residentById(residentId)) {
    return reject(`No resident with id ${residentId}`)
  }
  return resolve(
    patchedIncidents().filter((incident) => subjectResidentId(incident) === residentId),
  )
}

/**
 * Records that a re-score discharged the reviews it was flagged for.
 *
 * Returns what it touched so the act can be undone as one act — a re-score
 * that closed two reviews must undo both, because undoing half would leave the
 * record saying a review was done that was not.
 */
export function recordReviewFlagsCleared(input: {
  residentId: ResidentId
  target: ClearableTarget
  by: StaffRef
  at: IsoDateTime
}): Promise<ClearingToken> {
  if (!residentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  return resolve(clearReviewFlags(input))
}

/** Puts them back. There is no backend to correct a mis-click. */
export function undoReviewFlagsCleared(token: ClearingToken): Promise<void> {
  undoClearing(token)
  return resolve(undefined)
}

/**
 * Saves an unsigned care plan draft for this session.
 *
 * Held in memory and gone on reload, and the screen that writes it says so.
 * What it changes on every other screen is deliberate: a domain nobody had
 * started now reads as part-written rather than never written, and a domain
 * with a signed version now carries a second fact beside it.
 */
export function saveCarePlanDraft(input: {
  residentId: ResidentId
  domainId: CarePlanDomainId
  text: CarePlanText
  by: StaffRef
  at: IsoDateTime
}): Promise<void> {
  if (!fixtureResidentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  saveDraft(input)
  return resolve(undefined)
}

/** Throws a draft away. An abandoned draft leaves no trace; nobody followed it. */
export function discardCarePlanDraft(
  residentId: ResidentId,
  domainId: CarePlanDomainId,
): Promise<void> {
  discardDraft(residentId, domainId)
  return resolve(undefined)
}

/**
 * Signs a version of a care plan domain for this session.
 *
 * Returns what it touched so the act can be undone as one act — the signature
 * and the draft it consumed together, because undoing half would leave the
 * record holding a version nobody signed or losing work somebody typed.
 */
export function finaliseCarePlanDomain(input: {
  residentId: ResidentId
  domainId: CarePlanDomainId
  text: CarePlanText
  by: StaffRef
  on: IsoDate
  nextReviewOn: IsoDate
}): Promise<FinaliseToken> {
  if (!fixtureResidentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  const token = finaliseDomain(input)
  return logged(token, {
    module: 'Care Plans',
    what: `Finalised a care plan domain for ${nameOf(input.residentId)}: ${input.domainId.replace(/_/g, ' ')}`,
    to: `/residents/${input.residentId}/care-plan/${input.domainId}`,
    by: input.by,
  })
}

/** Takes the signature back, and puts the draft back with it. */
export function undoCarePlanFinalise(token: FinaliseToken): Promise<void> {
  undoFinalise(token)
  return resolve(undefined)
}

/**
 * Records a whole care plan review for this session.
 *
 * `outstanding` is what was still a gap at the moment of signing, carried on
 * the record so the review can never later read as covering a complete plan.
 */
export function recordWholePlanReview(input: {
  residentId: ResidentId
  by: StaffRef
  on: IsoDate
  nextDueOn: IsoDate
  against: CompletedAgainst
  outstanding: CarePlanDomainId[]
}): Promise<WholePlanReviewToken> {
  if (!fixtureResidentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  return resolve(completeWholePlanReview(input))
}

/**
 * One resident's goals, oldest first.
 *
 * Empty is a real answer and the screen renders it as one: "nobody has set a
 * goal with this person" is a finding, not an empty list.
 */
export function getResidentGoals(
  residentId: ResidentId,
): Promise<{ goals: Goal[]; progress: GoalProgressNote[] }> {
  if (!fixtureResidentById(residentId)) {
    return reject(`No resident with id ${residentId}`)
  }
  const forResident = goalsFor(residentId)
  const ids = new Set(forResident.map((goal) => goal.id))
  return resolve({
    goals: forResident,
    progress: goalProgressNotes.filter((note) => ids.has(note.goalId)),
  })
}

/**
 * Activities at a site, with the residents they name.
 *
 * The residents come with them because every figure on these screens counts
 * over the invitation list, and a row that cannot name its resident is the
 * wrong-subject failure with a grid around it.
 */
export function getActivities(
  siteId: SiteId,
): Promise<{ activities: Activity[]; residents: Resident[] }> {
  const refused = notYours(siteId, 'That home’s activities')
  if (refused) return refused
  return resolve({
    /*
     * Through this session's writes, so a session planned or cancelled a
     * moment ago is on the calendar that the planning screen navigated back
     * to. A read that saw the fixtures only would show a screen half its own
     * session, which is the two-clocks failure with a router in it.
     */
    activities: activitiesAt(siteId),
    residents: residentsBySite(siteId),
  })
}

/** One session, with everybody it names. */
export function getActivity(
  id: ActivityId,
): Promise<{ activity: Activity; residents: Resident[] }> {
  const fromFixtures = activityById(id)
  const activity =
    fromFixtures === undefined
      ? activitiesAt('site-rosewood-court')
          .concat(activitiesAt('site-ashgrove-lodge'))
          .find((entry) => entry.id === id)
      : withActivityEdits(fromFixtures)
  if (!activity) return reject(`No activity with id ${id}`)
  return resolve({ activity, residents: residentsBySite(activity.siteId) })
}

/** Every goal at a site, with its progress, for the queue. */
export function getGoalsBySite(siteId: SiteId): Promise<{
  residents: Resident[]
  goals: Goal[]
  progress: GoalProgressNote[]
}> {
  const refused = notYours(siteId, 'The goals of that home')
  if (refused) return refused
  const atSite = residentsBySite(siteId)
  const ids = new Set(atSite.map((resident) => resident.id))
  const inScope = goals.filter((goal) => ids.has(goal.residentId))
  const goalIds = new Set(inScope.map((goal) => goal.id))
  return resolve({
    residents: atSite,
    goals: inScope,
    progress: goalProgressNotes.filter((note) => goalIds.has(note.goalId)),
  })
}

/**
 * A resident's document library.
 *
 * The resident comes with it because every screen that renders a document
 * names the subject it belongs to, and because the gaps are derived from the
 * rest of the resident's record rather than from the documents alone.
 */
export function getResidentDocuments(
  residentId: ResidentId,
): Promise<{ resident: Resident; documents: DocumentRecord[] }> {
  const resident = fixtureResidentById(residentId)
  if (!resident) return reject(`No resident with id ${residentId}`)
  const refused = notYoursResident(resident)
  if (refused) return refused
  return resolve({ resident, documents: residentDocuments(residentId) })
}

/** Every document at a site, the residents' and the home's own. */
export function getSiteDocuments(siteId: SiteId): Promise<{
  documents: DocumentRecord[]
  residents: Resident[]
}> {
  const refused = notYours(siteId, 'The documents of that home')
  if (refused) return refused
  return resolve({
    documents: siteDocuments(siteId),
    residents: residentsBySite(siteId),
  })
}

/**
 * Files a document for this session.
 *
 * **Metadata only, and the type says so.** `file` is `not_retrievable`
 * because there is nothing to retrieve: no upload happened, no bytes exist,
 * and the row this produces will say that where a reader can see it. Naming
 * the format is still worth doing — it is what the person filing it chose, and
 * it is the difference between "a document" and "a PDF nobody can open here".
 */
export function fileDocument(input: {
  owner: DocumentRecord['owner']
  category: DocumentCategoryId
  title: string
  format: string
  expiry: ExpiryDecision
  filedBy: StaffRef
  filedOn: IsoDate
}): Promise<DocumentRecord> {
  const file: FileFacts = { kind: 'not_retrievable', format: input.format }
  return resolve(
    addSessionDocument({
      id: nextSessionDocumentId(),
      owner: input.owner,
      category: input.category,
      title: input.title,
      file,
      expiry: input.expiry,
      filedBy: input.filedBy,
      filedOn: input.filedOn,
    }),
  )
}

/**
 * Admits a resident. PRD §6.7, Phase 16.
 *
 * **The record it creates is almost entirely gaps, and that is correct.** Every
 * module already renders somebody in exactly this state — Ismail Sowande has
 * been that resident since Phase 0 — so nothing downstream needs a special
 * case for a person admitted a minute ago.
 */
export function admit(input: AdmissionInput): Promise<Resident> {
  if (input.fullLegalName.trim() === '') {
    return reject('A resident cannot be admitted without a legal name')
  }
  const resident = admitResident(input)
  return logged(resident, {
    module: 'Residents',
    what: `Admitted ${resident.fullLegalName} to ${input.siteId === 'site-ashgrove-lodge' ? 'Ashgrove Lodge' : 'Rosewood Court'}`,
    to: `/residents/${resident.id}`,
    by: input.admittedBy,
  })
}

/**
 * Changes one field on one resident.
 *
 * **One field, one act, one author.** A bulk save attributing six changes to
 * one signature is the wrong shape for a clinical record, so this takes a patch
 * of one field and the log records it as one thing.
 */
export function editResident(input: {
  residentId: ResidentId
  field: string
  patch: Partial<Resident>
  by: StaffRef
}): Promise<Resident> {
  const resident = residentById(input.residentId)
  if (!resident) return reject(`No resident with id ${input.residentId}`)

  editResidentField(input.residentId, input.patch)
  const updated = residentById(input.residentId)
  if (!updated) return reject(`No resident with id ${input.residentId}`)

  return logged(updated, {
    module: 'Residents',
    what: `Recorded ${input.field} for ${updated.fullLegalName}`,
    to: `/residents/${updated.id}`,
    by: input.by,
  })
}

/**
 * Records a risk assessment. PRD §6.6, Phase 16.
 *
 * **The level is what the badge strip and the profile header read**, and an
 * unscored assessment still reaches one — somebody looked and formed a
 * judgement. What it lacks is arithmetic, which is why `score` is a union.
 */
export function recordAssessment(input: {
  residentId: ResidentId
  templateId: RiskTemplateId
  level: RiskLevel
  score: RiskScore
  by: StaffRef
  at: IsoDateTime
}): Promise<Resident> {
  const resident = residentById(input.residentId)
  if (!resident) return reject(`No resident with id ${input.residentId}`)

  editResidentField(input.residentId, {
    risks: {
      ...resident.risks,
      [input.templateId]: {
        kind: 'assessed',
        level: input.level,
        score: input.score,
        assessedAt: input.at,
        assessedBy: input.by,
        reviewState: { kind: 'scheduled', dueOn: nextReviewFrom(input.at) },
      },
    },
  })

  const updated = residentById(input.residentId)
  if (!updated) return reject(`No resident with id ${input.residentId}`)
  return logged(updated, {
    module: 'Risk Assessments',
    what: `Assessed ${input.templateId.replace(/_/g, ' ')} for ${updated.fullLegalName}: ${input.level}`,
    to: `/residents/${updated.id}/risk-assessments`,
    by: input.by,
  })
}

/**
 * Withdraws a consent. PRD §6.7, Phase 16.
 *
 * **The effects it could not undo are carried onto the record**, derived at the
 * moment of withdrawal rather than remembered afterwards — which is what makes
 * "fourteen photographs are still on file" a fact somebody can act on rather
 * than a sentence in a note.
 */
export function withdrawConsent(input: {
  residentId: ResidentId
  consentType: ConsentTypeId
  note: string
  remains: DownstreamEffect[]
  by: StaffRef
  on: IsoDate
}): Promise<Resident> {
  const resident = residentById(input.residentId)
  if (!resident) return reject(`No resident with id ${input.residentId}`)

  const current = resident.consents[input.consentType] as AnyConsent
  if (current.kind !== 'given') {
    return reject('Only a consent that was given can be withdrawn')
  }

  editResidentField(input.residentId, {
    consents: {
      ...resident.consents,
      [input.consentType]: {
        kind: 'withdrawn',
        on: input.on,
        note: input.note,
        previouslyGivenOn: current.on,
        recordedBy: input.by,
        by: current.by,
        remains: input.remains,
      },
    } as Resident['consents'],
  })

  const updated = residentById(input.residentId)
  if (!updated) return reject(`No resident with id ${input.residentId}`)
  return logged(updated, {
    module: 'Consent',
    what: `Withdrew ${input.consentType.replace(/_/g, ' ')} consent for ${updated.fullLegalName}`,
    to: `/residents/${updated.id}/consent`,
    by: input.by,
  })
}

/**
 * Recording a consent decision. PRD §6.6e, Phase 10, finished in Phase 21.
 *
 * **The module could only take consent away.** `withdrawConsent` has existed
 * since Phase 10 and nothing has ever been able to record one as given,
 * refused or sought: the capacity gate collected an assessment and wrote
 * nothing. It was found by asking what AM v2.0's Family Portal setup screen
 * writes — the answer is this consent, and the act did not exist.
 *
 * Recorded here as Phase 10 work finished late rather than as Phase 21 scope,
 * so the phase notes stay true about what each phase actually delivered.
 *
 * **The authority carries its own assessment, which is why there is no
 * assessment store.** `DecisionAuthority` holds a `CapacityAssessment<K>`
 * whose `covers` must name this consent type, so an assessment made about
 * photography cannot authorise a family-portal consent and the compiler is
 * what says so. Nothing needs to look the assessment up later; it is part of
 * the record it authorised.
 */
export function recordConsent<K extends ConsentTypeId>(input: {
  residentId: ResidentId
  consentType: K
  outcome: { kind: 'given'; method: ConsentMethod } | { kind: 'refused'; note: string }
  authority: DecisionAuthority<K>
  by: StaffRef
  on: IsoDate
}): Promise<Resident> {
  const resident = residentById(input.residentId)
  if (!resident) return reject(`No resident with id ${input.residentId}`)

  const current = resident.consents[input.consentType] as AnyConsent
  if (current.kind === 'given' || current.kind === 'refused')
    return reject(
      `${resident.fullLegalName} already has a ${input.consentType.replace(/_/g, ' ')} decision on record; withdraw it to change it.`,
    )

  const status: ConsentStatus<K> =
    input.outcome.kind === 'given'
      ? {
          kind: 'given',
          on: input.on,
          method: input.outcome.method,
          recordedBy: input.by,
          by: input.authority,
        }
      : {
          kind: 'refused',
          on: input.on,
          note: input.outcome.note,
          recordedBy: input.by,
          by: input.authority,
        }

  editResidentField(input.residentId, {
    consents: {
      ...resident.consents,
      [input.consentType]: status,
    } as Resident['consents'],
  })

  const updated = residentById(input.residentId)
  if (!updated) return reject(`No resident with id ${input.residentId}`)
  return logged(updated, {
    module: 'Consent',
    what: `Recorded ${input.consentType.replace(/_/g, ' ')} consent as ${input.outcome.kind} for ${updated.fullLegalName}`,
    to: `/residents/${updated.id}/consent`,
    by: input.by,
  })
}

/** Takes it back. There is no backend to correct a mis-click. */
export function undoWholePlanReviewRecord(token: WholePlanReviewToken): Promise<void> {
  undoWholePlanReview(token)
  return resolve(undefined)
}

export function getRound(
  siteId: SiteId,
): Promise<{ residents: Resident[]; medications: Medication[]; records: MarRecord[] }> {
  const refused = notYours(siteId, 'That home’s medication round')
  if (refused) return refused
  const atSite = residentsBySite(siteId)
  const ids = new Set(atSite.map((resident) => resident.id))
  return resolve({
    residents: atSite,
    medications: atSite.flatMap((resident) => medicationsFor(resident.id)),
    records: patchedRecords().filter((record) => ids.has(record.residentId)),
  })
}

/**
 * Records a whole resident's round in one act.
 *
 * **One write, not one per dose.** A nurse signs for the doses in front of
 * them together; recording them one at a time would allow a half-signed round
 * — some doses attributed, some not — which is a state nobody chose and the
 * MAR grid would render as a mix of given and omitted.
 *
 * The signer and the moment come from the session and the clock.
 *
 * **Refused if the round is short a dose.** The expected set is derived here,
 * from the same medications and records the round was built from, rather than
 * taken from the caller — a caller that omits an unanswered dose would
 * otherwise record a complete-looking round that is missing one, and the MAR
 * grid would show the missing one as an omission with nobody's name on it.
 *
 * Also refused if a not-given has no reason, or if a controlled drug is short
 * a witness. The UI disables the button before any of these; this refuses
 * anyway, because a disabled button is a courtesy and this is the rule.
 */
/**
 * What a drug is standing at, or that nobody has counted it.
 *
 * The app's only way to ask. Reads through this session's counts, so an
 * opening balance recorded a minute ago is the balance the next dose
 * reconciles against.
 */
export function stockBalanceFor(medicationId: MedicationId): StockBalance {
  return balanceWithSession(medicationId)
}

/**
 * An opening balance for a controlled drug the register has never held one for.
 *
 * Two signatures, and they must be two people. No expected figure, because
 * there is nothing yet to expect — that absence is what makes it opening
 * rather than routine, and it is why `expected` lives inside `StockCount`'s
 * entry union.
 */
export function recordOpeningCount(input: {
  medicationId: MedicationId
  counted: number
  countedBy: StaffRef
  witnessedBy: StaffRef
  at: IsoDateTime
}): Promise<void> {
  if (!Number.isInteger(input.counted) || input.counted < 0) {
    return reject('An opening balance must be a whole number of doses')
  }
  if (input.countedBy.id === input.witnessedBy.id) {
    return reject('A stock count needs two different people')
  }
  if (balanceWithSession(input.medicationId).kind === 'counted') {
    // Not a validation nicety: a second "opening" balance would rewrite where
    // the running total started and silently absorb whatever went missing
    // between the two.
    return reject('This drug already has a balance; an opening count cannot replace it')
  }
  appendStockCount({
    medicationId: input.medicationId,
    countedAt: input.at,
    countedBy: input.countedBy,
    witnessedBy: input.witnessedBy,
    entry: { kind: 'opening' },
    counted: input.counted,
  })
  return resolve(undefined)
}

/**
 * The doses still open at a round: due, omitted, or never reached.
 *
 * **Exported because the guard for the round has to ask the round.** A test
 * that decided for itself which doses were outstanding would be a second copy
 * of this rule, and the two drift the moment a state is added. Read from the
 * patched records rather than the fixtures, so a dose already signed for is not
 * demanded a second time, and it is the same derivation `buildRound` makes.
 */
export function openDosesAt(
  residentId: ResidentId,
  date: string,
  roundTime: string,
): MedicationId[] {
  const open = new Set(
    patchedRecords()
      .filter(
        (record) =>
          record.residentId === residentId &&
          record.date === date &&
          record.roundTime === roundTime &&
          record.state.kind !== 'given' &&
          record.state.kind !== 'not_given',
      )
      .map((record) => record.medicationId),
  )
  return medicationsFor(residentId)
    .filter(
      (medication) =>
        !medication.isPrn &&
        medication.roundTimes.includes(roundTime) &&
        open.has(medication.id),
    )
    .map((medication) => medication.id)
}

export function recordRound(input: {
  residentId: ResidentId
  date: IsoDate
  roundTime: string
  doses: { medicationId: MedicationId; state: MarCellState }[]
  /**
   * Opening balances taken during this round, one per controlled drug the
   * register had no balance for.
   */
  openingCounts: {
    medicationId: MedicationId
    counted: number
    witnessedBy: StaffRef
  }[]
  by: StaffRef
  at: IsoDateTime
}): Promise<number> {
  if (!residentById(input.residentId)) {
    return reject(`No resident with id ${input.residentId}`)
  }
  if (input.doses.length === 0) return reject('A round with no doses is not a round')

  // Every dose at this round, on this date, that nobody has recorded yet.
  const expected = openDosesAt(input.residentId, input.date, input.roundTime)

  const answered = new Set(input.doses.map((dose) => dose.medicationId))
  const missing = expected.filter((id) => !answered.has(id))
  if (missing.length > 0) {
    return reject(
      `This round is short ${missing.length} of ${expected.length} doses: answer every dose before recording it.`,
    )
  }

  for (const dose of input.doses) {
    if (
      dose.state.kind === 'given' &&
      dose.state.witness.kind === 'required_not_recorded'
    ) {
      return reject('A controlled drug cannot be recorded without its second signature')
    }
    if (
      dose.state.kind === 'not_given' &&
      dose.state.reason === 'other' &&
      dose.state.note.trim() === ''
    ) {
      return reject('Not given without a reason is not a record')
    }
  }

  // A controlled drug given against a register with no balance needs an
  // opening count in the same act. Refused here as well as disabled in the UI:
  // without it the drug's running total starts at whatever the next count
  // happens to say, with the doses before it unaccounted for.
  const opening = new Map(
    input.openingCounts.map((count) => [count.medicationId, count]),
  )
  for (const dose of input.doses) {
    if (dose.state.kind !== 'given') continue
    if (dose.state.witness.kind === 'not_required') continue
    if (balanceWithSession(dose.medicationId).kind === 'counted') continue
    if (!opening.has(dose.medicationId)) {
      return reject(
        'A controlled drug with no balance on the register cannot be signed for without an opening count',
      )
    }
  }

  for (const count of input.openingCounts) {
    if (count.witnessedBy.id === input.by.id) {
      return reject('A stock count needs two different people')
    }
    appendStockCount({
      medicationId: count.medicationId,
      countedAt: input.at,
      countedBy: input.by,
      witnessedBy: count.witnessedBy,
      entry: { kind: 'opening' },
      counted: count.counted,
    })
  }

  for (const dose of input.doses) {
    recordAdministration(dose.medicationId, input.date, input.roundTime, dose.state)
  }
  return resolve(input.doses.length)
}

/**
 * Records a PRN dose. PRD §6.4: "PRN requires reason, symptom, and outcome."
 *
 * The outcome is **not** captured here, and that is the point: it has not
 * happened yet. It starts `not_recorded` — a real state that renders as a gap
 * — because a PRN given with nobody checking what it did is exactly the thing
 * a blank would hide.
 */
export function recordPrn(input: {
  residentId: ResidentId
  medicationId: MedicationId
  reason: string
  symptom: string
  by: StaffRef
  at: IsoDateTime
}): Promise<PrnAdministration> {
  if (input.reason.trim() === '') return reject('A PRN dose needs a reason')
  if (input.symptom.trim() === '') return reject('A PRN dose needs a symptom')
  return resolve(
    appendPrn({
      residentId: input.residentId,
      medicationId: input.medicationId,
      reason: input.reason.trim(),
      symptom: input.symptom.trim(),
      givenBy: input.by,
      givenAt: input.at,
      outcome: { kind: 'not_recorded' },
      note: 'none',
    }),
  )
}

/** What a PRN dose did. The follow-up write the other two answers do not have. */
export function recordPrnOutcomeFor(input: {
  id: string
  text: string
  at: IsoDateTime
}): Promise<void> {
  if (input.text.trim() === '') return reject('An outcome cannot be empty')
  if (!recordPrnOutcome(input.id, input.text.trim(), input.at)) {
    return reject(`No PRN dose with id ${input.id}`)
  }
  return resolve(undefined)
}

/**
 * PRN doses given during this session.
 *
 * **Synchronous, like `reviewRecordedThisSession`.** It is a question about
 * what this browser tab did a moment ago, not about the record: against a real
 * backend it would come back on the response to the write rather than a fetch,
 * and dressing it as a read of the care record would be a lie about where it
 * lives.
 */
export function prnGivenThisSession(residentId: ResidentId): PrnAdministration[] {
  return prnFor(residentId)
}

export function getMedications(residentId: ResidentId): Promise<Medication[]> {
  return resolve(medicationsFor(residentId))
}

export function getMedicationsDueSoon(residentId: ResidentId): Promise<MarRecord[]> {
  return resolve(dueWithinLookahead(residentId))
}

/**
 * What the residents list needs, in one read rather than 33.
 *
 * `latestNote` is `'none'`, never `undefined` — "this resident has never been
 * written up" is a real answer and one the list exists to surface, so it
 * cannot be the same shape as "we did not fetch it".
 */
export interface ResidentSummary {
  resident: Resident
  latestNote: CareNote | 'none'
}

/**
 * Everything the profile header needs, in one read. PRD §6.2, §16.3.
 *
 * Bundled rather than fetched per-panel because the header is a single
 * subject statement: a version of it where the name has loaded but the
 * allergies have not is a header that can be misread, and §2.4 makes
 * misreading the subject the second-worst failure available.
 */
export interface DueMedication {
  medication: Medication
  record: MarRecord
}

export interface ResidentProfile {
  resident: Resident
  /** The resident's own site — whose timezone their records render in. */
  site: Site
  latestNote: CareNote | 'none'
  /** Empty is a real answer: nothing is due. The header says so in words. */
  dueSoon: DueMedication[]
}

export function getResidentProfile(id: ResidentId): Promise<ResidentProfile> {
  const resident = residentById(id)
  if (!resident) return reject(`No resident with id ${id}`)
  const refused = notYoursResident(resident)
  if (refused) return refused

  const site = sites.find((entry) => entry.id === resident.siteId)
  if (!site) return reject(`Resident ${id} belongs to an unknown site`)

  const byId = new Map(medicationsFor(resident.id).map((med) => [med.id, med]))
  const dueSoon = dueWithinLookahead(resident.id).flatMap((record) => {
    const medication = byId.get(record.medicationId)
    return medication ? [{ medication, record }] : []
  })

  return resolve({
    resident,
    site,
    latestNote: latestNoteFor(resident.id) ?? 'none',
    dueSoon,
  })
}

export function getResidentSummaries(
  scope: SiteId | 'all',
): Promise<ResidentSummary[]> {
  /*
   * **`'all'` is not a home, so it is not refused here.** The only screen
   * asking for it is the group overview, which is Admin-only and already
   * gated; a specific home is checked like any other record.
   */
  if (scope !== 'all') {
    const refused = notYours(scope, 'The residents of that home')
    if (refused) return refused
  }
  const inScope = scope === 'all' ? residents() : residentsBySite(scope)
  return resolve(
    inScope.map((resident) => ({
      resident,
      latestNote: latestNoteFor(resident.id) ?? 'none',
    })),
  )
}
