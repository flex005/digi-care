import { Link } from 'react-router-dom'
import { useSiteFormat } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import type { IsoDateTime } from '@/data/types'
import { sessionActs } from '@/data/access/session-log'
import { staffLabel } from '@/data/access/team-store'
import { formatCount } from '@/lib/format'
import styles from './team.module.css'

/**
 * What this session has written. PRD §6.7, Phase 14.
 *
 * The sentence: **what this session has written, newest first — and what a
 * deployed log would carry that this one cannot.**
 *
 * **Narrow on purpose.** The two things a real activity log answers are who
 * read somebody's record and who did something that left no trace on a record.
 * This build checks nothing at sign-in, logs no reads and has no exports, so a
 * log claiming to hold them would be a screen inventing its own evidence — the
 * failure the whole product is organised against.
 *
 * **Nor does it hold everything that is written.** Nine of the client's write
 * functions never reach it, among them every medication round. The sign-out
 * screen therefore asks the stores rather than asking this.
 */
/**
 * Written as mid-sentence fragments rather than capitalised and lowercased at
 * the call site — the tidying transformation §8 names, which turned "DNAR"
 * into "dnar" in Phase 11.
 */
const NOT_LOGGED = [
  'who opened a resident’s record, and when',
  'sign-ins, sign-outs and failed attempts',
  'exports and downloads',
  'permission changes',
  'anything done before this page was loaded',
]

export function ActivityLogRoute() {
  const format = useSiteFormat()
  const acts = sessionActs()

  return (
    <div className={styles.page} data-activity-log>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Team
      </Link>

      <header>
        <h1 className={styles.pageTitle}>Activity log</h1>
        <p className={styles.pageSubtitle}>
          Everything written in this browser tab since it was opened, newest first.
        </p>
      </header>

      <Card>
        {acts.length === 0 ? (
          <p className={styles.emptyLog} data-empty-log>
            Nothing has been written in this session yet.
          </p>
        ) : (
          <ul className={styles.acts}>
            {acts.map((act) => (
              <li key={act.id}>
                <div className={styles.act} data-session-act={act.id}>
                  <p className={styles.actWhen}>
                    <span>{format.time(act.at as IsoDateTime)}</span>
                    <span className={styles.actDate}>
                      {format.relative(act.at as IsoDateTime)}
                    </span>
                  </p>
                  <div>
                    <p className={styles.actWhat}>{act.what}</p>
                    <p className={styles.actModule}>
                      {act.module} · {staffLabel(act.by)}
                    </p>
                  </div>
                  <Link
                    to={act.to}
                    className={styles.actLink}
                    aria-label={`Open the record: ${act.what}`}
                  >
                    Open the record
                    <Icon
                      name="arrows-sharp/arrow-right-01-sharp"
                      size={16}
                      aria-hidden
                    />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.notLogged} data-not-logged>
          <Unrecorded
            variant="panel"
            caption={`${formatCount(acts.length)} ${acts.length === 1 ? 'act' : 'acts'} in this session`}
            label="Not in this log"
            detail={`${NOT_LOGGED.join('; ')}.`}
          />
        </div>
      </Card>
    </div>
  )
}
