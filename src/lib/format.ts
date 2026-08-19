/**
 * Date and time formatting. PRD §3.6, CLAUDE.md §6.
 *
 * Dates are DD/MM/YYYY. Times are 24-hour. Never MM/DD, never am/pm.
 * Relative time is allowed alongside, never instead of, an absolute timestamp
 * on any clinical record — so `formatRelative` deliberately returns only the
 * parenthetical half and the caller must render the absolute time too.
 */

import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { enGB } from 'date-fns/locale'
import type { IsoDate, IsoDateTime } from '@/data/types'

const options = { locale: enGB }

/** `12/03/2026` */
export function formatDate(value: IsoDate | IsoDateTime): string {
  return format(parseISO(value), 'dd/MM/yyyy', options)
}

/** `08:04` */
export function formatTime(value: IsoDateTime): string {
  return format(parseISO(value), 'HH:mm', options)
}

/** `12/03/2026 08:04` */
export function formatDateTime(value: IsoDateTime): string {
  return format(parseISO(value), 'dd/MM/yyyy HH:mm', options)
}

/**
 * `2 hours ago`. Never rendered on its own — pair it with an absolute
 * timestamp. PRD §3.6.
 */
export function formatRelative(value: IsoDateTime): string {
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true, ...options })
}

/**
 * How a record's authorship reads: "C. Nwosu, 08:04".
 * Every clinical record displays its author and its timestamp, always
 * visible, never hover-only. PRD §3.6.
 */
export function formatAttribution(
  displayName: string,
  at: IsoDateTime,
  isActive = true,
): string {
  const who = isActive ? displayName : `${displayName} (deactivated)`
  return `${who}, ${formatTime(at)}`
}
