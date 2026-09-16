import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type {
  IsoDate,
  IsoDateTime,
  Resident,
  RiskLevel,
  RiskStatus,
  RiskTemplateId,
  StaffRef,
} from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import type { ResidentProfile } from '@/data/access/client'
import { carersAndSeniors } from '@/data/fixtures/organisation'
import { AlertDialog, Button, Card, Select, Toast } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import {
  recordAssessment,
  recordReviewFlagsCleared,
  undoReviewFlagsCleared,
} from '@/data/access/client'
import type { ClearingToken } from '@/data/access/review-flag-store'
import { flagsClosedBy, riskTemplateName } from '@/data/access/review-flags'
import { pluralise } from '@/lib/format'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import { PlaceholderBanner } from './PlaceholderBanner'
import {
  CHANGE_WORD,
  INSTRUMENT_ITEMS,
  LEVEL_LABEL,
  bandFor,
  compareScores,
  isScored,
} from './instrument'
import { badgeStripChange, notificationNote } from './rescore'
import styles from './risk.module.css'

/**
 * The scored assessment. PRD §6.6.
 *
 * The sentence: **this score puts them in this band, and every intervention
 * here needs somebody's name on it.**
 *
 * The running score is sticky because it is the thing the reader is watching
 * change — a scorer answering item four wants to know what item four did.
 *
 * **Point values are visible beside every choice**, and that is not a
 * convenience. A scorer who cannot see the weighting cannot tell whether the
 * instrument is behaving, and on a placeholder instrument that matters more
 * rather than less: the only way to notice that an invented weighting is wrong
 * is to be able to see it.
 */

interface Intervention {
  id: number
  description: string
  responsible: string
  dueOn: string
}

