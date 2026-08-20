import type { MoodRecord } from '@/data/types'
import { MOOD_LABELS } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * The five-point mood scale from a care note. Source PRD §16.
 *
 * Always a word, never a face alone — the source PRD's "5 face icons" are
 * unreadable to a screen reader and ambiguous to everyone else, so PRD §6.3
 * requires each to carry a text label. Here only the word is used.
 *
 * A note without a mood recorded is hatched, not rendered as neutral. A care
 * worker who did not record how someone seemed has not recorded that they
 * seemed fine.
 */
export function MoodBadge({ mood }: { mood: MoodRecord }) {
  const format = useSiteFormat()

  switch (mood.kind) {
    case 'not_recorded':
      return <Unrecorded label="Mood not recorded" />

    case 'recorded':
      return (
        <StatusPill
          tone={mood.score <= 2 ? 'caution' : mood.score === 3 ? 'info' : 'positive'}
          label={MOOD_LABELS[mood.score]}
          detail={format.attribution(
            mood.recordedBy.displayName,
            mood.recordedAt,
            mood.recordedBy.isActive,
          )}
        />
      )

    default:
      return assertNever(mood)
  }
}
