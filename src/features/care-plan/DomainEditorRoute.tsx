import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type {
  CarePlanDomainId,
  CarePlanDomainRecord,
  CarePlanText,
  Incident,
  IsoDate,
  IsoDateTime,
} from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import type { ProfileContext } from '@/features/residents/ResidentProfileRoute'
import {
  discardCarePlanDraft,
  finaliseCarePlanDomain,
  getResidentIncidents,
  recordReviewFlagsCleared,
  saveCarePlanDraft,
  undoCarePlanFinalise,
  undoReviewFlagsCleared,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { flagsClosedBy } from '@/data/access/review-flags'
import type { ClosableFlag } from '@/data/access/review-flags'
import type { ClearingToken } from '@/data/access/review-flag-store'
import type { FinaliseToken } from '@/data/access/care-plan-draft-store'
import { AlertDialog, Button, Card, Toast } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { pluralise } from '@/lib/format'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import { OwedReviews } from './OwedReviews'
import {
  EMPTY_PLAN,
  PLAN_FIELDS,
  currentVersion,
  editorStartsFrom,
  outstandingFields,
  versionCount,
} from './plan-fields'

import styles from './care-plan.module.css'
import type { AsyncResource } from '@/data/access/resource'

/**
 * Writing one care plan domain. PRD §6.7.
 *
 * The sentence: **this is what this person says, in their words, and this is
 * what staff will do about it.**
 *
 * Two rules hold the screen up, and both are about not putting words in
 * somebody's mouth:
 *
 *  - **The previous version renders beneath each box, never inside it.**
 *    Carrying last year's words forward automatically turns a review into a
 *    formality: the plan reads as re-agreed when nobody re-agreed it. Visible
 *    while writing, so carrying a sentence forward stays possible — and a
 *    decision, because somebody has to type it.
 *  - **Nothing is pre-filled from an assessment.** A Waterlow score cannot be
 *    turned into "I need help to walk" without inventing a sentence and
 *    attributing it to a resident.
 */
export function DomainEditorRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { domainId } = useParams<{ domainId: string }>()

  const domain = CARE_PLAN_DOMAINS.find((entry) => entry.id === domainId)
  const record = resident.carePlan.find((entry) => entry.domainId === domainId)

  if (!domain || !record) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such care plan domain</p>
          <p className={styles.errorBody}>
            Nothing is missing from {resident.fullLegalName}&rsquo;s plan; this address
            does not name one of the{' '}
            <span data-numeric>{CARE_PLAN_DOMAINS.length}</span> domains.
          </p>
          <Link to=".." relative="path" className={styles.backLink}>
            <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
            The whole care plan
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <Editor
      key={`${resident.id}-${domain.id}`}
      profileName={resident.fullLegalName}
      domainId={domain.id}
      domainName={domain.name}
      record={record}
    />
  )
}

