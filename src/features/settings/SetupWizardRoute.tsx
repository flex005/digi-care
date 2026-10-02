/*
 * permission-ok: refused by the shell, not by this file. `set_up_organisation`
 * carries `route: '/settings/setup'`, and `AppShell` refuses any route that
 * matches an admin act the viewer may not perform — so this screen is already
 * unreachable for every role but the registered person. `/settings` is also
 * `no_access` for four of the six roles, which covers it a second time.
 */
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { Button, Card, Select } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import {
  TIME_ZONES,
  setOrganisationName,
  setSiteName,
  setSiteTimeZone,
  setOrganisationType,
  setSubjectTerm,
  setTermChoice,
  chosenTermsAsConfigured,
  organisationTypeAsConfigured,
  subjectTermIdAsConfigured,
  setBrand,
  brandIdAsConfigured,
} from '@/data/access/settings-store'
import { isActive, setActive } from '@/data/access/site-config-store'
import {
  type SetupStepId,
  confirmStep,
  isConfirmed,
  isSkipped,
  requiredDone,
  resumeAt,
  skipStep,
} from '@/data/access/setup-store'
import { teamMembers } from '@/data/access/team-store'
import { InviteDrawer } from '@/features/team/InviteDrawer'
import { cameFromOrganisation } from './setup-origin'
import {
  ORGANISATION_TYPES,
  TERM_IDS,
  TERM_OPTIONS,
  type OrganisationType,
  type TermId,
} from '@/lib/vocabulary'

/** What each term is called on the form that chooses it. */
const TERM_LABELS: Record<TermId, string> = {
  subject: 'The people this service holds records about',
  carePlan: 'The plan of their care',
  staff: 'The people who work here',
  manager: 'The person who runs the service',
  admission: 'Somebody joining the service',
  incidentReport: 'A record of something that went wrong',
  medication: 'What is given and signed for',
  assessment: 'A judgement recorded about somebody',
  family: 'The people close to them',
}
import {
  BRAND_OPTIONS,
  BRAND_STEPS,
  DEFAULT_BRAND_ID,
  brandOptionById,
  brandRampHex,
} from '@/lib/brand'
import styles from './setup.module.css'

/**
 * Setting up the organisation. AM v2.0 AUTH-05, Phase 23.
 *
 * **Four steps, and the wizard owns none of what it writes.** The organisation
 * and site names go through the settings store, the templates through the
 * site configuration Phase 22 built, and the first invitation through the same
 * drawer Team Management uses. A wizard with its own copies would be a second
 * record of each, and the settings screen would then disagree with setup about
 * what the home is.
 *
 * **It does not run once, and it says so.** AM v2.0 runs it on the first
 * Admin's first login. This build has no accounts and forgets everything on
 * reload, so a "has run" flag would live in the tab and reset with it — a flag
 * describing the tab rather than the organisation. The wizard is a screen you
 * can open, it resumes within a session at the first step nobody confirmed or
 * skipped, and nothing remembers it past a reload.
 */
/** The id of the term a type defaults to, so the Select shows it selected. */
const defaultTermIdFor = (type: OrganisationType): string =>
  type === 'hospital' ? 'patient' : type === 'clinic' ? 'client' : 'resident'

const ORDER: readonly { id: SetupStepId; name: string; required: boolean }[] = [
  { id: 'organisation', name: 'The organisation', required: true },
  { id: 'vocabulary', name: 'What kind of service it is', required: true },
  { id: 'brand', name: 'Its colour', required: false },
  { id: 'site', name: 'Its first home', required: true },
  { id: 'templates', name: 'Risk assessments this home carries out', required: false },
  { id: 'invite', name: 'The first person to invite', required: false },
]

