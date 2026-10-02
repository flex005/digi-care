import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type {
  RiskAction,
  IsoDate,
  IsoDateTime,
  Resident,
  RiskLevel,
  RiskStatus,
  StaffRef,
} from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import type { ResidentProfile } from '@/data/access/client'
import { carersAndSeniors } from '@/data/fixtures/organisation'
import { AlertDialog, Button, Card, Select, Toast } from '@/components/primitives'
import { ReadOnlyHere, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useTerm } from '@/app/session/use-term'
import { useViewer } from '@/app/session/use-viewer'
import {
  recordAssessment,
  recordCustomRisk,
  recordReviewFlagsCleared,
  undoReviewFlagsCleared,
} from '@/data/access/client'
import type { ClearingToken } from '@/data/access/review-flag-store'
import { flagsClosedBy } from '@/data/access/review-flags'
import { formatDate, pluralise } from '@/lib/format'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import { PlaceholderBanner } from './PlaceholderBanner'
import {
  CHANGE_WORD,
  LEVEL_LABEL,
  LEVEL_OPTIONS,
  PLACEHOLDER_INSTRUMENT,
  bandFor,
  instrumentFor,
  needsPlaceholderWarning,
  compareScores,
  isScored,
  resolveRisk,
  riskInSentence,
} from './instrument'
import type { Instrument, ResolvedRisk } from './instrument'
import { RiskNameField } from './RiskFieldSet'
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

/**
 * An intervention as the record holds it.
 *
 * The form's own row carries a `dueOn` the record has no field for, and the
 * date is not dropped silently: it is written into the action so a plan that
 * says "by Friday" still says it on the resident's tab.
 */
function asActions(interventions: Intervention[]): RiskAction[] {
  return interventions
    .filter((entry) => entry.description.trim() !== '')
    .map((entry) => ({
      description:
        entry.dueOn === ''
          ? entry.description.trim()
          : `${entry.description.trim()} (by ${formatDate(entry.dueOn as IsoDate)})`,
      responsible: entry.responsible,
    }))
}

