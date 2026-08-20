import { describe, expect, it } from 'vitest'
import {
  ageFrom,
  formatDate,
  formatDateTime,
  formatInstantDate,
  formatTime,
  zoneLabel,
} from './format'
import type { IsoDate, IsoDateTime } from '@/data/types'

/**
 * PRD §3.6 — clinical timestamps render in the SITE's timezone, never the
 * viewer's. A dose given at 08:04 at Rosewood Court reads 08:04 to every
 * viewer, anywhere, forever.
 *
 * These tests pin that by formatting the same instant for several sites in
 * different zones. If someone reintroduces viewer-local formatting they fail
 * on any machine, not just one set to an unusual timezone.
 */

const LONDON = 'Europe/London'
const NEW_YORK = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

describe('site timezone rendering', () => {
  // 08:04 British Summer Time, i.e. 07:04 UTC.
  const dose = '2026-08-19T07:04:00Z' as IsoDateTime

  it('renders a dose given at 08:04 at a London site as 08:04', () => {
    expect(formatTime(dose, LONDON)).toBe('08:04')
  })

  it('renders the same instant differently for sites in different zones', () => {
    // Not a bug — these are genuinely different wall-clock times at those
    // sites. The point is that the SITE decides, not the viewer.
    expect(formatTime(dose, NEW_YORK)).toBe('03:04')
    expect(formatTime(dose, TOKYO)).toBe('16:04')
  })

  it('never renders am/pm, and always renders 24-hour', () => {
    const evening = '2026-08-19T19:30:00Z' as IsoDateTime
    expect(formatTime(evening, LONDON)).toBe('20:30')
    expect(formatTime(evening, LONDON)).not.toMatch(/am|pm/i)
  })

  it('renders dates DD/MM/YYYY, never MM/DD', () => {
    // 03/04 is unambiguous only because one of them is impossible as a month.
    const value = '2026-04-03T10:00:00Z' as IsoDateTime
    expect(formatInstantDate(value, LONDON)).toBe('03/04/2026')
    expect(formatDateTime(value, LONDON)).toBe('03/04/2026 11:00')
  })

  it('labels the zone that was in force at that instant, not today', () => {
    const summer = '2026-08-19T07:04:00Z' as IsoDateTime
    const winter = '2026-01-19T07:04:00Z' as IsoDateTime
    expect(zoneLabel(summer, LONDON)).toBe('BST')
    expect(zoneLabel(winter, LONDON)).toBe('GMT')
  })
})

describe('date-only values are never zone-converted', () => {
  /**
   * A date is not an instant. Parsing '2026-03-12' to UTC midnight and
   * shifting it into a zone behind UTC moves it to the 11th — a silently
   * wrong clinical date on a DNAR or a consent record.
   */
  const signedOn = '2026-03-12' as IsoDate

  it('renders the same day whatever the site zone', () => {
    expect(formatDate(signedOn)).toBe('12/03/2026')
  })

  it('does not shift backwards for a site behind UTC', () => {
    // The regression this guards against: formatInstantDate on a date-only
    // value in a western zone yields the previous day.
    const asInstantInNewYork = formatInstantDate(
      `${signedOn}T00:00:00Z` as IsoDateTime,
      NEW_YORK,
    )
    expect(asInstantInNewYork).toBe('11/03/2026')
    // …which is exactly why formatDate does not take a zone at all.
    expect(formatDate(signedOn)).toBe('12/03/2026')
  })
})

describe('ageFrom', () => {
  it('counts whole years', () => {
    expect(ageFrom('1938-11-04' as IsoDate, new Date('2026-08-19T12:00:00Z'))).toBe(87)
  })

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFrom('1938-12-25' as IsoDate, new Date('2026-08-19T12:00:00Z'))).toBe(87)
    expect(ageFrom('1938-01-02' as IsoDate, new Date('2026-08-19T12:00:00Z'))).toBe(88)
  })
})
