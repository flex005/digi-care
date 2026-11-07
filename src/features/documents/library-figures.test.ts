import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026. Every expiry is `daysAgo` or `daysAhead` of the fixtures' clock,
 * so these counts are the clock's; each figure below was measured at this
 * instant (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/documents?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { IsoDate, SiteId } from '@/data/types'
import { documentsForSite } from '@/data/fixtures/documents'
import { vocabularyFor } from '@/lib/vocabulary'
import { expiryDecisionCoverage } from './expiry'
import { organisationRows } from './library'

/**
 * Rosewood Court's library, as figures written out by hand.
 *
 * **Added 07/11/2026 because these figures moved and nothing here failed.**
 * Four prescriptions were added to the fixtures both builds share, three of
 * their scans joined this library, and every test in this build passed: each
 * one derived its expectation from the same fixtures the screen reads, so it
 * agreed with whatever they held. The Care Worker build pinned these figures
 * against DOC-01 and caught it. The same class as a formatter that rounded
 * twice and a test that computed its expectation with it.
 *
 * DOC-01 quotes 237 of 306 documents carrying an expiry decision, Health and
 * clinical 109 on file, 10 expired, 5 expiring, 21 with no expiry recorded;
 * Assessments and care planning 41/5/1/9; Consent records 34/3/3/4. The
 * fixtures carry three more Health and clinical documents than that: one with
 * an expiry date, one that does not expire, one with no expiry recorded
 * (docs/AM_PRD_STATUS.md, departures). Counted at the pin from the document
 * fixtures without these functions: 239 of 309, Health and clinical 112/10/5/22.
 */
const ROSEWOOD = 'site-rosewood-court' as SiteId
const TODAY = '2026-09-16' as IsoDate
const TERMS = vocabularyFor('care_home', {})

describe('Rosewood Court’s library', () => {
  it('has 239 of 309 documents carrying an expiry decision, 77%', () => {
    expect(
      expiryDecisionCoverage(documentsForSite(ROSEWOOD), 'Rosewood Court'),
    ).toEqual({
      kind: 'measured',
      unit: 'percentage',
      value: 77,
      coverage: { covered: 239, total: 309 },
    })
  })

  it('holds DOC-01’s three illustrated categories, Health and clinical with three more', () => {
    const rows = organisationRows(documentsForSite(ROSEWOOD), TODAY, TERMS)
    const of = (id: string) => {
      const row = rows.find((entry) => entry.id === id)
      if (row === undefined) throw new Error(`No ${id} row`)
      return {
        total: row.total,
        expired: row.expired,
        expiring: row.expiring,
        notRecorded: row.notRecorded,
      }
    }
    expect(of('health_clinical')).toEqual({
      total: 112,
      expired: 10,
      expiring: 5,
      notRecorded: 22,
    })
    expect(of('assessments_care_planning')).toEqual({
      total: 41,
      expired: 5,
      expiring: 1,
      notRecorded: 9,
    })
    expect(of('consent_records')).toEqual({
      total: 34,
      expired: 3,
      expiring: 3,
      notRecorded: 4,
    })
  })
})
