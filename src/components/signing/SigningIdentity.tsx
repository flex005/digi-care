import type { StaffRef } from '@/data/types'
import { signingCodeFor, signingCodeMatches } from '@/data/access/team-store'
import styles from './SigningIdentity.module.css'

/**
 * Who is signing, and the code that says it is them. PRD §6.7.
 *
 * **A sign-off has to name a person, not a click.** Every signing surface in
 * this build ended in a button; the medication round asked for four digits and
 * checked only that four had been typed, which establishes that somebody was
 * standing at the trolley and nothing about who. On a device a shift shares,
 * that is the shared-login failure with a keypad in front of it.
 *
 * The code belongs to one member of staff and is checked against them, so what
 * goes on the record is a name, an identifier traceable to that name, and the
 * moment. That is what an audit trail is.
 *
 * **It is not a security mechanism, and the screen says so.** There are no
 * accounts and no secrets in this build; a code that implied otherwise would be
 * the more dangerous of the two, because a home would trust it.
 */
export function SigningIdentity({
  who,
  code,
  onCode,
  what,
}: {
  who: StaffRef
  code: string
  onCode: (code: string) => void
  /** What the signature covers, so the code signs something named. */
  what: string
}) {
  const matches = signingCodeMatches(who.id, code)
  const entered = code.trim() !== ''

  return (
    <div className={styles.identity} data-signing-identity>
      <p className={styles.who}>
        Signing as <b>{who.fullName}</b>
      </p>
      <p className={styles.what}>{what}</p>

      <label className={styles.field}>
        <span className={styles.label}>Your signing code</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={code}
          onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))}
          data-signing-code
          aria-describedby="signing-code-state"
        />
      </label>

      <p className={styles.state} id="signing-code-state" data-signing-state>
        {!entered ? (
          <>
            Four digits, and they are {who.fullName.split(' ')[0]}&rsquo;s rather than
            anybody&rsquo;s.
          </>
        ) : matches ? (
          <>
            Recognised. This goes on the record as {who.fullName}, code{' '}
            <span data-numeric>{signingCodeFor(who.id)}</span>, with the time.
          </>
        ) : (
          <>That code does not belong to {who.fullName}. Nothing is signed.</>
        )}
      </p>

      {/*
       * Said plainly, because a home would otherwise take it for one. There
       * are no accounts in this build and nothing here is kept secret.
       */}
      <p className={styles.caveat}>
        An identifier, not a password: it establishes which member of staff signed.
      </p>
    </div>
  )
}

/** Whether this code lets a sign-off go ahead. One owner, every surface. */
export const canSign = (who: StaffRef, code: string): boolean =>
  signingCodeMatches(who.id, code)
