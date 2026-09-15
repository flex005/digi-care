import { Link } from 'react-router-dom'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
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

      {/*
       * **This paragraph said the opposite until Phase 17, and it was true
       * when it was written.** It is the staleness case exactly: a statement
       * on a screen nobody re-reads, correct for fifteen phases, and made
       * false by a change somewhere else. What replaces it draws the line that
       * actually matters now, because "these levels do something" and "these
       * levels are security" are a long way apart and the gap is where
       * somebody gets hurt.
       */}
      <div className={styles.notEnforced} data-not-enforced data-state="unrecorded">
        <p className={styles.notEnforcedTitle}>
          These levels decide what renders. They are not security.
        </p>
        <p className={styles.notEnforcedBody}>
          A module a role has no access to does not open, and a control a role has no
          level for is not drawn. What that prevents is somebody doing the wrong thing
          by accident. It prevents nothing else: the sign-in screen still checks nothing
          and anybody can sign in as anybody, and access control that lives in a browser
          is a suggestion. A real deployment enforces this on a server.
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

        <div className={styles.matrixNote}>
          <Unrecorded
            variant="panel"
            caption="What this matrix is not"
            label="Fifty-four permissions across nine modules is a number from a product that has a permission model."
            detail="This one has sixteen modules and none. A matrix that did not match the product would be worse than no matrix, so the modules come from the sidebar and the levels are the four distinctions this build already makes."
          />
        </div>
      </Card>
    </div>
  )
}
