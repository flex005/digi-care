import { describe, expect, it } from 'vitest'
import {
  formatAttributionOn,
  formatDuration,
  formatLateness,
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

describe('formatLateness', () => {
  it('counts days while days are still the shorter sentence', () => {
    expect(formatLateness(1)).toBe('1 day')
    expect(formatLateness(59)).toBe('59 days')
  })

  it('switches to months where a day count stops being legible', () => {
    // "426 days late" is a figure nobody converts in their head — precision
    // standing in for legibility on a screen somebody scans.
    expect(formatLateness(60)).toBe('2 months')
    expect(formatLateness(365)).toBe('12 months')
    expect(formatLateness(426)).toBe('14 months')
  })

  it('never drifts more than half its own unit from the truth', () => {
    /*
     * The first version truncated, which looks like the cautious choice and is
     * not: on an average-month divisor it lands just under every round number,
     * so a year read as "11 months". Asserted as a property rather than
     * against more literals — no rendered span may be more than half of its
     * own unit away from the truth in either direction.
     *
     * The parser reads days, months and years, because the renderer gained a
     * unit. That is the rendering changing, not the property.
     */
    const DAYS_IN_AVERAGE_MONTH = 30.44
    for (let days = 1; days <= 4000; days += 1) {
      const rendered = formatLateness(days)
      const asDays = renderedToDays(rendered, DAYS_IN_AVERAGE_MONTH)
      const unit = rendered.includes('day')
        ? 1
        : rendered.includes('year')
          ? DAYS_IN_AVERAGE_MONTH
          : DAYS_IN_AVERAGE_MONTH
      expect(
        Math.abs(asDays - days),
        `${days} days → "${rendered}"`,
      ).toBeLessThanOrEqual(unit / 2 + 0.01)
    }
  })

  it('reads long spans in years and months', () => {
    // "1275 days" is a figure nobody converts, and "42 months" is barely
    // better. This is how somebody says it.
    expect(formatDuration(730)).toBe('2 years')
    expect(formatDuration(1275)).toBe('3 years 6 months')
    expect(formatDuration(365 * 5)).toContain('5 years')
  })

  it('agrees the word with the count, at one', () => {
    expect(formatLateness(1)).toBe('1 day')
    expect(formatLateness(46)).toBe('46 days')
  })
})

describe('formatAttributionOn', () => {
  const at = '2026-08-22T10:29:00.000Z' as IsoDateTime

  it('carries the date as well as the time', () => {
    // `formatAttribution` renders the time alone, which is right for a record
    // read on the day it was made and wrong for one that may be days old: an
    // unsigned draft from last Tuesday shown as "11:29" reads as this morning.
    expect(formatAttributionOn('A. Okonkwo', at, 'Europe/London')).toBe(
      'A. Okonkwo, 22/08/2026 11:29',
    )
  })

  it('renders the name it is given and decorates nothing', () => {
    /*
     * Whether the author still has access is not this function's business any
     * more. It appended "(deactivated)" from a snapshot, which made a fact
     * about now part of a record about then; `staffLabel` in the team store
     * owns it, reading current standing. The guard that this is still said is
     * in the team suite, on the thing that now says it.
     */
    const decorated = 'J. Whitfield (no longer has access)'
    expect(formatAttributionOn(decorated, at, 'Europe/London')).toContain(decorated)
  })

  it('renders in the site zone, not the viewer’s', () => {
    expect(formatAttributionOn('A. Okonkwo', at, 'Pacific/Auckland')).toBe(
      'A. Okonkwo, 22/08/2026 22:29',
    )
  })
})

/** Turns a rendered span back into days, for the property above. */
function renderedToDays(rendered: string, daysInMonth: number): number {
  let total = 0
  for (const [, value, unit] of rendered.matchAll(/(\d+) (day|month|year)/g)) {
    const count = Number(value)
    if (unit === 'day') total += count
    if (unit === 'month') total += count * daysInMonth
    if (unit === 'year') total += count * 12 * daysInMonth
  }
  return total
}
