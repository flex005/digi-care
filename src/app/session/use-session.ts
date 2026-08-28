import { useContext, useMemo } from 'react'
import { SessionContext, TimeZoneContext } from './context'
import type { Session } from './context'
import {
  formatAttribution,
  formatAttributionOn,
  formatDate,
  formatDateTime,
  formatInstantDate,
  formatRelative,
  formatTime,
  viewerTimeZone,
  zoneLabel,
} from '@/lib/format'
import type { IsoDate, IsoDateTime } from '@/data/types'

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside a SessionProvider')
  return session
}

/** The zone the nearest enclosing site renders its records in. */
export function useTimeZone(): string {
  const timeZone = useContext(TimeZoneContext)
  if (!timeZone) throw new Error('useTimeZone must be used inside a TimeZoneProvider')
  return timeZone
}

/**
 * Formatters bound to the site's timezone. **This is the only way a component
 * should render a clinical timestamp** — ESLint blocks importing date-fns
 * formatting anywhere but `src/lib/format.ts`, so there is no second route.
 *
 * `showsZone` is true when the viewer's own zone differs from the site's,
 * which is exactly PRD §3.6's "wherever ambiguity is possible": a UK manager
 * sees `08:04`, an auditor abroad sees `08:04 BST` and cannot misread it.
 */
export function useSiteFormat() {
  const timeZone = useTimeZone()

  return useMemo(() => {
    const showsZone = viewerTimeZone() !== timeZone

    const withZone = (formatted: string, at: IsoDateTime) =>
      showsZone ? `${formatted} ${zoneLabel(at, timeZone)}` : formatted

    return {
      timeZone,
      showsZone,
      /** Date-only. Never zone-converted — a date is not an instant. */
      date: (value: IsoDate) => formatDate(value),
      /** An instant, rendered as a date in the site's zone. */
      instantDate: (value: IsoDateTime) => formatInstantDate(value, timeZone),
      time: (value: IsoDateTime) => withZone(formatTime(value, timeZone), value),
      dateTime: (value: IsoDateTime) =>
        withZone(formatDateTime(value, timeZone), value),
      /** Elapsed time. Correctly viewer-relative — it is about now. */
      relative: (value: IsoDateTime) => formatRelative(value),
      /** Who and when, time only — for a record being read on its own day. */
      attribution: (displayName: string, at: IsoDateTime) =>
        withZone(formatAttribution(displayName, at, timeZone), at),
      /**
       * Who and when, date and time — for a record that may be days old.
       *
       * An unsigned draft rendered as "11:29" reads as this morning however
       * long ago somebody wrote it.
       */
      attributionOn: (displayName: string, at: IsoDateTime) =>
        withZone(formatAttributionOn(displayName, at, timeZone), at),
    }
  }, [timeZone])
}
