import { assertNever } from '@/lib/assert-never'
import { Unrecorded } from '@/components/status'
import { useTimeZone } from '@/app/session/use-session'
import type { Resident } from '@/data/types'
import { BADGE_STRIP_SOURCES } from './badge-strip-sources'
import styles from './profile.module.css'

/**
 * The risk flag strip. PRD §16.3 — all five statuses, always, whatever they
 * say.
 *
 * Three lines per card: the field, the answer, the attribution. The answer is
 * the largest line and the only one carrying the status colour, because it is
 * the thing being read — "DNAR in place", "Penicillin", "Not assessed". The
 * field above it and the author beneath are context for an answer somebody has
 * already taken in.
 *
 * Colour arrives as a left edge bar and a tint rather than a full outline. An
 * outline draws a box first and its contents second; a bar leaves the answer as
 * the loudest thing on the card, which is the point of the card.
 *
 * **The unrecorded state keeps the hatch exactly.** Not a variant of it, not a
 * quieter version — the same treatment, through the same component, with the
 * left bar in the unrecorded colour so the strip still reads level. A gap must
 * not become tidier just because its neighbours became cards.
 */
export function BadgeStrip({ resident }: { resident: Resident }) {
  const timeZone = useTimeZone()

  return (
    <ul className={styles.flags} aria-label="Risk flags">
      {BADGE_STRIP_SOURCES.map((source) => {
        const state = source.state(resident, timeZone)

        switch (state.kind) {
          case 'unrecorded':
            return (
              <li key={source.id} className={styles.flagItem}>
                <Unrecorded
                  variant="flag"
                  caption={source.name}
                  label={state.answer}
                  detail={state.attribution}
                />
              </li>
            )

          case 'recorded':
            return (
              <li key={source.id} className={styles.flagItem}>
                <div
                  className={[styles.flag, TONE_CLASS[state.tone]].join(' ')}
                  data-state="recorded"
                  data-tone={state.tone}
                >
                  <span className={styles.flagField}>{source.name}</span>
                  <span className={styles.flagAnswer}>{state.answer}</span>
                  <span className={styles.flagAttribution}>{state.attribution}</span>
                </div>
              </li>
            )

          default:
            return assertNever(state)
        }
      })}
    </ul>
  )
}

const TONE_CLASS = {
  positive: styles.flagPositive,
  caution: styles.flagCaution,
  critical: styles.flagCritical,
  info: styles.flagInfo,
  brand: styles.flagBrand,
} as const
