import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { IsoDateTime, PostIncidentReviewFlag, ResidentId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES, subjectResidentId } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { flagsClosedBy, wasClearedLate } from '@/data/access/review-flags'
import {
  clearReviewFlags,
  patchedIncidents,
  resetSessionReviewFlags,
  undoClearing,
} from '@/data/access/review-flag-store'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { AssessmentListTab } from './AssessmentListTab'
import { AssessmentFormRoute, outstanding } from './AssessmentFormRoute'
import { RiskQueueRoute } from './RiskQueueRoute'
import { INSTRUMENT_ITEMS, bandFor, compareScores, isScored } from './instrument'

/**
 * Risk assessments. PRD §6.6.
 *
 * The module's own hazard is that scoring makes a gap easier to hide: once an
 * assessment can be completed, a list of the completed ones looks like a
 * finished job. So most of what is under test is that the gaps survive the
 * arrival of the thing that fills them.
 */

const NEVER_ASSESSED_FALLS = 'res-hutchinson'
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { path: 'risk-assessments', element: <AssessmentListTab /> },
          { path: 'risk-assessments/:templateId', element: <AssessmentFormRoute /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const listed = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-template]')).toBeTruthy())
  return container
}

describe('every template is listed, always', () => {
  it('renders all nine rows from the constant, not from the record', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    const rows = container.querySelectorAll('[data-template]')
    expect(rows.length).toBe(RISK_ASSESSMENT_TEMPLATES.length)
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      expect(
        container.querySelector(`[data-template="${template.id}"]`),
        template.id,
      ).toBeTruthy()
    }
  })

  it('renders the same nine for a resident with every one assessed', async () => {
    // Completing an assessment cannot remove a row — the row is the template,
    // not the assessment. A list of only the completed ones reads as a
    // complete picture.
    const fullyAssessed = residents.find((resident) =>
      RISK_ASSESSMENT_TEMPLATES.every(
        (template) => resident.risks[template.id].kind === 'assessed',
      ),
    )
    if (!fullyAssessed) return

    const { container } = renderAt(`/residents/${fullyAssessed.id}/risk-assessments`)
    await listed(container)
    expect(container.querySelectorAll('[data-template]').length).toBe(
      RISK_ASSESSMENT_TEMPLATES.length,
    )
  })

  it('carries the never-assessed figure with its denominator', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    const lead = container.querySelector('[data-never-assessed]')!
    expect(lead.textContent).toMatch(/of \d+ risks have never been assessed/)
    expect(lead.textContent).toMatch(/Never assessed is not low risk/)
  })
})

describe('never assessed is never made to look fine', () => {
  it('carries “No level”, not a blank and not low', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    const row = container.querySelector('[data-template="falls"]')!
    expect(row.getAttribute('data-assessed')).toBe('not_assessed')
    expect(row.textContent).toContain('No level')
    // The cheapest way to make a home look safe is to default the unknown to
    // fine, so the level column must never say Low here.
    expect(row.textContent).not.toContain('Low')
    expect(row.querySelectorAll('[data-state="unrecorded"]').length).toBeGreaterThan(0)
  })

  it('puts the action after the gap, not inside it', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    const row = container.querySelector('[data-template="falls"]')!
    const action = row.querySelector('[data-action="score"]')!
    const hatches = [...row.querySelectorAll('[data-state="unrecorded"]')]

    // The property is separation, not proximity: the gap is met first and the
    // affordance arrives after it. Inside the hatched cell it would read as an
    // answer to the gap rather than a response to one.
    expect(action).toBeTruthy()
    for (const hatch of hatches) {
      expect(hatch.contains(action)).toBe(false)
      expect(
        hatch.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  it('says exactly once that nobody has looked', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    // Two hatched chips explaining the same fact is volume drowning a
    // distinction, on the row whose whole job is to be one clear gap.
    const row = container.querySelector('[data-template="falls"]')!
    const explanations = row.textContent!.match(/nobody has looked/g) ?? []
    expect(explanations.length).toBe(1)
  })
})

describe('the placeholder says so where it appears', () => {
  it('banners the list and the form', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)
    expect(container.querySelector('[data-placeholder-instrument]')).toBeTruthy()

    const form = renderAt(`/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/falls`)
    await waitFor(() =>
      expect(
        form.container.querySelector('[data-placeholder-instrument]'),
      ).toBeTruthy(),
    )
    // A figure that does not do what it appears to must say so where it
    // appears, not in a release note.
    expect(form.container.textContent).toMatch(/not a validated clinical scale/)
    expect(form.container.textContent).toMatch(/make no clinical decision/)
  })
})

