import type {
  Incident,
  IncidentEvidence,
  IsoDate,
  IsoDateTime,
  Recorded,
} from '@/data/types'
import { COMMUNAL_AREAS, INCIDENT_SEVERITIES, INCIDENT_TYPES } from '@/data/types'
import { regionLabel } from '@/assets/body-map/regions'
import { pluralise } from '@/lib/format'
import { flagName } from './decisions'

/**
 * What an incident says, as a document.
 *
 * **Assembly is pure and separate from writing the file**, the same split
 * `assembleReport` uses on the report form and for the same reason: this is
 * where a clinical record becomes something a reader takes away, and every
 * omission here is an omission nobody can see. A test can read this; it cannot
 * read a PDF.
 *
 * **It says the same things the screen says, including the absences.** A
 * manager review nobody has written is a section saying so, not a section left
 * out — a reader who downloads an incident and finds no review heading cannot
 * tell whether the review is missing or the export is.
 */
export interface PdfSection {
  heading: string
  lines: string[]
}

export interface IncidentPdfContent {
  title: string
  fileName: string
  sections: PdfSection[]
  /** Embedded in the file. Video cannot be, and is named in a section. */
  photos: IncidentEvidence[]
}

/** The formatters, passed in so the assembly stays pure and testable. */
export interface PdfFormat {
  dateTime: (at: IsoDateTime) => string
  date: (on: IsoDate) => string
}

const typeName = (incident: Incident) =>
  INCIDENT_TYPES.find((entry) => entry.id === incident.type)?.name ?? incident.type

const severityName = (incident: Incident) =>
  INCIDENT_SEVERITIES.find((entry) => entry.id === incident.severity)?.name ??
  incident.severity

const locationLine = (location: Incident['location']): string => {
  if (location.kind === 'resident_room') return `Room ${location.room}`
  if (location.kind === 'not_recorded') return 'Nobody recorded where it happened.'
  return COMMUNAL_AREAS.find((area) => area.id === location.area)?.name ?? location.area
}

/** A manager's field, or the true statement that nobody has written it. */
const reviewLine = (label: string, field: Recorded<string>, format: PdfFormat) =>
  field.kind === 'recorded'
    ? `${label}: ${field.value} (${field.recordedBy.displayName}, ${format.dateTime(field.recordedAt)})`
    : `${label}: not recorded.`