export function SetupWizardRoute() {
  const { organisation, activeSite, reloadSites } = useSession()
  const [brandChoice, setBrandChoice] = useState<string>(
    brandIdAsConfigured() ?? DEFAULT_BRAND_ID,
  )
  /* The swatches follow the control immediately, so a reader sees the ramp
     they are choosing rather than the one they already have. */
  const previewRamp = brandRampHex(brandOptionById(brandChoice).hue)
  const fromOrganisation = cameFromOrganisation(useLocation().state)
  const [orgType, setOrgType] = useState<OrganisationType>(
    organisationTypeAsConfigured(),
  )
  const [termId, setTermId] = useState<string | undefined>(subjectTermIdAsConfigured())
  const [termChoices, setTermChoices] = useState<Partial<Record<TermId, string>>>(
    chosenTermsAsConfigured,
  )
  const [step, setStep] = useState<SetupStepId>(
    () => resumeAt(ORDER.map((entry) => entry.id)) ?? 'organisation',
  )
  const [, setVersion] = useState(0)
  const bump = () => setVersion((count) => count + 1)

  const [orgName, setOrgName] = useState(organisation.name)
  const [siteName, setSiteNameDraft] = useState(activeSite.name)
  const [zone, setZone] = useState(activeSite.timeZone)
  const [invitedBefore] = useState(() => teamMembers().length)

  const index = ORDER.findIndex((entry) => entry.id === step)
  const next = () => {
    const following = resumeAt(ORDER.map((entry) => entry.id))
    if (following !== undefined) setStep(following)
    bump()
  }

  return (
    <div className={styles.page} data-setup-wizard>
      <header className={styles.head}>
        <h1 className={styles.title}>Set up {organisation.name}</h1>
        {/*
         * First and plain, because "first login only" is a claim this build
         * cannot keep, and a reader told nothing would reasonably believe
         * finishing here means it will not appear again.
         */}
        <p className={styles.nothingRemembers} data-nothing-remembers>
          It picks up at the first step nobody has confirmed or skipped.
        </p>
      </header>

      <ol className={styles.steps} data-setup-steps>
        {ORDER.map((entry, position) => (
          <li
            key={entry.id}
            className={entry.id === step ? styles.stepOn : styles.step}
            data-setup-step={entry.id}
            data-state={
              isConfirmed(entry.id)
                ? 'confirmed'
                : isSkipped(entry.id)
                  ? 'skipped'
                  : 'open'
            }
          >
            <button type="button" onClick={() => setStep(entry.id)}>
              <span className={styles.stepName}>
                {position + 1}. {entry.name}
              </span>
              <span className={styles.stepMeta}>
                {isConfirmed(entry.id)
                  ? 'Confirmed'
                  : isSkipped(entry.id)
                    ? 'Skipped'
                    : entry.required
                      ? 'Required'
                      : 'Can be skipped'}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card>
        {step === 'organisation' ? (
          <section className={styles.section} data-setup-section="organisation">
            <h2 className={styles.sectionTitle}>What the organisation is called</h2>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Organisation name</span>
              <input
                type="text"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                data-field="organisation-name"
              />
            </label>
            {/*
             * Named rather than silently omitted: somebody who has read AUTH-05
             * will look for these, and a step that quietly drops them reads as
             * a step that forgot them.
             */}
            <p className={styles.note} data-not-held-here>
              The name is all diGi-Care holds about an organisation.
            </p>
            <div className={styles.actions}>
              <Button
                disabled={orgName.trim() === ''}
                data-confirm-step="organisation"
                onClick={() => {
                  setOrganisationName(orgName)
                  reloadSites()
                  confirmStep('organisation')
                  next()
                }}
              >
                Confirm and continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'vocabulary' ? (
          <section className={styles.section} data-setup-section="vocabulary">
            <h2 className={styles.sectionTitle}>What kind of service it is</h2>
            {/*
             * **The type picks the word, and the word is separately
             * changeable.** A clinic may well say "Service User", so the type
             * sets a default rather than a lock — and choosing a type clears
             * an earlier override, because otherwise the control would do
             * nothing for somebody who changed their mind.
             */}
            <div className={styles.choices} role="radiogroup" aria-label="Service type">
              {ORGANISATION_TYPES.map((entry) => (
                <label
                  key={entry.id}
                  className={orgType === entry.id ? styles.choiceOn : styles.choice}
                  data-org-type={entry.id}
                >
                  <input
                    type="radio"
                    name="organisation-type"
                    checked={orgType === entry.id}
                    onChange={() => {
                      setOrgType(entry.id)
                      /*
                       * The type picks the subject's default, so an earlier
                       * override of THAT term goes — otherwise the control
                       * does nothing for somebody who changed their mind. The
                       * other eight are untouched: they have nothing to do
                       * with the type.
                       */
                      setTermId(undefined)
                      setTermChoices((current) => {
                        const next = { ...current }
                        delete next.subject
                        return next
                      })
                    }}
                  />
                  {entry.name}
                </label>
              ))}
            </div>

            {/*
              No wrapping `<label>`: `Select` is a Radix combobox rather than a
              native control, so a label around it associates with nothing — it
              carries its own `label` prop, which is the association.

              One Select per term. The subject comes first because the type
              above picks its default; the rest default to their own first
              option and are changed only by somebody who wants to.
            */}
            {TERM_IDS.map((id) => (
              <div className={styles.field} key={id} data-term-choice={id}>
                <Select
                  labelVisible
                  label={TERM_LABELS[id]}
                  placeholder="Choose a word"
                  value={
                    id === 'subject'
                      ? (termId ?? defaultTermIdFor(orgType))
                      : (termChoices[id] ?? TERM_OPTIONS[id][0]!.id)
                  }
                  onValueChange={(value) => {
                    if (id === 'subject') setTermId(value)
                    setTermChoices((current) => ({ ...current, [id]: value }))
                  }}
                  options={TERM_OPTIONS[id].map((entry) => ({
                    value: entry.id,
                    label: entry.label,
                  }))}
                />
              </div>
            ))}

            <p className={styles.note}>
              These appear on every screen: headings, labels and tab names. Words
              somebody has already written into a record are not changed, and neither
              are statutory titles like Registered manager.
            </p>

            <div className={styles.actions}>
              <Button
                data-confirm-step="vocabulary"
                onClick={() => {
                  setOrganisationType(orgType)
                  if (termId !== undefined) setSubjectTerm(termId)
                  for (const [id, choice] of Object.entries(termChoices)) {
                    setTermChoice(id as TermId, choice)
                  }
                  confirmStep('vocabulary')
                  next()
                }}
              >
                Confirm and continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'brand' ? (
          <section className={styles.section} data-setup-section="brand">
            <h2 className={styles.sectionTitle}>Its colour</h2>
            {/*
             * **Accents and actions, and nothing else.** The hue reaches the
             * primary action, the active nav, the focus ring, chart series,
             * tints and the deep header. It does not reach body text, which is
             * a neutral, and it does not reach a single status colour: red,
             * amber and green mean what they mean, and a home cannot configure
             * its way out of the vocabulary this product is built on.
             */}
            <div className={styles.field} data-brand-choice>
              <Select
                labelVisible
                label="Brand colour"
                placeholder="Choose a colour"
                value={brandChoice}
                onValueChange={setBrandChoice}
                options={BRAND_OPTIONS.map((entry) => ({
                  value: entry.id,
                  label: entry.label,
                }))}
              />
            </div>

            {/*
             * The ramp, shown rather than described. Five swatches is the
             * cheapest honest answer to "what will this look like", and the
             * one thing a name cannot give: a teal and a magenta at the same
             * lightness look very different, and only one of them is vivid.
             */}
            <div className={styles.swatches} data-brand-preview>
              {BRAND_STEPS.map((step_) => (
                <span key={step_} className={styles.swatch} data-swatch={step_}>
                  <span
                    className={styles.swatchBlock}
                    style={{ background: previewRamp[step_] }}
                  />
                  <span className={styles.swatchLabel}>{step_}</span>
                </span>
              ))}
            </div>

            <p className={styles.note}>
              Every colour that carries a clinical meaning stays exactly as it is: red,
              amber, green, and the hatch that says nobody has recorded something. This
              changes accents and actions. Body text does not move.
            </p>

            <div className={styles.actions}>
              <Button
                data-confirm-step="brand"
                onClick={() => {
                  setBrand(brandChoice)
                  confirmStep('brand')
                  next()
                }}
              >
                Confirm and continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'site' ? (
          <section className={styles.section} data-setup-section="site">
            <h2 className={styles.sectionTitle}>Its first home</h2>
            <p className={styles.note}>
              The home you are signed in to. Its timezone decides what every clinical
              timestamp in it says.
            </p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Home name</span>
              <input
                type="text"
                value={siteName}
                onChange={(event) => setSiteNameDraft(event.target.value)}
                data-field="site-name"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Timezone</span>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                data-field="site-timezone"
              >
                {TIME_ZONES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <Button
                disabled={siteName.trim() === ''}
                data-confirm-step="site"
                onClick={() => {
                  setSiteName(activeSite.id, siteName.trim())
                  setSiteTimeZone(activeSite.id, zone)
                  reloadSites()
                  confirmStep('site')
                  next()
                }}
              >
                Confirm and continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'templates' ? (
          <section className={styles.section} data-setup-section="templates">
            <h2 className={styles.sectionTitle}>
              Risk assessments this home carries out
            </h2>
            {/*
             * **Two states here, not four.** At setup nobody has an assessment
             * against any template, so a template is either carried out or it is
             * not. The four-state rendering on the Settings screen exists because
             * turning one off later changes what an existing record says; that
             * cannot happen to a home with no records, and pretending otherwise
             * would describe states that do not exist.
             *
             * The note says what turning one off later will mean, because it is
             * not the same experience even though it is the same setting.
             */}
            <p className={styles.note} data-retire-later>
              Nine, all on by default; turning one off means nobody here will be asked
              it.
            </p>
            <ul className={styles.templates}>
              {RISK_ASSESSMENT_TEMPLATES.map((template) => {
                const on = isActive(activeSite.id, template.id)
                return (
                  <li
                    key={template.id}
                    className={styles.template}
                    data-template={template.id}
                  >
                    <label
                      className={styles.templateLabel}
                      htmlFor={`setup-${template.id}`}
                    >
                      <input
                        id={`setup-${template.id}`}
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          setActive(activeSite.id, template.id, !on)
                          bump()
                        }}
                        data-template-toggle={template.id}
                      />
                      {template.name}
                    </label>
                    <span
                      className={styles.templateState}
                      data-template-state={on ? 'on' : 'off'}
                    >
                      {on ? 'Carried out here' : 'Not carried out here'}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className={styles.actions}>
              <Button
                data-confirm-step="templates"
                onClick={() => {
                  confirmStep('templates')
                  next()
                }}
              >
                Confirm and continue
              </Button>
              <Button
                variant="secondary"
                data-skip-step="templates"
                onClick={() => {
                  skipStep('templates')
                  next()
                }}
              >
                Skip for now
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'invite' ? (
          <section className={styles.section} data-setup-section="invite">
            <h2 className={styles.sectionTitle}>The first person to invite</h2>
            {/*
             * The Team Management drawer itself, not a form made to look like
             * it. Somebody invited here is the same person on the team list,
             * with the same never-set-up standing, and the pending-invitations
             * banner counts them — which a second form writing its own record
             * would not.
             */}
            <p className={styles.note}>
              They appear on the team list with access not set up, and nothing is
              emailed to them.
            </p>
            <InviteDrawer onAdded={bump} />
            {teamMembers().length > invitedBefore ? (
              <p className={styles.note} data-invited-here>
                {teamMembers().length - invitedBefore === 1
                  ? 'One person added to the team during setup.'
                  : `${teamMembers().length - invitedBefore} people added to the team during setup.`}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button
                data-confirm-step="invite"
                onClick={() => {
                  confirmStep('invite')
                  next()
                }}
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                data-skip-step="invite"
                onClick={() => {
                  skipStep('invite')
                  next()
                }}
              >
                Skip for now
              </Button>
            </div>
          </section>
        ) : null}
      </Card>

      <p
        className={styles.footer}
        data-setup-state={requiredDone() ? 'required-done' : 'required-open'}
      >
        {requiredDone()
          ? 'The two required steps are confirmed. Anything skipped can be done from Settings or the team list at any time.'
          : `Step ${index + 1} of ${ORDER.length}. The organisation and its first home have to be confirmed before setup is done.`}{' '}
        {fromOrganisation ? (
          <Link to="/settings/organisation" className={styles.link} data-setup-exit>
            Back to the organisation
          </Link>
        ) : (
          <Link to="/" className={styles.link} data-setup-exit>
            Go to the dashboard
          </Link>
        )}
      </p>
    </div>
  )
}
