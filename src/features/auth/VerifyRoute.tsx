import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Dialog } from '@/components/primitives'
import { Logo } from '@/components/brand/Logo'
import type { SiteId } from '@/data/types'
import { memberById } from '@/data/access/team-store'
import { mayDo } from '@/features/team/permissions'
import { useSession } from '@/app/session/use-session'
import styles from './auth.module.css'

/**
 * The six digits. AM v2.0 AUTH-04, Phase 19.
 *
 * **Nothing was sent and nothing is checked, and that is on the screen rather
 * than behind a link.** Every other authentication screen in this build puts
 * its statement one click away, because a form that says what it cannot do
 * before somebody uses it is a paragraph in front of a form. This one is
 * different in kind: it asks for a code that was never sent anywhere, so a
 * reader who is not told will sit waiting for an email. The statement is the
 * screen's subject rather than a disclaimer on it.
 *
 * **Any six digits pass, and it says so.** The alternative — accepting one
 * particular code — would be a check that looks real and is not, which is the
 * thing this build refuses on the sign-in form. What is demonstrated is the
 * shape of the step: a code, a window it is good for, and a way to ask again.
 *
 * **The timer runs and the resend is live**, because both are honest: the
 * countdown is a real clock and the resend genuinely resets it. What neither
 * does is send anything.
 */
const WINDOW_SECONDS = 10 * 60
const RESEND_AFTER_SECONDS = 60

export function VerifyRoute() {
  const { staffId } = useParams<{ staffId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { sites, signInAs, organisation } = useSession()

  const member = useMemo(() => (staffId ? memberById(staffId) : undefined), [staffId])
  const site = sites.find((entry) => entry.id === (params.get('site') as SiteId))
  const fromInvitation = params.get('next') === 'invitation'

  const [code, setCode] = useState('')
  const [left, setLeft] = useState(WINDOW_SECONDS)
  /*
   * **The statement that no account was created moved here with the act.** It
   * was on the invitation's Accept button, which was the last step until
   * verification landed in front of the product. A statement at the moment of
   * the act has to move when the act does, or it becomes a warning about a
   * step that is no longer the end of anything.
   */
  const [finished, setFinished] = useState(false)
  /*
   * **Setting up the organisation, offered rather than remembered.** AM v2.0
   * AUTH-05 runs the wizard once, on the first Admin's first sign-in. Nothing
   * here records a sign-in, so "first" cannot be told apart from any other, and
   * a flag would be a claim about history this build does not hold. Signing out
   * discards everything the wizard wrote, so every sign-in does start with the
   * organisation unset by it: offering it each time is the state of the build
   * made visible, and the person who holds the act chooses.
   */
  const [offeringSetup, setOfferingSetup] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  if (member === undefined) {
    return (
      <div className={`${styles.screen} ${styles.centred}`}>
        <div className={`${styles.card} ${styles.verifyCard}`}>
          <h1 className={styles.title}>No account to verify</h1>
          <p className={styles.subtitle}>
            This link names somebody the team record does not hold.{' '}
            <Link to="/sign-in">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  if (offeringSetup) {
    return (
      <div className={`${styles.screen} ${styles.centred}`} data-setup-offer>
        <div className={`${styles.card} ${styles.verifyCard}`}>
          <Logo height={32} title="Radiant digicare" />
          {/* Not a welcome: the organisation already has homes and a team. */}
          <h1 className={styles.title}>Set up {organisation.name}?</h1>
          <p className={styles.subtitle}>It can be done now, or later from Settings.</p>
          <div className={`${styles.actions} ${styles.offerActions}`}>
            <Button
              variant="secondary"
              data-offer-dashboard
              onClick={() => navigate('/')}
            >
              Go to the dashboard
            </Button>
            <Button data-offer-setup onClick={() => navigate('/settings/setup')}>
              Set it up
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const ready = /^\d{6}$/.test(code) && left > 0
  const minutes = Math.floor(left / 60)
  const seconds = String(left % 60).padStart(2, '0')
  const canResend = left <= WINDOW_SECONDS - RESEND_AFTER_SECONDS

  return (
    <div className={`${styles.screen} ${styles.centred}`} data-verify={member.id}>
      <div className={`${styles.card} ${styles.verifyCard}`}>
        <Logo height={32} title="Radiant digicare" />
        <h1 className={styles.title}>Verify your email</h1>

        {/*
         * First, because the rest of the screen asks for something that does
         * not exist. Everywhere else in this build the statement is one click
         * away; here withholding it leaves somebody waiting for an email.
         */}
        <p className={styles.verifyNotice} data-nothing-sent>
          No code is sent or checked: any six digits continue.
        </p>

        <div className={styles.field}>
          <label className={styles.k} htmlFor="verify-code">
            Six-digit code
          </label>
          <input
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            data-field="code"
          />
        </div>

        <p className={styles.hint} data-verify-window>
          {left > 0 ? (
            <>
              Good for another{' '}
              <span data-numeric>
                {minutes}:{seconds}
              </span>{' '}
              of ten minutes.
            </>
          ) : (
            'That code has run out. Ask for another.'
          )}
        </p>

        <div className={styles.rowBetween}>
          <button
            type="button"
            className={styles.linkButton}
            disabled={!canResend}
            data-resend
            onClick={() => {
              setLeft(WINDOW_SECONDS)
              setCode('')
            }}
          >
            {canResend
              ? 'Send another code'
              : `Another can be asked for in ${RESEND_AFTER_SECONDS - (WINDOW_SECONDS - left)}s`}
          </button>
          <Button
            disabled={!ready}
            data-verify-submit
            onClick={() => {
              if (fromInvitation) {
                setFinished(true)
                return
              }
              if (site === undefined) return
              signInAs(member, site)
              if (mayDo(member.role, 'set_up_organisation')) setOfferingSetup(true)
              else navigate('/')
            }}
          >
            {fromInvitation ? 'Finish setting up' : 'Verify and sign in'}
          </Button>
        </div>
      </div>

      <Dialog
        open={finished}
        onOpenChange={(next) => {
          setFinished(next)
          if (!next) navigate('/sign-in')
        }}
        title="No account was created"
        description="Nothing was saved, so there is no account to sign in to."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setFinished(false)
              navigate('/sign-in')
            }}
          >
            Back to sign in
          </Button>
        }
      />
    </div>
  )
}
