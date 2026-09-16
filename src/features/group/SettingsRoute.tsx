import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ConfiguredLists } from './ConfiguredLists'
import { NotConfiguredHere } from './NotConfiguredHere'
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
  const viewer = useViewer()
  /*
   * **Read-only rather than absent, and that is AM v2.0 asking for the right
   * thing.** A manager who cannot see the round times or the timezone cannot
   * tell whether a screen is wrong or configured, so the settings are readable
   * by anybody who can open the module and changeable by the registered
   * person. Absence is for a control whose existence is not the reader's
   * business; this is a control whose *value* is very much their business.
   */
  const mayConfigure = viewer.may('configure_service')
  const [, setVersion] = useState(0)
  const bump = () => setVersion((count) => count + 1)

  const adjustable = figures().filter((figure) => !figure.fixedAtGeneration)
  const fixed = figures().filter((figure) => figure.fixedAtGeneration)
  const changed = changedFigures()

  return (
    <div className={styles.page} data-settings>
      <header>
        <h1 className={styles.pageTitle}>Settings</h1>
        {mayConfigure ? null : (
          <p className={styles.readOnlyNote} data-settings-read-only>
            <b>These are read-only for you.</b> Your role is {viewer.roleName};
            configuring the service belongs to the person it is registered to.
          </p>
        )}
        <p className={styles.pageSubtitle}>{activeSite.name}.</p>
        {/*
         * The way into the setup wizard. AM v2.0 runs it on the first Admin's
         * first sign-in; with no accounts that moment does not exist here, so
         * it is reached from the screen whose settings it writes, by whoever
         * holds the act.
         */}
        {viewer.may('set_up_organisation') ? (
          <p className={styles.pageSubtitle}>
            <Link to="../setup" relative="path" data-open-setup>
              Open organisation setup
            </Link>
          </p>
        ) : null}
      </header>

      <Card>
        <section className={styles.settingsSection} data-settings-section="site">
          <h2 className={styles.settingsTitle}>This home</h2>
          <p className={styles.settingsNote}>
            The zone decides what every clinical timestamp in this home says.
          </p>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            {mayConfigure ? (
              <input
                type="text"
                defaultValue={activeSite.name}
                data-setting="site-name"
                onBlur={(event) => {
                  setSiteName(
                    activeSite.id,
                    event.target.value.trim() || activeSite.name,
                  )
                  reloadSites()
                }}
              />
            ) : (
              <span className={styles.readOnlyValue} data-setting-value="site-name">
                {activeSite.name}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Timezone</span>
            {mayConfigure ? (
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
            ) : (
              <span className={styles.readOnlyValue} data-setting-value="site-timezone">
                {activeSite.timeZone}
              </span>
            )}
          </label>
        </section>

        <section className={styles.settingsSection} data-settings-section="adjustable">
          <h2 className={styles.settingsTitle}>Figures this build runs on</h2>
          <p className={styles.settingsNote}>
            Changing one changes what every screen says, immediately.
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
                    {mayConfigure ? (
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
                    ) : (
                      <span
                        className={styles.readOnlyValue}
                        data-setting-value={figure.id}
                      >
                        {formatCount(figure.value)}
                      </span>
                    )}
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

        {mayConfigure ? (
          <ConfiguredLists
            siteId={activeSite.id}
            siteName={activeSite.name}
            onChanged={bump}
          />
        ) : null}

        <NotConfiguredHere />

        <section className={styles.settingsSection} data-settings-section="clock">
          <h2 className={styles.settingsTitle}>The instant the record is drawn at</h2>
          <p className={styles.settingsNote}>
            Moving the clock reloads and draws the whole record again at that time.
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
            These are read-only: the record was produced against them.
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
            detail={`${changed.map((figure) => figure.label).join('; ')}. Every screen carries a marker while that is true.`}
          />
        </div>
      ) : null}
    </div>
  )
}
