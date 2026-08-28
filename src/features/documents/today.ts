import { now as appNow } from '@/data/fixtures/clock'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { useTimeZone } from '@/app/session/use-session'
import { zonedDate } from '@/lib/format'

/**
 * Today, in the site's timezone.
 *
 * **Never the viewer's day.** At 00:10 in London the viewer's UTC day is still
 * yesterday, and a document expiring today would read as expiring tomorrow —
 * on a screen whose whole job is telling somebody what has lapsed. The
 * calendar in Phase 9 had exactly this defect before it was fixed.
 *
 * Not memoised on `now`: the value is read once per render and every screen
 * using it re-renders on navigation, which is close enough for a day boundary
 * and honest about the fact that nothing here polls a clock.
 */
export function useSiteToday(): IsoDate {
  const timeZone = useTimeZone()
  return zonedDate(appNow().toISOString() as IsoDateTime, timeZone)
}
