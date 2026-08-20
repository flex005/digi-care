import type { SupportLevel } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * How much support a resident needs in a care plan domain. Source PRD §16.2:
 * Independent · Prompting Only · Partial Assistance · Full Assistance.
 *
 * `not_assessed` is a real member and renders hatched, because "Independent"
 * and "nobody has assessed them" are opposite claims about a person's safety.
 * Reading the second as the first is how someone gets left to manage stairs
 * alone.
 *
 * The tone rises with dependency, but the words carry the meaning — the level
 * is never conveyed by colour alone (PRD §7).
 */
export function SupportLevelBadge({ level }: { level: SupportLevel }) {
  switch (level.kind) {
    case 'not_assessed':
      return <Unrecorded label="Support level not assessed" />
    case 'independent':
      return <StatusPill tone="positive" label="Independent" />
    case 'prompting_only':
      return <StatusPill tone="positive" label="Prompting only" />
    case 'partial_assistance':
      return <StatusPill tone="caution" label="Partial assistance" />
    case 'full_assistance':
      return <StatusPill tone="info" label="Full assistance" />
    default:
      return assertNever(level)
  }
}
