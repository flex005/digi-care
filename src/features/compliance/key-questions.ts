import type {
  CheckReading,
  Recorded,
  Resident,
  ResidentId,
  CheckResult,
  Coverage,
  KeyQuestionId,
  PanelVerdict,
} from '@/data/types'
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'
import { medicationsFor } from '@/data/fixtures/medications'
import { formatCount, pluralise } from '@/lib/format'
import { expiryFinding, type ExpiryFinding } from '@/features/documents/expiry'
import { brokenReferences } from '@/features/documents/library'
import { OMISSION_WINDOW_DAYS, type ComplianceData } from './data'
import { reading, verdictFor } from './rating'

/**
 * What each Key Question is made of. PRD §6.7, Phase 12.
 *
 * **This mapping is not derived from CQC's published framework.** It is
 * plausible, useful for building, and not something a real home should be
 * rated by — the same standing as the risk instrument in §9.2a, and every
 * screen that renders it says so.
 *
 * Two kinds of entry, and the second is the point of the phase:
 *
 * - **derived** — a figure this product can compute, naming the module it came
 *   from. A figure whose origin is not stated is a figure nobody can check.
 * - **not_held** — a thing an inspector will ask for that **nothing in this
 *   product records**. Listed, never counted, never rated. It is a gap in the
 *   system rather than in the home, and its wording says so: the hatch would
 *   send a manager looking for a screen that does not exist.
 */

export interface DerivedCheck {
  kind: 'derived'
  id: string
  name: string
  from: string
  run: (data: ComplianceData) => CheckReading
}

export interface NotHeldCheck {
  kind: 'not_held'
  id: string
  name: string
  statement: string
}

export type Check = DerivedCheck | NotHeldCheck

export interface KeyQuestion {
  id: KeyQuestionId
  name: string
  /** The question CQC asks, in its own words. */
  asks: string
  checks: Check[]
}

// ---------------------------------------------------------------------------
// Small helpers, so each check reads as what it counts
// ---------------------------------------------------------------------------

const count = (covered: number, total: number): Coverage => ({ covered, total })

/** Every figure in a sentence goes through the owner. "1135" is not a count. */
const n = (value: number) => formatCount(value)

/** Residents at the site, and the templates and domains they each have. */
const templateTotal = (data: ComplianceData) =>
  data.residents.length * RISK_ASSESSMENT_TEMPLATES.length

const domainTotal = (data: ComplianceData) =>
  data.residents.length * CARE_PLAN_DOMAINS.length

const consentTotal = (data: ComplianceData) =>
  data.residents.length * CONSENT_TYPES.length

const today = (data: ComplianceData) =>
  data.now.slice(0, 10) as `${number}-${number}-${number}`

/**
 * One resident's medications.
 *
 * Read from the fixture layer rather than added to the bundle: the residents in
 * the bundle are already site-scoped, so iterating them and asking per resident
 * cannot reach a drug belonging to another site.
 */
const medicationsOf = (residentId: ResidentId) => medicationsFor(residentId)

/** Every recorded contact on a resident, whatever category they sit in. */
function contactsOf(resident: Resident) {
  const people: { communicationPreference: Recorded<unknown> }[] = []
  const { importantPeople } = resident
  for (const slot of [
    importantPeople.nextOfKin,
    importantPeople.emergencyContact,
    importantPeople.lpaHolder,
    importantPeople.socialWorker,
    importantPeople.advocate,
  ]) {
    if (slot.kind === 'recorded') people.push(slot.value)
  }
  if (importantPeople.familyWithVisitingRights.kind === 'recorded') {
    people.push(...importantPeople.familyWithVisitingRights.items)
  }
  return people
}

/**
 * A site document standing in for an assessment record.
 *
 * **Weaker evidence than it looks, and the row says so.** Fire and legionella
 * are evidenced by a document existing and carrying an expiry decision, not by
 * an assessment with findings and actions in it. Hiding that behind a tick
 * would be the screen overstating its own evidence.
 *
 * The denominator is one — a single document, at a single site — so this
 * check is always below the population floor and always renders Insufficient
 * Evidence. That is the correct answer rather than a defect: one document
 * cannot support a rate, and the row still says whether it is there.
 */
