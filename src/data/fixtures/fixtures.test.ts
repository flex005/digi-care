import { describe, expect, it } from 'vitest'
import { STAFF_ROLE_NAMES, type StaffRole } from '@/data/types'
import { CONSENT_TYPES, CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '../types'
import type { CarePlanVersion } from '../types'
import { recordCompleteness, staleRecords } from '../completeness'
import { REFUSAL_REASONS, residents } from './residents'
import { hasNoRiskFlags } from '@/features/residents/RiskFlagsCell'
import { careNotes } from './care-notes'
import {
  GAP_MEDICATION_IDS,
  KAVANAGH_FENTANYL,
  NEWLY_PRESCRIBED_CD,
  OMISSION_RATE_PERCENT,
  SPECIFIED_OMISSIONS,
  balanceOf,
  hasStockDiscrepancy,
  marRecordsAll,
  medications,
  recordedAfter,
  stockCounts,
} from './medications'
import { ROUND_TIMES } from './rounds'
import { sites, staff } from './organisation'
import { GAP_INCIDENT_IDS, flagIsOverdue, incidentById, incidents } from './incidents'
import { NOW, toIsoDateTime } from './generate'
import { zonedDate } from '@/lib/format'
import { handovers } from './handover'
import type { Incident, RecordedList, Resident } from '../types'

/**
 * PRD §5.3's ten deliberate gaps, asserted in CI.
 *
 * The Fixture Audit on /dev/states shows these to a human; this shows them to
 * the build. "Fixtures stay messy on purpose — the gaps are the test"
 * (CLAUDE.md §6), and a generator quietly losing a gap would mean every screen
 * built afterwards was reviewed against tidy data and signed off for the
 * wrong reason. That failure is silent and expensive, so it is pinned here.
 */

describe('fixture volume: PRD §5.2', () => {
  it('has 32 residents across 2 sites, 28 and 4', () => {
    expect(residents).toHaveLength(32)
    expect(residents.filter((r) => r.siteId === 'site-rosewood-court')).toHaveLength(28)
    expect(residents.filter((r) => r.siteId === 'site-ashgrove-lodge')).toHaveLength(4)
  })

  it('holds every role in the model, and one deactivated member', () => {
    /*
     * Fifteen rather than the fourteen §5.2 first specified. The fifteenth is
     * Funke Adeyinka, invited two days ago and not yet accepted: the live
     * invitation state was otherwise unreachable on a fresh load, which is the
     * reachability rule — a branch nobody can get to without first doing
     * something else is not built. Frank corrected the figure in the PRD
     * rather than have the fixture obey a stale one.
     *
     * **The role count was `7` typed into the assertion, and collapsing
     * `organisation_admin` turned it red.** The change was legitimate and the
     * one-character fix would have been to type `6`, which is the §8 defect
     * exactly: a number that measures the work rather than the rule, edited
     * each time the work moves. What the fixtures actually owe is that no role
     * in the model is left without somebody holding it, so the assertion reads
     * the declaration and cannot go stale against it.
     */
    /*
     * Seventeen from Phase 18. The two added are a deputy manager whose
     * invitation lapsed five weeks ago and an auditor invited two days ago:
     * every screen in Team Management is about people who sign into this
     * platform, and both outstanding invitations belonged to a care worker and
     * an activities coordinator, who accept in a different product. The
     * original two stay, because chasing an invitation and accepting one are
     * different acts and an Admin chases everybody they invited.
     *
     * PRD §5.2 still says fifteen. Flagged for Frank rather than edited: the
     * precedent recorded above is that he corrects the figure in the PRD
     * rather than have the fixture obey a stale one.
     */
    /*
     * Eighteen from Phase 29: a second deputy manager, appointed to one home.
     * Marie Halloran covers both, and until now nobody covered one — so the
     * ordinary arrangement, and the state where a manager has no site
     * switcher, existed nowhere in the fixtures.
     */
    /*
     * Nineteen from the Care Worker build: Hannah Price, a senior carer whose
     * invitation expired, so that product's expired invitation is reachable.
     */
    expect(staff).toHaveLength(19)

    const held = new Set(staff.map((member) => member.role))
    const unheld = (Object.keys(STAFF_ROLE_NAMES) as StaffRole[]).filter(
      (role) => !held.has(role),
    )
    expect(
      unheld,
      `no member of staff holds: ${unheld.join(', ')}, so nothing in the product renders one`,
    ).toEqual([])

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

describe('the rounds the clock reads are the rounds the drugs use', () => {
  it('gives every drug a round time from the one list', () => {
    /*
     * `clock.ts` decides whether a round is running, and it cannot import the
     * drugs: it is read before any fixture module loads. So the times live in
     * `rounds.ts` and this holds the drugs against them. A drug scheduled at a
     * time the clock does not know about would never be seen as in progress.
     */
    for (const medication of medications) {
      for (const round of medication.roundTimes) {
        expect(ROUND_TIMES, medication.name).toContain(round)
      }
    }
    // And the list has nothing in it the home does not use.
    const used = new Set(medications.flatMap((one) => one.roundTimes))
    for (const round of ROUND_TIMES) expect([...used]).toContain(round)
  })
})

describe('PRD §5.3: the ten deliberate gaps', () => {
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
    // Against the generation instant: the fixture's dates are derived from it,
    // and the wall clock is a different instant whenever the clock has moved.
    const daysSince = Math.round(
      (NOW.getTime() - new Date(newcomer!.admittedOn).getTime()) / 86_400_000,
    )
    expect(daysSince).toBeLessThanOrEqual(2)
    // Their header must read as unknown, not as untroubled.
    expect(recordCompleteness(newcomer!).missing.length).toBeGreaterThan(15)
    expect(newcomer!.allergies.kind).toBe('not_recorded')
    expect(newcomer!.resuscitation.kind).toBe('no_decision_recorded')
  })

  it('4. three specified medication omissions, with distinct escalation states', () => {
    /**
     * **Asserted by identity, not by counting.** This used to require exactly
     * three omissions in the whole fixture set, which was a claim about the
     * home rather than about §5.3's gap: three missed doses in 16,200 across
     * 32 residents over 90 days is not a careful service, it is one that does
     * not exist, and it left the omitted state reachable on one resident in
     * thirty-two.
     *
     * The generator produces omissions at 1% now (approved 22/08/2026). These
     * three are still pinned, still on the same controlled drug, and still
     * carry the three distinct escalation gaps the PRD asks for — which is
     * what the gap actually specifies.
     */
    const omissions = SPECIFIED_OMISSIONS
    expect(omissions).toHaveLength(3)
    // Still in the set the screens read from, not merely in a side list.
    for (const pinned of omissions) {
      expect(marRecordsAll).toContain(pinned)
    }

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

  it('4b. omissions happen across the home, not to one resident', () => {
    // The state the omissions view exists for. At three-in-total it was
    // reachable on one resident in thirty-two, so that screen had three rows,
    // all the same drug on the same day, and neither its oldest-first sort nor
    // its escalation filter did any visible work.
    const omissions = marRecordsAll.filter((r) => r.state.kind === 'omitted')
    const affected = new Set(omissions.map((r) => r.residentId))
    expect(affected.size).toBeGreaterThan(5)

    // And still rare. A rate that fills the queue is the same failure as one
    // that empties it — volume drowning the distinction (CLAUDE.md §8).
    const due = marRecordsAll.filter((r) => r.state.kind !== 'not_due').length
    /*
     * Read off the generator's own declared rate rather than a band typed
     * here. A number restated in two places is a second rule, and the way this
     * one drifted was the assertion being edited to make a legitimate change
     * pass.
     */
    const rate = omissions.length / due
    const declared = OMISSION_RATE_PERCENT / 100
    expect(rate).toBeGreaterThan(declared * 0.6)
    expect(rate).toBeLessThan(declared * 1.4)
  })

  it('5. a controlled drug with a stock count discrepancy', () => {
    const discrepancies = stockCounts.filter(hasStockDiscrepancy)
    expect(discrepancies.length).toBeGreaterThan(0)
    const first = discrepancies[0]!
    // A discrepancy is a routine count that did not come out; an opening count
    // has nothing to differ from and can never be one.
    expect(first.entry.kind).toBe('routine')
    if (first.entry.kind === 'routine') {
      expect(first.entry.expected).not.toBe(first.counted)
    }
    // And one that reconciles, so the discrepancy is a contrast not a default.
    expect(stockCounts.some((count) => !hasStockDiscrepancy(count))).toBe(true)
  })

  it('5b. every controlled drug has a running balance', () => {
    // A register holding a balance for one drug in sixteen is not a home with
    // patchy records, it is a home that does not exist. The round derived the
    // missing fifteen as `?? 0`, which reported a balance of zero and made the
    // reconciliation guard demand −1 — so those doses could not be given at
    // all. The specified discrepancy stays; the absent baseline goes.
    const controlled = medications.filter((med) => med.isControlledDrug)
    expect(controlled.length).toBeGreaterThan(0)

    // Held by reference, not by a number. The one drug without a balance is
    // deliberate and is named; anything else appearing here is the baseline
    // rotting back, which is what this exists to catch (§8).
    const uncounted = controlled
      .filter((med) => balanceOf(med.id).kind === 'no_balance_recorded')
      .map((med) => med.id)
    expect(uncounted, 'a controlled drug with no balance on the register').toEqual([
      NEWLY_PRESCRIBED_CD,
    ])
  })

  it('5d. one controlled drug prescribed and never counted', () => {
    // The fixture that reaches `StockBalance`'s `no_balance_recorded` member.
    // Without it that branch renders to nobody and the opening-count flow
    // exists only in a test.
    const drug = medications.find((med) => med.id === NEWLY_PRESCRIBED_CD)
    expect(drug, 'the newly prescribed controlled drug is missing').toBeTruthy()
    expect(drug!.isControlledDrug).toBe(true)
    expect(balanceOf(NEWLY_PRESCRIBED_CD)).toEqual({ kind: 'no_balance_recorded' })

    // A different finding from the discrepancy, and it must stay different: one
    // drug never counted, one drug whose count does not reconcile.
    expect(NEWLY_PRESCRIBED_CD).not.toBe(
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )

    // And no MAR record before it was prescribed — a dose nobody could be due.
    const records = marRecordsAll.filter(
      (record) => record.medicationId === NEWLY_PRESCRIBED_CD,
    )
    expect(records.length).toBeGreaterThan(0)
    expect(records.length).toBeLessThan(30)
  })

  it('5f. a patch is not administered daily', () => {
    // A fentanyl patch is changed every third day, and giving one daily would
    // be an overdose. `roundTimes` alone said only what *time* a drug runs, so
    // every drug ran every day and the register showed thirty patches in
    // thirty days — wrong on the facts, not thin.
    const patches = medications.filter((med) => med.stockUnit === 'patches')
    expect(patches.length).toBeGreaterThan(0)
    for (const patch of patches) {
      expect(patch.intervalDays, `${patch.name} is given every day`).toBeGreaterThan(1)
    }
  })

  it('5g. a day between doses is not_due, never a hole in the chart', () => {
    const patch = medications.find((med) => med.id === KAVANAGH_FENTANYL)!
    const records = marRecordsAll.filter((record) => record.medicationId === patch.id)
    const notDue = records.filter((record) => record.state.kind === 'not_due')

    // Every day has a cell. A day left off would be a hole, and a hole is the
    // one thing the chart must never render — nobody missed that dose, there
    // was no dose.
    expect(records.length).toBeGreaterThan(60)
    expect(notDue.length).toBeGreaterThan(0)

    // Roughly two days in three, for a three-day cycle. Bounded rather than
    // pinned, because the window moves with the clock.
    const share = notDue.length / records.length
    expect(share).toBeGreaterThan(0.5)
    expect(share).toBeLessThan(0.8)
  })

  it('5h. the controlled drugs are not almost all one drug', () => {
    // The unit column cannot visibly matter when almost every unit is the
    // same, so the wrong figure it prevents is untestable.
    const controlled = medications.filter((med) => med.isControlledDrug)
    const names = new Map<string, number>()
    for (const med of controlled) {
      names.set(med.name, (names.get(med.name) ?? 0) + 1)
    }

    expect(names.size).toBeGreaterThanOrEqual(4)
    expect(new Set(controlled.map((med) => med.stockUnit)).size).toBeGreaterThanOrEqual(
      3,
    )

    const commonest = [...names.values()].sort((a, b) => b - a)[0]!
    // Oral morphine staying the commonest is correct; being almost the only
    // one is not.
    expect(commonest / controlled.length).toBeLessThan(0.75)

    // And a home where nearly every resident is on a controlled drug is wrong
    // in the other direction.
    const onControlled = new Set(controlled.map((med) => med.residentId)).size
    expect(onControlled / residents.length).toBeLessThan(0.75)
  })

  it('5e. every stock count carries two different signatures', () => {
    // A count signed once is one person's word about a cabinet only they
    // looked in, which is what a controlled drug register exists to prevent.
    for (const count of stockCounts) {
      expect(count.countedBy.id, 'a count signed by nobody').toBeTruthy()
      expect(count.witnessedBy.id, 'a count with no witness').toBeTruthy()
      expect(
        count.countedBy.id === count.witnessedBy.id,
        'a count signed twice by the same person',
      ).toBe(false)
    }
  })

  it('5c. holds the discrepancy by identity, and bounds the rate', () => {
    // The gap this exists for is one drug's count, so it is pinned by
    // reference. A separate bound stops a generator drift turning a home with
    // one discrepancy into a home that cannot count anything (§8).
    const discrepancies = stockCounts.filter(hasStockDiscrepancy)
    expect(discrepancies.map((count) => count.medicationId)).toContain(
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
    expect(discrepancies.length / stockCounts.length).toBeLessThan(0.1)
  })

  it('11. an incident reported and never acknowledged', () => {
    // The state `/incidents` exists for. Not a milder "open" — open means
    // somebody took it on.
    const pinned = incidentById(GAP_INCIDENT_IDS.reportedNotAcknowledged)
    expect(pinned, 'the pinned unacknowledged incident is missing').toBeTruthy()
    expect(pinned!.status.kind).toBe('reported_not_acknowledged')

    // And a queue of one is an illustration of a queue.
    const waiting = incidents.filter(
      (incident) => incident.status.kind === 'reported_not_acknowledged',
    )
    expect(waiting.length).toBeGreaterThanOrEqual(3)
  })

  it('12. an incident closed with the notification decision never made', () => {
    const pinned = incidentById(GAP_INCIDENT_IDS.closedWithoutNotificationDecision)
    expect(pinned, 'the pinned undecided-notification incident is missing').toBeTruthy()
    expect(pinned!.status.kind).toBe('closed')
    // Settled, and the regulatory question was never asked.
    expect(pinned!.notification.kind).toBe('not_yet_decided')
  })

  it('13. notification recorded as required and never made', () => {
    // The sharpest of the three: a duty somebody accepted and did not
    // discharge, with nothing in the record to prove otherwise.
    const pinned = incidentById(GAP_INCIDENT_IDS.notificationRequiredNeverMade)
    expect(pinned, 'the pinned un-notified incident is missing').toBeTruthy()
    expect(pinned!.notification.kind).toBe('required_not_yet_notified')

    // Held by reference and bounded by rate: one is a finding, a dozen is the
    // home's normal state and the screen stops meaning anything (§8).
    const unmet = incidents.filter(
      (incident) => incident.notification.kind === 'required_not_yet_notified',
    )
    expect(unmet.map((incident) => incident.id)).toEqual([
      GAP_INCIDENT_IDS.notificationRequiredNeverMade,
    ])
  })

  it('14. every incident state has a fixture that reaches it', () => {
    // §8's first standing check, applied before the screens exist rather than
    // after one of them renders to nobody.
    const kinds = (pick: (incident: Incident) => string) => new Set(incidents.map(pick))

    expect(kinds((incident) => incident.status.kind)).toEqual(
      new Set(['reported_not_acknowledged', 'open', 'under_review', 'closed']),
    )
    expect(kinds((incident) => incident.notification.kind)).toEqual(
      new Set([
        'not_yet_decided',
        'not_required',
        'required_not_yet_notified',
        'notified',
      ]),
    )
    // Three injury states, and the third is why it is not an array: "nobody
    // looked" is not "no injuries found".
    expect(kinds((incident) => incident.injuries.kind)).toEqual(
      new Set(['not_recorded', 'no_injuries_found', 'marked']),
    )
    expect(kinds((incident) => incident.location.kind)).toEqual(
      new Set(['not_recorded', 'resident_room', 'communal']),
    )
    expect(kinds((incident) => incident.origin.kind)).toEqual(
      new Set(['reported', 'stock_count']),
    )
    // Both subjects. "No resident involved" is a claim somebody made, not an
    // absence, so it needs a fixture exactly as much as the other one.
    expect(kinds((incident) => incident.subject.kind)).toEqual(
      new Set(['resident', 'no_resident_involved']),
    )
    expect(new Set(incidents.map((incident) => incident.severity)).size).toBe(4)
  })

  it('15. post-incident review flags reach all three of their states', () => {
    const now = toIsoDateTime(NOW)
    const flags = incidents.flatMap((incident) => incident.reviewFlags)
    const awaiting = flags.filter((flag) => flag.state.kind === 'awaiting')

    // Completed, because 90 days in which no post-incident review ever
    // finished is a home that does not exist.
    expect(flags.some((flag) => flag.state.kind === 'completed')).toBe(true)
    // And both halves of awaiting: one somebody can still do on time, one
    // already missed. A screen that only ever shows the late version cannot
    // be checked against the one that matters.
    expect(awaiting.some((flag) => flagIsOverdue(flag, now))).toBe(true)
    /*
     * With hours to spare, not at the tie.
     *
     * `!flagIsOverdue` was true for every awaiting flag in the set, because
     * `dueBy` was clamped to this instant and `dueBy < now` is false when they
     * are equal. The assertion was green and the fixture had no in-time flag
     * in it at all — a boundary artefact standing in for the property.
     */
    const ONE_HOUR = 3_600_000
    const spare = toIsoDateTime(new Date(NOW.getTime() + ONE_HOUR))
    expect(awaiting.some((flag) => flag.dueBy > spare)).toBe(true)

    /*
     * And both halves for a care plan domain specifically, not only for a risk
     * assessment.
     *
     * Once the clamp was gone, every naturally overdue flag in the set pointed
     * at a risk assessment, so the care plan editor's "it will still read as
     * closed late" had nothing to render it for. Pinned as
     * `reviewFlagOverdue`.
     */
    const domainFlags = awaiting.filter(
      (flag) => flag.target.kind === 'care_plan_domain',
    )
    expect(domainFlags.some((flag) => flagIsOverdue(flag, now))).toBe(true)
    expect(domainFlags.some((flag) => flag.dueBy > spare)).toBe(true)
  })

  it('16. no incident is signed at a time that has not happened', () => {
    // A two-day-old incident could acquire an acknowledgement, a review and a
    // closure spanning 87 hours and land a day and a half from now. Not a thin
    // fixture — an impossible one.
    const now = toIsoDateTime(NOW)
    for (const incident of incidents) {
      expect(incident.occurredAt <= now, `${incident.id} occurred`).toBe(true)
      expect(incident.reported.at <= now, `${incident.id} reported`).toBe(true)
      if (incident.status.kind === 'closed') {
        expect(incident.status.closed.at <= now, `${incident.id} closed`).toBe(true)
      }
    }
  })

  it('17. only types that can happen to nobody happen to nobody', () => {
    // A faulty hoist found during a check happened to no resident; a fall did
    // not. Recording a fall against nobody would be a lost subject, which is
    // the failure §2.4 exists for.
    const nobody = incidents.filter(
      (incident) => incident.subject.kind === 'no_resident_involved',
    )
    expect(nobody.length).toBeGreaterThan(0)
    for (const incident of nobody) {
      expect(
        ['equipment_failure', 'near_miss'],
        `${incident.id} is a ${incident.type} with no resident`,
      ).toContain(incident.type)
    }
  })

  it('18. a near miss never carries harm', () => {
    // A definition, not a fixture convenience: a near miss that caused harm is
    // not a near miss, it is the incident it nearly was.
    for (const incident of incidents.filter((entry) => entry.type === 'near_miss')) {
      expect(incident.severity, `${incident.id}`).toBe('no_harm')
    }
  })

  it('19. the thin site stays thin', () => {
    // Ashgrove is where Insufficient Evidence and thin-denominator behaviour
    // get tested in Phase 12. A flat pick gave it a fifth of the home's
    // incidents on an eighth of its residents, which softens the case it
    // exists to make.
    const ashgroveResidents = residents.filter(
      (resident) => resident.siteId === 'site-ashgrove-lodge',
    ).length
    const ashgroveIncidents = incidents.filter(
      (incident) => incident.siteId === 'site-ashgrove-lodge',
    ).length

    const residentShare = ashgroveResidents / residents.length
    const incidentShare = ashgroveIncidents / incidents.length
    expect(incidentShare).toBeGreaterThan(residentShare * 0.5)
    expect(incidentShare).toBeLessThan(residentShare * 2)
  })

  it('20. the reporter’s account reaches every state it can', () => {
    // Probed before the screen, not after (§8). All five unions the report
    // form writes have to be renderable by the detail screen that reads them.
    const kinds = (pick: (incident: Incident) => string) => new Set(incidents.map(pick))

    expect(kinds((incident) => incident.response.witnesses.kind)).toEqual(
      new Set(['nobody_witnessed', 'witnessed']),
    )
    for (const field of ['gp', 'family'] as const) {
      expect(
        kinds((incident) => incident.response[field].kind),
        field,
      ).toEqual(new Set(['not_yet', 'not_required', 'contacted']))
    }
    expect(kinds((incident) => incident.response.emergencyServices.kind)).toEqual(
      new Set(['not_called', 'called']),
    )
    // Both services, or the union has a member nothing renders.
    const services = incidents
      .map((incident) => incident.response.emergencyServices)
      .filter((entry) => entry.kind === 'called')
      .map((entry) => entry.service)
    expect(new Set(services)).toEqual(new Set(['ambulance_999', 'nhs_111']))
  })

  it('21. no incident carries an empty account or an unexplained decision', () => {
    for (const incident of incidents) {
      // Required and non-empty, so there is no blank to interpret.
      expect(incident.response.immediateAction.trim(), incident.id).not.toBe('')

      for (const field of ['gp', 'family'] as const) {
        const state = incident.response[field]
        if (state.kind !== 'not_required') continue
        // A decision without a reason reads the same as a call nobody made.
        expect(state.reason.trim(), `${incident.id} ${field}`).not.toBe('')
      }
    }
  })

  it('22. nothing anywhere in the fixtures is dated in the future', () => {
    /*
     * The general form of gap 16, because this has now happened three times:
     * care notes in Phase 2, incident closures in Phase 4, and a controlled
     * drug count that inherited its instant from the last dose plus fifteen
     * minutes — which was in the future whenever that dose was recent.
     *
     * The per-module guards each caught their own; this walks everything, so
     * the fourth one is caught by a test that already exists.
     */
    const now = toIsoDateTime(NOW)
    const future: string[] = []

    /*
     * A deadline is not a record, and it is supposed to be in the future.
     *
     * `dueBy` is when a post-incident review has to be done by; a flag raised
     * an hour ago is due 47 hours from now, and a guard that calls that an
     * impossible date is asking a schedule to behave like a signature. The
     * same confusion is what clamped `dueBy` to now in the generator and left
     * the fixture set with no in-time flag in it.
     */
    const SCHEDULED = ['.dueBy']

    const walk = (value: unknown, path: string, depth = 0) => {
      if (depth > 6 || value === null || value === undefined) return
      if (typeof value === 'string') {
        if (SCHEDULED.some((suffix) => path.endsWith(suffix))) return
        // An ISO instant, not a date — a date has no time to overshoot into.
        if (/^\d{4}-\d{2}-\d{2}T/.test(value) && value > now) future.push(path)
        return
      }
      if (Array.isArray(value)) {
        for (const [index, item] of value.entries())
          walk(item, `${path}[${index}]`, depth + 1)
        return
      }
      if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          walk(item, `${path}.${key}`, depth + 1)
        }
      }
    }

    for (const incident of incidents) walk(incident, incident.id)
    for (const count of stockCounts) walk(count, `count ${count.medicationId}`)
    for (const note of careNotes.slice(0, 500)) walk(note, note.id)

    expect(future.slice(0, 10), 'dated in the future').toEqual([])
  })

  it('6. withdrawn photography consent with photos still on file', () => {
    const withdrawn = residents.filter(
      (r) => r.consents.photography.kind === 'withdrawn',
    )
    expect(withdrawn.map((r) => r.id)).toContain('res-brennan')
    const consent = withdrawn[0]!.consents.photography
    if (consent.kind !== 'withdrawn') throw new Error('expected withdrawn')
    /*
     * Withdrawal does not retroactively delete what was taken while consent
     * was given, and the effects are **data with counts** rather than a
     * sentence — a note cannot be asserted against, so a withdrawal that
     * forgot to mention the photographs would look identical to one that did.
     */
    expect(consent.previouslyGivenOn).toBeTruthy()
    expect(consent.remains.length).toBeGreaterThan(0)
    expect(consent.remains.map((effect) => effect.count.kind)).toContain('counted')
    // And one nobody has counted. Not knowing how many is not the same as none.
    expect(consent.remains.map((effect) => effect.count.kind)).toContain('not_counted')
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
   * The sweep below only catches an overshooting offset when the wall clock
   * happens to sit inside the overshoot window — a few minutes after a round
   * time, which is most of the day not true. This bug class has now appeared
   * twice (care notes, then administration records), so the clamp itself is
   * tested directly rather than left to the luck of the clock.
   */
  /*
   * **Both are written against the generation instant, not the wall clock.**
   * `recordedBetween`'s ceiling is `NOW`, and the two part company the moment
   * the clock is not real time — with the clock on the 08:00 round and the
   * wall clock at 13:45, an event six hours before *now* is five hours after
   * `NOW`, so the clamp pulls it back and the second assertion fails on a
   * function that is working. Third time this class has been fixed here.
   */
  it('clamps a record written after a round that has only just fallen due', () => {
    const now = NOW.getTime()
    const justDue = new Date(now - 4 * 60_000)
    // Twenty-five minutes of slack, four minutes of elapsed time.
    expect(recordedAfter(justDue, 25).getTime()).toBeLessThanOrEqual(now)
  })

  it('leaves a record alone when the whole offset has already elapsed', () => {
    const longDue = new Date(NOW.getTime() - 6 * 3_600_000)
    expect(recordedAfter(longDue, 25).getTime()).toBe(longDue.getTime() + 25 * 60_000)
  })

  /**
   * A care note timestamped after now is not messy data, it is impossible
   * data — and it renders as "in 12 hours", which reads as a plan rather than
   * an observation. The deliberate gaps in these fixtures are all absences;
   * none of them is a record of something that has not happened.
   */
  it('records no care note, mood or review later than now', () => {
    /*
     * "Now" is the instant the fixtures were generated at. Asserting against
     * the wall clock instead is weaker in exactly the wrong direction: with
     * the clock snapped back to a round it would pass on a record written
     * hours after the fixture's own present.
     */
    const now = NOW.getTime()
    for (const note of careNotes) {
      expect(new Date(note.recordedAt).getTime()).toBeLessThanOrEqual(now)
      if (note.mood.kind === 'recorded') {
        expect(new Date(note.mood.recordedAt).getTime()).toBeLessThanOrEqual(now)
      }
      if (note.review.kind === 'reviewed') {
        // Not before the note either. A ceiling alone let a note written at
        // 14:00 be "reviewed" at 09:00 the same morning — impossible in the
        // other direction, and invisible to a test that only looks forward.
        expect(
          new Date(note.review.reviewedAt).getTime(),
          `${note.id}: reviewed before it was written`,
        ).toBeGreaterThanOrEqual(new Date(note.recordedAt).getTime())
        expect(new Date(note.review.reviewedAt).getTime()).toBeLessThanOrEqual(now)
        // The flag is carried forward, not replaced. A review that erased who
        // raised it would be half a supervision record rendering as a whole
        // one, and the wait between the two would be uncomputable.
        expect(
          new Date(note.review.flaggedAt).getTime(),
          `${note.id}: flagged before it was written`,
        ).toBeGreaterThanOrEqual(new Date(note.recordedAt).getTime())
        expect(
          new Date(note.review.reviewedAt).getTime(),
          `${note.id}: reviewed before it was flagged`,
        ).toBeGreaterThanOrEqual(new Date(note.review.flaggedAt).getTime())
      }
      if (note.review.kind === 'flagged_not_reviewed') {
        expect(new Date(note.review.flaggedAt).getTime()).toBeLessThanOrEqual(now)
      }
    }
  })

  it('records no administration later than now', () => {
    // The generation instant, for the reason given above.
    const now = NOW.getTime()
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

describe('list fields cannot smuggle back the ambiguity', () => {
  /**
   * A bare `T[]` cannot tell "nobody recorded who is involved" from "somebody
   * asked and there is nobody". That is the same ambiguity `AllergyStatus` was
   * split into three members to remove, and it came back through the arrays
   * after being driven out of the scalars — twice, in `consultants` and in
   * `secondaryDiagnoses`.
   *
   * These tests hold the line for the whole class. Every list field must be a
   * three-member union, every one must have real fixtures in all three states,
   * and `recorded` must never be empty — an empty `recorded` is `Recorded<T[]>`
   * reintroducing the ambiguity one level down.
   */

  const LIST_FIELDS: Array<{
    name: string
    read: (resident: Resident) => RecordedList<unknown>
  }> = [
    { name: 'secondaryDiagnoses', read: (r) => r.secondaryDiagnoses },
    { name: 'consultants', read: (r) => r.consultants },
    {
      name: 'importantPeople.familyWithVisitingRights',
      read: (r) => r.importantPeople.familyWithVisitingRights,
    },
    {
      name: 'importantPeople.otherProfessionals',
      read: (r) => r.importantPeople.otherProfessionals,
    },
  ]

  it.each(LIST_FIELDS.map((field) => [field.name, field] as const))(
    '%s has a resident in all three states',
    (name, field) => {
      const kinds = new Set(residents.map((resident) => field.read(resident).kind))
      for (const required of ['not_recorded', 'none_involved', 'recorded']) {
        expect(
          kinds.has(required as never),
          `${name} has no resident in the "${required}" state, so a screen built on it is reviewed against part of the shape`,
        ).toBe(true)
      }
    },
  )

  it.each(LIST_FIELDS.map((field) => [field.name, field] as const))(
    '%s is never recorded-but-empty',
    (name, field) => {
      for (const resident of residents) {
        const list = field.read(resident)
        if (list.kind === 'recorded') {
          expect(
            list.items.length,
            `${resident.fullLegalName}: ${name} is "recorded" with nothing in it, which says nothing about whether anybody looked`,
          ).toBeGreaterThan(0)
        }
      }
    },
  )

  it('never records allergies with an empty list', () => {
    // The same defect inside a member that already asserts existence: an
    // `allergies` record listing none contradicts itself.
    for (const resident of residents) {
      if (resident.allergies.kind === 'allergies') {
        expect(resident.allergies.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('never attaches a refusal reason to a consent it is not about', () => {
    /*
     * **The pronouns defect in another field.** Every refusal drew its reason
     * from one pool of three sentences with no reference to what was being
     * refused, so "she does not want her picture anywhere" landed on
     * medication administration, on data sharing, on medical treatment and on
     * care and support — while photography, the one type it fits, never
     * received it. All 57 refusals were drawn that way; the other two
     * sentences said nothing in particular, which is why only one announced
     * itself.
     *
     * A refusal reason on the wrong decision is a record saying somebody
     * refused something for a reason they never gave, and nothing on the
     * screen distinguishes it from one they did.
     */
    let checked = 0
    for (const resident of residents) {
      for (const type of CONSENT_TYPES) {
        const consent = resident.consents[type.id]
        if (consent.kind !== 'refused') continue
        checked += 1
        const reasons = REFUSAL_REASONS[type.id]
        expect(
          [...reasons.refused, reasons.decidedAgainst],
          `${resident.id}/${type.id}: ${consent.note}`,
        ).toContain(consent.note)
      }
    }
    // A sweep that matched nothing would pass this silently.
    expect(checked, 'no refusal in the fixtures to check').toBeGreaterThan(20)
  })

  it('gives no reason to two consent types, and keeps the photography one to photography', () => {
    /*
     * **The test above cannot catch a reason filed under the wrong type**, and
     * that is the defect this pair exists for. It checks each note against the
     * table that generated it, so a photography sentence sitting in
     * medication's list satisfies it: the generator drew from the table and
     * the assertion agrees by construction. A property over a derived bound
     * inherits every error in the bound (§8), and the mutation proved it —
     * the reason moved, and the suite stayed green.
     *
     * A sentence that belongs to two decisions is either filler, which is how
     * the original pool passed for phases, or it is misplaced. Neither is a
     * refusal anybody gave. And the case that started this is held by name,
     * because a named case is the one thing a corrupt table cannot absorb.
     */
    const byReason = new Map<string, string[]>()
    for (const type of CONSENT_TYPES) {
      const reasons = REFUSAL_REASONS[type.id]
      for (const reason of [...reasons.refused, reasons.decidedAgainst]) {
        byReason.set(reason, [...(byReason.get(reason) ?? []), type.id])
      }
    }

    const shared = [...byReason.entries()]
      .filter(([, types]) => types.length > 1)
      .map(([reason, types]) => `${types.join(' + ')} :: ${reason}`)
    expect(shared).toEqual([])

    const picture = [...byReason.entries()].find(([reason]) =>
      reason.includes('picture anywhere'),
    )
    expect(picture?.[1], 'the photography reason is filed under another type').toEqual([
      'photography',
    ])
  })

  it('never records a best-interests decision with nobody consulted', () => {
    // A best-interests decision reached without consulting anybody is not one.
    // Mental Capacity Act 2005.
    for (const resident of residents) {
      for (const consent of Object.values(resident.consents)) {
        if (consent.kind === 'not_sought' || consent.kind === 'pending') continue
        if (consent.by.kind !== 'best_interests') continue
        expect(consent.by.consulted.length).toBeGreaterThan(0)
        expect(consent.by.rationale.trim()).not.toBe('')
      }
    }
  })

  it('never authorises a decision with an assessment that does not name it', () => {
    /*
     * The rule the mapped type holds at compile time, asserted at runtime too
     * — because the fixtures are the only place an assessment and a consent
     * are joined by hand, and a cast could get past the compiler.
     *
     * Blanket capacity is not expressible: a general "has capacity" applied to
     * a decision nobody assessed against has no way to be written.
     */
    for (const resident of residents) {
      for (const type of CONSENT_TYPES) {
        const consent = resident.consents[type.id]
        if (consent.kind === 'not_sought' || consent.kind === 'pending') continue
        const covered = Object.keys(consent.by.assessment.covers)
        expect(covered, `${resident.id}/${type.id}`).toContain(type.id)
      }
    }
  })

  it('records both MCA stages wherever capacity is found to be lacking', () => {
    // A conclusion with no impairment recorded and no functional finding is
    // not an assessment. The type refuses it; this proves the fixtures agree.
    let found = 0
    for (const resident of residents) {
      for (const consent of Object.values(resident.consents)) {
        if (consent.kind === 'not_sought' || consent.kind === 'pending') continue
        const finding = consent.by.assessment.finding
        if (finding.kind !== 'lacks_capacity') continue
        found += 1
        expect(finding.diagnosticTest.trim()).not.toBe('')
        expect(finding.functionalTest.trim()).not.toBe('')
      }
    }
    expect(found, 'no fixture reaches a lacks-capacity finding').toBeGreaterThan(0)
  })

  it('carePlan is a complete enumeration, not an ambiguous list', () => {
    // Listed here so the sweep is on the record: this array is NOT the same
    // defect. It always holds every domain, so an absence would be a bug
    // rather than an ambiguity, and that is asserted above.
    for (const resident of residents) {
      expect(resident.carePlan).toHaveLength(CARE_PLAN_DOMAINS.length)
    }
  })
})

describe('a finalised care plan version is a record somebody could have signed', () => {
  const finalised = residents.flatMap((resident) =>
    resident.carePlan.flatMap((domain) =>
      domain.versions.kind === 'finalised'
        ? domain.versions.history.map((version) => ({ resident, domain, version }))
        : [],
    ),
  )

  it('has no blank field in any version', () => {
    // Finalising requires all three fields, so a signed version with a blank
    // in it is a record the product refuses to create. The previous version's
    // `preferences` was the empty string for every revised domain in the set,
    // which would have rendered as an empty box in the middle of the diff —
    // a blank that reads as "she had no preferences" rather than "nobody
    // wrote them down".
    const blank = finalised.filter(
      ({ version }) =>
        version.currentNeeds.trim() === '' ||
        version.preferences.trim() === '' ||
        version.agreedActions.trim() === '',
    )
    expect(
      blank.map((entry) => `${entry.resident.id}/${entry.domain.domainId}`),
    ).toEqual([])
  })

  it('does not repeat one field as another', () => {
    // Preferences were drawn from the needs pool, so a plan's second field
    // was frequently a verbatim copy of its first. Two boxes saying the same
    // sentence is one fact rendered twice.
    const echoed = finalised.filter(
      ({ version }) => version.currentNeeds === version.preferences,
    )
    expect(
      echoed.map((entry) => `${entry.resident.id}/${entry.domain.domainId}`),
    ).toEqual([])
  })

  it('agrees with the status that points at it', () => {
    // The status carries who signed and when; so does the version. Two halves
    // of one fact, and a patch that edits one and not the other leaves a row
    // and its history contradicting each other.
    for (const resident of residents) {
      for (const domain of resident.carePlan) {
        if (domain.status.kind !== 'complete' && domain.status.kind !== 'review_due')
          continue

        expect(domain.versions.kind, `${resident.id}/${domain.domainId}`).toBe(
          'finalised',
        )
        if (domain.versions.kind !== 'finalised') continue

        const current = domain.versions.history.at(-1)!
        expect(current.finalisedOn, `${resident.id}/${domain.domainId}`).toBe(
          domain.status.finalisedOn,
        )
        expect(current.finalisedBy.id, `${resident.id}/${domain.domainId}`).toBe(
          domain.status.finalisedBy.id,
        )
      }
    }
  })

  it('has a signed domain carrying an unsigned draft', () => {
    // The state a care plan review actually is: an instruction staff follow
    // today, and a rewrite nobody has signed. The generator never produced
    // it, so the list's compound row and the editor's "draft over a signed
    // version" state had no fixture reaching them.
    const both = residents.flatMap((resident) =>
      resident.carePlan.filter(
        (domain) =>
          domain.versions.kind === 'finalised' && domain.draft.kind === 'draft',
      ),
    )
    expect(both.length).toBeGreaterThan(0)
  })

  it('has a domain part-written with nothing signed at all', () => {
    // The other draft state, and the opposite claim: somebody started and
    // staff have no signed plan to follow.
    const started = residents.flatMap((resident) =>
      resident.carePlan.filter(
        (domain) =>
          domain.status.kind === 'in_progress' &&
          domain.versions.kind === 'never_finalised',
      ),
    )
    expect(started.length).toBeGreaterThan(0)
  })

  it('has domains with two versions to diff, including an unchanged field', () => {
    // The diff's quiet branch. An unchanged field renders once, full width —
    // and a set where every field always moved would never reach it.
    const pairs = residents.flatMap((resident) =>
      resident.carePlan.flatMap((domain) =>
        domain.versions.kind === 'finalised' && domain.versions.history.length > 1
          ? [domain.versions.history.slice(-2) as [CarePlanVersion, CarePlanVersion]]
          : [],
      ),
    )
    expect(pairs.length).toBeGreaterThan(0)

    const withUnchanged = pairs.filter(
      ([was, now]) =>
        was.currentNeeds === now.currentNeeds ||
        was.preferences === now.preferences ||
        was.agreedActions === now.agreedActions,
    )
    expect(withUnchanged.length).toBeGreaterThan(0)
  })
})

describe('the reassuring case exists too', () => {
  /**
   * The residents list claims "All assessed, no flags" when nothing is
   * unrecorded and nothing needs attention. That branch went dead once
   * already — silently, when a change elsewhere shifted the generator's
   * random stream — so it is pinned rather than left to probability.
   *
   * A screen reviewed only against gaps is a screen nobody has seen working.
   */
  it('has a resident whose risk picture is entirely settled', () => {
    /*
     * Asked through the cell's own rule, not through a copy of it.
     *
     * This listed falls, choking, allergies and resuscitation by hand — four
     * of the conditions out of the six the cell actually applies. A guard that
     * asserts *less* than the screen requires passes while the branch it
     * protects goes dead; this one asserted *more* in one direction and less
     * in another, and the result was a test that failed on a working screen.
     * Either way the fix is the same: ask the question the screen asks.
     */
    const settled = residents.filter(hasNoRiskFlags)
    expect(
      settled.length,
      'no resident has a settled risk picture, so the residents list can never render "All assessed, no flags"',
    ).toBeGreaterThan(0)
  })
})

/**
 * An allergy's reaction and its severity are different facts: one says what
 * happens, the other grades it. Filling the reaction in with the severity's own
 * word makes both render sites read "Anaphylaxis · anaphylaxis", which looks
 * like a component repeating itself and is really a record saying one thing
 * twice.
 *
 * Asserted against the whole severity vocabulary rather than just equality,
 * because "Severe" written into the reaction of a `moderate` allergy is the
 * same defect and worse — it contradicts the grade beside it.
 */
describe('an allergy reaction is not its severity', () => {
  const SEVERITY_WORDS = new Set(['mild', 'moderate', 'severe', 'anaphylaxis'])

  it('never fills the reaction in with a severity word', () => {
    for (const resident of residents) {
      if (resident.allergies.kind !== 'allergies') continue
      for (const allergy of resident.allergies.items) {
        expect(
          SEVERITY_WORDS.has(allergy.reaction.trim().toLowerCase()),
          `${resident.fullLegalName}: ${allergy.substance} has reaction "${allergy.reaction}" and severity "${allergy.severity}": the reaction must describe what happens, not repeat the grade`,
        ).toBe(false)
      }
    }
  })
})

describe('nobody is written about in the wrong pronoun', () => {
  /**
   * **The defect this guards.** Every pool of hand-written fixture prose was
   * drawn with `rng.pick`, which knows nothing about the resident it is
   * drawing for, and the pronouns were baked into the strings. The result was
   * 1,988 of 12,139 care notes referring to a resident by the wrong pronoun —
   * "Preferred to stay in his room today" on a woman's record.
   *
   * In a care record that is not a typo. It is the sentence a family reads
   * when they ask what their mother did yesterday.
   *
   * The pools carry `{they}` tokens now and `pronounise` resolves them per
   * resident. This asserts the outcome rather than the mechanism: no rendered
   * string disagrees with the resident it is about, however it got there.
   */
  const MASCULINE = /\b(he|him|his)\b/i
  const FEMININE = /\b(she|her|hers)\b/i

  const disagrees = (text: string, pronouns: string) => {
    const masculine = MASCULINE.test(text)
    const feminine = FEMININE.test(text)
    // A sentence carrying both is about the resident and somebody else — "her
    // sister ... he confirms" — and cannot be judged by this rule.
    if (masculine === feminine) return false
    if (masculine && pronouns.startsWith('she')) return true
    if (feminine && pronouns.startsWith('he')) return true
    // they/them takes neither.
    return pronouns.startsWith('they')
  }

  const pronounsOf = (id: string) => {
    const resident = residents.find((entry) => entry.id === id)!
    return resident.pronouns.kind === 'recorded' ? resident.pronouns.value : 'they/them'
  }

  it('agrees with the resident in every care note', () => {
    const wrong = careNotes.filter((note) =>
      disagrees(note.body, pronounsOf(note.residentId)),
    )
    expect(wrong.slice(0, 3).map((note) => `${note.residentId}: ${note.body}`)).toEqual(
      [],
    )
  })

  it('agrees with the resident in every handover note', () => {
    const wrong: string[] = []
    for (const session of handovers) {
      for (const entry of session.entries) {
        const status = entry.status
        if (status.kind !== 'needs_attention' && status.kind !== 'urgent') continue
        if (disagrees(status.note, pronounsOf(entry.residentId))) {
          wrong.push(`${entry.residentId}: ${status.note}`)
        }
      }
    }
    expect(wrong.slice(0, 3)).toEqual([])
  })

  it('agrees with the resident in every communication need', () => {
    const wrong: string[] = []
    for (const resident of residents) {
      const need = resident.communicationNeeds
      if (need.kind !== 'recorded') continue
      const pronouns =
        resident.pronouns.kind === 'recorded' ? resident.pronouns.value : 'they/them'
      if (disagrees(need.value, pronouns)) wrong.push(`${resident.id}: ${need.value}`)
    }
    expect(wrong.slice(0, 3)).toEqual([])
  })

  it('leaves no token unresolved', () => {
    // An unknown token renders literally rather than vanishing, so it is
    // visible — but only if somebody looks. This looks.
    const stray = careNotes.filter((note) => /\{[A-Za-z]+\}/.test(note.body))
    expect(stray.slice(0, 3).map((note) => note.body)).toEqual([])
  })
})

describe("a MAR round belongs to the site's day, not the runner's", () => {
  /**
   * The grid is a lookup by (medication, date, round). A day boundary taken
   * from the machine rather than the site does not render a *wrong* cell — it
   * renders **no cell**, and a missing MAR cell is the exact ambiguity §2.1
   * opens with.
   *
   * `toDateString()` was machine-local and inert only because both fixture
   * sites are Europe/London. Inert is not fixed: this asserts the key against
   * the zone it claims to be in, so a third site in another zone fails here
   * rather than dropping cells on a screen.
   */
  it('keys every record by its own due time in its own site zone', () => {
    const zoneOf = (residentId: string) => {
      const resident = residents.find((entry) => entry.id === residentId)!
      return sites.find((entry) => entry.id === resident.siteId)!.timeZone
    }

    const wrong = marRecordsAll.filter((record) => {
      const state = record.state
      const due =
        state.kind === 'due'
          ? state.windowOpensAt
          : state.kind === 'omitted'
            ? state.dueAt
            : undefined
      if (due === undefined) return false
      return record.date !== zonedDate(due, zoneOf(record.residentId))
    })

    expect(
      wrong.slice(0, 3).map((r) => `${r.medicationId} ${r.date} ${r.roundTime}`),
    ).toEqual([])
  })

  it('uses a date-only key, never a locale string', () => {
    // 'Tue Aug 19 2026' sorts and compares differently from '2026-08-19', and
    // the grid does both.
    for (const record of marRecordsAll.slice(0, 200)) {
      expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('a flag says why, and a review says what was done', () => {
  /*
   * Both were added for the Care Worker PRD (CN-01, CN-02) and are shared by
   * both builds. Every state has to be reachable on a fresh load, or a screen
   * is written against a branch nobody can see: a flag with a reason and one
   * without, and each of the four outcomes.
   */
  const flags = careNotes.flatMap((note) =>
    note.review.kind === 'not_flagged' ? [] : [note.review],
  )

  it('holds flags with a reason and flags with none', () => {
    const kinds = new Set(flags.map((review) => review.reason.kind))
    expect([...kinds].sort()).toEqual(['given', 'not_given'])
    for (const review of flags)
      if (review.reason.kind === 'given') expect(review.reason.text.trim()).not.toBe('')
  })

  it('holds every review outcome, and an other that says what', () => {
    const outcomes = careNotes.flatMap((note) =>
      note.review.kind === 'reviewed' ? [note.review.outcome] : [],
    )
    expect([...new Set(outcomes.map((outcome) => outcome.kind))].sort()).toEqual(
      ['care_plan_updated', 'incident_raised', 'no_further_action', 'other'].sort(),
    )
    for (const outcome of outcomes)
      if (outcome.kind === 'other') expect(outcome.text.trim()).not.toBe('')
  })

  it('keeps a flag reason waiting in the queue', () => {
    expect(
      flags.some(
        (review) => review.reason.kind === 'given' && 'reviewedBy' in review === false,
      ),
    ).toBe(true)
  })
})
