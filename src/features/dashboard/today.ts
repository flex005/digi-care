import type {
  CareNote,
  Incident,
  IsoDate,
  IsoDateTime,
  Medication,
  Resident,
  Site,
} from '@/data/types'
import {
  getCareNotesForSite,
  getIncidents,
  getOmissions,
  type Omission,
} from '@/data/access/client'
import { boardFor } from '@/data/access/handover-store'
import {
  dueWithinLookahead,
  medicationsFor,
  type MarRecord,
} from '@/data/fixtures/medications'
import { projectReviews, type Reviewable } from '@/features/reviews/projection'
import { formatDate, zonedDate } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import type { HandoverSession } from '@/data/types'

/**
 * What is late, what is about to be, and who nobody has written up. Phase 12.
 *
 * **Deadline-shaped, over today.** The compliance panels ask what this record
 * can evidence; this asks what has to happen before the end of the shift. The
 * two share the machinery and share no figure — a compliance percentage on the
 * front door would be the reassurance this product exists to refuse, and it
 * would be most reassuring exactly when the record is thinnest.
 */

/** How far back the Dashboard looks for doses nobody recorded. */
export const LATE_DOSE_WINDOW_HOURS = 24

/**
 * When something should have happened — and **what kind of instant that is**.
 *
 * A dose is due at 12:00 on a day; a review is due *on* a day and at no time
 * in particular. Widening the second into the first printed "01:00 BST"
 * against every overdue review on this screen — midnight UTC, rendered through
 * the site's zone, an hour nobody recorded and nobody could act on.
 *
 * That is the third time this class has landed in this build, so it is a union
 * rather than a convention: the column cannot render a date as a time, because
 * a date does not have one.
 */
export type Deadline =
  { kind: 'instant'; at: IsoDateTime } | { kind: 'date'; on: IsoDate }

/** The sort key, in a form the two members can be compared on. */
// instant-ok: a sort key and an elapsed-time argument, never rendered as a time
export const deadlineKey = (deadline: Deadline): string =>
  deadline.kind === 'instant' ? deadline.at : `${deadline.on}T00:00:00.000Z`

/**
 * Which module a late thing came from.
 *
 * Carried on the row rather than derived from its wording, because the filter
 * has to agree with the count beside it: a pill that decided membership by
 * reading the label would be a second rule, and the two would drift the first
 * time a label changed.
 */
export type LateKind = 'dose' | 'review' | 'handover'

export interface LateItem {
  id: string
  kind: LateKind
  /** What the row is ordered by: when this should have happened. */
  due: Deadline
  what: string
  who: string
  /** The state, in the row's own words: "no record", "2 days late". */
  state: string
  detail: string
  to: string
  actionLabel: string
}

export interface UnwrittenResident {
  resident: Resident
  /** The last note this person has, or the fact that there has never been one. */
  last: { kind: 'note'; note: CareNote } | { kind: 'never' }
}

export interface Today {
  site: Site
  now: IsoDateTime
  residents: Resident[]
  /** Every care note at this site — the seven-day series is counted from it. */
  notes: CareNote[]
  /** Every incident, not only the unacknowledged: the series needs both. */
  incidents: Incident[]
  lateDoses: Omission[]
  dueSoon: { record: MarRecord; medication: Medication; resident: Resident }[]
  overdueReviews: Reviewable[]
  unsignedHandovers: HandoverSession[]
  unacknowledged: Incident[]
  incidentsTotal: number
  unwritten: UnwrittenResident[]
  late: LateItem[]
}

