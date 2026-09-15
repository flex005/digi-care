import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Button, PasswordField } from '@/components/primitives'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { setSigningCode } from '@/data/access/team-store'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { invitationFor, invitationHasExpired } from '@/data/fixtures/invitations'
import { memberById } from '@/data/access/team-store'
import { PERMISSION_MODULES, levelFor } from '@/features/team/permissions'
import { PERMISSION_LABELS } from '@/features/team/permissions'
import { formatDate, zonedDate } from '@/lib/format'
import styles from './auth.module.css'

/**
 * Accepting an invitation. PRD §6.7.
 *
 * **What is being accepted renders before the password fields**, because
 * somebody accepting an invitation should be able to see what they are
 * accepting. Role, home, who sent it and what access comes with it, and then a
 * link into the full list — the same matrix a manager sees, one row of it.
 *
 * **The expiry is stated, and an expired invitation is a screen rather than a
 * failure on submit.** An invitation with no expiry is a permanent open door:
 * a link granting access to every resident's clinical record, working for ever,
 * for whoever ends up holding it.
 *
 * Password rules render as a checklist that ticks as each is met, and none is
 * hidden until it fails — a rule somebody only learns about by breaking it is
 * a rule that wasted their time on purpose.
 */

/**
 * What a password has to be.
 *
 * **Each rule is a predicate, and the list is what the screen renders**, so a
 * rule cannot be shown without being checked or checked without being shown.
 * The two drifting apart is how a checklist starts lying.
 */
export const PASSWORD_RULES: {
  id: string
  says: string
  met: (input: Input) => boolean
}[] = [
  {
    id: 'length',
    says: 'At least 12 characters',
    met: ({ password }) => password.length >= 12,
  },
  {
    id: 'not-name',
    says: 'Not your name or the name of the home',
    met: ({ password, forbidden }) => {
      const lowered = password.toLowerCase()
      return (
        password.length > 0 &&
        !forbidden.some((word) => word.length > 2 && lowered.includes(word))
      )
    },
  },
  /*
   * AM v2.0's AUTH-03 asks for one uppercase, one number and one special
   * character. Three rules rather than one, because the list is what the
   * screen renders: a single "meets the complexity requirements" row tells
   * somebody they have failed and not what to change.
   */
  {
    id: 'uppercase',
    says: 'At least one capital letter',
    met: ({ password }) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    says: 'At least one number',
    met: ({ password }) => /\d/.test(password),
  },
  {
    id: 'special',
    says: 'At least one symbol',
    met: ({ password }) => /[^A-Za-z0-9]/.test(password),
  },
  {
    id: 'match',
    says: 'Both entries match',
    met: ({ password, confirm }) => password.length > 0 && password === confirm,
  },
]

interface Input {
  password: string
  confirm: string
  /** Lowercased words a password must not contain: their name, the home's. */
  forbidden: string[]
}

