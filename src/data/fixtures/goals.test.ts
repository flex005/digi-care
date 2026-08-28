import { describe, expect, it } from 'vitest'
import { CARE_PLAN_DOMAINS } from '../types'
import { residents } from './residents'
import { NOW, toIsoDate } from './generate'
import { GOAL_GAP_IDS, goals, goalProgressNotes, progressFor } from './goals'
import { NO_GOALS_ALERT_DAYS } from '@/features/goals/goal-timing'

/**
 * Goals as a fixture. PRD §6.7, Phase 8.
 *
 * Every state a goal screen will be built against needs a goal that reaches
 * it, and the first draw of this set failed that four times over: `disagreed`
 * did not occur at all, "no target date" occurred once, and the lead finding
 * had three rows. A screen reviewed against a state that cannot occur has not
 * been reviewed.
 */

const TODAY = toIsoDate(NOW)
const byId = new Map(residents.map((resident) => [resident.id, resident]))

describe('a goal is a record somebody could have made', () => {
  it('never predates the admission of the person whose goal it is', () => {
    // Not a thin fixture but an impossible one — the same class as an incident
    // closed a day and a half from now.
    const impossible = goals.filter((goal) => {
      const resident = byId.get(goal.residentId)
      return resident !== undefined && goal.setOn < resident.admittedOn
    })
    expect(impossible.map((goal) => goal.id)).toEqual([])
  })

  it('closes on or after the day it was set, and never in the future', () => {
    for (const goal of goals) {
      if (goal.outcome.kind === 'open') continue
      expect(goal.outcome.closed.on >= goal.setOn, goal.id).toBe(true)
      expect(goal.outcome.closed.on <= TODAY, goal.id).toBe(true)
    }
  })

  /*
   * There is no test here that a withdrawal carries no resident view.
   *
   * It used to be a guard, and it is now the type: `withdrawn_by_resident`
   * carries a `GoalEnding` rather than a `GoalClosure`, so writing one with a
   * view in it does not compile. **A guard is the weaker version of the same
   * claim** — it reports the mistake after somebody makes it, and the type
   * stops them making it. Recorded here so the next person does not add the
   * test back and conclude the rule is untested.
   */

  it('files a linked goal under a domain that exists', () => {
    const declared = new Set(CARE_PLAN_DOMAINS.map((domain) => domain.id))
    for (const goal of goals) {
      if (goal.domain.kind !== 'domain') continue
      expect(declared.has(goal.domain.domainId), goal.id).toBe(true)
    }
  })

  it('attaches every progress note to a goal that exists', () => {
    const ids = new Set(goals.map((goal) => goal.id))
    for (const note of goalProgressNotes)
      expect(ids.has(note.goalId), note.id).toBe(true)
  })
})