export async function loadToday(site: Site, now: IsoDateTime): Promise<Today> {
  const since = new Date(
    new Date(now).getTime() - LATE_DOSE_WINDOW_HOURS * 3_600_000,
  ).toISOString() as IsoDateTime

  const [omissions, incidents, notes] = await Promise.all([
    getOmissions(site.id, since),
    getIncidents(site.id),
    getCareNotesForSite(site.id),
  ])

  const residents = incidents.residents
  const today = zonedDate(now, site.timeZone)

  const dueSoon = residents.flatMap((resident) =>
    dueWithinLookahead(resident.id).flatMap((record) => {
      const medication = medicationsFor(resident.id).find(
        (candidate) => candidate.id === record.medicationId,
      )
      // A row that cannot say which drug it is about is not a weaker row, it
      // is a dangerous one — the same rule the omissions read applies.
      return medication === undefined ? [] : [{ record, medication, resident }]
    }),
  )

  const board = boardFor(site.id)
  const reviews = projectReviews(residents, now)
  const overdueReviews = reviews.items.filter(
    (item) => item.standing.kind === 'overdue',
  )

  const latestByResident = new Map<string, CareNote>()
  for (const note of notes) {
    const held = latestByResident.get(note.residentId)
    if (held === undefined || note.recordedAt > held.recordedAt) {
      latestByResident.set(note.residentId, note)
    }
  }

  const unwritten: UnwrittenResident[] = residents.flatMap(
    (resident): UnwrittenResident[] => {
      const note = latestByResident.get(resident.id)
      if (note === undefined) return [{ resident, last: { kind: 'never' as const } }]
      /*
       * The site's day, never the viewer's. At 00:10 in London the viewer's UTC
       * day is still yesterday, and every resident written up this evening would
       * appear on this list.
       */
      if (zonedDate(note.recordedAt, site.timeZone) === today) return []
      return [{ resident, last: { kind: 'note' as const, note } }]
    },
  )

  const unacknowledged = incidents.incidents.filter(
    (incident) => incident.status.kind === 'reported_not_acknowledged',
  )

  return {
    site,
    now,
    residents,
    notes,
    incidents: incidents.incidents,
    lateDoses: omissions.omissions,
    dueSoon,
    overdueReviews,
    unsignedHandovers: board?.unsigned ?? [],
    unacknowledged,
    incidentsTotal: incidents.incidents.length,
    unwritten,
    late: lateItems({
      omissions: omissions.omissions,
      overdueReviews,
      unsigned: board?.unsigned ?? [],
      residents,
    }),
  }
}

/**
 * Everything already late, in one list, ordered by how long it has been.
 *
 * Three sources become one list because the reader's question is "what should
 * have happened and has not", not "which module owns it". Each row still says
 * which module it came from through the action it offers.
 */
function lateItems(input: {
  omissions: Omission[]
  overdueReviews: Reviewable[]
  unsigned: HandoverSession[]
  residents: Resident[]
}): LateItem[] {
  const items: LateItem[] = []

  for (const omission of input.omissions) {
    items.push({
      id: `dose-${omission.record.medicationId}-${omission.dueAt}`,
      kind: 'dose',
      due: { kind: 'instant', at: omission.dueAt },
      what: `${omission.medication.name} ${omission.medication.dose}: ${omission.record.roundTime} round`,
      who: nameOf(omission.resident),
      state: 'No record',
      detail:
        omission.escalatedAt === 'not_escalated'
          ? 'the window closed and nobody escalated it'
          : `escalated ${omission.escalatedAt.slice(11, 16)}`,
      to: `/residents/${omission.resident.id}/medications`,
      actionLabel: 'Open MAR',
    })
  }

  for (const review of input.overdueReviews) {
    if (review.standing.kind !== 'overdue') continue
    items.push({
      id: review.id,
      kind: 'review',
      // A review is due on a day, not at a time. The union is what stops the
      // column inventing one.
      due: { kind: 'date', on: review.standing.dueOn },
      what: review.label,
      who: nameOf(review.resident),
      state: 'Past its date',
      detail: `due ${formatDate(review.standing.dueOn)}`,
      to: review.to,
      actionLabel: review.actionLabel,
    })
  }

  for (const session of input.unsigned) {
    items.push({
      id: session.id,
      kind: 'handover',
      due: { kind: 'date', on: session.date },
      what: `${session.outgoingShift} → ${session.incomingShift} handover`,
      who: input.residents.length > 0 ? 'The whole shift' : 'Nobody on record',
      state: 'Half complete',
      detail: 'one shift signed and the other never did',
      to: '/handover',
      actionLabel: 'Open handover',
    })
  }

  return items.sort((a, b) => deadlineKey(a.due).localeCompare(deadlineKey(b.due)))
}

const nameOf = (resident: Resident) =>
  resident.room.kind === 'recorded'
    ? `${resident.fullLegalName} · Room ${resident.room.value}`
    : `${resident.fullLegalName} · room not recorded`

export { MEDICATION_LOOKAHEAD_HOURS }
