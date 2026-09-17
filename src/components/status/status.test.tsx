import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { MarCell, marCellDescription, RiskBadge, Unrecorded } from './index'
import { staffHalloran, staffNwosu } from '@/data/fixtures/organisation'
import type { MarCellState, NotGivenReason } from '@/data/types'

/** Rosewood Court's zone. Every clinical time below renders in it, never
 *  in whatever zone the machine running the tests happens to be in. */
const SITE_ZONE = 'Europe/London'

/** Status components read the site's zone from context — there is no
 *  viewer-local fallback, by design, so tests supply it explicitly. */
function renderAtSite(ui: React.ReactNode) {
  return render(<SiteTimeZone timeZone={SITE_ZONE}>{ui}</SiteTimeZone>)
}

/**
 * The Evidence Invariant, asserted rather than assumed.
 *
 * These are the properties that must not regress silently. Each maps to a
 * numbered rule in PRD §2.2.
 */

describe('Rule 2: unrecorded always carries visible text', () => {
  it('renders the label, not just the pattern', () => {
    render(<Unrecorded label="Falls risk not assessed" />)
    expect(screen.getByText('Falls risk not assessed')).toBeVisible()
  })

  it('marks itself as unrecorded for tests and tooling to assert on', () => {
    const { container } = render(<Unrecorded label="Not recorded" />)
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
  })

  it('renders a denominator when one is given', () => {
    render(
      <Unrecorded
        variant="panel"
        label="Insufficient evidence"
        detail="4 of 32 residents have a completed falls risk assessment."
      />,
    )
    expect(screen.getByText(/4 of 32 residents/)).toBeVisible()
  })
})

describe('Rule 1: a status is never absent from the page', () => {
  it('renders a badge for an unassessed risk rather than nothing', () => {
    const { container } = renderAtSite(
      <RiskBadge name="Falls risk" status={{ kind: 'not_assessed' }} />,
    )
    expect(container).not.toBeEmptyDOMElement()
    expect(screen.getByText('Falls risk not assessed')).toBeVisible()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
  })
})

describe('Rule 3: a recorded negative is not an unrecorded value', () => {
  const notGiven: MarCellState = {
    kind: 'not_given',
    reason: 'resident_refused',
    note: '',
    recordedAt: '2026-08-19T08:04:00Z',
    recordedBy: staffNwosu,
  }

  const omitted: MarCellState = {
    kind: 'omitted',
    dueAt: '2026-08-19T08:00:00Z',
    escalation: { kind: 'escalated', at: '2026-08-19T09:04:00Z' },
    closure: { kind: 'open' },
  }

  it('gives a recorded "not given" the settled treatment, not the hatch', () => {
    const { container } = renderAtSite(
      <MarCell state={notGiven} context="08:00 Amlodipine" />,
    )
    expect(container.querySelector('[data-state="recorded"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="unrecorded"]')).not.toBeInTheDocument()
  })

  it('gives an omission the hatch, not the settled treatment', () => {
    const { container } = renderAtSite(
      <MarCell state={omitted} context="08:00 Amlodipine" />,
    )
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="recorded"]')).not.toBeInTheDocument()
  })
})

describe('PRD §6.4: every MAR cell has a full-sentence accessible name', () => {
  const cases: Array<[string, MarCellState, RegExp]> = [
    ['not_due', { kind: 'not_due' }, /not due/i],
    [
      'due',
      {
        kind: 'due',
        windowOpensAt: '2026-08-19T08:00:00Z',
        windowClosesAt: '2026-08-19T09:00:00Z',
      },
      /window open .* no record yet/i,
    ],
    [
      'given',
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'required_not_recorded' },
      },
      /second signature not recorded/i,
    ],
    [
      'omitted',
      {
        kind: 'omitted',
        dueAt: '2026-08-19T08:00:00Z',
        escalation: { kind: 'not_escalated' },
        closure: { kind: 'open' },
      },
      /window closed with no record.*not yet escalated/i,
    ],
  ]

  it.each(cases)('describes %s as a sentence', (_name, state, pattern) => {
    const sentence = marCellDescription(
      state,
      '08:00, 19 August, Amlodipine 5mg',
      SITE_ZONE,
    )
    expect(sentence).toMatch(pattern)
    expect(sentence).toContain('Amlodipine 5mg')
  })

  it('distinguishes a witnessed dose from one whose witness is missing', () => {
    const witnessed = marCellDescription(
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'witnessed', by: staffNwosu },
      },
      'ctx',
      SITE_ZONE,
    )
    const notRequired = marCellDescription(
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'not_required' },
      },
      'ctx',
      SITE_ZONE,
    )
    const missing = marCellDescription(
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'required_not_recorded' },
      },
      'ctx',
      SITE_ZONE,
    )
    // The whole reason MarWitness is a union: these must not read alike.
    expect(new Set([witnessed, notRequired, missing]).size).toBe(3)
    expect(missing).toMatch(/not recorded/i)
    expect(notRequired).not.toMatch(/witness/i)
  })
})

