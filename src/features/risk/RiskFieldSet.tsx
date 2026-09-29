import type { IsoDate, RiskFinding, RiskLevel } from '@/data/types'
import type { AdmissionRiskEntry } from '@/data/access/resident-store'
import { Button, Select } from '@/components/primitives'
import { carersAndSeniors } from '@/data/fixtures/organisation'
import { LEVEL_LABEL } from './instrument'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewIntervalMonths } from '@/data/access/settings-store'
import styles from './risk-draft.module.css'

/**
 * The fields a risk is recorded with, wherever it is recorded.
 *
 * **One field set, because there is one record.** Admission writes a risk, the
 * assessment screen re-scores one, and the resident's tab re-scores a risk
 * outside the nine: three doors into `RiskFinding`. A second set of fields for
 * any of them would be a second shape to reconcile on the way to the same
 * record, which is the defect this phase's type change exists to prevent.
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

/**
 * The date a re-score should carry, which is not always the one on the record.
 *
 * **A date already past is not a next review.** Prefilling the overdue date
 * that brought somebody to this screen would have them record an assessment
 * today that is nine days late the moment it is saved. A date still ahead is
 * kept, because somebody chose it; anything else is the interval from today,
 * which is what recording one fresh would give it.
 */
function nextDueFrom(state: RiskFinding['reviewState'], today: string): IsoDate {
  const onRecord =
    state.kind === 'never_scheduled'
      ? undefined
      : state.kind === 'completed'
        ? state.nextDueOn
        : state.dueOn
  if (onRecord !== undefined && onRecord > today) return onRecord
  return nextReviewFrom(today as IsoDate, reviewIntervalMonths())
}

function responsibleOptions(current: string): { value: string; label: string }[] {
  const listed = carersAndSeniors.map((member) => ({
    value: member.displayName,
    label: member.displayName,
  }))
  if (current === '' || listed.some((option) => option.value === current)) return listed
  return [{ value: current, label: current }, ...listed]
}

const LEVEL_OPTIONS = (['low', 'moderate', 'high'] as const).map((level) => ({
  value: level,
  label: LEVEL_LABEL[level],
}))

/** A draft filled in from a risk already on the record, for a re-score. */
export function draftFrom(finding: RiskFinding): DraftRisk {
  const today = new Date().toISOString().slice(0, 10)
  return {
    level: finding.level,
    score: finding.score.kind === 'scored' ? String(finding.score.value) : '',
    description: finding.description,
    /*
     * **Prefilled, never blank.** A re-score that starts empty and saves what
     * is on screen deletes the plan the last assessor wrote, silently, because
     * the next one did not retype it. The actions come back as they were, with
     * an empty row to add to.
     */
    actions:
      finding.actions.length === 0
        ? [{ description: '', responsible: '' }]
        : [...finding.actions.map((action) => ({ ...action }))],
    assessedOn: today,
    /*
     * The date already on the record, where there is one. A review that was
     * completed carries the next one; a risk nobody scheduled gets the
     * interval from today, which is what recording one fresh would give it.
     */
    reviewDueOn: nextDueFrom(finding.reviewState, today),
  }
}

/**
 * The fields themselves, shared by a template and a custom risk.
 *
 * One component, because the two are one record: a custom risk that took a
 * different set of fields would be a second kind of thing to reconcile on the
 * way to the resident's tab.
 */
export function RiskFields({
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
              /*
               * **Whoever is on the record is always an option.** An action
               * can name somebody who is not on this list — a maintenance
               * team, a district nurse, somebody who has since left — and a
               * Select that cannot represent the value it was given renders
               * blank, which reads as an action nobody owns.
               */
              options={responsibleOptions(action.responsible)}
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
