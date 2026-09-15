import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type {
  AnyConsent,
  CapacityAssessment,
  ConsentMethod,
  ConsentTypeId,
  DecisionAuthority,
  IsoDate,
} from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { recordConsent } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { now as appNow } from '@/data/fixtures/clock'
import { Button, Card, SelectedMark, Toast } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount, pluralise } from '@/lib/format'
import { CONSENT_MEANS } from './consent-meaning'
import styles from './consent.module.css'

/**
 * The capacity gate. PRD §6.7, Phase 10.
 *
 * The sentence: **before anything else, does this person have capacity for
 * this decision?**
 *
 * ## It is a gate, not a field
 *
 * The question stands alone and nothing about the consent itself is reachable
 * until it is answered. That is not a layout preference — the Mental Capacity
 * Act asks whether this person has capacity for *this* decision at *this*
 * time, so it is answered first, and answered again for a different decision
 * on a different day.
 *
 * **No default selection**, for the reason the risk instrument has none: a
 * pre-selected answer is an answer nobody gave, and here it is a legal finding
 * about somebody's mind.
 *
 * **Both MCA stages are required** where the answer is "lacks capacity". A
 * conclusion with no impairment recorded and no functional finding is not an
 * assessment, and neither field can be empty.
 *
 * **The scope names which decisions this assessment covers**, and it may never
 * be general — a consent can only be recorded against an assessment that names
 * its own type, which the mapped type holds at compile time. Blanket capacity
 * is not expressible.
 */

type Answer = 'has_capacity' | 'lacks_capacity'

