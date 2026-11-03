import {
  instantFromZonedWallClock,
  zonedDate,
  zonedWallClock,
  type TimeZone,
} from '@/lib/format'
import type { IsoDate, IsoDateTime } from '../types'

/**
 * The zone every fixture wall-clock time is built in: the homes' own.
 *
 * **A round at 20:00 is an appointment on the home's clock**, not an instant:
 * its UTC moment moves by an hour when the UK changes its clocks, and a window
 * built on the machine's clock instead drifts by the difference between the
 * two. That is what happened on 25/10/2026. Every instant the fixtures build
 * from a clock time ("20:00", "?at=20:20", twenty minutes into a round) is
 * built here, so there is one answer to "20:00 where?".
 *
 * Both sites are Europe/London; `fixtures.test.ts` fails if a site is added
 * in another zone, because then this constant would be a second answer.
 */
export const HOME_ZONE: TimeZone = 'Europe/London'

const iso = (at: Date) => at.toISOString() as IsoDateTime
const pad = (value: number) => String(value).padStart(2, '0')
const MINUTE_MS = 60_000

/** Minutes past midnight on the home's clock at an instant. */
export function homeMinutesOfDay(at: Date): number {
  const wall = new Date(zonedWallClock(iso(at), HOME_ZONE))
  return wall.getUTCHours() * 60 + wall.getUTCMinutes()
}

/** The home's calendar day at an instant. */
export function homeDate(at: Date): IsoDate {
  return zonedDate(iso(at), HOME_ZONE)
}

/** A home calendar day moved by whole days or months, as calendar arithmetic. */
export function shiftHomeDate(date: IsoDate, by: { days?: number; months?: number }) {
  const day = new Date(`${date}T00:00:00.000Z`)
  day.setUTCMonth(day.getUTCMonth() + (by.months ?? 0))
  day.setUTCDate(day.getUTCDate() + (by.days ?? 0))
  return day.toISOString().slice(0, 10) as IsoDate
}

/** The instant the home's clock reads `minutes` past midnight on a home day. */
export function atHomeClock(date: IsoDate, minutes: number): Date {
  const hour = Math.floor(minutes / 60)
  return new Date(
    instantFromZonedWallClock(`${date}T${pad(hour)}:${pad(minutes % 60)}`, HOME_ZONE),
  )
}

/**
 * The same time on the home's clock, on a day `by` away. Seconds and
 * milliseconds are carried over, since every real offset is whole minutes.
 */
export function shiftOnHomeClock(at: Date, by: { days?: number; months?: number }) {
  const moved = atHomeClock(shiftHomeDate(homeDate(at), by), homeMinutesOfDay(at))
  return new Date(moved.getTime() + (at.getTime() % MINUTE_MS))
}
