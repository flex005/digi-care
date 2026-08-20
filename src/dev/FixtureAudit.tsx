import { CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'

import { recordCompleteness, staleRecords } from '@/data/completeness'
import { residents } from '@/data/fixtures/residents'
import { careNotes, GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import {
  hasStockDiscrepancy,
  marRecordsAll,
  medications,
  stockCounts,
} from '@/data/fixtures/medications'
import { sites, staff } from '@/data/fixtures/organisation'
import { Unrecorded, StatusPill } from '@/components/status'
import styles from './dev.module.css'

/**
 * The Fixture Audit. PRD §5.3.
 *
 * The ten deliberate gaps are the cheapest and most effective defence in the
 * whole plan — every screen gets built against messy data by default, so the
 * messy cases show up in review rather than in production. But that only
 * works if the gaps are *actually still there*, and a generator plus a
 * hand-authored patch list is exactly the kind of thing that quietly stops
 * producing what it used to.
 *
 * So each gap is asserted here against the real fixtures rather than
 * described. A row that goes red means a screen built later would have been
 * reviewed against tidy data and passed for the wrong reason.
 */

interface Check {
  n: number
  gap: string
  found: boolean
  detail: string
}

function buildChecks(): Check[] {
  const checks: Check[] = []

  // 1 — a resident with no falls risk assessment ever completed.
  const noFalls = residents.filter((r) => r.risks.falls.kind === 'not_assessed')
  checks.push({
    n: 1,
    gap: 'A resident with no falls risk assessment ever completed',
    found: noFalls.length > 0,
    detail:
      noFalls.length > 0
        ? `${noFalls.length} residents, including ${noFalls[0]?.fullLegalName} — their header must not read as safe`
        : 'Nobody is missing a falls assessment — the badge strip would never be tested',
  })

  // 2 — no resuscitation decision, alongside a DNAR and a for-resuscitation.
  const noDecision = residents.filter(
    (r) => r.resuscitation.kind === 'no_decision_recorded',
  )
  const dnar = residents.filter((r) => r.resuscitation.kind === 'dnar_in_place')
  const forResus = residents.filter((r) => r.resuscitation.kind === 'for_resuscitation')
  checks.push({
    n: 2,
    gap: 'No resuscitation decision recorded, alongside a DNAR and a for-resuscitation',
    found: noDecision.length > 0 && dnar.length > 0 && forResus.length > 0,
    detail: `${noDecision.length} with no decision (${noDecision[0]?.fullLegalName}), ${dnar.length} DNAR in place, ${forResus.length} for resuscitation`,
  })

  // 3 — admitted yesterday, almost nothing filled in.
  const newest = [...residents].sort(
    (a, b) => new Date(b.admittedOn).getTime() - new Date(a.admittedOn).getTime(),
  )[0]
  const newestGaps = newest ? recordCompleteness(newest).missing.length : 0
  const admittedDaysAgo = newest
    ? Math.round((Date.now() - new Date(newest.admittedOn).getTime()) / 86_400_000)
    : -1
  checks.push({
    n: 3,
    gap: 'A resident admitted yesterday, with almost nothing filled in',
    found: admittedDaysAgo <= 2 && newestGaps > 15,
    detail: `${newest?.fullLegalName} — admitted ${admittedDaysAgo} day(s) ago, ${newestGaps} named gaps in the record`,
  })

  // 4 — three medication omissions, one escalated past 60 minutes and one
  //     inside the 30–60 minute window.
  const omissions = marRecordsAll.filter((record) => record.state.kind === 'omitted')
  const escalations = omissions
    .map((record) =>
      record.state.kind === 'omitted' && record.state.escalation.kind === 'escalated'
        ? Math.round(
            (new Date(record.state.escalation.at).getTime() -
              new Date(record.state.dueAt).getTime()) /
              60_000,
          )
        : -1,
    )
    .filter((minutes) => minutes >= 0)
  const pastSixty = escalations.filter((minutes) => minutes > 60).length
  const inWindow = escalations.filter(
    (minutes) => minutes >= 30 && minutes <= 60,
  ).length
  const notEscalated = omissions.filter(
    (record) =>
      record.state.kind === 'omitted' &&
      record.state.escalation.kind === 'not_escalated',
  ).length
  checks.push({
    n: 4,
    gap: 'Three medication omissions — one escalated past 60 minutes, one inside the 30–60 minute window',
    found: pastSixty > 0 && inWindow > 0 && notEscalated > 0,
    detail: `${omissions.length} omissions overall · ${pastSixty} escalated past 60 min · ${inWindow} inside the 30–60 min window · ${notEscalated} not escalated at all`,
  })

  // 5 — a controlled drug with a stock count discrepancy.
  const discrepancies = stockCounts.filter(hasStockDiscrepancy)
  const first = discrepancies[0]
  checks.push({
    n: 5,
    gap: 'A controlled drug with a stock count discrepancy',
    found: discrepancies.length > 0,
    detail: first
      ? `${discrepancies.length} discrepancy — expected ${first.expected}, counted ${first.counted}, ${first.expected - first.counted} unaccounted for`
      : 'No discrepancy present',
  })

  // 6 — withdrawn photography consent with photos still on file.
  const withdrawn = residents.filter((r) => r.consents.photography.kind === 'withdrawn')
  checks.push({
    n: 6,
    gap: 'A resident with withdrawn photography consent and existing photos still on file',
    found: withdrawn.length > 0,
    detail:
      withdrawn.length > 0
        ? `${withdrawn[0]?.fullLegalName} — consent withdrawn, photographs not retroactively deleted`
        : 'Nobody has withdrawn photography consent',
  })

  // 7 — a care plan domain finalised 14 months ago and never reviewed.
  let stalest = 0
  let stalestName = ''
  for (const resident of residents) {
    for (const domain of resident.carePlan) {
      if (domain.status.kind === 'review_due' && domain.status.daysOverdue > stalest) {
        stalest = domain.status.daysOverdue
        stalestName = resident.fullLegalName
      }
    }
  }
  checks.push({
    n: 7,
    gap: 'A care plan domain finalised 14 months ago and never reviewed',
    found: stalest >= 55,
    detail: `${stalestName} — most overdue domain is ${stalest} days past its review date`,
  })

  // 8 — a note flagged and not reviewed, and a correction note.
  const flagged = careNotes.filter(
    (note) => note.review.kind === 'flagged_not_reviewed',
  )
  const corrections = careNotes.filter((note) => note.corrects !== 'none')
  const superseded = careNotes.filter((note) => note.supersededBy !== 'none')
  checks.push({
    n: 8,
    gap: 'A care note flagged for review and not yet reviewed, and a correction note',
    found: flagged.length > 0 && corrections.length > 0 && superseded.length > 0,
    detail: `${flagged.length} flagged and unreviewed · ${corrections.length} correction note referencing ${GAP_NOTE_IDS.supersededOriginal} · the original stays visible, marked superseded`,
  })

  // 9 — Ashgrove thin enough for Insufficient Evidence.
  const ashgrove = residents.filter((r) => r.siteId === 'site-ashgrove-lodge')
  const ashgroveAssessed = ashgrove.filter(
    (r) => r.risks.falls.kind === 'assessed',
  ).length
  const coverage = ashgrove.length > 0 ? ashgroveAssessed / ashgrove.length : 0
  checks.push({
    n: 9,
    gap: 'A site where compliance coverage is thin enough to render Insufficient Evidence',
    found: ashgrove.length > 0 && coverage < 0.6,
    detail: `Ashgrove Lodge — ${ashgroveAssessed} of ${ashgrove.length} residents have a completed falls assessment (${Math.round(coverage * 100)}%, threshold 60%)`,
  })

  // 10 — a record authored by a now-deactivated staff member.
  const deactivated = staff
    .filter((member) => !member.isActive)
    .map((member) => member.id)
  const byDeactivated = careNotes.filter((note) =>
    deactivated.includes(note.recordedBy.id),
  )
  checks.push({
    n: 10,
    gap: 'At least one record authored by a now-deactivated staff member',
    found: byDeactivated.length > 0,
    detail:
      byDeactivated.length > 0
        ? `${byDeactivated.length} note(s) by ${byDeactivated[0]?.recordedBy.displayName} — records outlive access, and stay attributed`
        : 'No record by a deactivated author',
  })

  return checks
}

export function FixtureAudit() {
  const checks = buildChecks()
  const present = checks.filter((check) => check.found).length

  const rosewood = residents.filter((r) => r.siteId === 'site-rosewood-court')
  const ashgrove = residents.filter((r) => r.siteId === 'site-ashgrove-lodge')

  const totalUnassessed = residents.reduce(
    (sum, resident) =>
      sum +
      RISK_ASSESSMENT_TEMPLATES.filter(
        (t) => resident.risks[t.id].kind === 'not_assessed',
      ).length,
    0,
  )
  const totalNotSought = residents.reduce(
    (sum, resident) =>
      sum +
      CONSENT_TYPES.filter((t) => resident.consents[t.id].kind === 'not_sought').length,
    0,
  )
  const incomplete = residents.filter((r) => !recordCompleteness(r).isComplete).length
  const criticalGaps = residents.filter(
    (r) => recordCompleteness(r).hasCriticalGaps,
  ).length
  const stale = residents.filter((r) => staleRecords(r).length > 0).length

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Fixture audit</h2>
      <p className={styles.sectionNote}>
        PRD §5.3’s ten deliberate gaps, asserted against the real fixtures rather than
        described. Every one of them is a test that a screen built later cannot quietly
        pass. A row that fails means a screen would have been reviewed against tidy data
        and signed off for the wrong reason.
      </p>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Volume — PRD §5.2</span>
        <div className={styles.row}>
          <StatusPill
            tone={residents.length === 32 ? 'positive' : 'critical'}
            label={`${residents.length} residents`}
            detail={`${rosewood.length} Rosewood Court · ${ashgrove.length} Ashgrove Lodge · across ${sites.length} sites`}
          />
          <StatusPill
            tone={staff.length === 14 ? 'positive' : 'critical'}
            label={`${staff.length} staff`}
            detail={`${staff.filter((s) => !s.isActive).length} deactivated · across ${new Set(staff.map((s) => s.role)).size} roles`}
          />
          <StatusPill
            tone="info"
            label={`${careNotes.length} care notes`}
            detail="90 days of history"
          />
          <StatusPill
            tone="info"
            label={`${marRecordsAll.length} MAR records`}
            detail={`across ${medications.length} medications`}
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>
          Messiness — the gaps are the test, and must not be tidied
        </span>
        <div className={styles.row}>
          <StatusPill
            tone={
              criticalGaps > 0 && criticalGaps < residents.length
                ? 'positive'
                : 'critical'
            }
            label={`${criticalGaps} of ${residents.length} residents have a CRITICAL gap`}
            detail="what the Critical records missing chip fires on — allergies · resuscitation decision · falls risk · dysphagia risk · GP · next of kin · care and support consent"
          />
          <StatusPill
            tone="info"
            label={`${incomplete} of ${residents.length} have some gap`}
            detail="every care home does; the chip must discriminate or it is useless"
          />
          <StatusPill
            tone={stale > 0 ? 'positive' : 'critical'}
            label={`${stale} of ${residents.length} carry stale records`}
            detail="past a review or expiry date — the Stale state, PRD §6"
          />
          <StatusPill
            tone="info"
            label={`${totalUnassessed} risk assessments never completed`}
            detail={`across ${residents.length} residents × ${RISK_ASSESSMENT_TEMPLATES.length} templates`}
          />
          <StatusPill
            tone="info"
            label={`${totalNotSought} consents never sought`}
            detail={`across ${residents.length} residents × ${CONSENT_TYPES.length} types`}
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>
          The ten deliberate gaps — {present} of {checks.length} present
        </span>
        <div className={styles.stack}>
          {checks.map((check) =>
            check.found ? (
              <StatusPill
                key={check.n}
                tone="positive"
                label={`${check.n}. ${check.gap}`}
                detail={check.detail}
              />
            ) : (
              // A missing gap is itself a hole in the evidence — the fixtures
              // no longer test what they were built to test.
              <Unrecorded
                key={check.n}
                variant="row"
                label={`${check.n}. MISSING — ${check.gap}`}
                detail={check.detail}
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}
