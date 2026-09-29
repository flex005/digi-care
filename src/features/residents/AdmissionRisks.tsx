import { useState } from 'react'
import type { IsoDate, RiskLevel, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import type { AdmissionRiskEntry } from '@/data/access/resident-store'
import { Button, Select } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { StatusPill } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { carersAndSeniors } from '@/data/fixtures/organisation'
import { isScored, LEVEL_LABEL } from '@/features/risk/instrument'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import styles from './admission.module.css'

/**
 * Risk assessments at admission. AM v2.0 step 3, Phase 30.
 *
 * The sentence: **what somebody already knows about this person's risks on the
 * day they arrive, and nothing invented to fill the rest.**
 *
 * **This reverses a decision recorded in Phase 25.** The step used to say the
 * risk flags were not asked here, on the argument that answering one is
 * completing an assessment rather than ticking a box on an admission form.
 * That argument was about a form that would have *required* answers; the
 * decision it produced also refused the ones somebody arrives holding. A
 * resident comes from hospital with a Waterlow score on the discharge summary
 * and two falls last month, and a form with nowhere to put either makes the
 * home retype them into a second screen or lose them.
 *
 * So the rule that survives is the narrower one: **nothing here is required,
 * and nothing here is defaulted.** A template nobody touches stays never
 * assessed, which every screen already renders as the gap it is. What changed
 * is that somebody who knows the answer today can record it today.
 *
 * **A level without a number is a state, not a shortfall.** Five of the nine
 * are scored instruments, and the score box may honestly be empty on the day:
 * the record holds that as `not_scored_yet`, distinct from an instrument that
 * produces no number at all, and the resident's tab says which.
 */

/** One row of the form, before it becomes a record. */
export interface DraftRisk {
  level: RiskLevel | ''
  /** As typed. Blank on a scored instrument means nobody has worked it out. */
  score: string
  description: string
  actions: { description: string; responsible: string }[]
  assessedOn: string
  reviewDueOn: string
}

export interface DraftCustomRisk extends DraftRisk {
  name: string
}

export function emptyDraft(admittedOn: string): DraftRisk {
  return {
    level: '',
    score: '',
    description: '',
    actions: [{ description: '', responsible: '' }],
    assessedOn: admittedOn,
    reviewDueOn: nextReviewFrom(admittedOn as IsoDate, reviewIntervalMonths()),
  }
}

/** Answered means somebody reached a level. Everything else is optional. */
export const isAnswered = (draft: DraftRisk): boolean => draft.level !== ''

/**
 * A row as the record holds it.
 *
 * The score is read once, here: a blank box on a scored instrument is the
 * third state rather than a zero, and a zero typed into it is a score.
 */
export function asEntry(draft: DraftRisk, scored: boolean): AdmissionRiskEntry {
  const typed = Number(draft.score)
  const hasScore = draft.score.trim() !== '' && Number.isFinite(typed)
  return {
    level: draft.level === '' ? 'low' : draft.level,
    score: !scored
      ? { kind: 'unscored' }
      : hasScore
        ? { kind: 'scored', value: typed }
        : { kind: 'not_scored_yet' },
    description: draft.description,
    actions: draft.actions,
    assessedOn: draft.assessedOn as IsoDate,
    reviewDueOn: draft.reviewDueOn as IsoDate,
  }
}

const LEVEL_OPTIONS = (['low', 'moderate', 'high'] as const).map((level) => ({
  value: level,
  label: LEVEL_LABEL[level],
}))

const LEVEL_TONE = { low: 'positive', moderate: 'caution', high: 'critical' } as const

export function AdmissionRisks({
  name,
  admittedOn,
  drafts,
  onDraft,
  customs,
  onCustoms,
}: {
  name: string
  admittedOn: string
  drafts: Partial<Record<RiskTemplateId, DraftRisk>>
  onDraft: (id: RiskTemplateId, draft: DraftRisk) => void
  customs: DraftCustomRisk[]
  onCustoms: (next: DraftCustomRisk[]) => void
}) {
  const [open, setOpen] = useState<string>('')
  const answered = RISK_ASSESSMENT_TEMPLATES.filter((template) => {
    const draft = drafts[template.id]
    return draft !== undefined && isAnswered(draft)
  }).length

  return (
    <div className={styles.risks} data-admission-risks>
      <p className={styles.sectionNote} data-risk-claim>
        <span data-numeric>{answered}</span> of{' '}
        <span data-numeric>{RISK_ASSESSMENT_TEMPLATES.length}</span> answered. Anything
        left alone is recorded as never assessed, which is what every screen will show
        until somebody does one: it is not low risk, and it does not hold up this step.
      </p>

      <ul className={styles.riskList}>
        {RISK_ASSESSMENT_TEMPLATES.map((template) => {
          const draft = drafts[template.id] ?? emptyDraft(admittedOn)
          const scored = isScored(template.id)
          const isOpen = open === template.id
          return (
            <li key={template.id} className={styles.riskItem} data-risk={template.id}>
              {/* The state is outside the disclosure: a collapsed row that does
                  not say whether it has an answer is indistinguishable from one
                  that has none. */}
              <div className={styles.riskHead}>
                <div className={styles.riskAbout}>
                  <p className={styles.riskName}>{template.name}</p>
                  <p className={styles.riskInstrument}>
                    {scored ? template.framework : 'Unscored: findings recorded'}
                  </p>
                </div>

                {isAnswered(draft) ? (
                  <StatusPill
                    tone={LEVEL_TONE[draft.level as RiskLevel]}
                    label={LEVEL_LABEL[draft.level as RiskLevel]}
                  />
                ) : (
                  <Unrecorded
                    variant="chip"
                    label="Not assessed"
                    detail="nobody has looked at this risk yet"
                  />
                )}

                <Button
                  variant="secondary"
                  size="small"
                  data-open-risk={template.id}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? '' : template.id)}
                >
                  {isAnswered(draft) ? 'Edit' : 'Record'}
                  <Icon
                    name={
                      isOpen
                        ? 'arrows-sharp/arrow-up-01-sharp'
                        : 'arrows-sharp/arrow-down-01-sharp'
                    }
                    size={16}
                    aria-hidden
                  />
                </Button>
              </div>

              {isOpen ? (
                <RiskFields
                  idPrefix={template.id}
                  draft={draft}
                  scored={scored}
                  onChange={(next) => onDraft(template.id, next)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className={styles.customRisks} data-custom-risks={customs.length}>
        <div className={styles.riskHead}>
          <div className={styles.riskAbout}>
            <p className={styles.riskName}>Risks outside the nine</p>
            {/*
             * Said where somebody is about to add one. The nine are what every
             * home is expected to hold and what every "of 9" figure counts; a
             * risk recorded here is this resident's, listed beside them on
             * their own tab and counted in its own sentence.
             */}
            <p className={styles.riskInstrument}>
              Recorded for {name} and counted separately from the nine.
            </p>
          </div>
          <Button
            variant="secondary"
            size="small"
            data-add-custom-risk
            onClick={() =>
              onCustoms([...customs, { ...emptyDraft(admittedOn), name: '' }])
            }
          >
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Add custom risk
          </Button>
        </div>

        {customs.map((custom, index) => (
          <div
            key={`custom-${String(index)}`}
            className={styles.customRisk}
            data-custom-risk={index}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>What the risk is</span>
              <input
                type="text"
                value={custom.name}
                placeholder="Leaving the home unaccompanied"
                data-field={`custom-risk-name-${String(index)}`}
                onChange={(event) =>
                  onCustoms(
                    customs.map((entry, position) =>
                      position === index
                        ? { ...entry, name: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
            </label>

            <RiskFields
              idPrefix={`custom-${String(index)}`}
              draft={custom}
              scored={false}
              onChange={(next) =>
                onCustoms(
                  customs.map((entry, position) =>
                    position === index ? { ...next, name: entry.name } : entry,
                  ),
                )
              }
            />

            <Button
              variant="ghost"
              size="small"
              data-remove-custom-risk={index}
              onClick={() =>
                onCustoms(customs.filter((_, position) => position !== index))
              }
            >
              Remove this risk
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The fields themselves, shared by a template and a custom risk.
 *
 * One component, because the two are one record: a custom risk that took a
 * different set of fields would be a second kind of thing to reconcile on the
 * way to the resident's tab.
 */
function RiskFields({
  idPrefix,
  draft,
  scored,
  onChange,
}: {
  idPrefix: string
  draft: DraftRisk
  scored: boolean
  onChange: (next: DraftRisk) => void
}) {
  return (
    <div className={styles.riskFields}>
      <div className={styles.riskRow}>
        <Select
          label="Risk level"
          labelVisible
          placeholder="Not assessed"
          value={draft.level === '' ? undefined : draft.level}
          options={LEVEL_OPTIONS}
          onValueChange={(value) => onChange({ ...draft, level: value as RiskLevel })}
        />

        {scored ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Score</span>
            <input
              type="number"
              value={draft.score}
              data-field={`${idPrefix}-score`}
              onChange={(event) => onChange({ ...draft, score: event.target.value })}
            />
            {/* The blank is a state, and it says which one. */}
            <span className={styles.fieldHint}>
              Leave blank if nobody has worked it out yet: the record says scored, not
              yet rather than no score.
            </span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Assessed on</span>
          <input
            type="date"
            value={draft.assessedOn}
            data-field={`${idPrefix}-assessed-on`}
            onChange={(event) => onChange({ ...draft, assessedOn: event.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Next review due</span>
          <input
            type="date"
            value={draft.reviewDueOn}
            data-field={`${idPrefix}-review-due`}
            onChange={(event) =>
              onChange({ ...draft, reviewDueOn: event.target.value })
            }
          />
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>What is known about this risk</span>
        <textarea
          rows={2}
          value={draft.description}
          placeholder="What somebody has seen, in enough detail for the next person"
          data-field={`${idPrefix}-description`}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>

      <fieldset className={styles.actions}>
        <legend className={styles.fieldLabel}>Actions and precautions</legend>
        {draft.actions.map((action, index) => (
          <div key={`action-${String(index)}`} className={styles.actionRow}>
            <input
              type="text"
              value={action.description}
              placeholder="What will be done about this risk"
              aria-label="What will be done about this risk"
              data-field={`${idPrefix}-action-${String(index)}`}
              onChange={(event) =>
                onChange({
                  ...draft,
                  actions: draft.actions.map((entry, position) =>
                    position === index
                      ? { ...entry, description: event.target.value }
                      : entry,
                  ),
                })
              }
            />
            <Select
              label="Who is responsible"
              placeholder="Who is responsible"
              value={action.responsible === '' ? undefined : action.responsible}
              options={carersAndSeniors.map((member) => ({
                value: member.displayName,
                label: member.displayName,
              }))}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  actions: draft.actions.map((entry, position) =>
                    position === index ? { ...entry, responsible: value } : entry,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="small"
          data-add-action={idPrefix}
          onClick={() =>
            onChange({
              ...draft,
              actions: [...draft.actions, { description: '', responsible: '' }],
            })
          }
        >
          Add another action
        </Button>
      </fieldset>
    </div>
  )
}
