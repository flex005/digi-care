import { useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Card } from '@/components/primitives'
import { TIME_ZONES, setSiteName, setSiteTimeZone } from '@/data/access/settings-store'
import { ConfiguredLists } from './ConfiguredLists'
import { NotConfiguredHere } from './NotConfiguredHere'
import styles from './group.module.css'

/**
 * One home's own settings: its name, its timezone, and what it carries out.
 *
 * Headed by the home's name, because every value here belongs to the active
 * home and changes nothing at the other one. What every home shares is on the
 * organisation tab.
 */
export function HomeSettingsRoute() {
  const { activeSite, reloadSites } = useSession()
  const viewer = useViewer()
  const [, setVersion] = useState(0)
  const bump = () => setVersion((count) => count + 1)
  // Readable by anybody who can open the module, changeable by the registered
  // person: a manager who cannot read the timezone cannot tell a wrong screen
  // from a configured one.
  const mayConfigure = viewer.may('configure_service')

  return (
    <div className={styles.page} data-home-settings>
      <header className={styles.tabHead}>
        <div>
          <h2 className={styles.tabTitle} data-tab-heading>
            {activeSite.name}
          </h2>
          <p className={styles.pageSubtitle}>Settings for this home only.</p>
        </div>
      </header>
      {mayConfigure ? null : (
        <p className={styles.readOnlyNote} data-settings-read-only>
          <b>These are read-only for you.</b> Your role is {viewer.roleName};
          configuring the service belongs to the person it is registered to.
        </p>
      )}

      <Card>
        <section className={styles.settingsSection} data-settings-section="site">
          <h3 className={styles.settingsTitle}>Name and timezone</h3>
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

        {mayConfigure ? (
          <ConfiguredLists
            siteId={activeSite.id}
            siteName={activeSite.name}
            onChanged={bump}
          />
        ) : null}

        <NotConfiguredHere />
      </Card>
    </div>
  )
}
