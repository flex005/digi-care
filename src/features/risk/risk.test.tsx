import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
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
import { residentById, residents } from '@/data/fixtures/residents'
import { withResidentEdits } from '@/data/access/resident-store'
import { recordAssessment, recordCustomRisk } from '@/data/access/client'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { AssessmentListTab } from './AssessmentListTab'
import { AssessmentFormRoute, outstanding } from './AssessmentFormRoute'
import { RiskQueueRoute } from './RiskQueueRoute'
import {
  MORSE,
  PLACEHOLDER_INSTRUMENT,
  WATERLOW,
  bandFor,
  compareScores,
  isScored,
  maxScoreOf,
} from './instrument'

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

/**
 * Choose a risk level through the control the screen actually uses.
 *
 * Radix drives its listbox from pointer events, which `src/test/setup.ts`
 * shims — so this works, and a comment in this file saying jsdom cannot open
 * a Select was stale.
 */
const chooseLevel = async (
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  label: string,
) => {
  const choice = container.querySelector('[data-level-choice]')!
  await user.click(within(choice as HTMLElement).getByRole('combobox'))
  await user.click(await screen.findByRole('option', { name: label }))
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

describe('the placeholder says so where it appears, and only where it is true', () => {
  /*
   * **The example had to stop being falls.** This test used the falls form to
   * prove the banner appears, which was right while every scored template
   * shared one invented instrument. Falls carries the Morse Fall Scale now, so
   * the same assertion on the same template would have gone on passing while
   * asserting the opposite of what the screen should say.
   */
  const stillPlaceholder = 'nutrition' as const

  it('banners the list, and a form still on the stand-in', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)
    // The list spans all nine, three of which are still invented.
    expect(container.querySelector('[data-placeholder-instrument]')).toBeTruthy()

    const form = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/${stillPlaceholder}`,
    )
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

  /**
   * The mirror, which is the half that would have caught this.
   *
   * A banner saying the instrument is invented, on a form running a published
   * scale, is a false claim about a clinical figure — and it is the direction
   * nothing was watching: the old test asserted the sentence was present and
   * would have been satisfied by it being present wrongly.
   */
  it.each(['falls', 'pressure_ulcer'] as const)(
    'makes no placeholder claim on %s, which is sourced',
    async (templateId) => {
      const { container } = renderAt(
        `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/${templateId}`,
      )
      await waitFor(() =>
        expect(container.querySelector('[data-running-score]')).toBeTruthy(),
      )
      expect(container.querySelector('[data-placeholder-instrument]')).toBeNull()
      expect(container.textContent).not.toMatch(/not a validated clinical scale/)
      expect(container.textContent).not.toMatch(/make no clinical decision/)
    },
  )

  it('names the published scale on the row instead of calling it a placeholder', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    const falls = container.querySelector('[data-template="falls"]')!
    expect(falls.textContent).toContain('Morse Fall Scale')
    expect(falls.textContent).not.toContain('Placeholder scored instrument')

    const waterlow = container.querySelector('[data-template="pressure_ulcer"]')!
    expect(waterlow.textContent).toContain('Waterlow Score')

    // And the three nobody has sourced still say what they are.
    const nutrition = container.querySelector('[data-template="nutrition"]')!
    expect(nutrition.textContent).toContain('Placeholder scored instrument')
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
    ).toBe(MORSE.items.length)
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
    for (const item of MORSE.items) {
      const highest = Math.max(...item.choices.map((choice) => choice.points))
      await user.click(
        container.querySelector(`[data-choice="${item.id}:${highest}"]`)!,
      )
    }

    // Derived from the instrument, never typed again beside it.
    const expected = maxScoreOf(MORSE)
    const running = container.querySelector('[data-running-score]')!
    expect(running.textContent).toContain(String(expected))
    expect(running.textContent).toContain('High')
  })
})

describe('an intervention with no responsible person cannot be saved', () => {
  const base = {
    answered: MORSE.items.length,
    itemCount: MORSE.items.length,
    scored: true,
    /* Irrelevant while `scored` is true: the instrument reaches the level. */
    level: 'low' as const,
    /* A name is asked for only on a first custom assessment. */
    name: 'not asked here',
  }

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

  /*
   * **This assertion used to be `[]`, and it was encoding the defect.** Four of
   * the nine reach a level by judgement and there was no control for it, so
   * `level` was passed `bandFor(0)` — every unscored assessment recorded
   * **Low**, whatever the assessor had found, and this test said the form was
   * waiting on nothing. Tightened rather than relaxed: the form now refuses
   * until somebody has judged a level, and the note is here so the next person
   * who sees it fail reads why before changing it back.
   */
  it('waits for a level on an unscored instrument, and never assumes low', () => {
    expect(
      outstanding({
        answered: 0,
        interventions: [],
        scored: false,
        level: '',
        name: 'not asked here',
        itemCount: 0,
      }),
    ).toEqual(['a risk level'])

    expect(
      outstanding({
        answered: 0,
        interventions: [],
        scored: false,
        level: 'high',
        name: 'not asked here',
        itemCount: 0,
      }),
    ).toEqual([])
  })

  it('asks a first custom assessment for a name, and never an existing one', () => {
    expect(
      outstanding({
        answered: 0,
        interventions: [],
        scored: false,
        level: 'moderate',
        name: '   ',
        itemCount: 0,
      }),
    ).toEqual(['a name for this risk'])
  })
})

describe('the instrument', () => {
  it('bands by threshold, and never guesses low', () => {
    // Morse: 0–24 low, 25–44 moderate, 45+ high. Each edge on both sides.
    expect(bandFor(MORSE, 0)).toBe('low')
    expect(bandFor(MORSE, 24)).toBe('low')
    expect(bandFor(MORSE, 25)).toBe('moderate')
    expect(bandFor(MORSE, 44)).toBe('moderate')
    expect(bandFor(MORSE, 45)).toBe('high')
    expect(bandFor(MORSE, maxScoreOf(MORSE))).toBe('high')

    // Waterlow: below 10 low, 10–14 moderate, 15+ high. Different thresholds
    // on purpose — one shared band table was the thing this phase removed.
    expect(bandFor(WATERLOW, 0)).toBe('low')
    expect(bandFor(WATERLOW, 9)).toBe('low')
    expect(bandFor(WATERLOW, 10)).toBe('moderate')
    expect(bandFor(WATERLOW, 14)).toBe('moderate')
    expect(bandFor(WATERLOW, 15)).toBe('high')
    expect(bandFor(WATERLOW, maxScoreOf(WATERLOW))).toBe('high')

    // And the stand-in the other three still use, unchanged.
    expect(bandFor(PLACEHOLDER_INSTRUMENT, 24)).toBe('low')
    expect(bandFor(PLACEHOLDER_INSTRUMENT, 25)).toBe('moderate')
    expect(bandFor(PLACEHOLDER_INSTRUMENT, 50)).toBe('high')

    // The published maxima, held by name: a weight typed wrong moves these.
    expect(maxScoreOf(MORSE)).toBe(125)
    expect(maxScoreOf(WATERLOW)).toBe(46)
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

describe('the record keeps what the assessment found, and what is being done', () => {
  const WITH_CUSTOM = 'res-kavanagh'

  it('renders the description and every action under the row it belongs to', async () => {
    /*
     * **Until Phase 30 this was thrown away at save.** The form collected
     * findings and interventions, the record held a level and a number, and a
     * plan naming a responsible person survived as long as the page it was
     * typed on. The row has to carry both now, or the level arrives on every
     * screen with nothing underneath it.
     */
    const assessed = residents.find((resident) =>
      RISK_ASSESSMENT_TEMPLATES.some((template) => {
        const status = resident.risks[template.id]
        return status.kind === 'assessed' && status.actions.length > 0
      }),
    )
    expect(assessed, 'no assessment in the fixtures carries an action').toBeTruthy()

    const template = RISK_ASSESSMENT_TEMPLATES.find((entry) => {
      const status = assessed!.risks[entry.id]
      return status.kind === 'assessed' && status.actions.length > 0
    })!
    const status = assessed!.risks[template.id]
    if (status.kind !== 'assessed') throw new Error('expected an assessment')

    const { container } = renderAt(`/residents/${assessed!.id}/risk-assessments`)
    await listed(container)

    const row = container.querySelector(
      `[data-template="${template.id}"]`,
    )!.parentElement!
    const findings = row.querySelector('[data-findings]')!
    expect(findings.textContent).toContain(status.description)
    for (const action of status.actions) {
      expect(findings.textContent).toContain(action.description)
      // Never the action alone: a plan nobody owns is not a plan.
      expect(findings.textContent).toContain(action.responsible)
    }
  }, 30000)

  it('says so where an assessment carries no description or actions', async () => {
    const bare = residents.find((resident) =>
      RISK_ASSESSMENT_TEMPLATES.some((template) => {
        const status = resident.risks[template.id]
        return status.kind === 'assessed' && status.description === ''
      }),
    )
    expect(bare, 'no assessment in the fixtures is left bare').toBeTruthy()

    const { container } = renderAt(`/residents/${bare!.id}/risk-assessments`)
    await listed(container)

    // A level recorded in a hurry is a record. It is not a blank line.
    expect(container.textContent).toContain('No description recorded.')
  }, 30000)

  it('lists a custom risk beside the nine and counts it apart from them', async () => {
    const { container } = renderAt(`/residents/${WITH_CUSTOM}/risk-assessments`)
    await listed(container)

    const custom = container.querySelector('[data-custom-risk]')
    expect(custom, 'the pinned custom risk is not on the tab').toBeTruthy()
    expect(custom!.textContent).toContain('Leaving the home unaccompanied')

    /*
     * **Counted apart, which is the whole reason it has its own list.** "N of
     * 9" is a claim about what every home is expected to hold; a tenth risk on
     * one resident would make that denominator mean something different per
     * person, in nineteen files that read it.
     */
    const lead = container.querySelector('[data-never-assessed]')!
    expect(lead.textContent).toMatch(
      new RegExp(`of ${String(RISK_ASSESSMENT_TEMPLATES.length)} risks`),
    )
    expect(container.querySelector('[data-custom-claim]')!.textContent).toMatch(
      /9.*templates above, plus.*1.*outside the nine/s,
    )
  }, 30000)

  it('says the nine are the expected set where a resident has no custom risk', async () => {
    const { container } = renderAt(
      `/residents/${NEVER_ASSESSED_FALLS}/risk-assessments`,
    )
    await listed(container)

    expect(container.querySelector('[data-custom-risk]')).toBeNull()
    /*
     * **Both facts, in the one sentence that now carries them.** Empty here is
     * ordinary rather than a gap, and these sit outside the figure at the top.
     * Those used to be two paragraphs saying nearly the same thing, and
     * collapsing them is exactly the edit that can quietly drop one — so each
     * is held by name rather than by a paragraph existing.
     */
    const claim = container.querySelector('[data-no-custom-risks]')!.textContent
    expect(claim).toMatch(/ordinary rather than a gap/)
    expect(claim).toMatch(/not counted in the figure at the top/)
  }, 30000)

  it('carries the findings typed on the form through to the record', async () => {
    const user = userEvent.setup()
    // Its own render: recording raises a toast, which needs the provider.
    const router = createMemoryRouter(
      [
        {
          path: 'residents/:residentId',
          element: <ResidentProfileRoute />,
          children: [
            { path: 'risk-assessments/:templateId', element: <AssessmentFormRoute /> },
          ],
        },
      ],
      { initialEntries: [`/residents/${NEVER_ASSESSED_FALLS}/risk-assessments/falls`] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <ToastViewport />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-assessment-description]')).toBeTruthy(),
    )

    await user.type(
      container.querySelector('[data-assessment-description]')!,
      'Unsteady from low chairs.',
    )
    for (const item of container.querySelectorAll('[data-item]')) {
      await user.click(item.querySelector('[data-choice]')!)
    }
    await user.click(container.querySelector('[data-record-assessment]')!)

    /*
     * The interventions row is left empty on purpose: an empty row is not an
     * intervention, so the form saves without one. That an owned intervention
     * reaches the record is asserted against the writer below, because the
     * responsible person is chosen through a Radix Select in a portal, which
     * jsdom cannot open.
     */
    const after = await waitFor(() => {
      const found = withResidentEdits(residentById(NEVER_ASSESSED_FALLS as ResidentId)!)
        .risks.falls
      expect(found.kind).toBe('assessed')
      return found
    })
    if (after.kind !== 'assessed') throw new Error('falls was not recorded')
    expect(after.description).toBe('Unsteady from low chairs.')
    expect(after.actions).toEqual([])
  }, 30000)

  it('writes an owned action through the one function both screens use', async () => {
    const resident = residents.find(
      (entry) => entry.risks.behaviour.kind === 'not_assessed',
    )!
    await recordAssessment({
      residentId: resident.id,
      templateId: 'behaviour',
      level: 'moderate',
      score: { kind: 'unscored' },
      description: 'Agitated at handover time.',
      actions: [
        { description: 'ABC chart for a fortnight.', responsible: 'Senior carer' },
        // Blank rows are not interventions and never reach the record.
        { description: '', responsible: '' },
      ],
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = withResidentEdits(residentById(resident.id)!).risks.behaviour
    if (after.kind !== 'assessed') throw new Error('behaviour was not recorded')
    expect(after.description).toBe('Agitated at handover time.')
    expect(after.actions).toEqual([
      { description: 'ABC chart for a fortnight.', responsible: 'Senior carer' },
    ])
    expect(after.assessedBy).toEqual(staffOkonkwo)
  }, 30000)
})

describe('a risk outside the nine reaches the queue, and stays out of its figures', () => {
  const WITH_CUSTOM = 'res-kavanagh'

  function renderQueue() {
    const router = createMemoryRouter(
      [
        { path: '/risk-assessments', element: <RiskQueueRoute /> },
        { path: '/residents/:residentId/risk-assessments', element: <p>the tab</p> },
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

  it('lists it when its review has fallen due, like any other', async () => {
    const user = userEvent.setup()
    const resident = residents.find((entry) => entry.id === WITH_CUSTOM)!
    const risk = resident.customRisks[0]!
    /*
     * **Asserted, not skipped.** The first version of this let the fixture
     * decide: if the pinned risk was not yet due it returned early, so it
     * passed with the queue ignoring custom risks altogether — the mutation
     * said so. The fixture now carries an overdue one by construction, and
     * this states the requirement rather than reading it off the data.
     */
    expect(risk.reviewState.kind).toBe('overdue')

    const { container } = renderQueue()
    await waitFor(() => expect(container.querySelector('[data-row]')).toBeTruthy())
    // The queue opens on never assessed, which no recorded risk can be.
    await user.click(container.querySelector('[data-filter="overdue"]')!)
    await waitFor(() =>
      expect(
        container
          .querySelector('[data-filter="overdue"]')!
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    )

    const row = container.querySelector(`[data-row="${resident.id}-${risk.id}"]`)
    expect(row, 'the custom risk is not on the queue').toBeTruthy()
    expect(row!.getAttribute('data-expected')).toBe('no')
    expect(row!.textContent).toContain(risk.name)
    // It opens the resident's tab: there is no instrument screen behind it.
    expect(row!.getAttribute('href')).toBe(`/residents/${resident.id}/risk-assessments`)
  }, 30000)

  it('never enters the denominator the two findings are counted against', async () => {
    const { container } = renderQueue()
    await waitFor(() => expect(container.querySelector('[data-row]')).toBeTruthy())

    /*
     * The expected set is residents × nine templates. A custom risk in that
     * total would make "of N expected assessments" mean something different
     * for every resident, in a figure a reader is invited to check.
     */
    // The queue is one home's, so the denominator is too.
    const here = residents.filter(
      (resident) => resident.siteId === 'site-rosewood-court',
    )
    const expected = here.length * RISK_ASSESSMENT_TEMPLATES.length
    const detail = container.querySelector('[data-finding="overdue"]')!.textContent!
    expect(detail).toContain(String(expected))

    const customRisks = here.reduce(
      (total, resident) => total + resident.customRisks.length,
      0,
    )
    expect(customRisks).toBeGreaterThan(0)
    expect(detail).not.toContain(String(expected + customRisks))
  }, 30000)
})

describe('re-scoring keeps what the last assessor wrote', () => {
  it('prefills the description and the actions on a templated re-score', async () => {
    const assessed = residents.find((resident) => {
      const status = resident.risks.falls
      return (
        status.kind === 'assessed' &&
        status.description !== '' &&
        status.actions.length > 0
      )
    })!
    const status = assessed.risks.falls
    if (status.kind !== 'assessed') throw new Error('expected an assessment')

    const { container } = renderAt(`/residents/${assessed.id}/risk-assessments/falls`)
    await waitFor(() =>
      expect(container.querySelector('[data-assessment-description]')).toBeTruthy(),
    )

    /*
     * **The defect this prevents is silent.** A re-score saves what is on
     * screen, so a blank form deletes the plan the last assessor wrote the
     * moment the next one records a level without retyping it.
     */
    expect(
      container.querySelector<HTMLTextAreaElement>('[data-assessment-description]')!
        .value,
    ).toBe(status.description)
    const first = container.querySelector<HTMLInputElement>(
      '[data-intervention="1"] input',
    )!
    expect(first.value).toBe(status.actions[0]!.description)
  }, 30000)

  /*
   * **The same routed form the nine open.** `RiskFinding` has been one shape
   * for both since Phase 30; only the screen layer forked, and the modal a
   * custom risk used to open had no running score, no previous-against-new
   * comparison, no consequences and no undo.
   */
  it('re-scores a custom risk on the routed form, not in a modal', async () => {
    const user = userEvent.setup()
    const resident = residents.find((entry) => entry.id === 'res-kavanagh')!
    const risk = withResidentEdits(resident).customRisks[0]!

    const { container } = renderAt(`/residents/${resident.id}/risk-assessments`)
    await listed(container)

    const row = container.querySelector(`[data-custom-risk="${risk.id}"]`)!
    const open = row.querySelector('[data-action="rescore"]')!
    expect(open.tagName).toBe('A')
    await user.click(open)

    await waitFor(() =>
      expect(container.querySelector('[data-level-choice]')).toBeTruthy(),
    )
    // A risk outside the nine has no instrument, so there is no running score.
    expect(container.querySelector('[data-running-score]')).toBeNull()
    // The name is fixed once recorded, so the form never offers it again.
    expect(container.querySelector('[data-field="custom-risk-name-new"]')).toBeNull()
    expect(container.textContent).toContain(risk.name)

    // A re-score starts from the record, so the findings come back prefilled.
    const description = container.querySelector<HTMLTextAreaElement>(
      '[data-assessment-description]',
    )!
    expect(description.value).toBe(risk.description)
    await user.clear(description)
    await user.type(description, 'Settled since the door code changed.')

    await chooseLevel(user, container, risk.level === 'high' ? 'Low' : 'High')

    /*
     * The comparison is reachable for an unscored risk now: its gate was
     * "scored and every item answered", which no custom risk can satisfy.
     */
    await waitFor(() => expect(container.querySelector('[data-compare]')).toBeTruthy())
    // And nothing about post-incident reviews: a custom risk cannot be flagged.
    expect(container.querySelector('[data-closes]')).toBeNull()

    await user.click(container.querySelector('[data-record-rescore]')!)
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /Record assessment/ }))

    const after = await waitFor(() => {
      const found = withResidentEdits(residentById(resident.id)!).customRisks[0]!
      expect(found.description).toBe('Settled since the door code changed.')
      return found
    })
    // The same risk re-scored, not a second one beside it, and the name it
    // came in with — `recordCustomRisk` renames silently if handed another.
    expect(withResidentEdits(residentById(resident.id)!).customRisks).toHaveLength(1)
    expect(after.id).toBe(risk.id)
    expect(after.name).toBe(risk.name)
    expect(after.level).not.toBe(risk.level)
  }, 30000)
})

describe('an unscored template records the level somebody judged', () => {
  /*
   * **The defect this describes was live.** Four of the nine are unscored —
   * choking, behaviour, environmental and COSHH — and no control existed to
   * set their level. `recordAssessment` was handed `bandFor(total)` with
   * `total` stuck at 0, so every first assessment and every re-score of those
   * four recorded **Low**, silently, whatever the description said had been
   * found. That is the cheapest way to make a home look safe, and §1 exists to
   * prevent it.
   */
  const unscored = 'choking' as const

  it('refuses to record until a level is judged, then records that level', async () => {
    const user = userEvent.setup()
    const subject = residents.find(
      (entry) => entry.risks[unscored].kind === 'not_assessed',
    )!
    const { container } = renderAt(
      `/residents/${subject.id}/risk-assessments/${unscored}`,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-level-choice]')).toBeTruthy(),
    )
    // No instrument, so no running score to reach a level with.
    expect(container.querySelector('[data-running-score]')).toBeNull()

    const record = container.querySelector<HTMLButtonElement>(
      '[data-record-assessment]',
    )!
    expect(record.disabled).toBe(true)
    expect(container.textContent).toContain('a risk level')

    await user.type(
      container.querySelector('[data-assessment-description]')!,
      'Coughing on thin fluids at two meals this week.',
    )
    // A description is not a level: still refused.
    expect(record.disabled).toBe(true)

    await chooseLevel(user, container, 'High')
    await waitFor(() => expect(record.disabled).toBe(false))
    await user.click(record)

    const after = await waitFor(() => {
      const found = withResidentEdits(residentById(subject.id)!).risks[unscored]
      expect(found.kind).toBe('assessed')
      return found
    })
    if (after.kind !== 'assessed') throw new Error('not recorded')
    // High, because that is what was judged — not Low, because nothing scored.
    expect(after.level).toBe('high')
    expect(after.score).toEqual({ kind: 'unscored' })
  }, 30000)
})

describe('a risk outside the nine can be recorded after the day somebody arrived', () => {
  /*
   * **The level is recorded as chosen, which is the whole of the Part 1 fix.**
   * Four of the nine and every custom risk reach a level by judgement, and
   * there was no control for it: `level` was passed `bandFor(0)`, so every one
   * of them recorded **Low** whatever the assessor found. This drives the
   * control and reads the level back off the record.
   */
  it("records a new one from the resident's own tab, at the level chosen", async () => {
    const user = userEvent.setup()
    const resident = residents.find(
      (entry) =>
        entry.siteId === 'site-rosewood-court' && entry.customRisks.length === 0,
    )!
    const { container } = renderAt(`/residents/${resident.id}/risk-assessments`)
    await listed(container)

    const add = container.querySelector('[data-add-custom-risk]')!
    expect(add.tagName).toBe('A')
    await user.click(add)

    // The same routed form, with no instrument and the name asked once.
    await waitFor(() =>
      expect(container.querySelector('[data-level-choice]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-running-score]')).toBeNull()

    const record = container.querySelector<HTMLButtonElement>(
      '[data-record-assessment]',
    )!
    expect(record.disabled).toBe(true)

    await user.type(
      container.querySelector('[data-field="custom-risk-name-new"]')!,
      'Hoarding food in the room',
    )
    await user.type(
      container.querySelector('[data-assessment-description]')!,
      'Three plates found in the wardrobe this week.',
    )
    // Still refused: nobody has judged a level, and Low is not the default.
    expect(record.disabled).toBe(true)
    expect(container.textContent).toContain('a risk level')

    await chooseLevel(user, container, 'High')
    await waitFor(() => expect(record.disabled).toBe(false))
    await user.click(record)

    const after = await waitFor(() => {
      const found = withResidentEdits(residentById(resident.id)!).customRisks
      expect(found).toHaveLength(1)
      return found[0]!
    })
    expect(after.name).toBe('Hoarding food in the room')
    // The point of the whole fix: what was chosen, not what bandFor(0) returns.
    expect(after.level).toBe('high')
    expect(after.score).toEqual({ kind: 'unscored' })
  }, 30000)

  it('writes a new risk without touching the one already on file', async () => {
    const resident = residents.find((entry) => entry.id === 'res-kavanagh')!
    const existing = withResidentEdits(residentById(resident.id)!).customRisks
    expect(existing.length).toBeGreaterThan(0)

    await recordCustomRisk({
      residentId: resident.id,
      name: 'Hoarding food in the room',
      level: 'moderate',
      score: { kind: 'unscored' },
      description: 'Three plates found in the wardrobe this week.',
      actions: [{ description: 'Check the room daily.', responsible: 'Care team' }],
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = withResidentEdits(residentById(resident.id)!).customRisks
    expect(after).toHaveLength(existing.length + 1)
    // The one already there is untouched: a create is never an edit.
    expect(after[0]).toEqual(existing[0])
    expect(after[after.length - 1]!.name).toBe('Hoarding food in the room')
    expect(after[after.length - 1]!.id).not.toBe(existing[0]!.id)
  }, 30000)

  it('refuses a risk with no name, because the name is what it is called for ever', async () => {
    const resident = residents.find((entry) => entry.id === 'res-okafor')!
    await expect(
      recordCustomRisk({
        residentId: resident.id,
        name: '   ',
        level: 'low',
        score: { kind: 'unscored' },
        description: '',
        actions: [],
        by: staffOkonkwo,
        at: NOW_ISO,
      }),
    ).rejects.toThrow(/needs a name/i)
  }, 20000)
})
