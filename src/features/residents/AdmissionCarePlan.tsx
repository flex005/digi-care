import { useState } from 'react'
import type { CarePlanDomainId, CarePlanText } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { Button } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useTerm, useTerms } from '@/app/session/use-term'
import {
  CarePlanTextFields,
  emptyText,
  isWritten,
} from '@/features/care-plan/CarePlanTextFields'
import styles from './admission.module.css'

/**
 * Care plan domains at admission. AM v2.0 step 5, Phase 31.
 *
 * The sentence: **what somebody already knows about how this person wants to
 * be looked after, written down on the day rather than retyped later.**
 *
 * **Drafts, never signed versions.** Finalising is what makes a version the
 * instruction staff follow, and nobody can say that on the day somebody
 * arrives: it is signed from the resident's own tab, later, by whoever has
 * worked with them. So a domain written here reads as part-written on every
 * screen — the care plan queue still leads on it as never signed, which is
 * true — and the tab is where it becomes what staff follow.
 *
 * **Nothing here is required and nothing is defaulted.** A domain nobody
 * touches stays never started, which is not "no needs here", and the step's own
 * claim says so rather than implying a blank is fine.
 */
export function AdmissionCarePlan({
  name,
  drafts,
  onDraft,
  customs,
  onCustoms,
}: {
  name: string
  drafts: Partial<Record<CarePlanDomainId, CarePlanText>>
  onDraft: (id: CarePlanDomainId, text: CarePlanText) => void
  customs: (CarePlanText & { name: string })[]
  onCustoms: (next: (CarePlanText & { name: string })[]) => void
}) {
  const term = useTerm()
  const terms = useTerms()
  const [open, setOpen] = useState<string>('')
  const started = CARE_PLAN_DOMAINS.filter((domain) => {
    const text = drafts[domain.id]
    return text !== undefined && isWritten(text)
  }).length

  return (
    <div className={styles.risks} data-admission-care-plan>
      <p className={styles.sectionNote} data-plan-claim>
        <span data-numeric>{started}</span> of{' '}
        <span data-numeric>{CARE_PLAN_DOMAINS.length}</span> started. What you write
        here is a draft, signed later from {name}&rsquo;s {terms.carePlan.one}. A domain
        left alone stays never written, which is not &ldquo;no needs here&rdquo;.
      </p>

      <ul className={styles.riskList}>
        {CARE_PLAN_DOMAINS.map((domain) => {
          const text = drafts[domain.id] ?? emptyText()
          const isOpen = open === domain.id
          return (
            <li key={domain.id} className={styles.riskItem} data-domain={domain.id}>
              {/* The state is outside the disclosure, as on the risk step: a
                  closed row that does not say whether it has anything in it is
                  indistinguishable from one that has nothing. */}
              <div className={styles.riskHead}>
                <div className={styles.riskAbout}>
                  <p className={styles.riskName}>{domain.name}</p>
                  <p className={styles.riskInstrument}>
                    {isWritten(text)
                      ? 'Started, and nothing signed yet'
                      : 'Nobody has written this down'}
                  </p>
                </div>

                {isWritten(text) ? (
                  <span className={styles.planStarted} data-plan-state="draft">
                    Draft
                  </span>
                ) : (
                  <Unrecorded
                    variant="chip"
                    label="Never written"
                    detail="nobody has written this part of the plan"
                  />
                )}

                <Button
                  variant="secondary"
                  size="small"
                  data-open-domain={domain.id}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? '' : domain.id)}
                >
                  {isOpen ? 'Done' : isWritten(text) ? 'Edit' : 'Write'}
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
                <div className={styles.customRiskFields}>
                  <CarePlanTextFields
                    idPrefix={domain.id}
                    text={text}
                    onChange={(next) => onDraft(domain.id, next)}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className={styles.customRisks} data-custom-domains={customs.length}>
        <div className={`${styles.riskHead} ${styles.customRisksHead}`}>
          <div className={styles.riskAbout}>
            <p className={styles.riskName}>Domains outside the ten</p>
            {/*
             * Said where somebody is about to add one. The ten are what every
             * home is expected to hold and what every "of 10" figure counts; a
             * domain written here belongs to this resident, and is counted in
             * its own sentence on their own tab.
             */}
            <p className={styles.riskInstrument}>
              Written for {name} and counted separately from the ten.
            </p>
          </div>
          <Button
            variant="secondary"
            size="small"
            data-add-custom-domain
            onClick={() => {
              onCustoms([...customs, { ...emptyText(), name: '' }])
              setOpen(`custom-${String(customs.length)}`)
            }}
          >
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Add custom domain
          </Button>
        </div>

        {customs.map((custom, index) => {
          const key = `custom-${String(index)}`
          const named = custom.name.trim() !== ''
          const isOpen = open === key
          return (
            <div key={key} className={styles.customRisk} data-custom-domain={index}>
              <div className={styles.riskHead}>
                <div className={styles.riskAbout}>
                  <p className={styles.riskName}>
                    {named ? custom.name : 'A domain outside the ten'}
                  </p>
                  <p className={styles.riskInstrument}>
                    {named
                      ? `Written for this ${term.one}, outside the ten`
                      : 'Name it, and write what is known about it'}
                  </p>
                </div>

                {isWritten(custom) ? (
                  <span className={styles.planStarted} data-plan-state="draft">
                    Draft
                  </span>
                ) : (
                  <Unrecorded
                    variant="chip"
                    label="Never written"
                    detail="nobody has written this part of the plan"
                  />
                )}

                <Button
                  variant="secondary"
                  size="small"
                  data-open-custom-domain={index}
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
                      <span className={styles.fieldLabel}>What this domain is</span>
                      <input
                        type="text"
                        value={custom.name}
                        placeholder="The allotment"
                        data-field={`custom-domain-name-${String(index)}`}
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

                    <CarePlanTextFields
                      idPrefix={`custom-domain-${String(index)}`}
                      text={custom}
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
                      data-remove-custom-domain={index}
                      onClick={() =>
                        onCustoms(customs.filter((_, position) => position !== index))
                      }
                    >
                      Remove this domain
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
