import { useState } from 'react'
import type { CustomCarePlanDomain, IsoDate, IsoDateTime, Resident } from '@/data/types'
import {
  finaliseCarePlanDomain,
  recordCustomCarePlanDomain,
  saveCarePlanDraft,
} from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { now as appNow } from '@/data/fixtures/clock'
import { Button, Dialog } from '@/components/primitives'
import { SigningIdentity, canSign } from '@/components/signing/SigningIdentity'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import { CarePlanTextFields, emptyText, isWritten } from './CarePlanTextFields'
import { editorStartsFrom, outstandingFields, versionCount } from './plan-fields'
import styles from './care-plan.module.css'

/**
 * Writing a care plan domain outside the ten. Phase 31.
 *
 * **One dialog for adding one and for writing in one**, because they are the
 * same act with the same fields: a domain outside the ten is a domain, and its
 * draft and its signature go through the same writers the ten use. What this
 * adds is the slot, which the ten do not need because they arrive with the
 * resident.
 *
 * **Saving and signing are two buttons, not one.** A draft is what somebody
 * has written down; a signed version is what staff follow. The editor for the
 * ten has drawn that line since Phase 12 and a domain outside them cannot blur
 * it, or a plan nobody has agreed would become an instruction by being typed.
 *
 * The name is fixed once the domain exists, for the reason a custom risk's is:
 * everything written about it was written about that name.
 */
export function CustomDomainDialog({
  resident,
  domain,
  onClose,
  onWritten,
}: {
  resident: Resident
  /** An existing domain to write in, or `new` for one nobody has added. */
  domain: CustomCarePlanDomain | 'new'
  onClose: () => void
  onWritten: () => void
}) {
  const { currentUser } = useSession()
  const adding = domain === 'new'
  const [name, setName] = useState(domain === 'new' ? '' : domain.name)
  const [text, setText] = useState(() =>
    domain === 'new' ? emptyText() : editorStartsFrom(domain),
  )
  const [failure, setFailure] = useState('')
  /*
   * **Signing is a step, not a second button.** Finalising makes a version the
   * instruction staff follow, so it asks for the code every other clinical
   * signature in this build asks for. A step rather than a nested
   * confirmation, because this is already a dialog and a modal inside a modal
   * is a worse answer than a screen that changes what it is asking for.
   *
   * Saving a draft never asks: a draft is not a signature, and a code typed to
   * save one is a code typed out of habit.
   */
  const [signing, setSigning] = useState(false)
  const [code, setCode] = useState('')

  const signedVersions = domain === 'new' ? 0 : versionCount(domain)
  const at = appNow().toISOString() as IsoDateTime
  const on = at.slice(0, 10) as IsoDate
  const ready = name.trim() !== '' && isWritten(text)
  /*
   * Finalising needs all three, as the editor for the ten has since Phase 12:
   * a signed plan that does not say what somebody needs, how they want it done
   * or what staff will do is an instruction with a hole in it.
   */
  const waiting = outstandingFields(text)

  const withDomainId = async (): Promise<CustomCarePlanDomain | undefined> => {
    if (domain !== 'new') return domain
    return recordCustomCarePlanDomain({
      residentId: resident.id,
      name,
      by: currentUser,
    })
  }

  const fail = (cause: unknown) =>
    setFailure(cause instanceof Error ? cause.message : 'Nothing was written')

  const saveDraft = () => {
    void withDomainId()
      .then(async (created) => {
        if (!created) return
        await saveCarePlanDraft({
          residentId: resident.id,
          domainId: created.id,
          text,
          by: currentUser,
          at,
        })
        onWritten()
      })
      .catch(fail)
  }

  const finalise = () => {
    void withDomainId()
      .then(async (created) => {
        if (!created) return
        await finaliseCarePlanDomain({
          residentId: resident.id,
          domainId: created.id,
          text,
          by: currentUser,
          on,
          nextReviewOn: nextReviewFrom(on, reviewIntervalMonths()),
        })
        onWritten()
      })
      .catch(fail)
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={
        adding
          ? `Add a care plan domain for ${resident.preferredName}, outside the ten`
          : `${domain.name} for ${resident.preferredName}`
      }
      description={`${resident.fullLegalName}. Your name and the time go on whatever you write.`}
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setCode('')
              onClose()
            }}
          >
            Cancel
          </Button>
          {signing ? null : (
            <Button
              variant="secondary"
              disabled={!ready}
              data-save-custom-draft
              onClick={saveDraft}
            >
              Save draft
            </Button>
          )}
          {/* Signing is what makes it what staff follow, so it says so. */}
          <Button
            disabled={
              !ready || waiting.length > 0 || (signing && !canSign(currentUser, code))
            }
            data-finalise-custom-domain
            onClick={() => {
              if (!signing) {
                setSigning(true)
                return
              }
              finalise()
            }}
          >
            {signing ? 'Confirm and sign' : 'Finalise and sign'}
          </Button>
        </>
      }
    >
      {adding ? (
        <label className={styles.nameField}>
          <span className={styles.nameLabel}>What this domain is</span>
          <input
            type="text"
            value={name}
            placeholder="The allotment"
            data-field="custom-domain-name"
            onChange={(event) => setName(event.target.value)}
          />
          <span className={styles.nameHint}>
            This cannot be changed later, for the reason a risk&rsquo;s name cannot:
            everything written about it was written about this name.
          </span>
        </label>
      ) : null}

      <CarePlanTextFields idPrefix="custom-domain" text={text} onChange={setText} />

      {signing ? (
        <SigningIdentity
          who={currentUser}
          code={code}
          onCode={setCode}
          what={`Signing version ${String(signedVersions + 1)} of ${name.trim()} for ${resident.fullLegalName}.`}
        />
      ) : null}

      <p className={styles.nameHint} data-finalise-waiting>
        {waiting.length === 0
          ? 'Signing this makes it what staff follow.'
          : `Waiting on: ${waiting.map((field) => field.label.toLowerCase()).join(' · ')}. A draft can be saved without them.`}
      </p>

      {failure === '' ? null : <p data-custom-domain-failure>{failure}</p>}
    </Dialog>
  )
}