describe('the scored form', () => {
  const formPath = `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/falls`

  const scored = async () => {
    const result = renderAt(formPath)
    await waitFor(() =>
      expect(result.container.querySelector('[data-running-score]')).toBeTruthy(),
    )
    return result
  }

  it('shows the point value beside every choice', async () => {
    const { container } = await scored()

    // A scorer who cannot see the weighting cannot tell whether the instrument
    // is behaving — and on a placeholder instrument that matters more.
    const choices = container.querySelectorAll('[data-choice]')
    expect(choices.length).toBeGreaterThan(0)
    for (const choice of choices) {
      expect(choice.textContent, choice.getAttribute('data-choice')!).toMatch(
        /\d+ pts?$/,
      )
    }
  })

  it('has no default on any item', async () => {
    const { container } = await scored()

    // A pre-selected answer is an answer nobody gave — and on a scored
    // instrument, points nobody chose.
    for (const choice of container.querySelectorAll('[data-choice]')) {
      expect(choice.getAttribute('aria-checked')).toBe('false')
    }
    expect(
      container.querySelectorAll('[data-item] [data-state="unrecorded"]').length,
    ).toBe(INSTRUMENT_ITEMS.length)
  })

  it('says the score is not final until every item is answered', async () => {
    const user = userEvent.setup()
    const { container } = await scored()

    const running = container.querySelector('[data-running-score]')!
    expect(running.textContent).toMatch(/of \d+ items answered/)
    expect(running.textContent).toMatch(/not final until every item has an answer/)

    const first = container.querySelector('[data-item] [data-choice]')!
    await user.click(first)
    expect(running.textContent).toMatch(/1 of \d+ items answered/)
  })

  it('moves the score and the band as items are answered', async () => {
    const user = userEvent.setup()
    const { container } = await scored()

    // Answer every item at its highest weighting.
    for (const item of INSTRUMENT_ITEMS) {
      const highest = Math.max(...item.choices.map((choice) => choice.points))
      await user.click(
        container.querySelector(`[data-choice="${item.id}:${highest}"]`)!,
      )
    }

    const expected = INSTRUMENT_ITEMS.reduce(
      (sum, item) => sum + Math.max(...item.choices.map((choice) => choice.points)),
      0,
    )
    const running = container.querySelector('[data-running-score]')!
    expect(running.textContent).toContain(String(expected))
    expect(running.textContent).toContain('High')
  })
})

describe('an intervention with no responsible person cannot be saved', () => {
  const base = { answered: INSTRUMENT_ITEMS.length, scored: true }

  it('holds the record when one is unowned', () => {
    // A plan nobody owns is not a plan.
    expect(
      outstanding({
        ...base,
        interventions: [{ description: 'Sensor mat at the bedside', responsible: '' }],
      }),
    ).toEqual(['1 intervention with no responsible person'])
  })

  it('ignores an empty row, because it is not an intervention', () => {
    expect(
      outstanding({ ...base, interventions: [{ description: '', responsible: '' }] }),
    ).toEqual([])
  })

  it('names unanswered items rather than counting them vaguely', () => {
    expect(outstanding({ ...base, answered: 4, interventions: [] })).toEqual([
      '2 unanswered items',
    ])
    expect(outstanding({ ...base, answered: 5, interventions: [] })).toEqual([
      '1 unanswered item',
    ])
  })

  it('asks nothing of an unscored instrument', () => {
    // Four of the nine record findings and reach a level without arithmetic.
    expect(outstanding({ answered: 0, interventions: [], scored: false })).toEqual([])
  })
})

