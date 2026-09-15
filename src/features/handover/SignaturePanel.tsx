import { now as appNow } from '@/data/fixtures/clock'
import { SigningIdentity, canSign } from '@/components/signing/SigningIdentity'
import { useState } from 'react'
import type { HandoverId, HandoverSignature, IsoDateTime } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { signHandover } from '@/data/access/client'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { SHIFT_NAMES } from '@/lib/shift'
import type { Shift } from '@/data/types'
import { AlertDialog, Button } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import styles from './handover.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * One half of the dual signature. PRD §6.3.
 *
 * Two signatures, given separately, because a handover is two claims: the
 * outgoing shift saying "this is what I am handing you" and the incoming shift
 * saying "I have it". One signature covering both would let a shift walk out
 * having told nobody, and nothing on the record would show it.
 *
 * **Unsigned is a rendered state, not a blank.** A handover nobody accepted is
 * a shift change nobody took responsibility for, and it has to be visible.
 *
 * The signature records the counts at the moment it was given. That is the
 * denominator rule (Rule 4) applied to an act rather than a figure: signing
 * with six residents nobody looked at does not mean "all well", and a
 * signature that cannot say otherwise is a signature that means more than it
 * should.
 */
export function SignaturePanel({
  handoverId,
  side,
  shift,
  signature,
  reviewed,
  notReviewed,
  siteName,
  onSigned,
}: {
  handoverId: HandoverId
  side: 'outgoing' | 'incoming'
  shift: Shift
  signature: HandoverSignature
  reviewed: number
  notReviewed: number
  siteName: string
  /**
   * Reports **what was signed**, for the screen to announce.
   *
   * A bare "Signed" leaves the user checking whether their record went in as
   * they meant it — and on this screen what went in is the whole point: a
   * signature given with six residents nobody looked at does not mean they are
   * well, and the acknowledgement has to be able to say so. Announced by the
   * screen rather than here, because signing re-renders this panel.
   */
  onSigned: (summary: { title: string; description: string }) => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [confirming, setConfirming] = useState(false)
  /* Cleared whenever the dialog closes: a code left in a field on a device the
     shift shares is the thing this control exists to prevent. */
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const role = side === 'outgoing' ? 'Handing over' : 'Taking over'
  const total = reviewed + notReviewed

  const sign = async () => {
    try {
      await signHandover({
        handoverId,
        side,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
        reviewed,
        notReviewed,
      })
      setError('')
      onSigned({
        title: `Handover signed: ${reviewed} of ${total} reviewed${
          notReviewed > 0 ? `, ${notReviewed} not looked at` : ''
        }`,
        description:
          notReviewed > 0
            ? `Those ${notReviewed} are recorded as not reviewed, not as well. The counts are stored with your signature. In this build it is held in memory and will be gone on reload.`
            : 'The counts are stored with your signature. In this build it is held in memory and will be gone on reload.',
      })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nothing was signed')
    }
  }

  switch (signature.kind) {
    case 'signed':
      return (
        <div className={styles.signature} data-signature={side} data-signed="true">
          <p className={styles.signatureRole}>
            {role} · {SHIFT_NAMES[shift]} shift
          </p>
          <StatusPill
            tone="positive"
            label="Signed"
            detail={format.attribution(staffLabel(signature.by), signature.at)}
          />
          {/* What the signature actually covered. Never a bare "signed". */}
          <p className={styles.signatureCounts}>
            {signature.reviewed} of {signature.reviewed + signature.notReviewed}{' '}
            residents reviewed when this was signed
            {signature.notReviewed > 0
              ? `, and ${signature.notReviewed} had not been looked at`
              : ''}
            .
          </p>
        </div>
      )

    case 'not_signed':
      return (
        <div className={styles.signature} data-signature={side} data-signed="false">
          <p className={styles.signatureRole}>
            {role} · {SHIFT_NAMES[shift]} shift
          </p>
          <Unrecorded
            label="Not signed"
            detail={
              side === 'outgoing'
                ? 'nobody has handed this shift over'
                : 'nobody has accepted this handover'
            }
          />

          {/*
           * Signing a handover is the approve act in this module rather than a
           * write: somebody puts their name to the shift that is ending. Of
           * the roles that sign into this platform the auditor is the one
           * without it, which is the whole of what read-only means.
           */}
          {!viewer.canApproveIn('/handover') ? null : (
            <>
              <Button size="large" onClick={() => setConfirming(true)}>
                {side === 'outgoing' ? 'Sign as handing over' : 'Sign as taking over'}
              </Button>

              <AlertDialog
                open={confirming}
                onOpenChange={(next) => {
                  setConfirming(next)
                  // Never left in the field for whoever picks the device up.
                  if (!next) setCode('')
                }}
                subject={{
                  kind: 'handover',
                  shift: SHIFT_NAMES[shift].toLowerCase(),
                  site: siteName,
                  date: format.instantDate(appNow().toISOString() as IsoDateTime),
                }}
                action={
                  side === 'outgoing' ? 'Sign as handing over' : 'Sign as taking over'
                }
                description={
                  <>
                    <p>
                      {notReviewed > 0
                        ? `${reviewed} of ${total} residents have been reviewed. ${notReviewed} have not been looked at at all, and your signature will record that. It does not mean they are well.`
                        : `All ${total} residents at ${siteName} have been reviewed. Your name and the time are recorded against this handover and cannot be edited afterwards.`}
                    </p>
                    {/* Who signed, not that somebody clicked. */}
                    <SigningIdentity
                      who={currentUser}
                      code={code}
                      onCode={setCode}
                      what={`Signing the ${SHIFT_NAMES[shift].toLowerCase()} handover at ${siteName}, covering ${reviewed} of ${total} residents.`}
                    />
                  </>
                }
                confirmLabel={
                  side === 'outgoing' ? 'Sign as handing over' : 'Sign as taking over'
                }
                destructive={notReviewed > 0}
                onConfirm={sign}
                confirmDisabled={!canSign(currentUser, code)}
              />
            </>
          )}

          {error === '' ? null : <p className={styles.formError}>{error}</p>}
        </div>
      )

    default:
      return assertNever(signature)
  }
}