function Editor({
  profileName,
  domainId,
  domainName,
  record,
}: {
  profileName: string
  domainId: CarePlanDomainId
  domainName: string
  record: CarePlanDomainRecord
}) {
  const { resident, refresh } = useOutletContext<ProfileContext>()
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  /*
   * The boxes start from the draft, or empty. Never from the previous version,
   * and never from an assessment — see the docblock above.
   */
  const [text, setText] = useState<CarePlanText>(() => editorStartsFrom(record))
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  /*
   * The signature and the flag clearing it discharged, held together.
   *
   * Undoing one and not the other would leave the record holding a version
   * nobody signed, or an obligation that reads as met by work that no longer
   * exists. They were one act, so they take one control.
   */
  const [signed, setSigned] = useState<
    { finalise: FinaliseToken; clearing: ClearingToken; text: CarePlanText } | 'none'
  >('none')
  const [notice, setNotice] = useState<'none' | 'draft_saved' | 'draft_discarded'>(
    'none',
  )
  /*
   * Every write bumps this, and everything read from outside the record reads
   * it as a dependency.
   *
   * `refresh` re-reads the resident; this re-reads the incidents. Both are
   * needed, because the two halves of what this screen says — what the plan
   * holds and what it owes — come from two reads, and a screen that updates
   * one of them contradicts itself about the work somebody just did.
   */
  const [writes, setWrites] = useState(0)
  const [error, setError] = useState('')

  const previous = currentVersion(record)
  const waiting = outstandingFields(text)
  const versions = versionCount(record)

  const loadIncidents = useCallback(
    () => getResidentIncidents(resident.id),
    [resident.id],
  )
  const incidents = useResource<Incident[]>(loadIncidents, [resident.id, writes])

  /*
   * **Said here as well as in `Closes`.** The child renders the refusal in its
   * own sentence, which is right for the line it occupies — but a screen whose
   * whole subject is one resident's care plan should not go on drawing an
   * editor for a record belonging to a home this viewer is not appointed to.
   * The guard asks this file about its own resource for the same reason: a
   * screen that handles a state only through a child is one refactor away from
   * handling it nowhere.
   */
  if (incidents.kind === 'refused') {
    return <NotYourHome refusal={incidents} />
  }
  const closes =
    incidents.kind === 'ready'
      ? flagsClosedBy({
          incidents: incidents.data,
          residentId: resident.id,
          target: { kind: 'care_plan_domain', domainId },
          now,
          formatDate: (at) => format.instantDate(at),
        })
      : []

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        The whole care plan
      </Link>

      <h2 className={styles.screenTitle}>
        {domainName}, {profileName}
      </h2>

      <OwedReviews
        residentId={resident.id}
        domainId={domainId}
        now={now}
        revision={writes}
      />

      {/* Said, not implied. A screen that expects the resident's voice and
          does not ask for it gets a clinical summary in all three boxes. */}
      <div className={styles.voiceNote} data-voice-note>
        <b>Written in {resident.preferredName}&rsquo;s own words.</b> What they need and
        how they like it done are recorded as they say them: &ldquo;I like to…&rdquo;,
        not &ldquo;resident prefers…&rdquo;. What staff will do is written to whoever
        reads it on shift. Nothing here is filled in from an assessment: a score cannot
        be turned into &ldquo;I need help to walk&rdquo; without putting words in
        somebody&rsquo;s mouth.
      </div>

      <Card>
        {PLAN_FIELDS.map((field) => (
          <div className={styles.field} key={field.id} data-field={field.id}>
            <label className={styles.fieldLabel} htmlFor={`field-${field.id}`}>
              {field.label}
            </label>
            <p className={styles.fieldGuidance}>{field.guidance}</p>

            <textarea
              id={`field-${field.id}`}
              className={styles.textarea}
              value={text[field.id]}
              placeholder={field.placeholder}
              onChange={(event) =>
                setText((current) => ({ ...current, [field.id]: event.target.value }))
              }
            />

            {text[field.id].trim() === '' ? (
              <span className={styles.fieldEmpty}>
                <Unrecorded variant="chip" label={field.emptyNote} />
              </span>
            ) : null}

            {/* Beneath the box, never inside it. */}
            {previous === 'none' ? null : (
              <div className={styles.previous} data-previous={field.id}>
                <b className={styles.previousLabel}>
                  Version <span data-numeric>{versions}</span> · signed{' '}
                  <span data-numeric>{format.date(previous.finalisedOn)}</span> by{' '}
                  {previous.finalisedBy.displayName}
                </b>
                {previous[field.id]}
              </div>
            )}
          </div>
        ))}

        <div className={styles.foot}>
          <p className={styles.footState} data-foot-state>
            {/*
              Three states, and the third is the one a footer usually forgets.
              After signing, the boxes are empty because the draft became the
              version — so a line computed from the boxes would say "waiting on
              all three fields" about a plan that was just signed.
            */}
            {signed !== 'none' ? (
              <>
                <strong>
                  Version <span data-numeric>{versions}</span> is signed.
                </strong>{' '}
                It is what staff follow from now, and it is beneath each box as the
                previous version.
              </>
            ) : waiting.length === 0 ? (
              <>
                <strong>Every field is written.</strong> Finalising signs{' '}
                {previous === 'none' ? 'version 1' : `version ${versions + 1}`} of{' '}
                {domainName.toLowerCase()} for {profileName} and moves the next review
                to{' '}
                <span data-numeric>
                  {format.date(nextReviewFrom(now, reviewIntervalMonths()))}
                </span>
                .
              </>
            ) : (
              <>
                <strong>Waiting on:</strong>{' '}
                {waiting.map((field) => field.label).join(' · ')}.
              </>
            )}
            {signed === 'none' ? (
              <Closes
                closes={closes}
                domainName={domainName}
                loading={incidents.kind}
              />
            ) : null}
          </p>

          <span className={styles.footActions}>
            {record.draft.kind === 'draft' && signed === 'none' ? (
              <Button
                variant="ghost"
                data-discard-draft
                onClick={() => setDiscarding(true)}
              >
                Discard draft
              </Button>
            ) : null}
            <Button
              variant="secondary"
              data-save-draft
              disabled={signed !== 'none'}
              onClick={() => {
                void save()
              }}
            >
              Save draft
            </Button>
            {signed === 'none' ? (
              <Button
                disabled={waiting.length > 0}
                onClick={() => setConfirming(true)}
                data-finalise
              >
                Finalise and sign
              </Button>
            ) : (
              /*
               * Persistent while the clearing stands, rather than a toast
               * action that disappears. This discharged a clinical obligation
               * somebody else raised, and the chance to take it back should
               * outlast a five-second banner.
               */
              <Button
                variant="secondary"
                data-undo-clearing
                onClick={() => {
                  void undo(signed)
                }}
              >
                {closes.length === 0
                  ? 'Undo: unsign this version'
                  : `Undo: unsign and put ${pluralise(closes.length, 'review')} back`}
              </Button>
            )}
          </span>
        </div>
      </Card>

      {/*
        Always present, including where nothing has ever been signed.
        
        Hiding it there would leave the "no version has ever been signed"
        screen routed, rendered, tested — and unreachable, which is the defect
        §8 names: a screen nobody can open is not built, however green its
        tests are. "Has this ever been signed?" is the question, and the answer
        is a screen rather than an absent link.
      */}
      <Link to="history" className={styles.backLink} data-history-link>
        {versions > 0
          ? `Version history: ${pluralise(versions, 'signed version')}`
          : 'Version history: nothing signed yet'}
        <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
      </Link>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: profileName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Finalise and sign the ${domainName.toLowerCase()} care plan`}
        confirmLabel={
          closes.length === 0
            ? 'Finalise and sign'
            : `Sign and close ${pluralise(closes.length, 'review')}`
        }
        description={
          <span className={styles.confirmBody}>
            <span>
              This becomes the version staff follow; the previous version stays as
              history.
            </span>
            {/* Named individually, never counted. A figure says how much work
                vanished; the names say what it was. */}
            {closes.map((entry) => (
              <span key={entry.incident.id}>
                Closes the post-incident review flagged on {domainName.toLowerCase()} by{' '}
                {entry.description}
                {entry.overdue
                  ? ': already past its 48 hours, and it will still read as closed late.'
                  : ', which is still inside its 48 hours.'}
              </span>
            ))}
            <span>
              The next review moves to{' '}
              <span data-numeric>
                {format.date(nextReviewFrom(now, reviewIntervalMonths()))}
              </span>
              .
            </span>
          </span>
        }
        onConfirm={() => {
          void finalise()
        }}
      />

      {/* Confirmed rather than done on a click. Discarding throws away an
          unsigned draft somebody typed, and there is no backend to correct a
          mis-click — so it names the subject and the domain in the sentence,
          like every other confirmation here (§2.4). */}
      <AlertDialog
        open={discarding}
        onOpenChange={setDiscarding}
        subject={{
          kind: 'resident',
          name: profileName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action={`Discard the unsigned ${domainName.toLowerCase()} draft`}
        confirmLabel="Discard draft"
        description={
          <span className={styles.confirmBody}>
            <span>The draft is removed; nothing signed is touched.</span>
          </span>
        }
        onConfirm={() => {
          void discard()
        }}
      />

      <Toast
        open={signed !== 'none'}
        onOpenChange={(open) => {
          if (!open) setSigned('none')
        }}
        tone="positive"
        title={
          closes.length === 0
            ? 'Care plan finalised'
            : `Care plan finalised: ${pluralise(closes.length, 'review')} closed`
        }
      />

      <Toast
        open={notice !== 'none'}
        onOpenChange={(open) => {
          if (!open) setNotice('none')
        }}
        tone="info"
        title={notice === 'draft_discarded' ? 'Draft discarded' : 'Draft saved'}
        description={
          notice === 'draft_discarded'
            ? 'The domain reads exactly as it did before.'
            : 'It is not signed, so it is not what staff follow.'
        }
      />

      {error === '' ? null : <p className={styles.errorBody}>{error}</p>}
    </div>
  )

  async function save() {
    try {
      await saveCarePlanDraft({
        residentId: resident.id,
        domainId,
        text,
        by: currentUser,
        at: appNow().toISOString() as IsoDateTime,
      })
      // Every other tab reads the same record. A draft saved here and not seen
      // on the Needs tab is two screens disagreeing about one resident.
      refresh()
      setWrites((current) => current + 1)
      setNotice('draft_saved')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nothing was saved.')
    }
  }

  async function discard() {
    await discardCarePlanDraft(resident.id, domainId)
    setDiscarding(false)
    setText(EMPTY_PLAN)
    refresh()
    setWrites((current) => current + 1)
    setNotice('draft_discarded')
  }

  async function finalise() {
    try {
      /*
       * Two writes, one act.
       *
       * The signature is what staff will follow; the clearing is the
       * obligation it discharges. Both tokens are held together so undo puts
       * back both — half an undo leaves the record saying a review was done
       * that was not.
       */
      const finaliseToken = await finaliseCarePlanDomain({
        residentId: resident.id,
        domainId,
        text,
        by: currentUser,
        on: now.slice(0, 10) as IsoDate,
        nextReviewOn: nextReviewFrom(now, reviewIntervalMonths()),
      })
      const clearing = await recordReviewFlagsCleared({
        residentId: resident.id,
        target: { kind: 'care_plan_domain', domainId },
        by: currentUser,
        at: now,
      })
      setConfirming(false)
      setSigned({ finalise: finaliseToken, clearing, text })
      // The boxes empty because the draft became the version. It is now
      // beneath them, where a previous version belongs.
      setText(EMPTY_PLAN)
      refresh()
      setWrites((current) => current + 1)
      setError('')
    } catch (cause) {
      setConfirming(false)
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }

  async function undo(token: {
    finalise: FinaliseToken
    clearing: ClearingToken
    text: CarePlanText
  }) {
    await undoReviewFlagsCleared(token.clearing)
    await undoCarePlanFinalise(token.finalise)
    setText(token.text)
    setSigned('none')
    refresh()
    setWrites((current) => current + 1)
  }
}

/**
 * What finalising would discharge, named by name.
 *
 * The Phase 5 rule reused rather than restated: lateness is derived from
 * `completed.at > dueBy`, so a review closed after its 48 hours still reads as
 * closed late once the work is done. The footer says so before it happens.
 */
function Closes({
  closes,
  domainName,
  loading,
}: {
  closes: ClosableFlag[]
  domainName: string
  /*
   * **The resource's own union, not a copy of it.** This was written out as
   * `'loading' | 'ready' | 'error'`, which was true until `AsyncResource`
   * gained a fourth member and then quietly was not: a copied rule is a second
   * rule, and the original is still free to move. Taking the type from the
   * source means a new member breaks the build here rather than being narrowed
   * away at the call site.
   */
  loading: AsyncResource<unknown>['kind']
}) {
  if (loading === 'loading') return <> Checking post-incident reviews…</>
  if (loading === 'refused') {
    return (
      <>
        {' '}
        Whether finalising would close a post-incident review cannot be read here: those
        incidents belong to a home you are not appointed to.
      </>
    )
  }
  if (loading === 'error') {
    return (
      <>
        {' '}
        Whether finalising would close a post-incident review could not be read. That is
        unknown, not none.
      </>
    )
  }
  if (closes.length === 0) return null

  return (
    <>
      {closes.map((entry) => (
        <span key={entry.incident.id} data-closes={entry.incident.id}>
          {' '}
          Finalising this closes the post-incident review flagged on{' '}
          {domainName.toLowerCase()} by {entry.description}
          {entry.overdue
            ? ': already past its 48 hours, and it will still read as closed late.'
            : ', which is still inside its 48 hours.'}
        </span>
      ))}
    </>
  )
}