/**
 * A closed omission is two facts: the dose has no record, and somebody decided
 * something about that. CW PRD MED-01.
 *
 * Closing fills nothing. What is under test is that the hatch survives the
 * closure, that the closure is its own element outside the hatch rather than
 * small print inside it, and that nothing about the cell turns into the
 * settled treatment a recorded dose gets.
 */
describe('a closed omission stays a gap, with the closure beside it', () => {
  const REASON = 'GP informed. The next dose was given on time.'
  const closed: MarCellState = {
    kind: 'omitted',
    dueAt: '2026-08-19T08:00:00Z',
    escalation: { kind: 'escalated', at: '2026-08-19T09:04:00Z' },
    closure: {
      kind: 'closed',
      by: staffHalloran,
      at: '2026-08-20T10:15:00Z',
      reason: REASON,
    },
  }

  it('renders the hatch and the closure as two separate elements', () => {
    const { container } = renderAtSite(
      <MarCell state={closed} context="08:00 Amlodipine" />,
    )
    const gap = container.querySelector('[data-state="unrecorded"]')
    const closure = container.querySelector('[data-omission-closure="closed"]')
    expect(gap).toBeInTheDocument()
    expect(closure).toBeInTheDocument()
    // Beside the gap, never inside it: a closure in the hatch's small print is
    // the merged pill Rule 3a forbids.
    expect(gap!.contains(closure)).toBe(false)
    // Who, when in the home's zone, and why, in that order. The zone label is
    // there only when the machine running this is somewhere else, which is the
    // site format's rule and not this component's.
    expect(closure!.textContent).toMatch(
      new RegExp(
        `^Closed by M\\. Halloran, 20/08/2026 11:15( BST)?: ${REASON.replace(/\./g, '\\.')}$`,
      ),
    )
    // Nothing on the cell reads as the dose being recorded.
    expect(container.querySelector('[data-state="recorded"]')).not.toBeInTheDocument()
  })

  it('says nothing more about an open one than it did before closures existed', () => {
    const { container } = renderAtSite(
      <MarCell
        state={{ ...closed, closure: { kind: 'open' } }}
        context="08:00 Amlodipine"
      />,
    )
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
    expect(container.querySelector('[data-omission-closure]')).not.toBeInTheDocument()
  })

  it('puts the closure into the accessible sentence after the gap', () => {
    const sentence = marCellDescription(
      closed,
      '08:00, 19/08/2026, Amlodipine 5mg',
      SITE_ZONE,
    )
    expect(sentence).toMatch(/window closed with no record/i)
    expect(sentence).toContain(
      `Closed by ${staffHalloran.displayName}, 20/08/2026 11:15: ${REASON}`,
    )
    // The gap is stated before the decision about it.
    expect(sentence.indexOf('no record')).toBeLessThan(sentence.indexOf('Closed by'))
  })
})

describe('CW PRD MED-02: every not-given reason renders in words', () => {
  const REASONS: Record<NotGivenReason, RegExp> = {
    resident_refused: /resident refused/,
    resident_asleep: /resident asleep/,
    medication_unavailable: /medication unavailable/,
    resident_in_hospital: /resident in hospital/,
    resident_vomiting: /resident vomiting/,
    other: /other reason/,
  }

  it.each(Object.entries(REASONS))('renders %s as its words', (reason, words) => {
    const state: MarCellState = {
      kind: 'not_given',
      reason: reason as NotGivenReason,
      note: '',
      recordedAt: '2026-08-19T08:04:00Z',
      recordedBy: staffNwosu,
    }
    const { container } = renderAtSite(
      <MarCell state={state} context="08:00 Amlodipine" />,
    )
    // Read from the settled pill, not the page: the accessible sentence is on
    // the page too, and would satisfy a page-wide match on its own.
    const pill = container.querySelector('[data-state="recorded"]')
    expect(pill?.textContent).toMatch(words)
    expect(pill?.textContent).not.toMatch(/undefined/)
    expect(marCellDescription(state, 'ctx', SITE_ZONE)).toMatch(words)
  })
})