describe('every state a goal screen will be built against has a goal reaching it', () => {
  const outcomes = new Set(goals.map((goal) => goal.outcome.kind))
  const views = new Set(
    goals.flatMap((goal) =>
      goal.outcome.kind === 'open' || goal.outcome.kind === 'withdrawn_by_resident'
        ? []
        : [goal.outcome.closed.residentView.kind],
    ),
  )

  it('reaches all five outcomes', () => {
    // Including both halves of what used to be "abandoned": somebody
    // exercising a right over their own life, and something that happened to
    // them. A screen that only ever sees one cannot be checked against the
    // other.
    for (const kind of [
      'open',
      'achieved',
      'not_achieved',
      'withdrawn_by_resident',
      'stopped_by_service',
    ] as const) {
      expect(outcomes.has(kind), kind).toBe(true)
    }
  })

  it('reaches all three of what the resident said, including disagreed', () => {
    // `disagreed` did not occur at all in the first draw. It is the state this
    // module exists for: a claim that a person got what they wanted, over
    // somebody who says they did not.
    for (const kind of ['agreed', 'disagreed', 'not_asked'] as const) {
      expect(views.has(kind), kind).toBe(true)
    }
  })

  it('reaches a goal nobody has given a target date', () => {
    // It can never be late, so a screen leading on "past its date" would
    // silently never show it.
    const undated = goals.filter((goal) => goal.target.kind === 'no_target_date')
    expect(undated.length).toBeGreaterThan(0)
  })

  it('reaches a goal past its date with nothing recorded: the lead finding', () => {
    const overdue = goals.filter(
      (goal) =>
        goal.outcome.kind === 'open' &&
        goal.target.kind === 'by_date' &&
        goal.target.on < TODAY,
    )
    expect(overdue.length).toBeGreaterThan(0)

    // And one with no progress notes at all, which is the sharpest version:
    // nobody set a date it could still be met by, and nobody wrote anything.
    const untouched = overdue.filter((goal) => progressFor(goal.id).length === 0)
    expect(untouched.length).toBeGreaterThan(0)
  })

  it('reaches a goal nobody filed under a domain', () => {
    expect(
      goals.filter((goal) => goal.domain.kind === 'not_linked').length,
    ).toBeGreaterThan(0)
  })

  it('reaches a goal with no progress notes at all', () => {
    expect(
      goals.filter((goal) => progressFor(goal.id).length === 0).length,
    ).toBeGreaterThan(0)
  })
})

describe('the deliberate cases are pinned, not left to the draw', () => {
  const find = (id: string) => goals.find((goal) => goal.id === id)

  it('holds a goal marked achieved over somebody who says it was not', () => {
    const goal = find(GOAL_GAP_IDS.achievedButDisagreed)
    expect(goal).toBeDefined()
    expect(goal!.outcome.kind).toBe('achieved')
    if (goal!.outcome.kind !== 'achieved') return
    expect(goal!.outcome.closed.residentView.kind).toBe('disagreed')
  })

  it('holds a goal the service stopped without asking the person whose goal it was', () => {
    const goal = find(GOAL_GAP_IDS.stoppedWithoutAsking)
    expect(goal).toBeDefined()
    expect(goal!.outcome.kind).toBe('stopped_by_service')
    if (goal!.outcome.kind !== 'stopped_by_service') return
    expect(goal!.outcome.closed.residentView.kind).toBe('not_asked')
  })

  it('holds a goal past its date that nobody has written a word about', () => {
    const goal = find(GOAL_GAP_IDS.pastTargetNoProgress)
    expect(goal).toBeDefined()
    expect(goal!.outcome.kind).toBe('open')
    expect(goal!.target.kind).toBe('by_date')
    expect(progressFor(goal!.id)).toEqual([])
  })

  it('holds a goal nobody ever gave a date', () => {
    const goal = find(GOAL_GAP_IDS.noTargetDate)
    expect(goal?.target.kind).toBe('no_target_date')
    expect(goal?.domain.kind).toBe('not_linked')
  })
})

describe('the population the "no goals set" alert is claimed over', () => {
  const withGoals = new Set(goals.map((goal) => goal.residentId))
  const without = residents.filter((resident) => !withGoals.has(resident.id))
  const cutoff = new Date(NOW.getTime() - NO_GOALS_ALERT_DAYS * 86_400_000)

  it('has residents here long enough for the claim to be made about them', () => {
    const alerting = without.filter(
      (resident) => new Date(resident.admittedOn) < cutoff,
    )
    expect(alerting.length).toBeGreaterThan(0)
  })

  it('has somebody here too briefly for it, who must leave the denominator', () => {
    /*
     * The same shape as the resident who cannot yet be missing a 48-hour care
     * note: the window has not elapsed, so the answer is not "no problem", it
     * is not yet knowable. Without one, the exclusion is a branch nothing
     * reaches and the screen is reviewed without it.
     */
    const tooNew = without.filter((resident) => new Date(resident.admittedOn) >= cutoff)
    expect(tooNew.length).toBeGreaterThan(0)
  })
})
