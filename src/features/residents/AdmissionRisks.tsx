import { useState } from 'react'
import type { RiskLevel, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { Button } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { StatusPill } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { isScored, LEVEL_LABEL } from '@/features/risk/instrument'
import {
  RiskFields,
  emptyDraft,
  isAnswered,
  type DraftCustomRisk,
  type DraftRisk,
} from '@/features/risk/RiskFieldSet'
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
        <div className={`${styles.riskHead} ${styles.customRisksHead}`}>
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
            onClick={() => {
              onCustoms([...customs, { ...emptyDraft(admittedOn), name: '' }])
              // A row nobody can see is a row nobody fills in.
              setOpen(`custom-${String(customs.length)}`)
            }}
          >
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Add custom risk
          </Button>
        </div>

        {customs.map((custom, index) => {
          const key = `custom-${String(index)}`
          const named = custom.name.trim() !== ''
          /*
           * **Open because somebody opened it, never because of what is in it.**
           * The first version closed a row as soon as it had a name and a
           * level, which is the middle of filling one in: the description and
           * the actions are typed after the level, and the form shut in the
           * reader's face. A new row opens itself, stays open until Done, and
           * reopens on Edit — the same disclosure as the nine above it.
           */
          const isOpen = open === key
          return (
            <div key={key} className={styles.customRisk} data-custom-risk={index}>
              <div className={styles.riskHead}>
                <div className={styles.riskAbout}>
                  <p className={styles.riskName}>
                    {named ? custom.name : 'A risk outside the nine'}
                  </p>
                  <p className={styles.riskInstrument}>
                    {named
                      ? 'Recorded for this resident, outside the nine'
                      : 'Name it, and record what is known about it'}
                  </p>
                </div>

                {isAnswered(custom) ? (
                  <StatusPill
                    tone={LEVEL_TONE[custom.level as RiskLevel]}
                    label={LEVEL_LABEL[custom.level as RiskLevel]}
                  />
                ) : (
                  <Unrecorded
                    variant="chip"
                    label="Not assessed"
                    detail="nobody has recorded a level for this risk"
                  />
                )}

                <Button
                  variant="secondary"
                  size="small"
                  data-open-custom-risk={index}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? '' : key)}
                >
                  {isOpen ? 'Done' : 'Edit'}
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
                <>
                  <div className={styles.customRiskFields}>
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
                  </div>

                  <div className={styles.customRiskFoot}>
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
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