export function CapacityGateRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { consentType } = useParams<{ consentType: string }>()

  const type = CONSENT_TYPES.find((entry) => entry.id === consentType)

  const [answer, setAnswer] = useState<Answer | 'unanswered'>('unanswered')
  const [diagnostic, setDiagnostic] = useState('')
  const [functional, setFunctional] = useState('')
  const [scope, setScope] = useState<ConsentTypeId[]>([])

  /*
   * **The second half of the screen, which did not exist until Phase 25.**
   * The gate collected an assessment and its Continue button went nowhere, so
   * the Consent module could withdraw a consent and never record one — and the
   * Family Portal, which will not name anybody until a consent is on file, only
   * worked for residents whose consent the fixtures already held. Five screens
   * described a capacity to record and nothing performed it.
   */
  const { currentUser } = useSession()
  const [stage, setStage] = useState<'capacity' | 'decision'>('capacity')
  const [outcome, setOutcome] = useState<'given' | 'refused' | 'unanswered'>(
    'unanswered',
  )
  const [method, setMethod] = useState<ConsentMethod | ''>('')
  const [refusalNote, setRefusalNote] = useState('')
  const [authorityKind, setAuthorityKind] = useState<
    'best_interests' | 'lpa_holder' | 'unanswered'
  >('unanswered')
  const [consulted, setConsulted] = useState('')
  const [rationale, setRationale] = useState('')
  const [recorded, setRecorded] = useState<'no' | 'yes'>('no')
  const [failure, setFailure] = useState('')

  if (!type) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such consent</p>
          <p className={styles.errorBody}>
            This address does not name one of the{' '}
            <span data-numeric>{CONSENT_TYPES.length}</span> consent types.
          </p>
          <Link to=".." relative="path" className={styles.backLink}>
            <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
            All consents
          </Link>
        </Card>
      </div>
    )
  }

  /*
   * What is still outstanding, named rather than counted.
   *
   * The gate's own answer comes first because nothing else is reachable
   * without it — the footer says so rather than leaving somebody to work out
   * why the rest of the screen is not there.
   */
  const waiting: string[] = []
  if (answer === 'unanswered') {
    waiting.push(`whether ${resident.preferredName} has capacity for this decision`)
  }
  if (answer === 'lacks_capacity') {
    if (diagnostic.trim() === '') waiting.push('stage 1: the diagnostic test')
    if (functional.trim() === '') waiting.push('stage 2: the functional test')
  }

  const covered = [type.id as ConsentTypeId, ...scope]

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All consents
      </Link>

      <h2 className={styles.screenTitle}>Seek consent: {type.name.toLowerCase()}</h2>

      <Card>
        <div className={styles.section}>
          <p className={styles.gateNote} data-gate-note>
            <b>Nothing about this consent can be recorded yet.</b> The Mental Capacity
            Act asks whether this person has capacity for <i>this</i> decision at{' '}
            <i>this</i> time, so it is answered first, and answered again for a
            different decision on a different day.
          </p>
        </div>

        <div className={styles.section}>
          <p className={styles.question} data-gate-question>
            Does {resident.preferredName} have capacity to decide about{' '}
            {type.name.toLowerCase()}, today?
          </p>
          <p className={styles.questionHint}>
            Assume they do unless there is reason to think otherwise. A decision
            somebody else would call unwise is still theirs to make.
          </p>
          <p className={styles.questionHint}>
            This consent covers: {CONSENT_MEANS[type.id as ConsentTypeId]}
          </p>

          <div className={styles.options} role="radiogroup" aria-label="Capacity">
            <Option
              selected={answer === 'has_capacity'}
              onSelect={() => setAnswer('has_capacity')}
              id="has_capacity"
              title={`Yes: ${resident.preferredName} has capacity for this decision`}
              hint="They can understand it, hold it in mind, weigh it up, and tell somebody what they have decided."
            />
            <Option
              selected={answer === 'lacks_capacity'}
              onSelect={() => setAnswer('lacks_capacity')}
              id="lacks_capacity"
              title={`No: ${resident.preferredName} lacks capacity for this decision`}
              hint="Both stages of the MCA test must be recorded. A conclusion with no impairment and no functional finding is not an assessment."
            />
          </div>

          {answer === 'unanswered' ? (
            <span className={styles.unanswered} data-unanswered>
              <Unrecorded
                variant="chip"
                label="Not answered"
                detail="nothing else on this screen is available until it is"
              />
            </span>
          ) : null}

          {answer === 'lacks_capacity' ? (
            <>
              <div className={styles.stage} data-stage="diagnostic">
                <p className={styles.stageNumber}>Stage 1 · the diagnostic test</p>
                <label className={styles.stageQuestion} htmlFor="diagnostic">
                  Is there an impairment of, or disturbance in, the functioning of their
                  mind or brain?
                </label>
                <p className={styles.stageHint}>
                  Name it. &ldquo;Lacks capacity&rdquo; with no impairment recorded is a
                  conclusion without a test.
                </p>
                <textarea
                  id="diagnostic"
                  className={styles.textarea}
                  value={diagnostic}
                  placeholder="Moderate vascular dementia, diagnosed 2023."
                  onChange={(event) => setDiagnostic(event.target.value)}
                />
              </div>

              <div className={styles.stage} data-stage="functional">
                <p className={styles.stageNumber}>Stage 2 · the functional test</p>
                <label className={styles.stageQuestion} htmlFor="functional">
                  Which part of deciding can they not do, because of it?
                </label>
                <p className={styles.stageHint}>
                  Understand · retain · weigh up · communicate. Say which, and what you
                  saw.
                </p>
                <textarea
                  id="functional"
                  className={styles.textarea}
                  value={functional}
                  placeholder="Could repeat the options back but could not hold them together long enough to compare."
                  onChange={(event) => setFunctional(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        {answer === 'unanswered' ? null : (
          <div className={styles.section} data-scope-section>
            <p className={styles.stageNumber}>Which decisions this assessment covers</p>
            <p className={styles.questionHint}>
              One assessment may cover several decisions made in the same conversation.
              It can never be general: a consent may only be recorded against an
              assessment that names its own type, so &ldquo;has capacity&rdquo; applied
              to a decision nobody assessed against cannot be written down.
            </p>
            <div className={styles.scope}>
              {CONSENT_TYPES.map((entry) => {
                const fixed = entry.id === type.id
                const on = fixed || scope.includes(entry.id as ConsentTypeId)
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={[
                      styles.scopeChip,
                      fixed ? styles.scopeChipFixed : '',
                      on && !fixed ? styles.scopeChipOn : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={on}
                    disabled={fixed}
                    data-scope={entry.id}
                    onClick={() =>
                      setScope((current) =>
                        current.includes(entry.id as ConsentTypeId)
                          ? current.filter((one) => one !== entry.id)
                          : [...current, entry.id as ConsentTypeId],
                      )
                    }
                  >
                    {/* One mark for a chosen option, everywhere. */}
                    <SelectedMark selected={on} />
                    {entry.name}
                    {fixed ? ', this decision' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className={styles.foot}>
          <p className={styles.footState} data-foot-state>
            {waiting.length > 0 ? (
              <>
                <strong>Waiting on:</strong> {waiting.join(' · ')}.
                <br />
                Nothing about the consent itself can be recorded until that is answered.
              </>
            ) : (
              <>
                <strong>
                  This records a capacity assessment for {resident.fullLegalName},
                  covering{' '}
                  <span data-numeric>{pluralise(covered.length, 'decision')}</span>.
                </strong>{' '}
                {covered.length > 1 ? (
                  <>
                    It names <span data-numeric>{formatCount(covered.length)}</span>{' '}
                    decisions because they were talked through together, and a consent
                    recorded against it must be one of them.
                  </>
                ) : (
                  <>It names this decision only.</>
                )}{' '}
                Held in memory only in this build.
              </>
            )}
          </p>
          <Button
            size="large"
            disabled={waiting.length > 0 || stage === 'decision'}
            data-continue
            onClick={() => setStage('decision')}
          >
            Continue
          </Button>
        </div>
      </Card>

      {stage === 'decision' ? (
        <DecisionStep
          residentName={resident.fullLegalName}
          preferredName={resident.preferredName}
          typeName={type.name}
          lacksCapacity={answer === 'lacks_capacity'}
          existing={resident.consents[type.id as ConsentTypeId] as AnyConsent}
          lpa={
            resident.importantPeople.lpaHolder.kind === 'recorded'
              ? resident.importantPeople.lpaHolder.value
              : undefined
          }
          outcome={outcome}
          setOutcome={setOutcome}
          method={method}
          setMethod={setMethod}
          refusalNote={refusalNote}
          setRefusalNote={setRefusalNote}
          authorityKind={authorityKind}
          setAuthorityKind={setAuthorityKind}
          consulted={consulted}
          setConsulted={setConsulted}
          rationale={rationale}
          setRationale={setRationale}
          recorded={recorded}
          failure={failure}
          onRecord={() => {
            const on = appNow().toISOString().slice(0, 10) as IsoDate
            /*
             * **One cast, at the edge where data arrives, with the check it
             * replaces done at run time.** The consent type comes from the
             * URL, so the compile-time scoping `CapacityAssessment<K>` holds
             * for a literal cannot hold here: `K` is whichever of the eight
             * the address named. What the type guarantees statically — that
             * the assessment covers this consent — is checked below instead,
             * and a record that failed it would not be written.
             */
            const typeId = type.id as ConsentTypeId
            const covers = Object.fromEntries(covered.map((id) => [id, true]))
            if (covers[typeId] !== true) {
              setFailure(
                'This assessment does not name the decision it would authorise.',
              )
              return
            }
            const assessment = {
              id: `cap-${resident.id}-${typeId}-${on}` as const,
              residentId: resident.id,
              finding:
                answer === 'lacks_capacity'
                  ? {
                      kind: 'lacks_capacity' as const,
                      diagnosticTest: diagnostic.trim(),
                      functionalTest: functional.trim(),
                    }
                  : { kind: 'has_capacity' as const },
              covers,
              assessedOn: on,
              assessedBy: currentUser,
              note:
                answer === 'lacks_capacity'
                  ? `${diagnostic.trim()} ${functional.trim()}`
                  : `Assessed as having capacity for ${type.name.toLowerCase()}.`,
            } as unknown as CapacityAssessment<ConsentTypeId>

            const lpa =
              resident.importantPeople.lpaHolder.kind === 'recorded'
                ? resident.importantPeople.lpaHolder.value
                : undefined
            const authority: DecisionAuthority<ConsentTypeId> =
              answer === 'has_capacity'
                ? { kind: 'the_resident', assessment }
                : authorityKind === 'lpa_holder' && lpa !== undefined
                  ? {
                      kind: 'lpa_holder',
                      assessment,
                      who: lpa.name,
                      documentId: lpa.documentId,
                    }
                  : {
                      kind: 'best_interests',
                      assessment,
                      consulted: splitConsulted(consulted),
                      rationale: rationale.trim(),
                    }

            void recordConsent({
              residentId: resident.id,
              consentType: typeId,
              outcome:
                outcome === 'given'
                  ? { kind: 'given', method: method as ConsentMethod }
                  : { kind: 'refused', note: refusalNote.trim() },
              authority,
              by: currentUser,
              on,
            })
              .then(() => {
                setFailure('')
                setRecorded('yes')
              })
              .catch((error: unknown) =>
                setFailure(error instanceof Error ? error.message : String(error)),
              )
          }}
        />
      ) : null}

      <Toast
        open={recorded === 'yes'}
        onOpenChange={(open) => (open ? undefined : setRecorded('no'))}
        tone="positive"
        title="Consent decision recorded"
        description={`Recorded against ${resident.fullLegalName}, with the assessment it rests on. Held in memory only and gone on reload.`}
      />
    </div>
  )
}

/** "Dr Rahman, her son Tunde" or one per line, never empty. */
function splitConsulted(text: string): [string, ...string[]] {
  const names = text
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean)
  const [first, ...rest] = names
  return [first ?? '', ...rest]
}

/**
 * What was decided, and on whose authority.
 *
 * **The authority is not chosen freely; the capacity answer decides it.**
 * Somebody with capacity decides for themselves, so the only authority offered
 * is theirs. Somebody without it has a decision made for them, by a
 * best-interests process that names who was consulted or by the holder of a
 * health and welfare LPA — and the LPA route is offered only where one is on
 * file, because a financial LPA cannot consent to care, and offering it and
 * failing would put the rule in an error message instead of on the screen.
 */
function DecisionStep(props: {
  residentName: string
  preferredName: string
  typeName: string
  lacksCapacity: boolean
  existing: AnyConsent
  lpa: { name: string; lpaType: 'health_and_welfare' | 'financial' } | undefined
  outcome: 'given' | 'refused' | 'unanswered'
  setOutcome: (value: 'given' | 'refused') => void
  method: ConsentMethod | ''
  setMethod: (value: ConsentMethod) => void
  refusalNote: string
  setRefusalNote: (value: string) => void
  authorityKind: 'best_interests' | 'lpa_holder' | 'unanswered'
  setAuthorityKind: (value: 'best_interests' | 'lpa_holder') => void
  consulted: string
  setConsulted: (value: string) => void
  rationale: string
  setRationale: (value: string) => void
  recorded: 'no' | 'yes'
  failure: string
  onRecord: () => void
}) {
  const decided = props.existing.kind === 'given' || props.existing.kind === 'refused'
  const lpaUsable =
    props.lpa !== undefined && props.lpa.lpaType === 'health_and_welfare'

  const waiting: string[] = []
  if (props.outcome === 'unanswered') waiting.push('what was decided')
  if (props.outcome === 'given' && props.method === '') waiting.push('how it was given')
  if (props.outcome === 'refused' && props.refusalNote.trim() === '')
    waiting.push('what was said')
  if (props.lacksCapacity) {
    if (props.authorityKind === 'unanswered') waiting.push('who decided')
    if (props.authorityKind === 'best_interests') {
      if (props.consulted.trim() === '') waiting.push('who was consulted')
      if (props.rationale.trim() === '')
        waiting.push('why this is in their best interests')
    }
  }

  if (decided) {
    return (
      <Card>
        <div className={styles.section} data-already-decided>
          <p className={styles.question}>
            {props.residentName} already has a decision on record for{' '}
            {props.typeName.toLowerCase()}.
          </p>
          <p className={styles.questionHint}>
            A second one would overwrite somebody&rsquo;s answer. Withdrawing a consent
            is how it stops standing, and it is done from the consent itself.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className={styles.section} data-decision-step>
        <p className={styles.stageNumber}>What was decided</p>
        <div className={styles.options} role="radiogroup" aria-label="Decision">
          {(
            [
              ['given', 'Given'],
              ['refused', 'Refused'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={props.outcome === id}
              className={[
                styles.option,
                props.outcome === id ? styles.optionSelected : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-outcome={id}
              onClick={() => props.setOutcome(id)}
            >
              <span className={styles.optionTitle}>{label}</span>
            </button>
          ))}
        </div>

        {props.outcome === 'given' ? (
          <div className={styles.stage}>
            <p className={styles.stageNumber}>How it was given</p>
            <div className={styles.options} role="radiogroup" aria-label="Method">
              {(
                [
                  ['verbal', 'Said aloud'],
                  ['written', 'In writing'],
                  ['digital_signature', 'Signed digitally'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={props.method === id}
                  className={[
                    styles.option,
                    props.method === id ? styles.optionSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-method={id}
                  onClick={() => props.setMethod(id)}
                >
                  <span className={styles.optionTitle}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {props.outcome === 'refused' ? (
          <div className={styles.stage}>
            <label className={styles.stageQuestion} htmlFor="refusal-note">
              What was said
            </label>
            <p className={styles.stageHint}>
              A refusal is a record, not a failure, and it keeps the words.
            </p>
            <textarea
              id="refusal-note"
              className={styles.textarea}
              value={props.refusalNote}
              onChange={(event) => props.setRefusalNote(event.target.value)}
              data-field="refusal-note"
            />
          </div>
        ) : null}
      </div>

      <div className={styles.section} data-authority-step>
        <p className={styles.stageNumber}>On whose authority</p>
        {props.lacksCapacity ? (
          <>
            <p className={styles.questionHint}>
              {props.preferredName} lacks capacity for this decision, so it is made for
              them rather than by them.
            </p>
            <div className={styles.options} role="radiogroup" aria-label="Authority">
              <button
                type="button"
                role="radio"
                aria-checked={props.authorityKind === 'best_interests'}
                className={[
                  styles.option,
                  props.authorityKind === 'best_interests' ? styles.optionSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-authority="best_interests"
                onClick={() => props.setAuthorityKind('best_interests')}
              >
                <span className={styles.optionTitle}>A best-interests decision</span>
                <span className={styles.optionHint}>
                  Made for them after consulting the people who know them.
                </span>
              </button>
              {lpaUsable ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.authorityKind === 'lpa_holder'}
                  className={[
                    styles.option,
                    props.authorityKind === 'lpa_holder' ? styles.optionSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-authority="lpa_holder"
                  onClick={() => props.setAuthorityKind('lpa_holder')}
                >
                  <span className={styles.optionTitle}>
                    {props.lpa?.name}, under a health and welfare LPA
                  </span>
                  <span className={styles.optionHint}>
                    The attorney decides, against the document already on file.
                  </span>
                </button>
              ) : null}
            </div>
            {lpaUsable ? null : (
              <p className={styles.questionHint} data-no-lpa-route>
                {props.lpa === undefined
                  ? 'No lasting power of attorney is on file, so an attorney cannot be the authority.'
                  : 'The LPA on file is financial, and a financial attorney cannot consent to care.'}
              </p>
            )}
            {props.authorityKind === 'best_interests' ? (
              <>
                <div className={styles.stage}>
                  <label className={styles.stageQuestion} htmlFor="consulted">
                    Who was consulted
                  </label>
                  <p className={styles.stageHint}>
                    One per line. A best-interests decision reached without consulting
                    anybody is not a best-interests decision.
                  </p>
                  <textarea
                    id="consulted"
                    className={styles.textarea}
                    value={props.consulted}
                    onChange={(event) => props.setConsulted(event.target.value)}
                    data-field="consulted"
                  />
                </div>
                <div className={styles.stage}>
                  <label className={styles.stageQuestion} htmlFor="rationale">
                    Why this is in their best interests
                  </label>
                  <textarea
                    id="rationale"
                    className={styles.textarea}
                    value={props.rationale}
                    onChange={(event) => props.setRationale(event.target.value)}
                    data-field="rationale"
                  />
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className={styles.questionHint} data-authority="the_resident">
            {props.preferredName} has capacity for this decision, so it is theirs. No
            other authority is offered, because none applies.
          </p>
        )}
      </div>

      <div className={styles.foot}>
        <p className={styles.footState} data-decision-state>
          {props.recorded === 'yes' ? (
            <strong>Recorded against {props.residentName}.</strong>
          ) : waiting.length > 0 ? (
            <>
              <strong>Waiting on:</strong> {waiting.join(' · ')}.
            </>
          ) : (
            <>
              This records the decision and the assessment it rests on, for{' '}
              {props.residentName}. Held in memory only in this build.
            </>
          )}
          {props.failure === '' ? null : (
            <>
              <br />
              <span data-record-failure>{props.failure}</span>
            </>
          )}
        </p>
        <Button
          size="large"
          disabled={waiting.length > 0 || props.recorded === 'yes'}
          data-record-consent
          onClick={props.onRecord}
        >
          Record this decision
        </Button>
      </div>
    </Card>
  )
}

/** A choice with a mark, because a tinted border alone is colour carrying meaning. */
function Option({
  selected,
  onSelect,
  id,
  title,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  id: string
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={[styles.option, selected ? styles.optionSelected : '']
        .filter(Boolean)
        .join(' ')}
      data-capacity={id}
      onClick={onSelect}
    >
      <span
        className={styles.optionMark}
        data-selected={selected || undefined}
        aria-hidden
      >
        <Icon name="check-validation/tick-02" size={12} />
      </span>
      <span className={styles.optionTitle}>{title}</span>
      <span className={styles.optionHint}>{hint}</span>
    </button>
  )
}