export function AssessmentFormRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { templateId } = useParams<{ templateId: string }>()

  const template = RISK_ASSESSMENT_TEMPLATES.find((entry) => entry.id === templateId)

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [interventions, setInterventions] = useState<Intervention[]>([
    { id: 1, description: '', responsible: '', dueOn: '' },
  ])
  const [nextId, setNextId] = useState(2)
  const [firstRecorded, setFirstRecorded] = useState(false)
  const { currentUser } = useSession()

  if (!template) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such risk assessment</p>
          <p className={styles.errorBody}>
            Nothing is missing from the record; this address does not name one of the{' '}
            <span data-numeric>{RISK_ASSESSMENT_TEMPLATES.length}</span> templates.
          </p>
        </Card>
      </div>
    )
  }

  const scored = isScored(template.id as RiskTemplateId)
  const existing = resident.risks[template.id as RiskTemplateId]
  const previous = existing.kind === 'assessed' ? existing : undefined
  const answered = Object.keys(answers).length
  const total = Object.values(answers).reduce((sum, points) => sum + points, 0)
  const band = bandFor(total)
  const waiting = outstanding({ answered, interventions, scored })

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All risk assessments
      </Link>

      <h2 className={styles.formTitle}>
        {previous ? 'Re-score: ' : ''}
        {template.name}, {resident.fullLegalName}
      </h2>

      <PlaceholderBanner />

      {scored ? (
        <div className={styles.runningScore} data-running-score>
          <div className={styles.scoreBlock}>
            <span className={styles.scoreLabel}>Running score</span>
            <span className={styles.scoreFigure} data-numeric>
              {total}
            </span>
          </div>

          <div className={styles.scoreProgress}>
            <span className={styles.progressTrack}>
              <span
                className={styles.progressFill}
                style={{ width: `${(answered / INSTRUMENT_ITEMS.length) * 100}%` }}
              />
            </span>
            {/* The figure carries its denominator, and says plainly that it is
                not final — a partial score read as a total is a wrong clinical
                figure. */}
            <span className={styles.progressText}>
              <span data-numeric>{answered}</span> of{' '}
              <span data-numeric>{INSTRUMENT_ITEMS.length}</span> items answered
              {answered < INSTRUMENT_ITEMS.length
                ? ', the score is not final until every item has an answer'
                : ''}
            </span>
          </div>

          <div className={styles.scoreBand}>
            <span className={styles.scoreLabel}>Band</span>
            <StatusPill tone={LEVEL_TONE[band]} label={LEVEL_LABEL[band]} />
          </div>
        </div>
      ) : null}

      {scored ? (
        <Card>
          <ul className={styles.itemList}>
            {INSTRUMENT_ITEMS.map((item) => (
              <li key={item.id} className={styles.itemRow} data-item={item.id}>
                <div className={styles.itemAbout}>
                  <p className={styles.itemQuestion}>{item.question}</p>
                  <p className={styles.itemGuidance}>{item.guidance}</p>
                  {answers[item.id] === undefined ? (
                    <Unrecorded
                      variant="chip"
                      label="Not answered"
                      detail="the score is incomplete until this has an answer"
                    />
                  ) : null}
                </div>

                {/* No default on any item. A pre-selected answer is an answer
                    nobody gave, and on a scored instrument it is also points
                    nobody chose. */}
                <div
                  className={styles.choices}
                  role="radiogroup"
                  aria-label={item.question}
                >
                  {item.choices.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      role="radio"
                      aria-checked={answers[item.id] === choice.points}
                      className={[
                        styles.choice,
                        answers[item.id] === choice.points ? styles.choiceSelected : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-choice={`${item.id}:${choice.points}`}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [item.id]: choice.points,
                        }))
                      }
                    >
                      <span>{choice.label}</span>
                      <span className={styles.choicePoints} data-numeric>
                        {pluralise(choice.points, 'pt')}
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card padded>
          <p className={styles.settledNote}>
            {template.name} is not a scored instrument in this build. Findings are
            recorded and a level is judged; there is no arithmetic to show.
          </p>
        </Card>
      )}

      <Card>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Interventions</h3>

          <ul className={styles.interventionList}>
            {interventions.map((entry) => (
              <li
                key={entry.id}
                className={styles.interventionRow}
                data-intervention={entry.id}
              >
                <input
                  className={styles.input}
                  type="text"
                  value={entry.description}
                  placeholder="What will be done about this risk"
                  aria-label="What will be done about this risk"
                  onChange={(event) =>
                    setInterventions((current) =>
                      current.map((item) =>
                        item.id === entry.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Select
                  label="Who is responsible"
                  placeholder="Who is responsible"
                  value={entry.responsible === '' ? undefined : entry.responsible}
                  onValueChange={(value) =>
                    setInterventions((current) =>
                      current.map((item) =>
                        item.id === entry.id ? { ...item, responsible: value } : item,
                      ),
                    )
                  }
                  options={carersAndSeniors.map((staff: StaffRef) => ({
                    value: staff.id,
                    label: staff.displayName,
                  }))}
                />
                <input
                  className={styles.input}
                  type="date"
                  value={entry.dueOn}
                  aria-label="Due by"
                  onChange={(event) =>
                    setInterventions((current) =>
                      current.map((item) =>
                        item.id === entry.id
                          ? { ...item, dueOn: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="small"
                  aria-label={`Remove intervention ${entry.id}`}
                  onClick={() =>
                    setInterventions((current) =>
                      current.filter((item) => item.id !== entry.id),
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>

          <div className={styles.interventionActions}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setInterventions((current) => [
                  ...current,
                  { id: nextId, description: '', responsible: '', dueOn: '' },
                ])
                setNextId((id) => id + 1)
              }}
            >
              <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
              Add an intervention
            </Button>
          </div>

          {/* Said on the screen, not only enforced. A plan nobody owns is not
              a plan — it is a sentence somebody wrote. */}
          <p className={styles.interventionNote}>
            An intervention with no responsible person cannot be saved. A plan nobody
            owns is not a plan.
          </p>
        </section>
      </Card>

      {previous && scored && answered === INSTRUMENT_ITEMS.length ? (
        <CompareBlock
          previous={previous}
          nextScore={total}
          nextLevel={band}
          resident={resident}
          templateId={template.id as RiskTemplateId}
        />
      ) : null}

      <div className={styles.foot}>
        <p className={styles.footState}>
          {waiting.length === 0 ? (
            <>
              <strong>Every item is answered.</strong> This records a{' '}
              {template.name.toLowerCase()} of {LEVEL_LABEL[band]} for{' '}
              {resident.fullLegalName}.
            </>
          ) : (
            <>
              <strong>Waiting on:</strong> {waiting.join(' · ')}
            </>
          )}
        </p>
        {/*
         * Live from Phase 16. The re-score path has its own confirmation,
         * because a level change notifies the shift; a first assessment
         * changes nothing that was previously stated, so it records directly.
         */}
        <Button
          size="large"
          disabled={waiting.length > 0}
          data-record-assessment
          onClick={() => {
            void recordAssessment({
              residentId: resident.id,
              templateId: template.id as RiskTemplateId,
              level: band,
              score: scored ? { kind: 'scored', value: total } : { kind: 'unscored' },
              by: currentUser,
              at: appNow().toISOString() as IsoDateTime,
            }).then(() => setFirstRecorded(true))
          }}
        >
          Record assessment
        </Button>
      </div>

      <Toast
        open={firstRecorded}
        onOpenChange={(open) => {
          if (!open) setFirstRecorded(false)
        }}
        tone="positive"
        title="Assessment recorded"
        description={`${template.name} for ${resident.fullLegalName}.`}
      />
    </div>
  )
}

const LEVEL_TONE = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
} as const

/**
 * What the form is still waiting on, named item by item.
 *
 * Exported so the rule can be tested without driving the screen — the rule is
 * what matters, not the wiring.
 */
export function outstanding(input: {
  answered: number
  interventions: { description: string; responsible: string }[]
  scored: boolean
}): string[] {
  const waiting: string[] = []

  if (input.scored && input.answered < INSTRUMENT_ITEMS.length) {
    const missing = INSTRUMENT_ITEMS.length - input.answered
    waiting.push(`${pluralise(missing, 'unanswered item')}`)
  }

  // An intervention somebody typed and nobody owns holds the record. An empty
  // row is not an intervention at all and is ignored.
  const unowned = input.interventions.filter(
    (entry) => entry.description.trim() !== '' && entry.responsible === '',
  ).length
  if (unowned > 0) {
    waiting.push(`${pluralise(unowned, 'intervention')} with no responsible person`)
  }

  return waiting
}

/**
 * Previous against new, and everything the change would cost.
 *
 * The centre column carries **an arrow and a word**. Never the arrow alone:
 * direction by shape is unreadable in greyscale and means nothing to a screen
 * reader, so a shape-only indicator is decoration on a clinical finding.
 */
function CompareBlock({
  previous,
  nextScore,
  nextLevel,
  resident,
  templateId,
}: {
  previous: Extract<RiskStatus, { kind: 'assessed' }>
  nextScore: number
  nextLevel: RiskLevel
  resident: Resident
  templateId: RiskTemplateId
}) {
  /** Only four of the nine produce a number; the rest reach a level. */
  const scoredTemplate = isScored(templateId)
  const format = useSiteFormat()
  const { currentUser } = useSession()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const [confirming, setConfirming] = useState(false)
  const [recorded, setRecorded] = useState<ClearingToken | 'none'>('none')
  const [error, setError] = useState('')

  const previousScore =
    previous.score.kind === 'scored' ? previous.score.value : nextScore
  const change = compareScores(previousScore, nextScore)
  const levelChanged = previous.level !== nextLevel

  const closes = flagsClosedBy({
    incidents,
    residentId: resident.id,
    target: { kind: 'risk_assessment', templateId },
    now,
    formatDate: (at) => format.date(at.slice(0, 10) as IsoDate),
  })

  return (
    <Card>
      <div className={styles.compare} data-compare>
        <div className={styles.compareSide}>
          <span className={styles.scoreLabel}>Previous</span>
          <span className={styles.compareFigure} data-numeric>
            {previousScore}
          </span>
          <StatusPill
            tone={LEVEL_TONE[previous.level]}
            label={LEVEL_LABEL[previous.level]}
          />
          <span className={styles.compareWho}>
            {previous.assessedBy.displayName} ·{' '}
            <span data-numeric>
              {format.date(previous.assessedAt.slice(0, 10) as IsoDate)}
            </span>
          </span>
        </div>

        <div className={styles.compareChange} data-change={change}>
          <Icon
            name={
              change === 'deteriorated'
                ? 'arrows-sharp/arrow-down-01-sharp'
                : change === 'improved'
                  ? 'arrows-sharp/arrow-up-01-sharp'
                  : 'arrows-sharp/arrow-right-01-sharp'
            }
            size={24}
            aria-hidden
          />
          {/* The word, always. The arrow beside it is reinforcement. */}
          <span className={styles.compareWord}>{CHANGE_WORD[change]}</span>
          <span className={styles.compareDelta} data-numeric>
            {nextScore === previousScore
              ? 'no change'
              : `${nextScore > previousScore ? '+' : ''}${nextScore - previousScore} points`}
          </span>
        </div>

        <div className={styles.compareSide}>
          <span className={styles.scoreLabel}>New</span>
          <span className={styles.compareFigure} data-numeric>
            {nextScore}
          </span>
          <StatusPill tone={LEVEL_TONE[nextLevel]} label={LEVEL_LABEL[nextLevel]} />
          <span className={styles.compareWho}>not yet recorded</span>
        </div>
      </div>

      {levelChanged ? (
        <>
          <div className={styles.consequences} data-consequences>
            <p className={styles.consequencesTitle}>
              The risk level has changed, and these change with it
            </p>
            <ul className={styles.consequencesList}>
              <li>
                {badgeStripChange(
                  templateId,
                  previous.level,
                  nextLevel,
                  (level) => LEVEL_LABEL[level],
                )}
              </li>

              {/* Named individually, never counted. A figure tells somebody how
                  much work vanished; the names tell them what it was. */}
              {closes.map((entry) => (
                <li key={entry.incident.id} data-closes={entry.incident.id}>
                  This closes the post-incident review flagged on{' '}
                  {riskTemplateName(templateId).toLowerCase()} by {entry.description}
                  {entry.overdue
                    ? ': it is already past its 48 hours, and will still read as closed late.'
                    : ', which is still inside its 48 hours.'}
                </li>
              ))}

              <li>
                The next review moves to{' '}
                <span data-numeric>
                  {format.date(nextReviewFrom(now, reviewIntervalMonths()))}
                </span>
                .
              </li>
            </ul>
          </div>

          <div className={styles.notificationNote} data-notification-note>
            <Unrecorded
              variant="panel"
              label="Staff on shift would be notified"
              detail={notificationNote(resident.preferredName, LEVEL_LABEL[nextLevel])}
            />
          </div>
        </>
      ) : null}

      <div className={styles.foot}>
        <p className={styles.footState}>
          <strong>
            Confirming records a {riskTemplateName(templateId).toLowerCase()} of{' '}
            {LEVEL_LABEL[nextLevel]} for {resident.fullLegalName}.
          </strong>{' '}
          The previous score stays on the record; a re-score adds to the history rather
          than replacing it.
        </p>
        {recorded === 'none' ? (
          <Button size="large" onClick={() => levelChanged && setConfirming(true)}>
            {closes.length === 0
              ? 'Record assessment'
              : `Record and close ${pluralise(closes.length, 'review')}`}
          </Button>
        ) : (
          /*
           * Persistent while the clearing stands, rather than a toast action
           * that disappears. A toast is the right length for "we saved it";
           * this closed a clinical obligation somebody else raised, and the
           * chance to take it back should outlast a five-second banner.
           */
          <Button
            variant="secondary"
            size="large"
            data-undo-clearing
            onClick={() => {
              void undo(recorded)
            }}
          >
            Undo: put {pluralise(closes.length, 'review')} back
          </Button>
        )}
      </div>

      {/* Raised only when the level changes. Raising it on every re-score is
          volume drowning the distinction — a warning that fires on the
          unremarkable case stops being read on the remarkable one. */}
      {levelChanged ? (
        <AlertDialog
          open={confirming}
          onOpenChange={setConfirming}
          subject={{
            kind: 'resident',
            name: resident.fullLegalName,
            ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
          }}
          action={`Record a ${riskTemplateName(templateId).toLowerCase()} of ${LEVEL_LABEL[nextLevel]}`}
          confirmLabel={
            closes.length === 0
              ? 'Record assessment'
              : `Record and close ${pluralise(closes.length, 'review')}`
          }
          description={
            <span className={styles.confirmBody}>
              <span>
                {badgeStripChange(
                  templateId,
                  previous.level,
                  nextLevel,
                  (level) => LEVEL_LABEL[level],
                )}
              </span>
              {closes.map((entry) => (
                <span key={entry.incident.id}>
                  Closes the review flagged by {entry.description}
                  {entry.overdue ? ', already past its 48 hours' : ''}.
                </span>
              ))}
              <span>No notification is sent.</span>
            </span>
          }
          onConfirm={() => {
            void record()
          }}
        />
      ) : null}

      {/* The toast lives on the screen rather than inside the dialog, because
          the dialog closes on confirm and a toast rendered inside it would be
          destroyed by the act it is reporting. */}
      <Toast
        open={recorded !== 'none'}
        onOpenChange={(open) => {
          if (!open) setRecorded('none')
        }}
        tone="positive"
        title={
          closes.length === 0
            ? 'Assessment recorded'
            : `Assessment recorded: ${pluralise(closes.length, 'review')} closed`
        }
        description="Recorded against this resident."
      />

      {error === '' ? null : <p className={styles.errorBody}>{error}</p>}
    </Card>
  )

  async function record() {
    try {
      /*
       * Phase 16: the assessment is written before the flags it closes.
       * The order matters — a flag discharged by a re-score that did not land
       * would be an obligation cleared by nothing.
       */
      await recordAssessment({
        residentId: resident.id,
        templateId,
        level: nextLevel,
        score: scoredTemplate
          ? { kind: 'scored', value: nextScore }
          : { kind: 'unscored' },
        by: currentUser,
        at: now,
      })

      const token = await recordReviewFlagsCleared({
        residentId: resident.id,
        target: { kind: 'risk_assessment', templateId },
        by: currentUser,
        at: now,
      })
      setConfirming(false)
      setRecorded(token)
      setError('')
    } catch (cause) {
      setConfirming(false)
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }

  async function undo(token: ClearingToken) {
    await undoReviewFlagsCleared(token)
    setRecorded('none')
  }
}
