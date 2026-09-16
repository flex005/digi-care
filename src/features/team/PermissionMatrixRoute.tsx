import { Link } from 'react-router-dom'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import {
  PERMISSION_LABELS,
  PERMISSION_MEANS,
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  levelFor,
} from './permissions'
import styles from './team.module.css'

/**
 * What each role would be able to do. PRD §6.7, Phase 14.
 *
 * The sentence: **that nothing here is enforced, then what each role would be
 * able to do in each of the sixteen modules.**
 *
 * The statement comes first because a grid of permissions is the most
 * convincing thing on any admin screen, and this one decides nothing. There is
 * no authentication in this build.
 */
export function PermissionMatrixRoute() {
  return (
    <div className={styles.page} data-permission-matrix>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Team
      </Link>

      <header>
        <h1 className={styles.pageTitle}>Permissions</h1>
      </header>
      <div className={styles.notEnforced} data-not-enforced data-state="unrecorded">
        {/*
         * **What the rows are, which the table never said.** Six roles are
         * listed and three of them sign into this platform: the other three
         * are care workers, senior carers and activities coordinators, who use
         * the Care Worker product. Their rows are here because this is the
         * platform where an Admin manages them, so what they can do is
         * something an Admin needs to see. That is a legitimate reason for the
         * rows and it is a different claim from "these are the people who use
         * this product", which is how a table of roles reads by default.
         */}
        <p className={styles.notEnforcedBody} data-matrix-subject>
          <b>
            This is what the people you manage can do, not a list of who uses this
            platform.
          </b>{' '}
          Three of these roles sign in here: the Admin, the Manager and the auditor. The
          rest work in the Care Worker app and are managed from here.
        </p>
      </div>

      <Card>
        <div className={styles.legend}>
          {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[]).map(
            (level) => (
              <p key={level} className={styles.legendItem} data-legend={level}>
                <span className={styles.legendLabel}>{PERMISSION_LABELS[level]}</span>
                <span className={styles.legendMeans}>{PERMISSION_MEANS[level]}</span>
              </p>
            ),
          )}
        </div>

        <div className={styles.matrixScroll}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th scope="col">Module</th>
                {PERMISSION_ROLES.map((role) => (
                  <th key={role} scope="col" className={styles.matrixRole}>
                    {STAFF_ROLE_NAMES[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((module) => (
                <tr key={module.id} data-matrix-row={module.id}>
                  <th scope="row" className={styles.matrixModule}>
                    {module.label}
                  </th>
                  {PERMISSION_ROLES.map((role) => {
                    const level = levelFor(role, module.id)
                    return (
                      <td key={role} className={styles.matrixCell}>
                        {level === 'no_access' ? (
                          /*
                           * No access is a decision somebody made about a role,
                           * not a gap in the record — so it renders settled and
                           * never takes the hatch.
                           */
                          <span className={styles.levelNone} data-level={level}>
                            {PERMISSION_LABELS[level]}
                          </span>
                        ) : (
                          <span className={styles.level} data-level={level}>
                            {PERMISSION_LABELS[level]}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
