import { describe, expect, it } from 'vitest'
import { CONSENT_TYPES, CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '../types'
import { recordCompleteness, staleRecords } from '../completeness'
import { residents } from './residents'
import { careNotes } from './care-notes'
import { hasStockDiscrepancy, marRecordsAll, stockCounts } from './medications'
import { sites, staff } from './organisation'

/**
 * PRD §5.3's ten deliberate gaps, asserted in CI.
 *
 * The Fixture Audit on /dev/states shows these to a human; this shows them to
 * the build. "Fixtures stay messy on purpose — the gaps are the test"
 * (CLAUDE.md §6), and a generator quietly losing a gap would mean every screen
 * built afterwards was reviewed against tidy data and signed off for the
 * wrong reason. That failure is silent and expensive, so it is pinned here.
 */

describe('fixture volume — PRD §5.2', () => {
  it('has 32 residents across 2 sites, 28 and 4', () => {
    expect(residents).toHaveLength(32)
    expect(residents.filter((r) => r.siteId === 'site-rosewood-court')).toHaveLength(28)
    expect(residents.filter((r) => r.siteId === 'site-ashgrove-lodge')).toHaveLength(4)
  })

  it('has 14 staff across the seven roles, including one deactivated', () => {
    expect(staff).toHaveLength(14)
    expect(new Set(staff.map((s) => s.role)).size).toBe(7)
    expect(staff.filter((s) => !s.isActive)).toHaveLength(1)
  })

  it('gives every site a timezone, because clinical records render in it', () => {
    for (const site of sites) {
      expect(site.timeZone).toBeTruthy()
      expect(
        () => new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone }),
      ).not.toThrow()
    }
  })

  it('lists every reference list in full on every resident', () => {
    // Absence from a list is the same bug as a blank cell. CLAUDE.md §1.
    for (const resident of residents) {
      expect(Object.keys(resident.risks)).toHaveLength(RISK_ASSESSMENT_TEMPLATES.length)
      expect(Object.keys(resident.consents)).toHaveLength(CONSENT_TYPES.length)
      expect(resident.carePlan).toHaveLength(CARE_PLAN_DOMAINS.length)
    }
  })
})

describe('PRD §5.3 — the ten deliberate gaps', () => {
  it('1. a resident with no falls risk assessment ever completed', () => {
    const noFalls = residents.filter((r) => r.risks.falls.kind === 'not_assessed')
    expect(noFalls.length).toBeGreaterThan(0)
    expect(noFalls.map((r) => r.id)).toContain('res-hutchinson')
  })

  it('2. no resuscitation decision, alongside a DNAR and a for-resuscitation', () => {
    const byKind = (kind: string) =>
      residents.filter((r) => r.resuscitation.kind === kind)
    expect(byKind('no_decision_recorded').map((r) => r.id)).toContain('res-pemberton')
    expect(byKind('dnar_in_place').map((r) => r.id)).toContain('res-okafor')
    expect(byKind('for_resuscitation').map((r) => r.id)).toContain('res-adeyemi')
  })

  it('3. a resident admitted yesterday with almost nothing filled in', () => {
    const newcomer = residents.find((r) => r.id === 'res-sowande')
    expect(newcomer).toBeDefined()
    const daysSince = Math.round(
      (Date.now() - new Date(newcomer!.admittedOn).getTime()) / 86_400_000,
    )
    expect(daysSince).toBeLessThanOrEqual(2)
    // Their header must read as unknown, not as untroubled.
    expect(recordCompleteness(newcomer!).missing.length).toBeGreaterThan(15)
    expect(newcomer!.allergies.kind).toBe('not_recorded')
    expect(newcomer!.resuscitation.kind).toBe('no_decision_recorded')
  })

  it('4. exactly three medication omissions, with distinct escalation states', () => {
    const omissions = marRecordsAll.filter((r) => r.state.kind === 'omitted')
    // PRD §5.3 says three. Three hundred random ones would drown the
    // escalation distinction the union exists to express.
    expect(omissions).toHaveLength(3)

    const gaps = omissions.map((record) => {
      if (record.state.kind !== 'omitted') throw new Error('not an omission')
      return record.state.escalation.kind === 'escalated'
        ? Math.round(
            (new Date(record.state.escalation.at).getTime() -
              new Date(record.state.dueAt).getTime()) /
              60_000,
          )
        : -1
    })

    expect(gaps.filter((minutes) => minutes > 60)).toHaveLength(1)
    expect(gaps.filter((minutes) => minutes >= 30 && minutes <= 60)).toHaveLength(1)
    expect(gaps.filter((minutes) => minutes === -1)).toHaveLength(1)
  })

  it('5. a controlled drug with a stock count discrepancy', () => {
    const discrepancies = stockCounts.filter(hasStockDiscrepancy)
    expect(discrepancies.length).toBeGreaterThan(0)
    expect(discrepancies[0]!.expected).not.toBe(discrepancies[0]!.counted)
    // And one that reconciles, so the discrepancy is a contrast not a default.
    expect(stockCounts.some((count) => !hasStockDiscrepancy(count))).toBe(true)
  })

  it('6. withdrawn photography consent with photos still on file', () => {
    const withdrawn = residents.filter(
      (r) => r.consents.photography.kind === 'withdrawn',
    )
    expect(withdrawn.map((r) => r.id)).toContain('res-brennan')
    const consent = withdrawn[0]!.consents.photography
    if (consent.kind !== 'withdrawn') throw new Error('expected withdrawn')
    // Withdrawal does not retroactively delete what was taken while consent
    // was given — the downstream effect the Phase 10 flow has to surface.
    expect(consent.note).toMatch(/remain on file/i)
    expect(consent.previouslyConsentedOn).toBeTruthy()
  })

  it('7. a care plan domain finalised long ago and never reviewed', () => {
    const adeyemi = residents.find((r) => r.id === 'res-adeyemi')!
    const mobility = adeyemi.carePlan.find((d) => d.domainId === 'mobility')!
    expect(mobility.status.kind).toBe('review_due')
    if (mobility.status.kind !== 'review_due') throw new Error('expected review_due')
    expect(mobility.status.daysOverdue).toBeGreaterThan(55)
    expect(staleRecords(adeyemi).length).toBeGreaterThan(0)
  })

  it('8. a note flagged and not reviewed, and a correction note', () => {
    const flagged = careNotes.filter((n) => n.review.kind === 'flagged_not_reviewed')
    expect(flagged.length).toBeGreaterThan(0)

    const correction = careNotes.find((n) => n.corrects !== 'none')
    expect(correction).toBeDefined()

    // Care notes are immutable. The original stays visible, marked
    // superseded — the fact that somebody first recorded the wrong thing is
    // itself part of the record. CLAUDE.md §6.
    const original = careNotes.find((n) => n.id === correction!.corrects)
    expect(original).toBeDefined()
    expect(original!.supersededBy).toBe(correction!.id)
  })

  it('9. a site thin enough for Insufficient Evidence', () => {
    const ashgrove = residents.filter((r) => r.siteId === 'site-ashgrove-lodge')
    const assessed = ashgrove.filter((r) => r.risks.falls.kind === 'assessed').length
    expect(assessed / ashgrove.length).toBeLessThan(0.6)
  })

  it('10. a record authored by a now-deactivated staff member', () => {
    const deactivated = staff.filter((s) => !s.isActive).map((s) => s.id)
    const authored = careNotes.filter((n) => deactivated.includes(n.recordedBy.id))
    expect(authored.length).toBeGreaterThan(0)
    // Records outlive access, and stay attributed.
    expect(authored[0]!.recordedBy.isActive).toBe(false)
  })
})

