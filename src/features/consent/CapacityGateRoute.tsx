import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { ConsentTypeId } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Button, Card, SelectedMark } from '@/components/primitives'
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
          <Button size="large" disabled={waiting.length > 0} data-continue>
            Continue
          </Button>
        </div>
      </Card>
    </div>
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
