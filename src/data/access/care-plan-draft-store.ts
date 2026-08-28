import { held, type SessionHolding } from './session-holding'
import type {
  CarePlanDomainId,
  CarePlanDomainRecord,
  CarePlanText,
  CarePlanVersion,
  IsoDate,
  IsoDateTime,
  Resident,
  ResidentId,
  StaffRef,
} from '../types'

/**
 * Care plan drafts and signatures made during this session. PRD §6.7.
 *
 * **Why this exists rather than a screen that keeps its own text.** The state
 * this module is built around is a signed plan with an unsigned rewrite on top
 * of it — an instruction staff are following today, and a revision nobody has
 * agreed. Until this store, that state was reachable only from a fixture, and
 * **a state reachable only from a fixture is one nobody can get to by doing
 * the work.** It is also the state most likely to be got wrong in a real
 * build, because it is the one where a reader most needs to see both halves.
 *
 * Same discipline as `mar-store`, `note-store`, `handover-store` and
 * `review-flag-store`: in memory, never touching the fixtures, gone on reload,
 * and every screen that writes through it says so.
 *
 * ## Why saving and signing live in one store
 *
 * They are two writes to the same record, and signing **consumes** the draft.
 * Split across two stores there would be two ways for a domain to end up
 * saying it has a draft over a version that draft already became.
 */

const key = (residentId: ResidentId, domainId: CarePlanDomainId) =>
  `${residentId}|${domainId}`

interface SessionDraft {
  text: CarePlanText
  by: StaffRef
  at: IsoDateTime
}

interface SessionSignatures {
  versions: CarePlanVersion[]
  nextReviewOn: IsoDate
}

const drafts = new Map<string, SessionDraft>()
const signatures = new Map<string, SessionSignatures>()

/**
 * Saves an unsigned draft.
 *
 * Overwrites rather than accumulating: a draft is one person's working copy of
 * one domain, not a history. **A history of intentions is not a history of
 * instructions**, which is the same reason it never reaches the version list.
 */
export function saveDraft(input: {
  residentId: ResidentId
  domainId: CarePlanDomainId
  text: CarePlanText
  by: StaffRef
  at: IsoDateTime
}): void {
  drafts.set(key(input.residentId, input.domainId), {
    text: input.text,
    by: input.by,
    at: input.at,
  })
}

/**
 * Throws the draft away.
 *
 * **An abandoned draft leaves no trace, and that is correct rather than a
 * gap** — nobody followed it. The signed version underneath is untouched, so a
 * domain that had one goes back to reading exactly as it did.
 */
export function discardDraft(residentId: ResidentId, domainId: CarePlanDomainId): void {
  drafts.delete(key(residentId, domainId))
}

/** What one act of signing touched, so it can be undone as one act. */
export interface FinaliseToken {
  key: string
  /** The draft it consumed, put back on undo. */
  restored: SessionDraft | 'none'
}

/**
 * Signs a version, and consumes the draft it was written from.
 *
 * The draft does not survive, because it *became* the version — leaving it in
 * place would show a domain carrying a rewrite of the thing that rewrite
 * already is.
 */
export function finaliseDomain(input: {
  residentId: ResidentId
  domainId: CarePlanDomainId
  text: CarePlanText
  by: StaffRef
  on: IsoDate
  nextReviewOn: IsoDate
}): FinaliseToken {
  const id = key(input.residentId, input.domainId)
  const existing = signatures.get(id)
  const version: CarePlanVersion = {
    ...input.text,
    finalisedBy: input.by,
    finalisedOn: input.on,
  }

  signatures.set(id, {
    versions: [...(existing?.versions ?? []), version],
    nextReviewOn: input.nextReviewOn,
  })

  const restored = drafts.get(id) ?? 'none'
  drafts.delete(id)
  return { key: id, restored }
}

/**
 * Takes the signature back, and puts the draft back with it.
 *
 * Undoing one half would leave the record holding a version nobody signed, or
 * losing work somebody typed. There is no backend to correct a mis-click.
 */
export function undoFinalise(token: FinaliseToken): void {
  const existing = signatures.get(token.key)
  if (existing) {
    const versions = existing.versions.slice(0, -1)
    if (versions.length === 0) signatures.delete(token.key)
    else signatures.set(token.key, { ...existing, versions })
  }
  if (token.restored !== 'none') drafts.set(token.key, token.restored)
}

/**
 * One resident, with this session's care plan edits applied.
 *
 * Returns the resident unchanged — same object — when nothing has been
 * written, so every read in the app can go through this without paying for it.
 */
export function withSessionCarePlan(resident: Resident): Resident {
  const touched = resident.carePlan.some((domain) => {
    const id = key(resident.id, domain.domainId)
    return drafts.has(id) || signatures.has(id)
  })
  if (!touched) return resident

  return {
    ...resident,
    carePlan: resident.carePlan.map((domain) => patch(resident.id, domain)),
  }
}

function patch(
  residentId: ResidentId,
  domain: CarePlanDomainRecord,
): CarePlanDomainRecord {
  const id = key(residentId, domain.domainId)
  let patched = domain

  const signed = signatures.get(id)
  if (signed) {
    const history = [
      ...(domain.versions.kind === 'finalised' ? domain.versions.history : []),
      ...signed.versions,
    ] as [CarePlanVersion, ...CarePlanVersion[]]
    const current = history[history.length - 1]!

    patched = {
      ...patched,
      // Signed today, so it is in date whatever it was before — including
      // where the review was overdue, which is what finalising is *for*.
      status: {
        kind: 'complete',
        finalisedBy: current.finalisedBy,
        finalisedOn: current.finalisedOn,
        nextReviewOn: signed.nextReviewOn,
      },
      summary: current.currentNeeds,
      versions: { kind: 'finalised', history },
    }
  }

  const draft = drafts.get(id)
  if (draft) {
    patched = {
      ...patched,
      draft: {
        kind: 'draft',
        ...draft.text,
        updatedBy: draft.by,
        updatedAt: draft.at,
      },
      /*
       * A draft over a signed plan does **not** move the status.
       *
       * The signed version is still the instruction staff follow today; the
       * draft is a second fact beside it, not a replacement for it. Only a
       * domain with nothing signed becomes `in_progress`, because there the
       * draft is the only thing there is.
       */
      status:
        patched.status.kind === 'not_started'
          ? { kind: 'in_progress', updatedBy: draft.by, updatedAt: draft.at }
          : patched.status,
    }
  }

  return patched
}

/** Test hook. Nothing in the app calls this. */
/**
 * What this store would lose.
 *
 * A draft and a finalised domain are counted apart: one is unfinished writing
 * and the other is a signed clinical document, and losing them are not the
 * same loss.
 */
export function carePlanHoldings(): SessionHolding[] {
  return [
    ...held('care plan drafts you saved but did not finalise', drafts.size),
    ...held('care plan domains you finalised and signed', signatures.size),
  ]
}

export function resetSessionCarePlan(): void {
  drafts.clear()
  signatures.clear()
}
