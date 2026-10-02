import { useState } from 'react'
import type { StaffRef } from '@/data/types'
import { signingCodeFor, signingCodeMatches } from '@/data/access/team-store'
import { useSession } from '@/app/session/use-session'
import { useTerms } from '@/app/session/use-term'
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
 *
 * **Which is why somebody can read their own.** The code is derived from a
 * staff id rather than issued, so the only people who knew one were those who
 * had just chosen it on the invitation screen; everybody signed in as a
 * pre-seeded member of staff had no way to find theirs, and every signing
 * surface in the product was therefore unreachable by ordinary use. Keeping it
 * from them bought nothing — there is nothing to keep — and cost the screens
 * it guards.
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
  const { currentUser } = useSession()
  const terms = useTerms()
  const [shown, setShown] = useState(false)
  const matches = signingCodeMatches(who.id, code)
  const entered = code.trim() !== ''
  const isMine = who.id === currentUser.id

  return (
    <div className={styles.identity} data-signing-identity>
      <p className={styles.who}>
        Signing as <b>{who.fullName}</b>
      </p>
      <p className={styles.what}>{what}</p>

      {/*
       * The label and the control are associated by id rather than by wrapping,
       * because the disclosure sits on this row and a `<button>` inside a
       * `<label>` is both wrong HTML and a second thing the label appears to
       * name — `getByLabelText` resolved to the button rather than the field.
       */}
      <div className={styles.field}>
        <span className={styles.labelRow}>
          <label className={styles.label} htmlFor="signing-code">
            Your signing code
          </label>
          {/*
           * **Guarded on the viewer, not on `who`.** Today every call site
           * signs as the person at the keyboard, but this component also
           * stands in front of countersigning somebody else's work, and the
           * day `who` is a second signatory this must not hand their code to
           * whoever is looking at the screen.
           */}
          {isMine ? (
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShown((was) => !was)}
              aria-expanded={shown}
              data-reveal-code
            >
              {shown ? 'Hide my code' : 'Show my code'}
            </button>
          ) : null}
        </span>
        <input
          id="signing-code"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={code}
          onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))}
          data-signing-code
          aria-describedby="signing-code-state"
        />
      </div>

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

      {isMine && shown ? (
        <p className={styles.mine} data-my-signing-code>
          Yours is <span data-numeric>{signingCodeFor(currentUser.id)}</span>.
        </p>
      ) : null}

      {/*
       * Said plainly, because a home would otherwise take it for one. There
       * are no accounts in this build and nothing here is kept secret — which
       * is the same sentence that lets the disclosure above exist.
       */}
      <p className={styles.caveat}>
        An identifier, not a password: it establishes which {terms.staff.one} signed, so
        yours is not kept from you.
      </p>
    </div>
  )
}

/** Whether this code lets a sign-off go ahead. One owner, every surface. */
export const canSign = (who: StaffRef, code: string): boolean =>
  signingCodeMatches(who.id, code)