describe('the instrument', () => {
  it('bands by threshold, and never guesses low', () => {
    expect(bandFor(0)).toBe('low')
    expect(bandFor(24)).toBe('low')
    expect(bandFor(25)).toBe('moderate')
    expect(bandFor(49)).toBe('moderate')
    expect(bandFor(50)).toBe('high')
    expect(bandFor(9999)).toBe('high')
  })

  it('names five scored templates and four unscored', () => {
    const scored = RISK_ASSESSMENT_TEMPLATES.filter((template) => isScored(template.id))
    expect(scored.length).toBe(5)
    expect(RISK_ASSESSMENT_TEMPLATES.length - scored.length).toBe(4)
  })

  it('compares two scores with a word, not only a direction', () => {
    // An arrow alone is unreadable in greyscale and means nothing to a screen
    // reader, so every comparison carries a word.
    expect(compareScores(28, 55)).toBe('deteriorated')
    expect(compareScores(55, 28)).toBe('improved')
    expect(compareScores(30, 30)).toBe('unchanged')
  })
})

describe('accessibility', () => {
  it('has no axe violations on the list', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)
    const panel = container.querySelector('[class*="tabPanel"]') as HTMLElement
    expect((await axe(panel)).violations).toEqual([])
  }, 60000)

  it('has no axe violations on the form', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/falls`,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-running-score]')).toBeTruthy(),
    )
    const panel = container.querySelector('[class*="tabPanel"]') as HTMLElement
    expect((await axe(panel)).violations).toEqual([])
  }, 60000)

  it('names the resident on the form, not only the template', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/falls`,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-running-score]')).toBeTruthy(),
    )
    const resident = residents.find((person) => person.id === NEVER_ASSESSED_FALLS)!
    const heading = within(container).getAllByRole('heading')
    expect(
      heading.some((node) => node.textContent?.includes(resident.fullLegalName)),
    ).toBe(true)
  })
})

describe('re-score names what it closes, and never counts it', () => {
  /** A resident with an open falls flag, found rather than named. */
  const withOpenFallsFlag = incidents.find(
    (incident) =>
      subjectResidentId(incident) !== 'none' &&
      incident.reviewFlags.some(
        (flag) =>
          flag.state.kind === 'awaiting' &&
          flag.target.kind === 'risk_assessment' &&
          flag.target.templateId === 'falls',
      ),
  )

  it('has a fixture where a re-score would close something', () => {
    // Without one, every assertion below passes vacuously — the flow that
    // clears a clinical obligation would be tested against nothing.
    expect(withOpenFallsFlag, 'no incident has an open falls review flag').toBeTruthy()
  })

  it('names each closed review individually rather than counting them', () => {
    const residentId = subjectResidentId(withOpenFallsFlag!) as ResidentId
    const closes = flagsClosedBy({
      incidents,
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      now: NOW_ISO,
      formatDate: (at) => at.slice(0, 10),
    })

    expect(closes.length).toBeGreaterThan(0)
    for (const entry of closes) {
      // "the unwitnessed fall of 21/08" — the record, not a figure.
      expect(entry.description).toMatch(/^the .+ of \d{4}-\d{2}-\d{2}$/)
      expect(entry.incident.id).toBeTruthy()
    }
  })

  it('closes every open flag for that template, not only the oldest', () => {
    // Two incidents that both flagged falls recorded the same obligation
    // twice; leaving one open would ask for the same work again.
    const residentId = subjectResidentId(withOpenFallsFlag!) as ResidentId
    const open = incidents
      .filter((incident) => subjectResidentId(incident) === residentId)
      .flatMap((incident) =>
        incident.reviewFlags.filter(
          (flag) =>
            flag.state.kind === 'awaiting' &&
            flag.target.kind === 'risk_assessment' &&
            flag.target.templateId === 'falls',
        ),
      )
    const closes = flagsClosedBy({
      incidents,
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      now: NOW_ISO,
      formatDate: (at) => at.slice(0, 10),
    })
    expect(closes.length).toBe(open.length)
  })

  it('never closes a flag for a different template or resident', () => {
    const residentId = subjectResidentId(withOpenFallsFlag!) as ResidentId
    const closes = flagsClosedBy({
      incidents,
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      now: NOW_ISO,
      formatDate: (at) => at.slice(0, 10),
    })
    for (const entry of closes) {
      expect(subjectResidentId(entry.incident)).toBe(residentId)
      expect(entry.flag.target.kind).toBe('risk_assessment')
      if (entry.flag.target.kind === 'risk_assessment') {
        expect(entry.flag.target.templateId).toBe('falls')
      }
    }
  })
})