export function InvitationRoute() {
  const { staffId } = useParams<{ staffId: string }>()
  const { activeSite, sites } = useSession()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  const member = staffId === undefined ? undefined : memberById(staffId)
  const invitation = staffId === undefined ? undefined : invitationFor(staffId)

  if (member === undefined || invitation === undefined) {
    return (
      <div className={styles.screen} data-invitation-missing>
        <h1 className={styles.title}>No invitation with that link</h1>
        <p className={styles.subtitle}>
          Nothing is shown rather than a form for an invitation nobody sent. If you were
          expecting one, ask the manager who invited you to send it again.
        </p>
        <Link to="/sign-in" className={styles.linkButton}>
          Go to sign in
        </Link>
      </div>
    )
  }

  const home = sites.find((entry) => member.siteIds.includes(entry.id)) ?? activeSite
  /*
   * The home's day, not the viewer's. An invitation that has a day left in
   * London and none in the viewer's zone is the timezone bug this product
   * takes seriously, on a screen that grants access.
   */
  const today: IsoDate = zonedDate(appNow().toISOString() as IsoDateTime, home.timeZone)
  const expired = invitationHasExpired(invitation, today)

  const forbidden = [
    ...member.ref.fullName.toLowerCase().split(/\s+/),
    ...home.name.toLowerCase().split(/\s+/),
  ]
  const input: Input = { password, confirm, forbidden }
  const unmet = PASSWORD_RULES.filter((rule) => !rule.met(input))
  const pinReady = /^\d{4}$/.test(pin) && pin === pinConfirm

  const initials = member.ref.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className={styles.screen} data-invitation={member.id}>
      <div className={`${styles.card} ${styles.inv}`}>
        <div className={styles.invHead}>
          <p className={styles.who}>{initials}</p>
          <h1>Set up your account, {member.ref.fullName.split(/\s+/)[0]}</h1>
          <p>
            {invitation.invitedBy.fullName} invited you to {home.name} on{' '}
            {formatDate(invitation.invitedOn)}.
            <br />
            {expired ? (
              <>This invitation expired on {formatDate(invitation.expiresOn)}.</>
            ) : (
              <>This invitation expires on {formatDate(invitation.expiresOn)}.</>
            )}
          </p>
        </div>

        <div className={styles.invSec}>
          <h2>What you have been invited as</h2>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Name</span>
            <span className={styles.detailValue}>{member.ref.fullName}</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Role</span>
            <span className={styles.detailValue}>{STAFF_ROLE_NAMES[member.role]}</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Home</span>
            <span className={styles.detailValue}>{home.name}</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Invited by</span>
            <span className={styles.detailValue}>
              {invitation.invitedBy.fullName} ·{' '}
              {STAFF_ROLE_NAMES[invitation.invitedBy.role]}
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Access</span>
            <span className={styles.detailValue} data-invited-access>
              {/*
               * Described from the matrix rather than written out, so what an
               * invitation promises and what the role actually gets cannot
               * come apart.
               */}
              {accessSentence(member.role)}
            </span>
          </div>
        </div>

        {expired ? (
          /*
           * Said here rather than raised on submit. An expiry that only
           * appears after somebody has chosen a password is an expiry that
           * wasted their time to enforce itself.
           */
          <p className={styles.expired} data-invitation-expired>
            <b>This invitation expired on {formatDate(invitation.expiresOn)}</b> and
            cannot be accepted. Ask {invitation.invitedBy.fullName} to send a new one.
          </p>
        ) : (
          <div className={styles.invSec}>
            <h2>Choose a password</h2>
            <div className={styles.field}>
              <PasswordField
                id="invitation-password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                data-field="password"
              />
            </div>

            <ul className={styles.pwRules} data-password-rules>
              {PASSWORD_RULES.map((rule) => {
                const met = rule.met(input)
                return (
                  <li
                    key={rule.id}
                    className={met ? styles.prOk : styles.pr}
                    data-rule={rule.id}
                    data-met={met ? 'yes' : 'no'}
                  >
                    <span className={styles.tick} aria-hidden>
                      {met ? '✓' : ''}
                    </span>
                    {rule.says}
                  </li>
                )
              })}
            </ul>

            <div className={styles.field}>
              <PasswordField
                id="invitation-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                data-field="confirm"
              />
            </div>

            {/*
             * **The count of rules met, where AM v2.0 asks for a strength
             * bar.** Weak, Fair and Strong are a RAG treatment on a claim
             * about security that nothing in this build can make: a password
             * meeting five rules is not "strong", it meets five rules. And RAG
             * is reserved for findings. So the figure is the one the checklist
             * already supports, with its denominator, and the list above is
             * what tells somebody what to change.
             */}
            <p className={styles.pwCount} data-password-met>
              {PASSWORD_RULES.length - unmet.length} of {PASSWORD_RULES.length} rules
              met
            </p>

            <h2>Set your signing code</h2>
            <p className={styles.hint}>
              Four digits, typed when you sign for a medication round, countersign a
              handover, or finalise a care plan. It goes on those records as you.
            </p>
            <div className={styles.field}>
              <PasswordField
                id="invitation-pin"
                label="Signing code"
                value={pin}
                onChange={(next) => setPin(next.replace(/\D/g, '').slice(0, 4))}
                autoComplete="off"
                data-field="pin"
              />
            </div>
            <div className={styles.field}>
              <PasswordField
                id="invitation-pin-confirm"
                label="Confirm signing code"
                value={pinConfirm}
                onChange={(next) => setPinConfirm(next.replace(/\D/g, '').slice(0, 4))}
                autoComplete="off"
                data-field="pin-confirm"
              />
            </div>
            <p className={styles.hint} data-pin-collision>
              Nothing stops two people choosing the same four digits. Until you set one,
              your code is derived from your account and cannot collide with anybody
              else&rsquo;s; choosing one is what a real deployment does, and it moves
              that guarantee from the system to whoever runs it.
            </p>

            {/*
             * **No job title.** AM v2.0's AUTH-03 asks for one, and this screen
             * collected it and kept it nowhere: `StaffMember` holds a name, a
             * role, homes and a standing, and nothing else. A field somebody
             * fills in that disappears is a control that does nothing, so it is
             * absent until a screen needs a job title, which is when it earns a
             * field — the same ruling as the organisation fields the setup wizard
             * does not ask for.
             */}
          </div>
        )}

        <div className={`${styles.invSec} ${styles.actions}`}>
          <Link to={`/invitation/${member.id}/access`} className={styles.linkButton}>
            See what I would be able to do
          </Link>
          <Button
            disabled={expired || unmet.length > 0 || !pinReady}
            data-accept-invitation
            onClick={() => {
              setSigningCode(member.id, pin)
              navigate(`/verify/${member.id}?next=invitation`)
            }}
          >
            Accept and set up my account
          </Button>
        </div>
      </div>

      {/* Feedback on the form, not an explanation of it: what is still
          outstanding, and nothing when nothing is. */}
      {expired || (unmet.length === 0 && pinReady) ? null : (
        <p className={styles.subtitle} data-invitation-state>
          Waiting on:{' '}
          {[
            ...unmet.map((rule) => rule.says.toLowerCase()),
            ...(pinReady ? [] : ['a four-digit signing code, entered twice']),
          ].join(' · ')}
          .
        </p>
      )}
    </div>
  )
}

/**
 * What an invitation promises, in a sentence, derived from the matrix.
 *
 * Not written out beside it: a sentence and a table stating the same access
 * are two owners of one fact, and the sentence is the one nobody updates.
 */
function accessSentence(role: Parameters<typeof levelFor>[0]): string {
  const byLevel = new Map<string, string[]>()
  for (const module of PERMISSION_MODULES) {
    const level = levelFor(role, module.id)
    byLevel.set(level, [...(byLevel.get(level) ?? []), module.label])
  }
  const parts: string[] = []
  for (const level of ['approve', 'record', 'read', 'no_access'] as const) {
    const modules = byLevel.get(level)
    if (modules === undefined || modules.length === 0) continue
    parts.push(`${PERMISSION_LABELS[level]}: ${modules.join(', ')}`)
  }
  return parts.join('. ')
}
