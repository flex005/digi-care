import type { StaffRole } from '@/data/types'
import { Card } from '@/components/primitives'
import {
  ADMIN_ACTS,
  PERMISSION_LABELS,
  PERMISSION_MEANS,
  PERMISSION_MODULES,
  levelFor,
  mayDo,
} from '@/features/team/permissions'
import styles from './me.module.css'

/**
 * What one role can do, in every module. PRD §6.7.
 *
 * **The same data as the manager's matrix, one row of it**, and read through
 * the same `levelFor` rather than restated. A second table describing the same
 * access is a second rule, and the one nobody updates is whichever a reader
 * happens to be looking at.
 *
 * **The statement that nothing is enforced renders before the first row**, as
 * it does on the matrix. A list of permissions is the most convincing thing on
 * any screen, and this one decides nothing.
 *
 * Used twice: by somebody looking at their own access, and by somebody
 * deciding whether to accept an invitation — who should be able to see what
 * they are accepting before they accept it, not after.
 */
export function RolePermissions({
  staffRole: role,
  who,
}: {
  /**
   * **`staffRole` rather than `role`.** jsx-a11y reads any prop called `role`
   * as an ARIA role and fails on a literal, which meant this component could
   * only ever be handed a variable: the first test to pass "deputy_manager"
   * directly broke the build. A prop that can only be given an expression is a
   * prop with a trap in it, and the word costs nothing.
   */
  staffRole: StaffRole
  /** Whose access this is, named. A permission list with no subject is a leaflet. */
  who: string
}) {
  return (
    <div className={styles.perms} data-role-permissions={role}>
      <Card>
        <div className={styles.permHead}>
          <h2 className={styles.permTitle}>
            {who}: {PERMISSION_MODULES.length} modules, {LEVELS.length} levels
          </h2>
          {/*
           * What each level means comes from the matrix's own wording rather
           * than a second phrasing here. Two sentences describing one level
           * are two owners, and the one that goes stale is whichever the
           * reader is looking at.
           */}
          <dl className={styles.legend}>
            {LEVELS.map((level) => (
              <div key={level} className={styles.legendItem} data-legend={level}>
                <dt className={LEVEL_CLASS[level]}>{PERMISSION_LABELS[level]}</dt>
                <dd className={styles.legendMeans}>{PERMISSION_MEANS[level]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ul className={styles.permList}>
          {PERMISSION_MODULES.map((module) => {
            const level = levelFor(role, module.id)
            return (
              <li key={module.id} className={styles.permRow} data-module={module.id}>
                <span className={styles.permModule}>{module.label}</span>
                <span className={LEVEL_CLASS[level]} data-level={level}>
                  {PERMISSION_LABELS[level]}
                </span>
              </li>
            )
          })}
        </ul>

        {/*
         * **The acts that are not levels, and this is where absence is
         * answerable.** Phase 17 makes Admin-only controls absent rather than
         * disabled, which is what Frank asked for and which creates a problem
         * of its own: a control that is simply not drawn tells the reader
         * nothing, and absence from a list is the same bug as a blank cell
         * (CLAUDE.md §1). So the four acts are listed for every role, held or
         * not, each with the reason it belongs where it does. A manager who
         * goes looking for the inspection pack finds it named here rather than
         * concluding the product lost it.
         */}
        <section className={styles.permActs} data-admin-acts>
          <h3 className={styles.permActsTitle}>
            Four acts belong to the registered person
          </h3>
          <p className={styles.permActsNote}>
            The provider and the registered manager are the two people a service is
            registered to. These four are theirs, whatever level anybody else holds in
            the module they sit in.
          </p>
          <ul className={styles.permActList}>
            {ADMIN_ACTS.map((act) => {
              const held = mayDo(role, act.id)
              return (
                <li
                  key={act.id}
                  className={styles.permActRow}
                  data-act={act.id}
                  data-held={held ? 'yes' : 'no'}
                >
                  <span className={held ? styles.permActYes : styles.permActNo}>
                    {held ? 'Yours' : 'Not yours'}
                  </span>
                  <span>
                    <b className={styles.permActWhat}>{act.what}</b>
                    <span className={styles.permActWhy}>{act.why}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {/*
         * The inert treatment, and the second of the two places it appears.
         * Somebody looking for their own training record should be told
         * plainly that it is not here rather than left to conclude it is
         * empty — which is the same failure as a blank cell, one level up.
         */}
        <p className={styles.notHeld} data-not-held="staff-records">
          <b>
            Your training, supervision, appraisal and induction records are not held in
            diGi-Care.
          </b>{' '}
          Ask your manager where your home keeps them.
        </p>
      </Card>
    </div>
  )
}

const LEVELS = ['no_access', 'read', 'record', 'approve'] as const

const LEVEL_CLASS: Record<(typeof LEVELS)[number], string> = {
  no_access: styles.lvNone,
  read: styles.lvRead,
  record: styles.lvRecord,
  approve: styles.lvApprove,
}
