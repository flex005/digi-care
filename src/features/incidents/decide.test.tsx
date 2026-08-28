import { describe, expect, it } from 'vitest'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { incidents as fixtureIncidents } from '@/data/fixtures/incidents'
import {
  decideNotRequired,
  decideRequired,
  decisionFor,
  recordNotified,
} from '@/data/access/notification-store'

/**
 * Whether the CQC has to be told. PRD §6.5.
 *
 * The three buttons on the incident had no handler at all, so the duty the
 * compliance panel tracks could be read, judged and then not written down.
 */
describe('a notification decision is recorded against the incident', () => {
  const undecided = () =>
    fixtureIncidents.find((one) => one.notification.kind === 'not_yet_decided')!

  it('records the duty, and does not record it as discharged', () => {
    const incident = undecided()
    const decision = decideRequired(incident.id, staffOkonkwo)

    expect(decision.kind).toBe('required_not_yet_notified')
    // Accepting a duty is not the same act as discharging it, and a screen
    // that conflated them would read as "the CQC was told" on the strength of
    // somebody deciding it should be.
    expect(decisionFor(incident.id)?.kind).toBe('required_not_yet_notified')
  })

  it('refuses "not required" with no reason', () => {
    const incident = undecided()
    /*
     * A judgement with nothing behind it cannot be told from nobody having
     * made one, which is exactly the state it would be replacing.
     */
    expect(() => decideNotRequired(incident.id, '   ', staffOkonkwo)).toThrow(/why/i)

    const decision = decideNotRequired(
      incident.id,
      'no harm and no injury, outside the notifiable list',
      staffOkonkwo,
    )
    expect(decision.kind).toBe('not_required')
    if (decision.kind === 'not_required') {
      expect(decision.reason).toMatch(/notifiable list/)
      expect(decision.decided.by.id).toBe(staffOkonkwo.id)
    }
  })

  it('refuses a notification with no reference to look it up by', () => {
    const incident = undecided()
    const duty = decideRequired(incident.id, staffOkonkwo)
    if (duty.kind !== 'required_not_yet_notified') throw new Error('not a duty')

    expect(() => recordNotified(incident.id, '', staffOkonkwo, duty.decided)).toThrow(
      /reference/i,
    )

    const done = recordNotified(
      incident.id,
      'CQC-2026-0041',
      staffOkonkwo,
      duty.decided,
    )
    expect(done.kind).toBe('notified')
    if (done.kind === 'notified') {
      // Both acts survive: who decided it was needed, and who told them.
      expect(done.decided.by.id).toBe(staffOkonkwo.id)
      expect(done.notified.by.id).toBe(staffOkonkwo.id)
      expect(done.reference).toBe('CQC-2026-0041')
    }
  })
})
