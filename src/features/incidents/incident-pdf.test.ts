import { describe, expect, it } from 'vitest'
import type { Incident, IncidentEvidence, IsoDateTime } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import { staffOkonkwo, staffNwosu } from '@/data/fixtures/organisation'
import { incidentPdfContent, type PdfFormat } from './incident-pdf'

/**
 * What the download actually says.
 *
 * **Asserted on the assembled content, not on a PDF.** The file is bytes no
 * test can read, so the thing worth holding — that every recorded fact reaches
 * the page, and that what cannot reach it is named rather than dropped — is
 * held one step earlier, where it is readable. That split is the whole reason
 * `incidentPdfContent` is a separate function.
 *
 * The photo and video cases are built here rather than taken from a fixture,
 * because **no fixture incident carries evidence** — a generated photograph
 * nobody took is the invented record this build refuses. So the path that
 * embeds an image and the path that names a video are exercised against an
 * incident constructed the way a session-reported one is.
 */
const format: PdfFormat = {
  dateTime: (at) => `[${at}]`,
  date: (on) => `[${on}]`,
}

const base = incidents[0]!

const evidence = (kind: 'photo' | 'video', fileName: string): IncidentEvidence => ({
  id: `evidence-${fileName}`,
  kind,
  fileName,
  size: 1024,
  url: `blob:test/${fileName}`,
  attached: { by: staffNwosu, at: '2026-10-01T09:14:00.000Z' as IsoDateTime },
})

const withEvidence = (attached: IncidentEvidence[]): Incident => ({
  ...base,
  evidence: attached,
})

const linesOf = (incident: Incident, heading: string): string[] => {
  const content = incidentPdfContent(incident, {
    residentName: 'Emmanuel Okafor',
    siteName: 'Rosewood Court',
    format,
  })
  const section = content.sections.find((entry) => entry.heading === heading)
  if (!section) throw new Error(`No ${heading} section in the document`)
  return section.lines
}

describe('the download carries what the record holds', () => {
  it('names the facts a reader came for', () => {
    const content = incidentPdfContent(base, {
      residentName: 'Emmanuel Okafor',
      siteName: 'Rosewood Court',
      format,
    })
    const text = content.sections.flatMap((section) => section.lines).join('\n')

    expect(text).toContain(base.description)
    expect(text).toContain(base.response.immediateAction)
    expect(text).toContain(base.reported.by.displayName)
    // The occurred-at goes through the site's formatter, never raw.
    expect(text).toContain(`[${base.occurredAt}]`)
    expect(content.fileName).toContain(base.id)
  })

  /*
   * A section nobody has written is a section saying so. Left out, a reader
   * cannot tell whether the review is missing or the export is.
   */
  it('says a review is not yet written rather than omitting the section', () => {
    const unreviewed: Incident = {
      ...base,
      review: {
        rootCause: { kind: 'unrecorded' },
        actionsTaken: { kind: 'unrecorded' },
        preventiveMeasures: { kind: 'unrecorded' },
      },
    }
    expect(linesOf(unreviewed, 'Manager review').join(' ')).toContain(
      'Not yet reviewed',
    )
  })

  it('writes injuries as body-map region names, never coordinates', () => {
    const injured: Incident = {
      ...base,
      injuries: {
        kind: 'marked',
        regions: ['knee_left', 'heel_right'],
        recorded: { by: staffOkonkwo, at: base.reported.at },
      },
    }
    const line = linesOf(injured, 'Injuries').join(' ')
    expect(line).toContain('Left knee')
    expect(line).toContain('Right heel')
    expect(line).not.toMatch(/\d{2,},\s*\d{2,}/)
  })
})

describe('the file says what it is leaving out', () => {
  it('hands photographs to the writer to embed', () => {
    const content = incidentPdfContent(
      withEvidence([evidence('photo', 'bruise.jpg')]),
      {
        residentName: 'Emmanuel Okafor',
        siteName: 'Rosewood Court',
        format,
      },
    )

    expect(content.photos.map((photo) => photo.fileName)).toEqual(['bruise.jpg'])
    expect(
      linesOf(
        content.photos.length ? withEvidence(content.photos) : base,
        'Photographs and video',
      ).join(' '),
    ).toContain('bruise.jpg')
  })

  /*
   * **The case this test exists for.** A PDF cannot hold a playable video, and
   * an export that quietly dropped one would let a reader conclude no video
   * was taken — the opposite of what the record says.
   */
  it('names an attached video, says it is not in the file, and says why', () => {
    const lines = linesOf(
      withEvidence([evidence('video', 'corridor-clip.mp4')]),
      'Photographs and video',
    ).join(' ')

    expect(lines).toContain('corridor-clip.mp4')
    expect(lines).toContain('not included')
    expect(lines).toContain('cannot hold a playable video')
    // And where it actually is, so "attached" does not imply somewhere to go.
    expect(lines).toContain('this session only')
  })

  it('names every video where more than one is attached', () => {
    const lines = linesOf(
      withEvidence([
        evidence('video', 'first.mp4'),
        evidence('video', 'second.mp4'),
        evidence('photo', 'bruise.jpg'),
      ]),
      'Photographs and video',
    ).join(' ')

    expect(lines).toContain('first.mp4')
    expect(lines).toContain('second.mp4')
    expect(lines).toContain('2 videos')
  })

  it('says nothing was attached where nothing was, without implying a gap', () => {
    const lines = linesOf(withEvidence([]), 'Photographs and video')
    expect(lines).toEqual(['Nothing was attached.'])
  })

  it('makes no video claim where only photographs are attached', () => {
    const lines = linesOf(
      withEvidence([evidence('photo', 'bruise.jpg')]),
      'Photographs and video',
    ).join(' ')
    expect(lines).not.toContain('not included')
  })
})

describe('an edited account says so in the file too', () => {
  it('carries the edit stamp into the document', () => {
    const edited: Incident = {
      ...base,
      edited: {
        kind: 'edited',
        edited: { by: staffOkonkwo, at: '2026-10-02T11:00:00.000Z' as IsoDateTime },
      },
    }
    const content = incidentPdfContent(edited, {
      residentName: 'Emmanuel Okafor',
      siteName: 'Rosewood Court',
      format,
    })
    const section = content.sections.find((entry) => entry.heading.includes('edited'))

    expect(section).toBeTruthy()
    expect(section!.lines.join(' ')).toContain(staffOkonkwo.displayName)
    expect(section!.lines.join(' ')).toContain('not kept')
  })

  it('says nothing about editing where nothing was edited', () => {
    const content = incidentPdfContent(base, {
      residentName: 'Emmanuel Okafor',
      siteName: 'Rosewood Court',
      format,
    })
    expect(content.sections.some((entry) => entry.heading.includes('edited'))).toBe(
      false,
    )
  })
})
