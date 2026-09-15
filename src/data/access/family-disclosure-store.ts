import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  CareNoteId,
  IncidentId,
  IsoDateTime,
  ResidentId,
  StaffRef,
} from '../types'

/**
 * What was disclosed to a family, by whom, and when. AM v2.0 FAM-02 and
 * FAM-03, Phase 21.
 *
 * **Append-only, and never a property of the thing disclosed.** A care note is
 * immutable; sharing one is not an edit to it but a new record *about* it. And
 * un-sharing is a second record superseding the first rather than an erasure:
 * **a note that was visible to a family for three weeks was disclosed**, and a
 * boolean flipped back to `false` destroys that fact entirely. Current
 * visibility is derived from the latest entry, the way a MAR cell derives its
 * state rather than storing it.
 *
 * **One log for notes and incidents, not two mechanisms.** A family message on
 * an incident is a disclosure, not a review finding — which is also what stops
 * it quietly becoming a field on `ManagerReview` later, where it would be
 * indistinguishable from the manager's conclusions.
 *
 * **Nothing here reaches a family.** The Family Portal is a separate product
 * that this build does not contain: no email is sent, no notification arrives,
 * and un-sharing removes nothing from anywhere, because nothing was ever
 * shown. What this records is a decision, and the screens say so at the moment
 * of the act rather than behind a link — see `family-statement.ts`.
 */

export type DisclosureSubject =
  | { kind: 'care_note'; noteId: CareNoteId }
  | {
      kind: 'incident'
      incidentId: IncidentId
      /**
       * Plain language, for the family, and never the clinical record.
       *
       * AM v2.0's INC-01 is explicit: the family see this message and not the
       * incident. "Emmanuel had a fall this afternoon, he was checked by the
       * nurse and is comfortable" rather than "Fall: unwitnessed. Moderate
       * harm. Root cause: environmental."
       */
      message: string
    }

export interface Disclosure {
  id: string
  residentId: ResidentId
  subject: DisclosureSubject
  /** Superseded by a later entry about the same subject, never removed. */
  decision: 'shared' | 'withdrawn'
  by: StaffRef
  at: IsoDateTime
}

const log: Disclosure[] = []
let shared = 0
let withdrawn = 0

const key = (subject: DisclosureSubject): string =>
  subject.kind === 'care_note'
    ? `note:${subject.noteId}`
    : `incident:${subject.incidentId}`

/** Every decision about this subject, oldest first. The history, entire. */
export function disclosureHistory(subject: DisclosureSubject): Disclosure[] {
  return log.filter((entry) => key(entry.subject) === key(subject))
}

/**
 * What stands now, derived from the latest entry rather than stored.
 *
 * `undefined` where nobody has ever decided, which is not the same as somebody
 * having withdrawn: one is a question nobody asked and the other is an answer.
 */
export function currentDisclosure(subject: DisclosureSubject): Disclosure | undefined {
  const history = disclosureHistory(subject)
  return history[history.length - 1]
}

export const isSharedWithFamily = (subject: DisclosureSubject): boolean =>
  currentDisclosure(subject)?.decision === 'shared'

function record(
  residentId: ResidentId,
  subject: DisclosureSubject,
  decision: 'shared' | 'withdrawn',
  by: StaffRef,
): Disclosure {
  const entry: Disclosure = {
    id: `disc-${String(log.length + 1).padStart(3, '0')}`,
    residentId,
    subject,
    decision,
    by,
    at: appNow().toISOString() as IsoDateTime,
  }
  log.push(entry)
  if (decision === 'shared') shared += 1
  else withdrawn += 1
  return entry
}

export function share(
  residentId: ResidentId,
  subject: DisclosureSubject,
  by: StaffRef,
): Disclosure {
  if (isSharedWithFamily(subject))
    throw new Error(
      'This is already shared. A second sharing would add an entry saying nothing changed.',
    )
  if (subject.kind === 'incident' && subject.message.trim() === '')
    throw new Error(
      'A family message with nothing in it is a disclosure of nothing. Write what the family are being told, in plain language.',
    )
  return record(residentId, subject, 'shared', by)
}

/**
 * Stop sharing, which does not unsay it.
 *
 * The entry is appended rather than the earlier one removed, because the
 * earlier one is the record that a family could see this, and for how long.
 */
export function withdrawSharing(
  residentId: ResidentId,
  subject: DisclosureSubject,
  by: StaffRef,
): Disclosure {
  if (!isSharedWithFamily(subject))
    throw new Error('This is not shared, so there is nothing to stop sharing.')
  return record(residentId, subject, 'withdrawn', by)
}

export function disclosureHoldings(): SessionHolding[] {
  return [
    ...held('things you shared with a family', shared),
    ...held('things you stopped sharing', withdrawn),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionDisclosures(): void {
  log.length = 0
  shared = 0
  withdrawn = 0
}
