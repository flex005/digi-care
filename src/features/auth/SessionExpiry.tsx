import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionTimeoutMinutes } from '@/data/access/settings-store'
import { useSession } from '@/app/session/use-session'
import styles from './auth.module.css'

/**
 * A session that ends, and says so before it does. AM v2.0 AUTH-08, Phase 19.
 *
 * **The one thing in the authentication phase that is not a drawing.** Nothing
 * here signs anybody in, verifies an address or checks a password, and all of
 * those say so. This is different: the clock is real, the inactivity is real,
 * and reaching zero genuinely destroys everything the session wrote, through
 * the same path the sign-out screen uses. It has teeth because the thing it
 * protects — work held in memory and nowhere else — is real too.
 *
 * **Which is why it warns rather than merely acting.** Signing somebody out is
 * the only act in this build that destroys work rather than failing to save
 * it, and doing that silently after eight quiet hours would be the same defect
 * as a confirmation that does not say what it will take. The warning names the
 * time left and offers the way back, and the sign-out that follows lands on a
 * screen that says what happened.
 *
 * **Activity is a click or a keypress, not a route change.** A reader moving
 * between screens is working; a reader who has left the tab open on the
 * Dashboard is not, and a route-based reset would keep a session alive for
 * somebody who went home.
 */
const WARN_WITHIN_MINUTES = 10

export function SessionExpiry() {
  const { signIn, signOut } = useSession()
  const navigate = useNavigate()
  const [lastActive, setLastActive] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const touch = () => setLastActive(Date.now())
    for (const event of ['pointerdown', 'keydown'] as const)
      window.addEventListener(event, touch)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      for (const event of ['pointerdown', 'keydown'] as const)
        window.removeEventListener(event, touch)
      clearInterval(tick)
    }
  }, [])

  const timeout = sessionTimeoutMinutes() * 60_000
  const left = Math.max(0, lastActive + timeout - now)
  const signedIn = signIn.kind === 'signed_in'

  useEffect(() => {
    if (!signedIn || left > 0) return
    signOut()
    navigate('/sign-in?ended=inactivity')
  }, [signedIn, left, signOut, navigate])

  if (!signedIn || left > WARN_WITHIN_MINUTES * 60_000) return null

  const minutes = Math.floor(left / 60_000)
  const seconds = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')

  return (
    <div className={styles.expiryBar} data-session-expiry>
      <p className={styles.expiryText}>
        <b>
          This session ends in{' '}
          <span data-numeric>
            {minutes}:{seconds}
          </span>
        </b>{' '}
        and everything it has written will be gone. Nothing in this build is saved
        anywhere else.
      </p>
      <button
        type="button"
        className={styles.expiryStay}
        data-stay-signed-in
        onClick={() => setLastActive(Date.now())}
      >
        Stay signed in
      </button>
    </div>
  )
}
