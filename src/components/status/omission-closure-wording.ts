import type { IsoDateTime, OmissionClosure } from '@/data/types'
import { staffLabel } from '@/data/access/team-store'

/*
 * In its own file rather than beside `OmissionClosureFact`, so the component's
 * file exports only a component and fast refresh keeps working on it.
 */

type ClosedOmission = Extract<OmissionClosure, { kind: 'closed' }>

/**
 * The sentence, with one owner: "Closed by M. Halloran, 12/09/2026 14:02: GP
 * informed." The MAR cell's accessible name and this component both ask it,
 * so the words a screen reader hears and the words on the screen agree.
 *
 * Who and when come in already formatted, because the two callers format a
 * timestamp differently: the component through the site's format, which adds
 * a zone label where the viewer is elsewhere, and the accessible sentence in
 * the site's zone alone, as every other part of that sentence is.
 */
export function omissionClosureSentence(
  closure: ClosedOmission,
  attributionOn: (displayName: string, at: IsoDateTime) => string,
): string {
  const reason = closure.reason.trim()
  // The reason is somebody's own words, so it keeps its own full stop rather
  // than gaining a second one.
  const ending = /[.!?]$/.test(reason) ? '' : '.'
  return `Closed by ${attributionOn(staffLabel(closure.by), closure.at)}: ${reason}${ending}`
}