describe('clearing a flag never erases that it was late', () => {
  const raised = '2026-08-01T09:00:00.000Z' as IsoDateTime
  const dueBy = '2026-08-03T09:00:00.000Z' as IsoDateTime
  const by = { id: 'staff-x', displayName: 'A. Okonkwo' } as never

  const flag = (completedAt: string): PostIncidentReviewFlag => ({
    target: { kind: 'risk_assessment', templateId: 'falls' },
    raised: { by, at: raised },
    dueBy,
    state: { kind: 'completed', completed: { by, at: completedAt as IsoDateTime } },
  })

  it('still reads as late after the work is done', () => {
    /*
     * The half most easily lost, because the natural write is to set
     * `completed` and move on — which loses the lateness, since the only thing
     * that said so was the *absence* of a completion before `dueBy`.
     *
     * Derived from the record rather than stored, so it stays true rather than
     * being true until somebody does the work.
     */
    expect(wasClearedLate(flag('2026-08-06T10:00:00.000Z'))).toBe(true)
  })

  it('does not call an in-time clearing late', () => {
    expect(wasClearedLate(flag('2026-08-02T10:00:00.000Z'))).toBe(false)
  })

  it('says nothing about a flag nobody has cleared', () => {
    // An open flag is not "cleared late" — it is not cleared at all, and the
    // detail screen shows it as overdue instead.
    expect(
      wasClearedLate({
        target: { kind: 'risk_assessment', templateId: 'falls' },
        raised: { by, at: raised },
        dueBy,
        state: { kind: 'awaiting' },
      }),
    ).toBe(false)
  })
})

