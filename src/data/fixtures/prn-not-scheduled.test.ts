import { vi } from 'vitest'

/*
 * Pinned to a full instant, 16/09/2026 at 20:20 BST, so a window is open and
 * a round is part-recorded: the states a PRN must never reach are all reachable
 * for a scheduled drug at this moment.
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import {
  MAR_HISTORY_DAYS,
  fellDueAt,
  isScheduledDaysAgo,
  marRecordsAll,
  medications,
} from './medications'
import { now } from './clock'
import { residentsBySite } from './residents'
import { sites, staffNwosu } from './organisation'
import { getOmissions } from '@/data/access/client'
import { roundsToday, todayDoses } from '@/features/dashboard/series'
import { loadReportData } from '@/features/reports/data'
import { REPORT_PERIOD_DAYS, periodEndingToday } from '@/features/reports/period'
import { reportById } from '@/features/reports/catalogue'
import { runReport } from '@/features/reports/runs'
import { staffActivity } from '@/features/team/staff-activity'
import { vocabularyFor } from '@/lib/vocabulary'
import { zonedDate } from '@/lib/format'

/**
 * **A PRN is by definition not scheduled** (corrected 05/11/2026, in both
 * builds). Its chart holds the doses somebody chose to give, and nothing else:
 * no window, no omission, no refusal of a dose nobody offered at a round. And
 * a PRN somebody gave is still something they did.
 */

const at = now().toISOString() as IsoDateTime
const rosewood = sites[0]!
const asRequired = new Set(
  medications
    .filter((medication) => medication.isPrn)
    .map((medication) => medication.id),
)
const prnCells = marRecordsAll.filter((record) => asRequired.has(record.medicationId))
const scheduledCells = marRecordsAll.filter(
  (record) => !asRequired.has(record.medicationId),
)

describe('an as-required drug on the chart', () => {
  it('has doses given and nothing else, while scheduled drugs keep every state', () => {
    expect(new Set(prnCells.map((record) => record.state.kind))).toEqual(
      new Set(['given', 'not_due']),
    )
    expect(new Set(scheduledCells.map((record) => record.state.kind))).toEqual(
      new Set(['given', 'not_given', 'omitted', 'due', 'not_due']),
    )
  })

  it('is scheduled on no day, while a scheduled drug is on some', () => {
    const days = Array.from({ length: MAR_HISTORY_DAYS }, (_, day) => day)
    expect(
      medications
        .filter((medication) => medication.isPrn)
        .filter((medication) =>
          days.some((day) => isScheduledDaysAgo(medication, day)),
        ),
    ).toEqual([])
    expect(
      medications
        .filter((medication) => !medication.isPrn)
        .every((medication) => days.some((day) => isScheduledDaysAgo(medication, day))),
    ).toBe(true)
  })

  it('never fell due, so no figure counts it among the doses owed', () => {
    const given = prnCells.filter((record) => record.state.kind === 'given')
    expect(given.length).toBeGreaterThan(0)
    expect(given.every((record) => fellDueAt(record) === 'not_due')).toBe(true)
  })

  it('is never an omission on the omissions list', async () => {
    const since = new Date(new Date(at).getTime() - 7 * 86_400_000).toISOString()
    const { omissions } = await getOmissions(rosewood.id, since as IsoDateTime)
    expect(omissions.length).toBeGreaterThan(0)
    expect(omissions.filter((omission) => omission.medication.isPrn)).toEqual([])
  })

  it('is not one of today’s doses on the dashboard', () => {
    const residents = residentsBySite(rosewood.id)
    const ids = new Set(residents.map((resident) => resident.id))
    const today = zonedDate(at, rosewood.timeZone)
    const todays = marRecordsAll.filter(
      (record) => ids.has(record.residentId) && record.date === today,
    )
    expect(
      todays.filter(
        (record) =>
          asRequired.has(record.medicationId) && record.state.kind === 'given',
      ).length,
    ).toBeGreaterThan(0)
    const scheduledToday = todays.filter((record) => {
      const medication = medications.find((entry) => entry.id === record.medicationId)
      return (
        medication !== undefined &&
        !medication.isPrn &&
        isScheduledDaysAgo(medication, 0)
      )
    })
    expect(todayDoses(roundsToday(rosewood, residents, at)).total).toBe(
      scheduledToday.length,
    )
  })
})

describe('a PRN somebody gave is still something they did', () => {
  it('stays in their activity', () => {
    const acts = staffActivity(staffNwosu.id, vocabularyFor('care_home', {}))
    const gaveAPrn = prnCells.some(
      (record) =>
        record.state.kind === 'given' && record.state.givenBy.id === staffNwosu.id,
    )
    expect(gaveAPrn).toBe(true)
    expect(
      acts.some((act) =>
        [...asRequired].some((id) => act.id.startsWith(`dose-${id}-`)),
      ),
    ).toBe(true)
  })

  it('counts among the doses they recorded in the care note coverage report', async () => {
    const terms = vocabularyFor('care_home', {})
    const definition = reportById('care-note-coverage', terms)!
    const period = periodEndingToday(at, rosewood.timeZone, REPORT_PERIOD_DAYS)
    const data = await loadReportData(rosewood, at)
    const worked = (records: typeof data.marRecords) => {
      const result = runReport({
        data: { ...data, marRecords: records },
        definition,
        terms,
        period,
        previous: undefined,
        cut: 'staff',
      }) as unknown as { rows: { id: string; cells: { value?: number }[] }[] }
      return result.rows.find((row) => row.id === staffNwosu.id)?.cells[0]?.value
    }
    const theirPrn = data.marRecords.filter(
      (record) =>
        asRequired.has(record.medicationId) &&
        record.state.kind === 'given' &&
        record.state.givenBy.id === staffNwosu.id &&
        record.date >= period.from &&
        record.date <= period.to,
    ).length
    expect(theirPrn).toBeGreaterThan(0)
    const withPrn = worked(data.marRecords) ?? 0
    const withoutPrn =
      worked(
        data.marRecords.filter((record) => !asRequired.has(record.medicationId)),
      ) ?? 0
    expect(withPrn - withoutPrn).toBe(theirPrn)
  })
})
