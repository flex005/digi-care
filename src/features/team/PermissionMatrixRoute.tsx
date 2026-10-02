import { Link } from 'react-router-dom'
import { useTerms } from '@/app/session/use-term'
import { navLabel } from '@/app/nav-items.icons'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import {
  PERMISSION_LABELS,
  PERMISSION_MEANS,
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  SIGN_IN_ROLES,
  levelFor,
} from './permissions'
import styles from './team.module.css'

/**
 * The sign-in roles as a sentence, from the declaration rather than typed out.
 *
 * The list is joined with "and" before the last because a bare comma list
 * reads as a fragment where this sits mid-sentence. The names themselves are
 * never this screen's to choose: they are CQC titles the permission system
 * keys off, and the Manager term must not reach them.
 */
function signInRoleNames(): string {
  const names = SIGN_IN_ROLES.map((role) => STAFF_ROLE_NAMES[role])
  const last = names[names.length - 1]
  return names.length < 2
    ? (last ?? '')
    : `${names.slice(0, -1).join(', ')} and ${last}`
}

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
  const terms = useTerms()
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
          {/*
           * **Named from SIGN_IN_ROLES, not written out.** This sentence said
           * "the Admin, the Manager and the auditor", which named no row in
           * the table underneath it — the rows come from STAFF_ROLE_NAMES and
           * read "Registered manager", "Deputy manager", "Auditor". Two
           * spellings of one role is the one-owner defect, and here the second
           * spelling was also the informal one, so a reader checking the
           * sentence against the table found neither of the first two.
           * It is also where the Manager term must not reach: these are CQC
           * titles naming legal accountability, and the permission system keys
           * off these roles.
           */}
          Three of these roles sign in here: {signInRoleNames()}. The rest work in the
          Care Worker app and are managed from here.
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
                    {navLabel(module, terms)}
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