function siteDocumentCheck(data: ComplianceData, title: string): CheckReading {
  const record = data.documents.find(
    (candidate) => candidate.owner.kind === 'site' && candidate.title === title,
  )
  const finding = record ? expiryFinding(record.expiry, today(data)) : undefined

  return reading({
    coverage: count(record ? 1 : 0, 1),
    detail: record
      ? `A document is on file. ${describeExpiry(finding)}`
      : 'No document is on file at this site.',
    missing:
      'One document at one site cannot support a rate; the row says whether it is there.',
    caveat: 'Evidenced by a document existing, not by an assessment record.',
  })
}

function describeExpiry(finding: ExpiryFinding | undefined): string {
  if (finding === undefined) return ''
  switch (finding.kind) {
    case 'expired':
      return 'It expired.'
    case 'expiring':
      return 'It expires inside the window.'
    case 'in_date':
      return 'It is in date.'
    case 'does_not_expire':
      return 'Somebody recorded that it does not expire.'
    case 'not_recorded':
      return 'Nobody has said whether it expires.'
  }
}

// ---------------------------------------------------------------------------
// Safe
// ---------------------------------------------------------------------------

const SAFE: Check[] = [
  {
    kind: 'derived',
    id: 'doses-recorded',
    name: 'Doses with a record against them',
    from: `Medications · last ${pluralise(OMISSION_WINDOW_DAYS, 'day')}`,
    run: (data) => {
      const missed = data.omissions.length
      const due = data.dosesDue
      return reading({
        coverage: count(due - missed, due),
        detail: `${n(missed)} of ${n(due)} doses have no record against them`,
        missing: `Only ${pluralise(due, 'dose')} fell due here in ${pluralise(OMISSION_WINDOW_DAYS, 'day')}: too few to support a rate.`,
      })
    },
  },
  {
    kind: 'derived',
    id: 'risks-assessed',
    name: 'Risk assessments completed',
    from: `Risk assessments · ${RISK_ASSESSMENT_TEMPLATES.length} templates, every resident`,
    run: (data) => {
      const total = templateTotal(data)
      let assessed = 0
      for (const resident of data.residents) {
        for (const template of RISK_ASSESSMENT_TEMPLATES) {
          if (resident.risks[template.id]?.kind === 'assessed') assessed += 1
        }
      }
      return reading({
        coverage: count(assessed, total),
        detail: `${n(total - assessed)} of ${n(total)} never assessed, across ${pluralise(data.residents.length, 'resident')}`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'reviews-in-date',
    name: 'Risk assessments re-scored on time',
    from: 'Reviews · every assessment with a review date',
    run: (data) => {
      const items = data.reviews.items.filter((item) => item.kind === 'risk_assessment')
      const overdue = items.filter((item) => item.standing.kind === 'overdue').length
      return reading({
        coverage: count(items.length - overdue, items.length),
        detail: `${n(overdue)} of ${n(items.length)} past their review date`,
        missing: 'Too few assessments carry a review date to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'incidents-acknowledged',
    name: 'Incidents acknowledged by a manager',
    from: 'Incidents · every incident at this site',
    run: (data) => {
      const waiting = data.incidents.filter(
        (incident) => incident.status.kind === 'reported_not_acknowledged',
      ).length
      return reading({
        coverage: count(data.incidents.length - waiting, data.incidents.length),
        detail: `${n(waiting)} of ${n(data.incidents.length)} reported and never acknowledged`,
        missing: 'Too few incidents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'review-flags-cleared',
    name: 'Post-incident review flags cleared in time',
    from: 'Incidents · flags raised by a closed incident',
    run: (data) => {
      const flags = data.incidents.flatMap((incident) => incident.reviewFlags)
      const now = data.now
      const outstanding = flags.filter(
        (flag) => flag.state.kind === 'awaiting' && flag.dueBy < now,
      ).length
      return reading({
        coverage: count(flags.length - outstanding, flags.length),
        detail: `${n(outstanding)} of ${n(flags.length)} still awaiting past their 48 hours`,
        missing: 'Too few review flags have been raised here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'cd-balances',
    name: 'Controlled drug counts reconcile',
    from: 'Medications · controlled drug register',
    run: (data) => {
      const routine = data.stockCounts.filter((stock) => stock.entry.kind === 'routine')
      const agreed = routine.filter(
        (stock) =>
          stock.entry.kind === 'routine' && stock.entry.expected === stock.counted,
      ).length
      return reading({
        coverage: count(agreed, routine.length),
        detail: `${n(routine.length - agreed)} of ${n(routine.length)} counts did not match the register`,
        missing: `Only ${n(routine.length)} routine counts have been made here: too few to support a rate.`,
      })
    },
  },
  {
    kind: 'derived',
    id: 'prn-maximums',
    name: 'PRN medicines with a 24-hour maximum recorded',
    from: 'Medications · every PRN prescription',
    run: (data) => {
      const prn = data.residents
        .flatMap((resident) => medicationsOf(resident.id))
        .filter((medication) => medication.maximumIn24Hours.kind !== 'not_applicable')
      const recorded = prn.filter(
        (medication) => medication.maximumIn24Hours.kind === 'recorded',
      ).length
      return reading({
        coverage: count(recorded, prn.length),
        detail: `${n(prn.length - recorded)} of ${n(prn.length)} have no maximum recorded, so no dose can be checked against one`,
        missing: 'Too few PRN prescriptions here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'fire-risk-assessment',
    name: 'Fire risk assessment',
    from: 'Documents · site level',
    run: (data) => siteDocumentCheck(data, 'Fire risk assessment'),
  },
  {
    kind: 'derived',
    id: 'legionella-risk-assessment',
    name: 'Legionella risk assessment',
    from: 'Documents · site level',
    run: (data) => siteDocumentCheck(data, 'Legionella risk assessment'),
  },
  {
    kind: 'not_held',
    id: 'staff-training',
    name: 'Staff training and competency',
    statement: 'Staff training is not recorded in diGi-Care.',
  },
]

// ---------------------------------------------------------------------------
// Effective
// ---------------------------------------------------------------------------

const EFFECTIVE: Check[] = [
  {
    kind: 'derived',
    id: 'care-plans-written',
    name: 'Care plan domains ever written',
    from: `Care planning · ${CARE_PLAN_DOMAINS.length} domains, every resident`,
    run: (data) => {
      const total = domainTotal(data)
      let finalised = 0
      for (const resident of data.residents) {
        for (const domain of resident.carePlan) {
          if (domain.versions.kind === 'finalised') finalised += 1
        }
      }
      return reading({
        coverage: count(finalised, total),
        detail: `${n(total - finalised)} of ${n(total)} domains have never been written`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'care-plan-reviews',
    name: 'Care plan domains reviewed on time',
    from: 'Reviews · every domain with a review date',
    run: (data) => {
      const items = data.reviews.items.filter(
        (item) => item.kind === 'care_plan_domain',
      )
      const overdue = items.filter((item) => item.standing.kind === 'overdue').length
      return reading({
        coverage: count(items.length - overdue, items.length),
        detail: `${n(overdue)} of ${n(items.length)} past their review date`,
        missing: 'Too few domains carry a review date to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'whole-plan-reviews',
    name: 'Whole care plans reviewed on time',
    from: 'Reviews · one review per resident',
    run: (data) => {
      const items = data.reviews.items.filter((item) => item.kind === 'whole_care_plan')
      const overdue = items.filter((item) => item.standing.kind === 'overdue').length
      return reading({
        coverage: count(items.length - overdue, items.length),
        detail: `${n(overdue)} of ${n(items.length)} past their review date`,
        missing: 'Too few whole-plan reviews are scheduled here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'capacity-assessed',
    name: 'Decided consents resting on a capacity assessment',
    from: 'Consent · every decided consent',
    run: (data) => {
      let decided = 0
      for (const resident of data.residents) {
        for (const type of CONSENT_TYPES) {
          const consent = resident.consents[type.id]
          if (
            consent.kind === 'given' ||
            consent.kind === 'refused' ||
            consent.kind === 'withdrawn'
          ) {
            decided += 1
          }
        }
      }
      /*
       * Every decided consent carries an authority by construction, and every
       * authority carries an assessment naming its own type — the type enforces
       * it and no runtime check can find a counter-example. The figure is
       * therefore about how much of the record has reached that state at all,
       * which is the honest reading of what it measures.
       */
      return reading({
        coverage: count(decided, consentTotal(data)),
        detail: `${n(decided)} of ${n(consentTotal(data))} consents have been decided, each with a capacity assessment behind it`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'nutrition-assessed',
    name: 'Nutrition screening completed',
    from: 'Risk assessments · MUST, every resident',
    run: (data) => {
      const assessed = data.residents.filter(
        (resident) => resident.risks.nutrition?.kind === 'assessed',
      ).length
      return reading({
        coverage: count(assessed, data.residents.length),
        detail: `${n(data.residents.length - assessed)} of ${n(data.residents.length)} residents have never been screened`,
        missing: 'Too few residents here to support a rate.',
        caveat:
          'The screening instrument in this build is a placeholder, not MUST as published.',
      })
    },
  },
  {
    kind: 'not_held',
    id: 'staff-supervision',
    name: 'Staff supervision and appraisal',
    statement: 'Supervision and appraisal are not recorded in diGi-Care.',
  },
  {
    kind: 'not_held',
    id: 'staff-induction',
    name: 'Induction and mandatory training completion',
    statement: 'Induction records are not recorded in diGi-Care.',
  },
]

// ---------------------------------------------------------------------------
// Caring
// ---------------------------------------------------------------------------

const CARING: Check[] = [
  {
    kind: 'derived',
    id: 'goals-resident-view',
    name: 'Closed goals recording what the resident said',
    from: 'Goals · every closed goal',
    run: (data) => {
      const closed = data.goals.filter((goal) => goal.outcome.kind !== 'open')
      const asked = closed.filter((goal) => {
        const outcome = goal.outcome
        if (outcome.kind === 'open') return false
        if (outcome.kind === 'withdrawn_by_resident') return true
        return outcome.closed.residentView.kind !== 'not_asked'
      }).length
      return reading({
        coverage: count(asked, closed.length),
        detail: `${n(closed.length - asked)} of ${n(closed.length)} closed without asking the resident what they thought`,
        missing: 'Too few goals have been closed here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'consent-sought',
    name: 'Consents sought at all',
    from: `Consent · ${CONSENT_TYPES.length} types, every resident`,
    run: (data) => {
      let sought = 0
      for (const resident of data.residents) {
        for (const type of CONSENT_TYPES) {
          if (resident.consents[type.id].kind !== 'not_sought') sought += 1
        }
      }
      const total = consentTotal(data)
      return reading({
        coverage: count(sought, total),
        detail: `${n(total - sought)} of ${n(total)} have never been sought: neither refusal nor permission`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'communication-preferences',
    name: 'Contacts with a communication preference recorded',
    from: 'Important People · every recorded contact',
    run: (data) => {
      let total = 0
      let recorded = 0
      for (const resident of data.residents) {
        for (const person of contactsOf(resident)) {
          total += 1
          if (person.communicationPreference.kind === 'recorded') recorded += 1
        }
      }
      return reading({
        coverage: count(recorded, total),
        detail: `${n(total - recorded)} of ${n(total)} contacts have no preference recorded`,
        missing: 'Too few contacts recorded here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'flagged-notes-reviewed',
    name: 'Flagged care notes reviewed by somebody',
    from: 'Care notes · every note flagged for review',
    run: (data) => {
      const flagged = data.notes.filter((note) => note.review.kind !== 'not_flagged')
      const reviewed = flagged.filter((note) => note.review.kind === 'reviewed').length
      return reading({
        coverage: count(reviewed, flagged.length),
        detail: `${n(flagged.length - reviewed)} of ${n(flagged.length)} flagged notes are still waiting`,
        missing: 'Too few notes have been flagged here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'preferred-name',
    name: 'Residents whose preferred name is recorded',
    from: 'Client profile · every resident',
    run: (data) => {
      const recorded = data.residents.filter(
        (resident) => resident.preferredName.trim() !== '',
      ).length
      return reading({
        coverage: count(recorded, data.residents.length),
        detail: `${n(data.residents.length - recorded)} of ${n(data.residents.length)} have no preferred name recorded`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'not_held',
    id: 'dignity-observations',
    name: 'Dignity and respect observations',
    statement: 'Observations of care are not recorded in diGi-Care.',
  },
  {
    kind: 'not_held',
    id: 'resident-surveys',
    name: 'Resident and family surveys',
    statement: 'Surveys are not recorded in diGi-Care.',
  },
]

// ---------------------------------------------------------------------------
// Responsive
// ---------------------------------------------------------------------------

const RESPONSIVE: Check[] = [
  {
    kind: 'derived',
    id: 'activities-written-up',
    name: 'Activity sessions written up',
    from: 'Activities · sessions that have happened',
    run: (data) => {
      const happened = data.activities.filter((activity) => activity.endsAt < data.now)
      const writtenUp = happened.filter((activity) =>
        activity.invited.some(
          (invitation) => invitation.attendance.kind !== 'not_recorded',
        ),
      ).length
      return reading({
        coverage: count(writtenUp, happened.length),
        detail: `${n(happened.length - writtenUp)} of ${n(happened.length)} sessions have no attendance recorded against anybody`,
        missing: 'Too few sessions have happened here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'attendance-recorded',
    name: 'Invitations with an attendance answer',
    from: 'Activities · every invitation on a session that has happened',
    run: (data) => {
      const invitations = data.activities
        .filter((activity) => activity.endsAt < data.now)
        .flatMap((activity) => activity.invited)
      const answered = invitations.filter(
        (invitation) => invitation.attendance.kind !== 'not_recorded',
      ).length
      return reading({
        coverage: count(answered, invitations.length),
        detail: `${n(invitations.length - answered)} of ${n(invitations.length)} invitations have no answer either way`,
        missing: 'Too few invitations here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'goals-past-date',
    name: 'Goals still open past the date they were set for',
    from: 'Goals · every open goal with a date',
    run: (data) => {
      const dated = data.goals.filter(
        (goal) => goal.outcome.kind === 'open' && goal.target.kind === 'by_date',
      )
      const passed = dated.filter(
        (goal) => goal.target.kind === 'by_date' && goal.target.on < today(data),
      ).length
      return reading({
        coverage: count(dated.length - passed, dated.length),
        detail: `${n(passed)} of ${n(dated.length)} passed their date with nothing said`,
        missing: 'Too few dated goals here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'resuscitation-recorded',
    name: 'Residents with a resuscitation decision recorded',
    from: 'Future Plans · every resident',
    run: (data) => {
      const recorded = data.residents.filter(
        (resident) =>
          resident.futurePlans.resuscitation.kind !== 'no_decision_recorded',
      ).length
      return reading({
        coverage: count(recorded, data.residents.length),
        detail: `${n(data.residents.length - recorded)} of ${n(data.residents.length)} have no decision either way`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'end-of-life-preferences',
    name: 'Residents with an end of life preference recorded',
    from: 'Future Plans · preferred place of care',
    run: (data) => {
      const recorded = data.residents.filter(
        (resident) => resident.futurePlans.preferredPlaceOfCare.kind === 'recorded',
      ).length
      return reading({
        coverage: count(recorded, data.residents.length),
        detail: `${n(data.residents.length - recorded)} of ${n(data.residents.length)} have nothing recorded`,
        missing: 'Too few residents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'referenced-documents-on-file',
    name: 'Documents a record references and the library holds',
    from: 'Documents · every referenced id',
    run: (data) => {
      let referenced = 0
      let broken = 0
      for (const resident of data.residents) {
        const mine = data.documents.filter(
          (record) =>
            record.owner.kind === 'resident' && record.owner.residentId === resident.id,
        )
        const missing = brokenReferences(resident, mine)
        broken += missing.length
        referenced += mine.length + missing.length
      }
      return reading({
        coverage: count(referenced - broken, referenced),
        detail: `${n(broken)} referenced documents were never uploaded`,
        missing: 'Too few documents referenced here to support a rate.',
      })
    },
  },
  {
    kind: 'not_held',
    id: 'complaints',
    name: 'Complaints and how they were resolved',
    statement:
      'Complaints exist in diGi-Care only as document titles, not as records that can be counted or followed.',
  },
]

// ---------------------------------------------------------------------------
// Well-led
// ---------------------------------------------------------------------------

const WELL_LED: Check[] = [
  {
    kind: 'derived',
    id: 'notification-decisions',
    name: 'Incidents with a notification decision made',
    from: 'Incidents · statutory notifications',
    run: (data) => {
      const undecided = data.incidents.filter(
        (incident) => incident.notification.kind === 'not_yet_decided',
      ).length
      return reading({
        coverage: count(data.incidents.length - undecided, data.incidents.length),
        detail: `${n(undecided)} of ${n(data.incidents.length)} have nobody's decision either way`,
        missing: 'Too few incidents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'notifications-made',
    name: 'Required notifications actually made',
    from: 'Incidents · decisions that said the CQC must be told',
    run: (data) => {
      const required = data.incidents.filter(
        (incident) =>
          incident.notification.kind === 'required_not_yet_notified' ||
          incident.notification.kind === 'notified',
      )
      const made = required.filter(
        (incident) => incident.notification.kind === 'notified',
      ).length
      return reading({
        coverage: count(made, required.length),
        detail: `${n(required.length - made)} of ${n(required.length)} were decided as required and never notified`,
        missing: 'Too few notifiable incidents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'document-expiry-decisions',
    name: 'Documents carrying an expiry decision',
    from: 'Documents · everything on file at this site',
    run: (data) => {
      const decided = data.documents.filter(
        (record) => record.expiry.kind !== 'not_recorded',
      ).length
      return reading({
        coverage: count(decided, data.documents.length),
        detail: `${n(data.documents.length - decided)} of ${n(data.documents.length)} have neither a date nor a recorded decision that they do not expire`,
        missing: 'Too few documents on file here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'documents-in-date',
    name: 'Documents still in date',
    from: 'Documents · everything with an expiry date',
    run: (data) => {
      const dated = data.documents.filter((record) => record.expiry.kind === 'expires')
      const expired = dated.filter(
        (record) => expiryFinding(record.expiry, today(data)).kind === 'expired',
      ).length
      return reading({
        coverage: count(dated.length - expired, dated.length),
        detail: `${n(expired)} of ${n(dated.length)} dated documents have lapsed`,
        missing: 'Too few dated documents here to support a rate.',
      })
    },
  },
  {
    kind: 'derived',
    id: 'handovers-signed',
    name: 'Handovers signed by both shifts',
    from: 'Handover · every session at this site',
    run: (data) => {
      const board = data.handover
      const unsigned = board ? board.unsigned.length : 0
      const total = unsigned + 1
      return reading({
        coverage: count(total - unsigned, total),
        detail: `${n(unsigned)} earlier handovers are still missing a signature`,
        missing:
          'Only the open handover is on record here, which is too few to support a rate.',
      })
    },
  },
  {
    kind: 'not_held',
    id: 'audits',
    name: 'Audits and the quality assurance cycle',
    statement: 'Audits are not recorded in diGi-Care.',
  },
  {
    kind: 'not_held',
    id: 'policy-review',
    name: 'Policy review cycle',
    statement:
      'Policies exist in diGi-Care as documents with an expiry decision, not as a review cycle with owners and dates.',
  },
]

export const KEY_QUESTIONS: KeyQuestion[] = [
  {
    id: 'safe',
    name: 'Safe',
    asks: 'Are people protected from abuse and avoidable harm?',
    checks: SAFE,
  },
  {
    id: 'effective',
    name: 'Effective',
    asks: 'Does their care achieve good outcomes?',
    checks: EFFECTIVE,
  },
  {
    id: 'caring',
    name: 'Caring',
    asks: 'Do staff treat people with compassion and respect?',
    checks: CARING,
  },
  {
    id: 'responsive',
    name: 'Responsive',
    asks: 'Is their care organised around their needs?',
    checks: RESPONSIVE,
  },
  {
    id: 'well_led',
    name: 'Well-led',
    asks: 'Does leadership assure good quality care?',
    checks: WELL_LED,
  },
]

export function keyQuestionById(id: string): KeyQuestion | undefined {
  return KEY_QUESTIONS.find((question) => question.id === id)
}

/** One panel: every check run, findings first, with the verdict over them. */
export interface Panel {
  question: KeyQuestion
  results: CheckResult[]
  verdict: PanelVerdict
  /** Checks nothing in this product records. Never counted, always listed. */
  notHeld: NotHeldCheck[]
}

export function runPanel(question: KeyQuestion, data: ComplianceData): Panel {
  const results: CheckResult[] = question.checks.map((check) =>
    check.kind === 'not_held'
      ? { kind: 'not_held', definition: check }
      : { kind: 'derived', definition: check, reading: check.run(data) },
  )

  return {
    question,
    results,
    verdict: verdictFor(results),
    notHeld: question.checks.filter(
      (check): check is NotHeldCheck => check.kind === 'not_held',
    ),
  }
}

export function runPanels(data: ComplianceData): Panel[] {
  return KEY_QUESTIONS.map((question) => runPanel(question, data))
}