export function AssessmentFormRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { templateId } = useParams<{ templateId: string }>()

  const resolved = resolveRisk(resident, templateId)

  /*
   * **A re-score starts from what is on the record, never from blank.**
   * Saving what is on screen is how a form works, so a description and a plan
   * that the last assessor wrote would be deleted by the next one simply not
   * retyping them: data loss dressed as a fresh assessment. The instrument's
   * own answers are not prefilled, because those are this assessment's.
   */
  const onRecord: RiskStatus =
    resolved === 'no_such_risk' || resolved.kind === 'new_custom'
      ? { kind: 'not_assessed' }
      : resolved.kind === 'fixed'
        ? resolved.status
        : { kind: 'assessed', ...resolved.risk }
  const recorded = onRecord.kind === 'assessed' ? onRecord : undefined

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [interventions, setInterventions] = useState<Intervention[]>(() =>
    recorded === undefined || recorded.actions.length === 0
      ? [{ id: 1, description: '', responsible: '', dueOn: '' }]
      : recorded.actions.map((action, index) => ({
          id: index + 1,
          description: action.description,
          responsible: action.responsible,
          dueOn: '',
        })),
  )
  const [description, setDescription] = useState(() => recorded?.description ?? '')
  const [nextId, setNextId] = useState(
    () => (recorded === undefined ? 1 : recorded.actions.length) + 1,
  )
  const [firstRecorded, setFirstRecorded] = useState(false)
  /*
   * **The level, for an instrument that does not compute one.** Four of the
   * nine are unscored and a custom risk always is, and until this phase there
   * was no control for it anywhere: `level` was passed `bandFor(total)` with
   * `total` stuck at 0, so every one of them recorded **Low**, silently,
   * whatever the assessor had written. That is the default-the-unknown-to-fine
   * failure §1 exists to prevent, and it was live.
   *
   * **Not prefilled from the previous assessment, deliberately.** The scored
   * instrument's own answers are not prefilled either, for the reason this
   * file already gives: those are this assessment's. A level on an unscored
   * template is exactly that judgement, and carrying it forward would make "no
   * change" the answer nobody had to give.
   */
  const [chosenLevel, setChosenLevel] = useState<RiskLevel | ''>('')
  /** Only ever asked for a first custom assessment; fixed once recorded. */
  const [newName, setNewName] = useState('')
  const { currentUser } = useSession()
  const viewer = useViewer()

  /*
   * **The form is the write.** `/risk-assessments` declares
   * `records: 'completing an assessment'` and `approves: false` — there is no
   * separate sign-off, so completing it is the act and `canRecordIn` is the
   * whole question. What was assessed, and by whom, is read on the tab.
   */
  if (!viewer.canRecordIn('/risk-assessments')) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <ReadOnlyHere
            roleName={viewer.roleName}
            subject="this risk assessment"
            act="complete one"
          />
        </Card>
      </div>
    )
  }

  if (resolved === 'no_such_risk') {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such risk assessment</p>
          <p className={styles.errorBody}>
            Nothing is missing from the record; this address names neither one of the{' '}
            <span data-numeric>{RISK_ASSESSMENT_TEMPLATES.length}</span> templates nor a
            risk recorded for {resident.fullLegalName} outside them.
          </p>
        </Card>
      </div>
    )
  }

  /*
   * A risk outside the nine has no instrument, so it is never scored — and
   * the placeholder stands in where nothing is rendered from it, so the
   * running score and the item list have one shape to read either way.
   */
  const scored = resolved.kind === 'fixed' ? isScored(resolved.id) : false
  const instrument =
    resolved.kind === 'fixed' ? instrumentFor(resolved.id) : PLACEHOLDER_INSTRUMENT
  const items = instrument.items
  const naming = resolved.kind === 'new_custom'
  const name = naming ? newName : resolved.name
  const previous = onRecord.kind === 'assessed' ? onRecord : undefined
  const answered = Object.keys(answers).length
  const total = Object.values(answers).reduce((sum, points) => sum + points, 0)
  const band = bandFor(instrument, total)
  /* The arithmetic where there is an instrument, the judgement where not. */
  const nextLevel: RiskLevel | '' = scored ? band : chosenLevel
  const waiting = outstanding({
    answered,
    interventions,
    scored,
    level: nextLevel,
    name: naming ? newName : 'not asked here',
    itemCount: items.length,
  })

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All risk assessments
      </Link>

      <h2 className={styles.formTitle}>
        {previous ? 'Re-score: ' : ''}
        {naming && newName.trim() === '' ? 'A risk outside the nine' : name},{' '}
        {resident.fullLegalName}
      </h2>

      {needsPlaceholderWarning(scored, instrument.sourced) ? (
        <PlaceholderBanner />
      ) : null}

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
                style={{ width: `${(answered / items.length) * 100}%` }}
              />
            </span>
            {/* The figure carries its denominator, and says plainly that it is
                not final — a partial score read as a total is a wrong clinical
                figure. */}
            <span className={styles.progressText}>
              <span data-numeric>{answered}</span> of{' '}
              <span data-numeric>{items.length}</span> items answered
              {answered < items.length
                ? ', the score is not final until every item has an answer'
                : ''}
            </span>
          </div>

          {/*
           * Its own line, not folded into the sentence above. A scale that
           * reads backwards from every other one in the build is the fact a
           * scorer most needs before they start, and appending it to a note
           * about the score not being final would bury it.
           */}
          {instrument.higherIsWorse ? null : (
            <p className={styles.scoreDirection} data-score-direction>
              This scale runs the other way to the rest:{' '}
              <b>a lower score is a higher risk</b>.
            </p>
          )}

          <div className={styles.scoreBand}>
            <span className={styles.scoreLabel}>Band</span>
            <StatusPill tone={LEVEL_TONE[band]} label={LEVEL_LABEL[band]} />
          </div>
        </div>
      ) : null}

      {scored ? (
        <Card>
          <ul className={styles.itemList}>
            {items.map((item) => (
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
            {naming
              ? 'A risk outside the nine has no instrument: findings are recorded and a level is judged.'
              : `${name} is not a scored instrument: findings are recorded and a level is judged.`}
          </p>

          {/* The name, asked once and only here. A custom risk's name is fixed
              once it is recorded, because everything written about it was
              written about that name — so the editor never offers it again. */}
          {naming ? (
            <RiskNameField
              value={newName}
              onChange={setNewName}
              idSuffix="-new"
              hint="This cannot be changed later."
            />
          ) : null}

          {/*
           * **The judgement, which had no control at all.** Without it `level`
           * was `bandFor(0)`, so an unscored assessment recorded Low whatever
           * the description said. The same control the admission form and the
           * re-score dialog use, rather than a second one to keep in step.
           */}
          <div className={styles.levelChoice} data-level-choice>
            <Select
              label="Risk level"
              labelVisible
              placeholder="Not yet judged"
              value={chosenLevel === '' ? undefined : chosenLevel}
              options={LEVEL_OPTIONS}
              onValueChange={(value) => setChosenLevel(value as RiskLevel)}
            />
          </div>
        </Card>
      )}

      <Card>
        <section className={styles.section}>
          {/*
           * **The findings, which the record keeps.** The instrument produces
           * a number and the number produces a level; what neither carries is
           * what the assessor actually saw. It went unrecorded until Phase 30,
           * because there was nowhere on the record to put it — so the level
           * arrived on every screen with nothing underneath it.
           */}
          <h3 className={styles.sectionTitle}>What this assessment found</h3>
          <textarea
            className={styles.input}
            rows={3}
            value={description}
            placeholder="What you saw, in enough detail for the next person"
            aria-label="What this assessment found"
            data-assessment-description
            onChange={(event) => setDescription(event.target.value)}
          />
        </section>

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
            An intervention with no responsible person cannot be saved.
          </p>
        </section>
      </Card>

      {/*
       * **Reached by an unscored re-score too.** The gate was `scored &&
       * every item answered`, which no unscored template can ever satisfy — so
       * the comparison, the consequences and the undo were unreachable for
       * four of the nine and for every custom risk. What makes the comparison
       * possible is a new level, and for an unscored assessment that is the
       * judgement rather than the arithmetic.
       */}
      {previous !== undefined &&
      nextLevel !== '' &&
      (scored ? answered === items.length : true) ? (
        <CompareBlock
          previous={previous}
          nextScore={total}
          nextLevel={nextLevel}
          resident={resident}
          resolved={resolved}
          instrument={instrument}
          description={description}
          interventions={interventions}
        />
      ) : null}

      <div className={styles.foot}>
        <p className={styles.footState}>
          {waiting.length === 0 && nextLevel !== '' ? (
            <>
              <strong>Every item is answered.</strong> This records{' '}
              {riskInSentence({ kind: resolved.kind, name })} as{' '}
              {LEVEL_LABEL[nextLevel]} for {resident.fullLegalName}.
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
            /*
             * Guarded rather than cast. `outstanding` already refuses an
             * unscored assessment with no level, so this cannot be reached —
             * and a cast here would be the one that silences the check §8
             * names, on the field this whole fix is about.
             */
            if (nextLevel === '') return
            const common = {
              level: nextLevel,
              score: scored
                ? ({ kind: 'scored', value: total } as const)
                : ({ kind: 'unscored' } as const),
              description,
              actions: asActions(interventions),
              by: currentUser,
              at: appNow().toISOString() as IsoDateTime,
            }
            /*
             * Two writers, one act, chosen here rather than in the store: the
             * nine live in `resident.risks` keyed by template and the rest in
             * `resident.customRisks` as a list. The screen is where that
             * difference belongs.
             */
            const written =
              resolved.kind === 'fixed'
                ? recordAssessment({
                    residentId: resident.id,
                    templateId: resolved.id,
                    ...common,
                  })
                : recordCustomRisk({
                    residentId: resident.id,
                    name,
                    ...(resolved.kind === 'custom' ? { riskId: resolved.id } : {}),
                    ...common,
                  })
            void written.then(() => setFirstRecorded(true))
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
        description={`${name} for ${resident.fullLegalName}.`}
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
  /**
   * The level this assessment will record. Computed from the instrument where
   * there is one, and chosen where there is not.
   */
  level: RiskLevel | ''
  /**
   * The name a first custom assessment is being given. `'not asked here'` for
   * the nine and for a custom risk already on the record, whose name is fixed.
   */
  name: string
  /**
   * How many items this template's instrument asks.
   *
   * Passed rather than read from a constant: Morse has six, Waterlow has ten,
   * and the placeholder has six. A module-level item count was the right
   * answer only while every scored template shared one instrument.
   */
  itemCount: number
}): string[] {
  const waiting: string[] = []

  if (input.scored && input.answered < input.itemCount) {
    const missing = input.itemCount - input.answered
    waiting.push(`${pluralise(missing, 'unanswered item')}`)
  }

  /*
   * **The level, where nothing computes one.** Without this the form was
   * ready to save with no judgement made, and `bandFor(0)` recorded Low. A
   * scored instrument reaches its level through the items above instead.
   */
  if (!input.scored && input.level === '') waiting.push('a risk level')

  if (input.name.trim() === '') waiting.push('a name for this risk')

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
  resolved,
  instrument,
  description,
  interventions,
}: {
  previous: Extract<RiskStatus, { kind: 'assessed' }>
  nextScore: number
  nextLevel: RiskLevel
  resident: Resident
  resolved: ResolvedRisk
  /** Which way its numbers run, for the comparison below. */
  instrument: Instrument
  /** Both typed above, and both written by the same save as a first one. */
  description: string
  interventions: Intervention[]
}) {
  /** Five of the nine produce a number; the rest reach a level by judgement. */
  const scoredTemplate = resolved.kind === 'fixed' && isScored(resolved.id)
  const named = resolved.kind === 'new_custom' ? '' : resolved.name
  const inSentence = riskInSentence({ kind: resolved.kind, name: named })
  const format = useSiteFormat()
  const term = useTerm()
  const { currentUser } = useSession()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const [confirming, setConfirming] = useState(false)
  /*
   * Outside the nine there is no flag to discharge, so there is nothing to put
   * back. A state rather than a null, and the same shape `DomainEditorRoute`
   * uses for exactly this.
   */
  const [recorded, setRecorded] = useState<ClearingToken | 'nothing_to_clear' | 'none'>(
    'none',
  )
  const [error, setError] = useState('')

  const previousScore =
    previous.score.kind === 'scored' ? previous.score.value : nextScore
  /*
   * The direction comes from the instrument. On Braden a rising total is a
   * resident at less risk, and this read "up is worse" out of a comment until
   * Braden landed — which would have printed Deteriorated over somebody
   * getting better, on the block whose whole job is to say which way it went.
   */
  const change = compareScores(previousScore, nextScore, instrument.higherIsWorse)
  const levelChanged = previous.level !== nextLevel

  /*
   * **Only the nine, because only they can be flagged.**
   * `IncidentReviewTarget` names a `RiskTemplateId` and that union is closed
   * deliberately: a post-incident review is raised against one of the nine. A
   * risk outside them has no flags rather than an unread set, so the screen
   * says nothing about them rather than something un-scoped.
   */
  const closes =
    resolved.kind === 'fixed'
      ? flagsClosedBy({
          incidents,
          residentId: resident.id,
          target: { kind: 'risk_assessment', templateId: resolved.id },
          now,
          formatDate: (at) => format.date(at.slice(0, 10) as IsoDate),
        })
      : []

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
              {/* The badge strip is drawn from the nine; a custom risk has no
                  place on it, so the line is absent rather than invented. */}
              {resolved.kind === 'fixed' ? (
                <li>
                  {badgeStripChange(
                    resolved.id,
                    previous.level,
                    nextLevel,
                    (level) => LEVEL_LABEL[level],
                  )}
                </li>
              ) : null}

              {/* Named individually, never counted. A figure tells somebody how
                  much work vanished; the names tell them what it was. */}
              {closes.map((entry) => (
                <li key={entry.incident.id} data-closes={entry.incident.id}>
                  This closes the post-incident review flagged on {inSentence} by{' '}
                  {entry.description}
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
              label="Nobody on shift is notified"
              detail={notificationNote(resident.preferredName, LEVEL_LABEL[nextLevel])}
            />
          </div>
        </>
      ) : null}

      <div className={styles.foot}>
        <p className={styles.footState}>
          <strong>
            Confirming records {inSentence} as {LEVEL_LABEL[nextLevel]} for{' '}
            {resident.fullLegalName}.
          </strong>{' '}
          The previous score stays on the record; a re-score adds to the history.
        </p>
        {recorded === 'none' ? (
          <Button
            size="large"
            data-record-rescore
            onClick={() => levelChanged && setConfirming(true)}
          >
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
          action={`Record ${inSentence} as ${LEVEL_LABEL[nextLevel]}`}
          confirmLabel={
            closes.length === 0
              ? 'Record assessment'
              : `Record and close ${pluralise(closes.length, 'review')}`
          }
          description={
            <span className={styles.confirmBody}>
              {resolved.kind === 'fixed' ? (
                <span>
                  {badgeStripChange(
                    resolved.id,
                    previous.level,
                    nextLevel,
                    (level) => LEVEL_LABEL[level],
                  )}
                </span>
              ) : null}
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
        description={`Recorded against this ${term.one}.`}
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
      const common = {
        level: nextLevel,
        score: scoredTemplate
          ? ({ kind: 'scored', value: nextScore } as const)
          : ({ kind: 'unscored' } as const),
        description,
        actions: asActions(interventions),
        by: currentUser,
        at: now,
      }
      if (resolved.kind === 'fixed') {
        await recordAssessment({
          residentId: resident.id,
          templateId: resolved.id,
          ...common,
        })
      } else if (resolved.kind === 'custom') {
        /*
         * The name goes back unchanged. `recordCustomRisk` renames silently if
         * handed a different string, and everything written about this risk
         * was written about that name.
         */
        await recordCustomRisk({
          residentId: resident.id,
          name: resolved.name,
          riskId: resolved.id,
          ...common,
        })
      }

      /*
       * Only where a flag could exist. Calling this for a risk outside the
       * nine would mean widening `IncidentReviewTarget` to take an id it is
       * closed against, to clear a set that is empty by construction.
       */
      const token =
        resolved.kind === 'fixed'
          ? await recordReviewFlagsCleared({
              residentId: resident.id,
              target: { kind: 'risk_assessment', templateId: resolved.id },
              by: currentUser,
              at: now,
            })
          : ('nothing_to_clear' as const)
      setConfirming(false)
      setRecorded(token)
      setError('')
    } catch (cause) {
      setConfirming(false)
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }

  async function undo(token: ClearingToken | 'nothing_to_clear') {
    if (token !== 'nothing_to_clear') await undoReviewFlagsCleared(token)
    setRecorded('none')
  }
}
