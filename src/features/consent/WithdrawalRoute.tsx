import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { IsoDate, AnyConsent, ConsentTypeId, DownstreamEffect } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { AlertDialog, Button, Card, Toast } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { pluralise } from '@/lib/format'
import { EffectCountValue } from './ConsentParts'
import { CONSENT_MEANS } from './consent-meaning'
import styles from './consent.module.css'
import { withdrawConsent } from '@/data/access/client'

/**
 * Withdrawing a consent. PRD §6.7, Phase 10.
 *
 * The sentence: **this is what withdrawing does not undo.**
 *
 * **The effects are data, not prose.** A sentence cannot be asserted against,
 * so a withdrawal that forgot to mention the photographs would look identical
 * to one that did — the product's own failure inside the dialog written to
 * prevent it. Each effect is a row the confirmation renders and a test names.
 *
 * Cross-module effects belong here too: withdrawing photography while Family
 * Portal Access still stands is a real consequence, and it is checkable from
 * the record rather than remembered by whoever writes the note.
 */
export function WithdrawalRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { consentType } = useParams<{ consentType: string }>()
  const format = useSiteFormat()
  const [confirming, setConfirming] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const { currentUser } = useSession()

  const type = CONSENT_TYPES.find((entry) => entry.id === consentType)
  const status = type
    ? (resident.consents[type.id as ConsentTypeId] as AnyConsent)
    : undefined

  if (!type || !status) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such consent</p>
          <p className={styles.errorBody}>
            This address does not name one of the{' '}
            <span data-numeric>{CONSENT_TYPES.length}</span> consent types.
          </p>
        </Card>
      </div>
    )
  }

  /*
   * What withdrawing will not undo.
   *
   * On a consent already withdrawn these are the effects recorded at the time;
   * on a live one they are what the home would still be holding afterwards.
   * Either way they come from the record.
   */
  const effects: DownstreamEffect[] =
    status.kind === 'withdrawn' ? status.remains : liveEffects(resident, type.id)

  const alreadyWithdrawn = status.kind === 'withdrawn'

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All consents
      </Link>

      <h2 className={styles.screenTitle}>
        {alreadyWithdrawn ? 'Withdrawn' : 'Withdraw consent'}, {type.name.toLowerCase()}
      </h2>

      <Card>
        <div className={styles.section}>
          <p className={styles.question}>
            {alreadyWithdrawn ? (
              <>
                {resident.preferredName} withdrew consent to {type.name.toLowerCase()}{' '}
                on <span data-numeric>{format.date(status.on)}</span>.
              </>
            ) : (
              <>
                {resident.preferredName} is withdrawing consent to{' '}
                {type.name.toLowerCase()}.
              </>
            )}
          </p>
          <p className={styles.questionHint}>
            {CONSENT_MEANS[type.id as ConsentTypeId]}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.remains} data-remains={effects.length}>
            <p className={styles.remainsTitle}>What withdrawing does not undo</p>
            <p className={styles.remainsIntro}>
              Withdrawing stops anything new and removes nothing: each of these is
              somebody&rsquo;s job afterwards.
            </p>
            <ul className={styles.remainsList}>
              {effects.map((effect) => (
                <li
                  className={styles.effect}
                  key={effect.name}
                  data-effect={effect.name}
                >
                  <span>
                    <span className={styles.effectName}>{effect.name}</span>
                    <span className={styles.effectWhy}>{effect.explanation}</span>
                  </span>
                  <EffectCountValue count={effect.count} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.foot}>
          <p className={styles.footState} data-foot-state>
            {alreadyWithdrawn ? (
              <>
                <strong>
                  The record carries what was outstanding at the time of signing.
                </strong>{' '}
                It can never later read as though withdrawing removed them.
              </>
            ) : (
              <>
                <strong>
                  Confirming records that {resident.fullLegalName} withdrew consent to{' '}
                  {type.name.toLowerCase()}, and that{' '}
                  <span data-numeric>{pluralise(effects.length, 'thing')}</span>{' '}
                  remained at the time.
                </strong>{' '}
                The record carries what was outstanding, so it can never later read as
                though withdrawing removed them.
              </>
            )}
          </p>
          {alreadyWithdrawn ? null : (
            <Button size="large" onClick={() => setConfirming(true)} data-withdraw>
              Record the withdrawal
            </Button>
          )}
        </div>
      </Card>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Withdraw consent to ${type.name.toLowerCase()}`}
        confirmLabel="Record the withdrawal"
        description={
          <span className={styles.footState}>
            {/* Named individually and from the record — the dialog cannot
                forget one, because it is not remembering. */}
            {effects.map((effect) => (
              <span key={effect.name} data-confirm-effect={effect.name}>
                {effect.name}, {effect.explanation}
                <br />
              </span>
            ))}
          </span>
        }
        onConfirm={() => {
          setConfirming(false)
          // Live from Phase 16. The effects go onto the record with it.
          void withdrawConsent({
            residentId: resident.id,
            consentType: type.id as ConsentTypeId,
            note: 'Withdrawn from the consent screen.',
            remains: effects,
            by: currentUser,
            on: appNow().toISOString().slice(0, 10) as IsoDate,
          }).then(() => setRecorded(true))
        }}
      />

      <Toast
        open={recorded}
        onOpenChange={setRecorded}
        tone="positive"
        title="Consent withdrawn"
        description={`Recorded against ${resident.fullLegalName}, with what withdrawing did not undo.`}
      />
    </div>
  )
}

/**
 * What the home would still be holding after withdrawing this consent.
 *
 * Derived from the record rather than typed into a note. The Family Portal
 * case is the one worth having: **a separate consent that this withdrawal does
 * not touch**, which is exactly the consequence somebody signing needs to see
 * and exactly the sort of thing prose forgets.
 */
function liveEffects(
  resident: ResidentProfile['resident'],
  typeId: string,
): DownstreamEffect[] {
  const effects: DownstreamEffect[] = []

  if (typeId === 'photography') {
    effects.push({
      name: 'Photographs already taken',
      explanation:
        'Taken while consent stood. Withdrawing stops new ones; it does not remove these.',
      count: { kind: 'not_counted' },
    })

    const portal = resident.consents.family_portal
    if (portal.kind === 'given') {
      effects.push({
        name: 'Family Portal access is still given',
        explanation:
          'A separate consent, unaffected by this one. Named family keep access unless that is withdrawn too.',
        count: { kind: 'unchanged' },
      })
    }
  }

  if (effects.length === 0) {
    effects.push({
      name: 'Records already made under this consent',
      explanation:
        'Anything recorded while consent stood stays on the record. Withdrawing stops what happens next.',
      count: { kind: 'not_counted' },
    })
  }

  return effects
}