describe('the fixtures discriminate', () => {
  /**
   * A gap that every resident has is not a signal. These bounds are what make
   * the residents list filters and the Partial and Stale states worth
   * building — if they ever go to 0 or 32, the screen has stopped testing
   * anything.
   */
  it('flags some but not all residents as having a critical gap', () => {
    const critical = residents.filter(
      (r) => recordCompleteness(r).hasCriticalGaps,
    ).length
    expect(critical).toBeGreaterThan(4)
    expect(critical).toBeLessThan(residents.length)
  })

  it('gives some but not all residents a stale record', () => {
    const stale = residents.filter((r) => staleRecords(r).length > 0).length
    expect(stale).toBeGreaterThan(2)
    expect(stale).toBeLessThan(residents.length)
  })

  it('names what is missing rather than counting it', () => {
    const withGaps = residents.find((r) => recordCompleteness(r).hasCriticalGaps)!
    for (const gap of recordCompleteness(withGaps).missing) {
      expect(gap.label).toMatch(/[a-z]/i)
      // Never a bare number. Rule 4.
      expect(gap.label).not.toMatch(/^\d+$/)
    }
  })
})

describe('determinism', () => {
  it('produces stable ids, so a review finding can be reproduced', () => {
    expect(residents.map((r) => r.id)).toContain('res-okafor')
    expect(residents.filter((r) => r.id === 'res-okafor')).toHaveLength(1)
    expect(new Set(residents.map((r) => r.id)).size).toBe(residents.length)
  })
})

describe('records cannot be in the future', () => {
  /**
   * A care note timestamped after now is not messy data, it is impossible
   * data — and it renders as "in 12 hours", which reads as a plan rather than
   * an observation. The deliberate gaps in these fixtures are all absences;
   * none of them is a record of something that has not happened.
   */
  it('records no care note, mood or review later than now', () => {
    const now = Date.now()
    for (const note of careNotes) {
      expect(new Date(note.recordedAt).getTime()).toBeLessThanOrEqual(now)
      if (note.mood.kind === 'recorded') {
        expect(new Date(note.mood.recordedAt).getTime()).toBeLessThanOrEqual(now)
      }
      if (note.review.kind === 'reviewed') {
        expect(new Date(note.review.reviewedAt).getTime()).toBeLessThanOrEqual(now)
      }
      if (note.review.kind === 'flagged_not_reviewed') {
        expect(new Date(note.review.flaggedAt).getTime()).toBeLessThanOrEqual(now)
      }
    }
  })

  it('records no administration later than now', () => {
    const now = Date.now()
    for (const record of marRecordsAll) {
      const { state } = record
      if (state.kind === 'given') {
        expect(new Date(state.givenAt).getTime()).toBeLessThanOrEqual(now)
      }
      if (state.kind === 'not_given') {
        expect(new Date(state.recordedAt).getTime()).toBeLessThanOrEqual(now)
      }
      // `due` and `not_due` are about the future by definition — they are
      // expectations, not records — so they are exempt.
    }
  })
})
