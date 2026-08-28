import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Button, Dialog, PasswordField } from '@/components/primitives'
import { Logo } from '@/components/brand/Logo'
import type { SiteId } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffOsei } from '@/data/fixtures/organisation'
import { teamMembers } from '@/data/access/team-store'
import { pluralise } from '@/lib/format'
import { addressFor, memberForAddress } from './addresses'
import { PROTOTYPE_STATEMENT, PROTOTYPE_WARNING } from './prototype-statement'
import styles from './auth.module.css'

/**
 * Signing in. PRD §6.7.
 *
 * **The site is chosen here rather than after.** It decides the timezone every
 * record written today carries, and a home picked on the next screen means the
 * first thing somebody read was rendered in the wrong zone. Each home carries
 * its zone on its own row, so the choice states its consequence without a
 * paragraph explaining it.
 *
 * **No "remember me".** There is no session to remember: everything is in this
 * browser tab and a reload signs you out.
 *
 * **The address is matched against the team.** Any password is accepted and
 * none is checked, but the person is real: signing in has to produce somebody
 * whose name goes on every record written afterwards, and an address matching
 * nobody would produce a session belonging to nobody in particular.
 *
 * **What this build does not check is behind the recovery link rather than
 * across the top of the screen.** The statement is the same one it always was
 * and it is one click from the form, on the control whose absence would
 * otherwise be the giveaway.
 */
export function SignInRoute() {
  const { sites, signInAs } = useSession()
  const navigate = useNavigate()

  const members = useMemo(() => teamMembers(), [])
  const defaultSite =
    sites.find((site) => site.id === 'site-rosewood-court') ?? sites[0]
  const defaultMember = members.find((member) => member.id === staffOsei.id)

  const [email, setEmail] = useState(
    defaultMember && defaultSite ? addressFor(defaultMember, defaultSite) : '',
  )
  const [password, setPassword] = useState('')
  const [siteId, setSiteId] = useState<SiteId | undefined>(defaultSite?.id)
  const [askedAboutRecovery, setAskedAboutRecovery] = useState(false)

  const member = memberForAddress(email, members, sites)
  const site = sites.find((entry) => entry.id === siteId)
  const typedSomething = email.trim() !== ''

  return (
    <div className={`${styles.screen} ${styles.centred}`} data-sign-in>
      <div className={styles.card}>
        <div className={styles.authWrap}>
          <div className={styles.authSide}>
            {/* Light, not the artwork as supplied: brand purple on the deep
                purple panel would lose the mark into the background. */}
            <Logo tone="light" height={40} title="Radiant digicare" />
            <p className={styles.claim}>
              A care record that says what nobody has written down.
            </p>
            <p className={styles.claimSmall}>
              Every gap renders as a gap. A blank never means the same as a no, and
              nothing is green because it happens to be empty.
            </p>
            <p className={styles.sideFoot}>
              {sites.map((entry) => entry.name).join(' and ')}
            </p>
          </div>

          <div className={styles.authMain}>
            {/* The page's only h1: the outer heading was a second one saying
                the same word. */}
            <h1 className={styles.authTitle}>Sign in</h1>
            <p className={styles.lede}>
              Use the email address your manager invited you with.
            </p>

            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.k} htmlFor="sign-in-email">
                  Email
                </label>
                <input
                  id="sign-in-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  data-field="email"
                  autoComplete="username"
                />
                {typedSomething && member === undefined ? (
                  <p className={styles.fieldError} data-no-such-account>
                    No account here uses that address.
                  </p>
                ) : null}
              </div>

              <div className={styles.field}>
                <PasswordField
                  id="sign-in-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  data-field="password"
                />
              </div>

              <div className={styles.field}>
                <span className={styles.k}>Which home are you working at today?</span>
                <div className={styles.siteChoice}>
                  {sites.map((entry) => {
                    const chosen = entry.id === siteId
                    return (
                      <label
                        key={entry.id}
                        className={chosen ? styles.scOn : styles.sc}
                        data-site-option={entry.id}
                      >
                        <input
                          type="radio"
                          name="sign-in-site"
                          checked={chosen}
                          onChange={() => setSiteId(entry.id)}
                        />
                        {entry.name}
                        {/* The zone rides on the row, so choosing a home shows
                            what the choice decides. */}
                        <span className={styles.scMeta}>
                          {pluralise(residentsBySite(entry.id).length, 'resident')} ·{' '}
                          {entry.timeZone}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className={styles.hint}>
                  Chosen here rather than afterwards, because it decides the timezone
                  every record you write today will carry.
                </p>
              </div>

              {/*
               * The way into onboarding. In a real deployment this link does
               * not exist: an invitation arrives as a link in an email
               * addressed to one person, and that is the only way anybody
               * reaches theirs. Nothing here sends email, so without this the
               * whole invitation path would be reachable only by typing a
               * URL, which is the same as not having built it.
               */}
              <p className={styles.hint}>
                <Link to="/invitation" className={styles.linkButton} data-invited-link>
                  I have been invited and need to set up my account
                </Link>
              </p>

              <div className={styles.rowBetween}>
                <button
                  type="button"
                  className={styles.linkButton}
                  data-forgotten-password
                  onClick={() => setAskedAboutRecovery(true)}
                >
                  I have forgotten my password
                </button>
                <Button
                  disabled={member === undefined || site === undefined}
                  data-sign-in-submit
                  onClick={() => {
                    if (member === undefined || site === undefined) return
                    signInAs(member, site)
                    navigate('/')
                  }}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
       * The prototype statement, on the one control that cannot honestly do
       * what it says. It was a banner across the top of every authentication
       * screen and still is on the invitation, where somebody is being asked
       * to accept something; here it sits behind the click that would have
       * exposed it anyway, so the form is a form and the fact is a sentence
       * away rather than a paragraph in front of it.
       */}
      <Dialog
        open={askedAboutRecovery}
        onOpenChange={(next) => setAskedAboutRecovery(next)}
        title="There is no password to recover"
        description={`${PROTOTYPE_STATEMENT} There is no server to send a reset to and nothing stored that could be reset.`}
        actions={
          <Button variant="secondary" onClick={() => setAskedAboutRecovery(false)}>
            Close
          </Button>
        }
      >
        <p className={styles.dialogBody} data-recovery-note>
          {PROTOTYPE_WARNING}
        </p>
      </Dialog>
    </div>
  )
}
