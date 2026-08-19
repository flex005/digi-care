import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarCell, marCellDescription, RiskBadge, Unrecorded } from './index'
import { staffNwosu } from '@/data/fixtures/organisation'
import type { MarCellState } from '@/data/types'

/**
 * The Evidence Invariant, asserted rather than assumed.
 *
 * These are the properties that must not regress silently. Each maps to a
 * numbered rule in PRD §2.2.
 */

describe('Rule 2 — unrecorded always carries visible text', () => {
  it('renders the label, not just the pattern', () => {
    render(<Unrecorded label="Falls risk — not assessed" />)
    expect(screen.getByText('Falls risk — not assessed')).toBeVisible()
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

describe('Rule 1 — a status is never absent from the page', () => {
  it('renders a badge for an unassessed risk rather than nothing', () => {
    const { container } = render(
      <RiskBadge name="Falls risk" status={{ kind: 'not_assessed' }} />,
    )
    expect(container).not.toBeEmptyDOMElement()
    expect(screen.getByText('Falls risk — not assessed')).toBeVisible()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
  })
})

describe('Rule 3 — a recorded negative is not an unrecorded value', () => {
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
  }

  it('gives a recorded "not given" the settled treatment, not the hatch', () => {
    const { container } = render(
      <MarCell state={notGiven} context="08:00 Amlodipine" />,
    )
    expect(container.querySelector('[data-state="recorded"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="unrecorded"]')).not.toBeInTheDocument()
  })

  it('gives an omission the hatch, not the settled treatment', () => {
    const { container } = render(<MarCell state={omitted} context="08:00 Amlodipine" />)
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="recorded"]')).not.toBeInTheDocument()
  })
})

describe('PRD §6.4 — every MAR cell has a full-sentence accessible name', () => {
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
      },
      /window closed with no record.*not yet escalated/i,
    ],
  ]

  it.each(cases)('describes %s as a sentence', (_name, state, pattern) => {
    const sentence = marCellDescription(state, '08:00, 19 August, Amlodipine 5mg')
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
    )
    const notRequired = marCellDescription(
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'not_required' },
      },
      'ctx',
    )
    const missing = marCellDescription(
      {
        kind: 'given',
        givenAt: '2026-08-19T08:04:00Z',
        givenBy: staffNwosu,
        witness: { kind: 'required_not_recorded' },
      },
      'ctx',
    )
    // The whole reason MarWitness is a union: these must not read alike.
    expect(new Set([witnessed, notRequired, missing]).size).toBe(3)
    expect(missing).toMatch(/not recorded/i)
    expect(notRequired).not.toMatch(/witness/i)
  })
})
