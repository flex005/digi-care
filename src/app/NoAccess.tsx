import { Link } from 'react-router-dom'
import type { AdminAct } from '@/features/team/permissions'
import { PERMISSION_MODULES } from '@/features/team/permissions'
import { useViewer } from './session/use-viewer'
import styles from './no-access.module.css'

/**
 * A screen this role does not hold. Phase 17.
 *
 * **Absent rather than disabled, and this is the other half of that.** The
 * control is not rendered, so the only way to arrive here is to type the URL
 * or follow a stale link, and the screen has to say which of the two things
 * happened: the module is not yours, or the module is yours and this one act
 * is not. Those are different facts and a single "no access" page would state
 * the first when the second is true.
 *
 * **It is careful not to read as a phase that has not arrived.** Every unbuilt
 * screen in sixteen phases said so in the sidebar with its phase tag, and a
 * reader who has learned that treatment will read any refusal as "coming
 * later" unless told otherwise. This one says the module is built and other
 * roles use it.
 *
 * And it links to `/me/permissions`, because absence from a list is the same
 * bug as a blank cell (CLAUDE.md §1): a control that quietly is not there tells
 * nobody what they hold, so the screen that does is one click from every
 * refusal.
 */
export function NoAccess({ moduleId, act }: { moduleId?: string; act?: AdminAct }) {
  const viewer = useViewer()
  const label =
    PERMISSION_MODULES.find((entry) => entry.id === moduleId)?.label ?? moduleId

  return (
    <div className={styles.page} data-no-access={act ? act.id : moduleId}>
      {act === undefined ? (
        <>
          <h1 className={styles.title}>{label} is not part of your access</h1>
          <p className={styles.body}>
            Your role is {viewer.roleName}, and {label} is not one of the modules it
            opens.
          </p>
          <p className={styles.body}>
            That is a decision about the role rather than about you, and it is not a
            module waiting on a later phase. {label} is built, and the roles that hold
            it use it every day.
          </p>
        </>
      ) : (
        <>
          <h1 className={styles.title}>{act.phrase} is not part of your access</h1>
          <p className={styles.why}>{act.why}</p>
          <p className={styles.body}>
            Your role is {viewer.roleName}. You can open{' '}
            {PERMISSION_MODULES.find((entry) => entry.id === act.module)?.label ??
              act.module}{' '}
            and read all of it. This one screen belongs to the person the service is
            registered to.
          </p>
        </>
      )}

      <div className={styles.actions}>
        <Link to="/me/permissions" className={styles.link} data-see-access>
          See the whole of your access
        </Link>
      </div>
    </div>
  )
}
