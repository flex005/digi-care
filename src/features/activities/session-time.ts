import type { IsoDate, IsoDateTime } from '@/data/types'
import { zonedDate, zonedWallClock } from '@/lib/format'
import type { TimeZone } from '@/lib/format'

/**
 * A date and a time as a clock on the home's wall shows them, as the instant
 * they name. Phase 25.
 *
 * **The home's wall, never the viewer's.** A session at 14:30 is at 14:30 in
 * the lounge it happens in; a browser in another zone that read the inputs as
 * its own would put it an hour out for half the year.
 *
 * The offset is taken at the guessed instant and applied once. That is exact
 * except inside the hour a clock change skips or repeats, where a wall time
 * either does not exist or exists twice, and this lands on one of the two.
 * Nobody plans a session for 01:30 on the last Sunday in October.
 */
export function siteInstant(
  date: IsoDate,
  time: string,
  timeZone: TimeZone,
): IsoDateTime {
  const wall = new Date(`${date}T${time}:00.000Z`).getTime()
  const offset =
    zonedWallClock(new Date(wall).toISOString() as IsoDateTime, timeZone) - wall
  return new Date(wall - offset).toISOString() as IsoDateTime
}

/** The inverse, for filling a form from a session that already exists. */
export function siteWallParts(
  value: IsoDateTime,
  timeZone: TimeZone,
): { date: IsoDate; time: string } {
  const wall = new Date(zonedWallClock(value, timeZone))
  const hours = String(wall.getUTCHours()).padStart(2, '0')
  const minutes = String(wall.getUTCMinutes()).padStart(2, '0')
  return { date: zonedDate(value, timeZone), time: `${hours}:${minutes}` }
}
