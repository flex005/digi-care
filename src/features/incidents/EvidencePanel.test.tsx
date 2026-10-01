import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { IncidentEvidence } from '@/data/types'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { EvidencePanel } from './EvidencePanel'

/**
 * Evidence is recorded, so it never wears the treatment for something missing.
 *
 * **The hatch means a clinical fact is absent**, and `Unrecorded` is the one
 * entry point to it in this build. This panel reached for it to carry a
 * storage caveat — the files are held for the session only — which is true,
 * and not a gap: the evidence is there, with who attached it and when.
 *
 * Spending the gap vocabulary on something nobody has to act on is how the
 * vocabulary stops working where there *is* a gap. The same sentence is a
 * plain paragraph on the report form, and it is one here.
 *
 * Constructed rather than drawn from a fixture, on purpose: no fixture
 * incident carries evidence, because a generated photograph nobody took is the
 * invented record this build refuses. The component is tested on its own, the
 * way `PlaceholderBanner.test.tsx` tests that one.
 */
const photo: IncidentEvidence = {
  id: 'evidence-1',
  kind: 'photo',
  fileName: 'bruise-left-forearm.jpg',
  size: 240_000,
  url: 'blob:test/photo',
  attached: { by: staffOkonkwo, at: '2026-10-01T09:14:00.000Z' as const },
}

const video: IncidentEvidence = {
  ...photo,
  id: 'evidence-2',
  kind: 'video',
  fileName: 'corridor-clip.mp4',
  size: 4_100_000,
}

const renderPanel = (evidence: IncidentEvidence[]) =>
  render(
    <SessionProvider>
      <SiteTimeZone timeZone="Europe/London">
        <EvidencePanel evidence={evidence} />
      </SiteTimeZone>
    </SessionProvider>,
  )

describe('attached evidence is a record, not a gap', () => {
  it('never renders the unrecorded treatment, photo or video', () => {
    const { container } = renderPanel([photo, video])

    // The hatch, by the attribute `Unrecorded` sets. Asserting the absence of
    // the treatment rather than of a word, because the wording may change and
    // the rule is about the treatment.
    expect(container.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(container.querySelector('[data-placeholder-instrument]')).toBeNull()
  })

  it('still says the files are held for this session only', () => {
    const { container } = renderPanel([photo])
    const note = container.querySelector('[data-evidence-session-only]')

    expect(note).toBeTruthy()
    expect(note!.textContent).toContain('this session only')
    // A plain paragraph, not a panel wearing the hatch.
    expect(note!.getAttribute('data-state')).toBeNull()
  })

  it('names who attached each one and when, always visible', () => {
    const { container } = renderPanel([photo, video])
    const text = container.textContent ?? ''

    expect(text).toContain('bruise-left-forearm.jpg')
    expect(text).toContain('corridor-clip.mp4')
    expect(text).toContain(staffOkonkwo.displayName)
  })

  /*
   * The empty case is ordinary rather than missing: most incidents have no
   * photographs. It is said, and it is not hatched either.
   */
  it('says nothing was attached without calling it a gap', () => {
    const { container } = renderPanel([])

    expect(container.querySelector('[data-no-evidence]')).toBeTruthy()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})