export function incidentPdfContent(
  incident: Incident,
  about: { residentName: string; siteName: string; format: PdfFormat },
): IncidentPdfContent {
  const { format } = about
  const sections: PdfSection[] = []

  sections.push({
    heading: 'What happened',
    lines: [
      `Type: ${typeName(incident)}`,
      `Severity: ${severityName(incident)}`,
      `Occurred: ${format.dateTime(incident.occurredAt)} (${about.siteName} local time)`,
      `Where: ${locationLine(incident.location)}`,
      `Who it happened to: ${about.residentName}`,
      '',
      incident.description,
      `Recorded by ${incident.reported.by.displayName}, ${format.dateTime(incident.reported.at)}`,
    ],
  })

  if (incident.edited.kind === 'edited') {
    sections.push({
      heading: 'This account has been edited',
      lines: [
        `Edited by ${incident.edited.edited.by.displayName}, ${format.dateTime(incident.edited.edited.at)}.`,
        'The account above is the edited one. What it said before was not kept.',
      ],
    })
  }

  sections.push({
    heading: 'What was done at the time',
    lines: [
      incident.response.immediateAction,
      `Recorded by ${incident.reported.by.displayName}, ${format.dateTime(incident.reported.at)}`,
      '',
      incident.response.witnesses.kind === 'nobody_witnessed'
        ? `Witnesses: nobody witnessed it (recorded by ${incident.response.witnesses.recordedBy.displayName}).`
        : `Witnesses: ${incident.response.witnesses.people.join(', ')} (recorded by ${incident.response.witnesses.recordedBy.displayName}).`,
    ],
  })

  /*
   * Region names, never the coordinates the map draws them at. A reader of
   * this file has no map in front of them.
   */
  sections.push({
    heading: 'Injuries',
    lines: [
      incident.injuries.kind === 'marked'
        ? `Marked: ${incident.injuries.regions.map(regionLabel).join(', ')} (recorded by ${incident.injuries.recorded.by.displayName}).`
        : incident.injuries.kind === 'no_injuries_found'
          ? `Checked, and no injuries found (recorded by ${incident.injuries.recorded.by.displayName}).`
          : 'Nobody recorded whether they were checked for injury.',
    ],
  })

  sections.push({
    heading: 'Where this has got to',
    lines: [
      incident.status.kind === 'reported_not_acknowledged'
        ? 'Reported, and nobody has acknowledged it.'
        : incident.status.kind === 'open'
          ? `Acknowledged by ${incident.status.acknowledged.by.displayName}, ${format.dateTime(incident.status.acknowledged.at)}.`
          : incident.status.kind === 'under_review'
            ? `Under review. Acknowledged by ${incident.status.acknowledged.by.displayName}; review started by ${incident.status.reviewStarted.by.displayName}.`
            : `Closed by ${incident.status.closed.by.displayName}, ${format.dateTime(incident.status.closed.at)}.`,
      incident.urgency.kind === 'needs_attention_now'
        ? `${incident.urgency.raised.by.displayName} said this one cannot wait: ${incident.urgency.because}`
        : '',
    ].filter((line) => line !== ''),
  })

  sections.push({
    heading: 'Manager review',
    lines:
      incident.review.rootCause.kind === 'unrecorded' &&
      incident.review.actionsTaken.kind === 'unrecorded' &&
      incident.review.preventiveMeasures.kind === 'unrecorded'
        ? ['Not yet reviewed. Nobody has recorded any of the three findings.']
        : [
            reviewLine('Root cause', incident.review.rootCause, format),
            reviewLine('Actions taken', incident.review.actionsTaken, format),
            reviewLine(
              'Preventive measures',
              incident.review.preventiveMeasures,
              format,
            ),
          ],
  })

  sections.push({
    heading: 'CQC notification',
    lines: [
      incident.notification.kind === 'not_yet_decided'
        ? 'Nobody has decided whether this must be notified.'
        : incident.notification.kind === 'not_required'
          ? `Decided not required by ${incident.notification.decided.by.displayName}: ${incident.notification.reason}`
          : incident.notification.kind === 'required_not_yet_notified'
            ? `Required, and not yet notified. Decided by ${incident.notification.decided.by.displayName}.`
            : `Notified, reference ${incident.notification.reference}, by ${incident.notification.notified.by.displayName}.`,
    ],
  })

  sections.push({
    heading: 'Telling the family',
    lines: [
      incident.familyTold.kind === 'not_decided'
        ? 'Nobody has decided whether to tell the family.'
        : incident.familyTold.kind === 'should_be_told'
          ? `They should be told. Decided by ${incident.familyTold.decided.by.displayName}, ${format.dateTime(incident.familyTold.decided.at)}.`
          : `They are not to be told: ${incident.familyTold.reason} Decided by ${incident.familyTold.decided.by.displayName}.`,
      'This system cannot contact a family member. Telling them is a telephone call somebody makes.',
    ],
  })

  sections.push({
    heading: 'Post-incident review',
    lines:
      incident.reviewFlags.length === 0
        ? ['Nothing was flagged for re-checking.']
        : incident.reviewFlags.map(
            (flag) =>
              `${flagName(flag)}: ${flag.state.kind === 'awaiting' ? `awaiting, due ${format.dateTime(flag.dueBy)}` : `completed by ${flag.state.completed.by.displayName}`}`,
          ),
  })

  const photos = incident.evidence.filter((entry) => entry.kind === 'photo')
  const videos = incident.evidence.filter((entry) => entry.kind === 'video')

  /*
   * **The file says what it is leaving out.** A PDF cannot hold a playable
   * video, and an export that quietly dropped one would let a reader conclude
   * that no video was taken — the opposite of what the record says. So the
   * videos are named, and where they actually are is said too, because
   * "attached" would otherwise imply it is somewhere a reader could go and get
   * it later.
   */
  sections.push({
    heading: 'Photographs and video',
    lines:
      incident.evidence.length === 0
        ? ['Nothing was attached.']
        : [
            ...photos.map(
              (photo) =>
                `Photograph: ${photo.fileName} (attached by ${photo.attached.by.displayName}, ${format.dateTime(photo.attached.at)}). Included below.`,
            ),
            ...(videos.length === 0
              ? []
              : [
                  `${pluralise(videos.length, 'video')} attached to this report and not included in this file: a PDF cannot hold a playable video.`,
                  ...videos.map(
                    (video) =>
                      `  ${video.fileName} (attached by ${video.attached.by.displayName}, ${format.dateTime(video.attached.at)})`,
                  ),
                  /*
                   * Agreed with the count, not written once in the singular.
                   * The line above it already counts through `pluralise`, so a
                   * report with two videos said "2 videos attached" and then
                   * "The video is held" two lines later — the same defect
                   * `pluralise` exists for, in a sentence that happens to carry
                   * no number of its own.
                   */
                  videos.length === 1
                    ? 'The video is held in the browser for this session only. It is not stored anywhere, so the original recording is the only lasting copy.'
                    : 'The videos are held in the browser for this session only. They are not stored anywhere, so the original recordings are the only lasting copies.',
                ]),
          ],
  })

  return {
    title: `${typeName(incident)}: ${about.residentName}`,
    fileName: `incident-${incident.id}-${incident.occurredAt.slice(0, 10)}.pdf`,
    sections,
    photos,
  }
}
