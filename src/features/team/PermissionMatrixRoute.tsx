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

      <div className={styles.notEnforced} data-not-enforced data-state="unrecorded">
        <p className={styles.notEnforcedTitle}>Nothing here is enforced.</p>
        <p className={styles.notEnforcedBody}>
          There is a sign-in screen and it checks nothing: any details sign you in, and
          no screen anywhere checks a level set here. What follows describes what a real
          deployment would enforce. It is not a control, and changing it would change
          nothing, which is why there is nothing to change.
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