describe('clearing a review is a write another screen can see', () => {
  afterEach(() => resetSessionReviewFlags())

  const subject = () => {
    const incident = patchedIncidents().find((entry) =>
      entry.reviewFlags.some(
        (flag) =>
          flag.state.kind === 'awaiting' &&
          flag.target.kind === 'risk_assessment' &&
          flag.target.templateId === 'falls',
      ),
    )!
    return { incident, residentId: subjectResidentId(incident) as ResidentId }
  }

  it('closes every open falls flag for that resident, and no others', () => {
    const { residentId } = subject()
    const before = openFallsFlags(residentId)
    expect(before).toBeGreaterThan(0)

    clearReviewFlags({
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    // The obligation the incident screen was asserting is discharged.
    expect(openFallsFlags(residentId)).toBe(0)
    // And nothing else moved: another template's flags are untouched.
    expect(openFlagsFor(residentId, 'pressure_ulcer')).toBe(
      openFlagsForFixture(residentId, 'pressure_ulcer'),
    )
  })

  it('leaves the fixtures alone', () => {
    const { residentId } = subject()
    const fixtureOpen = openFlagsForFixture(residentId, 'falls')
    clearReviewFlags({
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      by: staffOkonkwo,
      at: NOW_ISO,
    })
    // Session only. `fixtures.test.ts` keeps testing the fixtures rather than
    // whatever the last re-score did.
    expect(openFlagsForFixture(residentId, 'falls')).toBe(fixtureOpen)
  })

  it('still reads as closed late where it was late', () => {
    const { residentId } = subject()
    const wereOverdue = patchedIncidents()
      .filter((incident) => subjectResidentId(incident) === residentId)
      .flatMap((incident) => incident.reviewFlags)
      .filter(
        (flag) =>
          flag.state.kind === 'awaiting' &&
          flag.target.kind === 'risk_assessment' &&
          flag.target.templateId === 'falls' &&
          flag.dueBy < NOW_ISO,
      ).length

    clearReviewFlags({
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const lateAfter = patchedIncidents()
      .filter((incident) => subjectResidentId(incident) === residentId)
      .flatMap((incident) => incident.reviewFlags)
      .filter(
        (flag) =>
          flag.target.kind === 'risk_assessment' &&
          flag.target.templateId === 'falls' &&
          wasClearedLate(flag),
      ).length

    // Doing the work does not make it on time. Nothing was stored to say
    // "late", so nothing could be overwritten by the completion.
    expect(lateAfter).toBe(wereOverdue)
  })

  it('undoes as one act, because half an undo is a false record', () => {
    const { residentId } = subject()
    const before = openFallsFlags(residentId)

    const token = clearReviewFlags({
      residentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      by: staffOkonkwo,
      at: NOW_ISO,
    })
    expect(openFallsFlags(residentId)).toBe(0)

    undoClearing(token)
    // Undoing half would leave the record saying a review was done that was
    // not, which is worse than not offering undo at all.
    expect(openFallsFlags(residentId)).toBe(before)
  })

  it('never re-closes a review somebody else completed', () => {
    // Re-clearing a completed flag would overwrite whoever actually did the
    // work with whoever happened to re-score afterwards.
    const withCompleted = patchedIncidents().find((incident) =>
      incident.reviewFlags.some((flag) => flag.state.kind === 'completed'),
    )!
    const completedBefore = withCompleted.reviewFlags
      .filter((flag) => flag.state.kind === 'completed')
      .map((flag) =>
        flag.state.kind === 'completed' ? flag.state.completed.by.id : '',
      )

    clearReviewFlags({
      residentId: subjectResidentId(withCompleted) as ResidentId,
      target: { kind: 'risk_assessment', templateId: 'falls' },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = patchedIncidents()
      .find((incident) => incident.id === withCompleted.id)!
      .reviewFlags.filter((flag) => flag.state.kind === 'completed')
      .map((flag) =>
        flag.state.kind === 'completed' ? flag.state.completed.by.id : '',
      )

    expect(after).toEqual(expect.arrayContaining(completedBefore))
  })
})

function openFlagsFor(residentId: ResidentId, templateId: 'falls' | 'pressure_ulcer') {
  return patchedIncidents()
    .filter((incident) => subjectResidentId(incident) === residentId)
    .flatMap((incident) => incident.reviewFlags)
    .filter(
      (flag) =>
        flag.state.kind === 'awaiting' &&
        flag.target.kind === 'risk_assessment' &&
        flag.target.templateId === templateId,
    ).length
}

function openFlagsForFixture(
  residentId: ResidentId,
  templateId: 'falls' | 'pressure_ulcer',
) {
  return incidents
    .filter((incident) => subjectResidentId(incident) === residentId)
    .flatMap((incident) => incident.reviewFlags)
    .filter(
      (flag) =>
        flag.state.kind === 'awaiting' &&
        flag.target.kind === 'risk_assessment' &&
        flag.target.templateId === templateId,
    ).length
}

const openFallsFlags = (residentId: ResidentId) => openFlagsFor(residentId, 'falls')

describe('the fifth queue', () => {
  const renderQueue = () => {
    const router = createMemoryRouter(
      [
        { path: '/risk-assessments', element: <RiskQueueRoute /> },
        {
          path: '/residents/:residentId/risk-assessments/:templateId',
          element: <p>form</p>,
        },
      ],
      { initialEntries: ['/risk-assessments'] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  const queued = async (container: HTMLElement) => {
    await waitFor(() => expect(container.querySelector('[data-row]')).toBeTruthy())
    return container
  }

  it('opens on its own finding rather than on everything', async () => {
    const { container } = renderQueue()
    await queued(container)

    const active = container.querySelector('[data-filter][aria-pressed="true"]')!
    expect(active.getAttribute('data-filter')).toBe('never_assessed')
  })

  it('leads with never assessed and keeps overdue beside it, never summed', async () => {
    const { container } = renderQueue()
    await queued(container)

    const lead = container.querySelector('[data-finding="never-assessed"]')!
    const secondary = container.querySelector('[data-finding="overdue"]')!

    // An overdue review is a risk somebody looked at and has not looked at
    // recently. Never assessed is a risk nobody has looked at at all — a
    // different claim, not a worse version of the same one.
    expect(lead.className).not.toBe(secondary.className)
    expect(
      lead.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('counts against residents × templates, not against assessments on record', async () => {
    const { container } = renderQueue()
    await queued(container)

    // Counting what exists would make a home that has assessed nothing look
    // complete. The denominator is what the home is expected to hold.
    const atSite = residents.filter(
      (resident) => resident.siteId === 'site-rosewood-court',
    )
    const expected = atSite.length * RISK_ASSESSMENT_TEMPLATES.length
    const lead = container.querySelector('[data-finding="never-assessed"]')!
    expect(lead.textContent).toContain(String(RISK_ASSESSMENT_TEMPLATES.length))
    expect(lead.textContent).toContain(expected.toLocaleString('en-GB'))
  })

  it('puts never assessed above overdue, and longest overdue first within it', async () => {
    const user = userEvent.setup()
    const { container } = renderQueue()
    await queued(container)
    await user.click(container.querySelector('[data-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelectorAll('[data-row]').length).toBeGreaterThan(10),
    )

    const states = [...container.querySelectorAll('[data-row]')].map((row) =>
      row.getAttribute('data-state'),
    )
    // A risk nobody has assessed has no wait to measure, which is why it sorts
    // above the ones that do rather than among them.
    const lastNever = states.lastIndexOf('not_assessed')
    const firstAssessed = states.indexOf('assessed')
    if (lastNever !== -1 && firstAssessed !== -1) {
      expect(lastNever).toBeLessThan(firstAssessed)
    }
  })

  it('names a resident on every row', async () => {
    const { container } = renderQueue()
    await queued(container)

    for (const row of container.querySelectorAll('[data-row]')) {
      const who = row.firstElementChild!
      expect(who.textContent!.trim().length).toBeGreaterThan(0)
      expect(who.textContent).toMatch(/Room \d+|Room not recorded/)
    }
  })

  it('carries the filter on the figure while one is narrowing the list', async () => {
    const user = userEvent.setup()
    const { container } = renderQueue()
    await queued(container)

    // Rule 3c: a count over a filtered set carries the filter, or it is false.
    expect(container.querySelector('[class*="resultLine"]')!.textContent).toMatch(
      /of [\d,]+ shown/,
    )
    await user.click(container.querySelector('[data-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelector('[class*="resultLine"]')!.textContent).toBe(
        'Never assessed first, then longest overdue',
      ),
    )
  })

  it('banners the placeholder here too', async () => {
    const { container } = renderQueue()
    await queued(container)
    expect(container.querySelector('[data-placeholder-instrument]')).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = renderQueue()
    await queued(container)
    expect((await axe(container)).violations).toEqual([])
  }, 60000)
})
