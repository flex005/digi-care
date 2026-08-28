import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Button } from '@/components/primitives'
import { sessionLossTotal, sessionLosses } from '@/data/access/session-losses'
import { formatCount, pluralise } from '@/lib/format'
import styles from './auth.module.css'

/**
 * Signing out. PRD §6.7.
 *
 * **The one screen in this build where an action destroys work rather than
 * failing to save it.** Everything the product records is held in this browser
 * tab and sent nowhere, so there is no server keeping a second copy and no
 * reload that brings any of it back.
 *
 * **So the confirmation names what would go, item by item, with counts.** A
 * sentence saying "unsaved changes will be lost" is equally true of a session
 * in which nothing happened, which makes it uncheckable: a reader cannot hold
 * it against what is actually there. Same shape as the consent withdrawal's
 * downstream effects, and for the same reason.
 *
 * **Where nothing has been written, the block does not render at all.** A loss
 * box listing nothing would teach a reader to click past the one that lists
 * something.
 *
 * The list is assembled by `session-losses.ts`, which asks every store rather
 * than reading the activity log — the log covers six modules of twelve, and a
 * confirmation missing a third of what it destroys is worse than the vague
 * sentence it replaced, because it looks complete.
 */
export function SignOutRoute() {
  const { currentUser, signOut, signIn } = useSession()
  const navigate = useNavigate()

  /*
   * Read once, on the way in. The list a reader agreed to must be the list
   * that was destroyed: re-reading it after the click would describe a session
   * that no longer exists.
   */
  const [losses] = useState(() => sessionLosses())
  const [total] = useState(() => sessionLossTotal())

  const firstName = currentUser.fullName.split(/\s+/)[0]

  /*
   * Already signed out, so there is nobody to address and nothing to confirm.
   * Asking "Sign out, Adaeze?" of somebody who is not signed in names a person
   * the session does not have — the wrong-subject failure on the one screen
   * whose whole job is being checkable.
   */
  if (signIn.kind === 'signed_out') {
    return (
      <div className={styles.screen} data-sign-out data-already-signed-out>
        <header>
          <h1 className={styles.title}>You are already signed out</h1>
          <p className={styles.subtitle}>
            Nothing is held. Everything this build records lives in the browser tab it
            was written in, and there is no session open.
          </p>
        </header>
        <Link to="/sign-in" className={styles.linkButton}>
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.screen} data-sign-out>
      <header>
        <h1 className={styles.title}>Sign out</h1>
        <p className={styles.subtitle}>
          The one screen in this build where an action destroys work rather than failing
          to save it.
        </p>
      </header>

      <div className={`${styles.card} ${styles.soWrap}`}>
        <div className={styles.soHead}>
          <h2>Sign out, {firstName}?</h2>
          <p>
            Everything diGi-Care records in this build is held in your browser&rsquo;s
            memory. It is never sent anywhere, and signing out discards it.
          </p>
        </div>

        {losses.length > 0 ? (
          <div className={styles.lossBox} data-loss-box>
            <p className={styles.lossTitle}>What you would lose</p>
            <p className={styles.lossBody}>
              These were recorded during this session and exist nowhere else. Signing
              out is not the same as saving and leaving, because there is nothing to
              save to.
            </p>
            <ul className={styles.lossList}>
              {losses.map((entry) => (
                <li key={entry.what} className={styles.lossRow} data-loss={entry.what}>
                  {capitalise(entry.what)}
                  <span className={styles.lossCount} data-numeric>
                    {formatCount(entry.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.nothingToLose} data-nothing-to-lose>
            Nothing has been written into the record this session, so there is nothing
            to lose. Signing out returns you to the sign-in screen.
          </p>
        )}

        <div className={styles.soFoot}>
          <Link to="/me" className={styles.stayButton} data-stay-signed-in>
            Stay signed in
          </Link>
          <Button
            variant="destructive"
            className={styles.dangerOutline}
            data-confirm-sign-out
            onClick={() => {
              signOut()
              navigate('/sign-in')
            }}
          >
            {/*
             * The count is in the sentence rather than beside it, because
             * this is the click that does it. "Sign out" alone would be a
             * button that discards thirty records without saying so.
             */}
            {total === 0
              ? 'Sign out'
              : `Sign out and discard ${pluralise(total, 'record')}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Ours, so it is ours to capitalise: the list phrases are written here. */
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
