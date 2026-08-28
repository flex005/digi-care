import { useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import {
  TIME_ZONES,
  changedFigures,
  figures,
  setFigure,
  setSiteName,
  setSiteTimeZone,
} from '@/data/access/settings-store'
import { CLOCK_IS_OVERRIDDEN, clockHref } from '@/data/fixtures/clock'
import styles from './group.module.css'

/**
 * Site settings. PRD §6.7, Phase 15.
 *
 * The sentence: **which site this is, then the figures that genuinely change
 * what a screen says, then the ones that are fixed at generation — stated as
 * fixed, with their values, rather than offered as controls.**
 *
 * **Settable if and only if it is read at render.** A figure baked into the
 * fixtures cannot be changed by a control, because the records were produced
 * against the old value: the control would move a label and not a single dose.
 * That is the largest "control that does nothing" available, on the screen
 * where somebody most reasonably expects otherwise.
 */
/**
 * Hours worth looking at, and what each one shows.
 *
 * Named by the state they make reachable rather than offered as a bare clock:
 * a time picker would be a control with no argument, and the reason to move the
 * clock is always a state, never an hour.
 */
const CLOCK_CHOICES: { value: string; label: string; what: string }[] = [
  {
    value: '08:20',
    label: '08:20',
    what: 'the 08:00 round in progress, nothing recorded yet',
  },
  {
    value: '09:30',
    label: '09:30',
    what: 'that round closed, its unrecorded doses now missing',
  },
  { value: '14:20', label: '14:20', what: 'the 14:00 round in progress' },
  { value: '18:20', label: '18:20', what: 'the 18:00 round in progress' },
  { value: '20:20', label: '20:20', what: 'the last round of the day in progress' },
]

export function SettingsRoute() {
  const { activeSite, reloadSites } = useSession()
  const [, setVersion] = useState(0)
  const bump = () => setVersion((count) => count + 1)

  const adjustable = figures().filter((figure) => !figure.fixedAtGeneration)
  const fixed = figures().filter((figure) => figure.fixedAtGeneration)
  const changed = changedFigures()

  return (
    <div className={styles.page} data-settings>
      <header>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>
          {activeSite.name}. Nothing here survives a reload, like every other write in
          this build, which is why every screen says when one of these has been changed.
        </p>
      </header>

      <Card>
        <section className={styles.settingsSection} data-settings-section="site">
          <h2 className={styles.settingsTitle}>This home</h2>
          <p className={styles.settingsNote}>
            Both of these are read while a screen draws. The zone decides what every
            clinical timestamp in this home says, which is the whole reason §3.6 exists.
          </p>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              type="text"
              defaultValue={activeSite.name}
              data-setting="site-name"
              onBlur={(event) => {
                setSiteName(activeSite.id, event.target.value.trim() || activeSite.name)
                reloadSites()
              }}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Timezone</span>
            <select
              value={activeSite.timeZone}
              data-setting="site-timezone"
              onChange={(event) => {
                setSiteTimeZone(activeSite.id, event.target.value)
                reloadSites()
              }}
            >
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.settingsSection} data-settings-section="adjustable">
          <h2 className={styles.settingsTitle}>Figures this build runs on</h2>
          <p className={styles.settingsNote}>
            Every one of these is invented and named in §9 of the frontend PRD, and
            every one is read while a screen draws, so changing one changes what that
            screen says, immediately and everywhere.
          </p>

          <ul className={styles.figures}>
            {adjustable.map((figure) => (
              <li key={figure.id}>
                <div className={styles.figure} data-figure={figure.id}>
                  <div>
                    <p className={styles.figureLabel}>{figure.label}</p>
                    <p className={styles.figureEffect}>{figure.effect}</p>
                    <p className={styles.figureSeen}>Seen on: {figure.seenOn}</p>
                  </div>
                  <label className={styles.figureField}>
                    <span className={styles.fieldLabel}>{figure.unit}</span>
                    <input
                      type="number"
                      defaultValue={figure.value}
                      data-setting={figure.id}
                      onBlur={(event) => {
                        const next = Number(event.target.value)
                        if (Number.isFinite(next) && next > 0)
                          setFigure(figure.id, next)
                        bump()
                      }}
                    />
                  </label>
                  <p className={styles.figureDefault}>
                    {figure.value === figure.fallback ? (
                      <span data-figure-state="default">
                        default {formatCount(figure.fallback)}
                      </span>
                    ) : (
                      <span
                        className={styles.figureChanged}
                        data-figure-state="changed"
                      >
                        changed this session · was {formatCount(figure.fallback)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.settingsSection} data-settings-section="clock">
          <h2 className={styles.settingsTitle}>The instant the record is drawn at</h2>
          <p className={styles.settingsNote}>
            Every record in this build is generated when the page loads, against the
            clock. Some states only exist at certain hours: a dose is inside its window
            for one hour after its round and not otherwise, so on a real clock they are
            zero for most of the day, and a true zero cannot be told from a screen that
            has stopped working. Moving the clock reloads and draws the whole record
            again at that time.
          </p>

          <div className={styles.clockChoices} data-clock-choices>
            {CLOCK_CHOICES.map((choice) => (
              <a
                key={choice.value}
                href={clockHref(choice.value)}
                className={styles.clockChoice}
                data-clock-choice={choice.value}
              >
                <span className={styles.clockTime}>{choice.label}</span>
                <span className={styles.clockWhat}>{choice.what}</span>
              </a>
            ))}
          </div>

          <p className={styles.settingsNote}>
            {CLOCK_IS_OVERRIDDEN ? (
              <>
                <b>The clock is moved.</b> Every screen says so while it is, and{' '}
                <a href={clockHref('')} data-clock-reset>
                  going back to the real clock
                </a>{' '}
                reloads and redraws the record.
              </>
            ) : (
              'The record is drawn at the real time. Nothing is pretending.'
            )}
          </p>
        </section>

        <section className={styles.settingsSection} data-settings-section="fixed">
          <h2 className={styles.settingsTitle}>Fixed at fixture generation</h2>
          <p className={styles.settingsNote}>
            These are read-only, and the reason is the point rather than an apology: the
            record was produced against them, so a control here would move a label and
            not the data.
          </p>

          {fixed.map((figure) => (
            <div key={figure.id} className={styles.fixedFigure} data-fixed={figure.id}>
              <p className={styles.figureLabel}>
                {figure.label}, <span data-numeric>{formatCount(figure.value)}</span>{' '}
                {figure.unit}
              </p>
              <p className={styles.figureEffect}>{figure.effect}</p>
            </div>
          ))}
        </section>
      </Card>

      {changed.length > 0 ? (
        <div data-settings-changed>
          <Unrecorded
            variant="panel"
            caption="Changed this session"
            label={`${formatCount(changed.length)} of these figures ${changed.length === 1 ? 'is' : 'are'} no longer at the documented default.`}
            detail={`${changed.map((figure) => figure.label).join('; ')}. Every screen carries a marker while that is true, because a screen behaving differently from its documented default without saying so is the reassurance failure with the reader's own change as the cause.`}
          />
        </div>
      ) : null}
    </div>
  )
}
