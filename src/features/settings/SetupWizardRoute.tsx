import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { Button, Card } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import {
  TIME_ZONES,
  setOrganisationName,
  setSiteName,
  setSiteTimeZone,
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
const ORDER: readonly { id: SetupStepId; name: string; required: boolean }[] = [
  { id: 'organisation', name: 'The organisation', required: true },
  { id: 'site', name: 'Its first home', required: true },
  { id: 'templates', name: 'Risk assessments this home carries out', required: false },
  { id: 'invite', name: 'The first person to invite', required: false },
]

export function SetupWizardRoute() {
  const { organisation, activeSite, reloadSites } = useSession()
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
          <b>Nothing remembers whether this has been done.</b> A real deployment runs it
          once, for the first Admin, on their first sign-in. This build keeps no
          accounts and forgets everything on reload, so this is a screen you can open
          whenever you like. Within this session it picks up at the first step nobody
          has confirmed or skipped.
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
              The name is all this build holds about an organisation. An address,
              country, care setting, CQC registration number and primary contact have no
              field here, so there is nowhere for them to go.
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

        {step === 'site' ? (
          <section className={styles.section} data-setup-section="site">
            <h2 className={styles.sectionTitle}>Its first home</h2>
            <p className={styles.note}>
              The home you are signed in to. Its name and timezone are the same settings
              the Settings screen changes, not a copy of them; the timezone decides what
              every clinical timestamp in this home says.
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
              Nine, all on by default. Turning one off now simply means nobody here will
              be asked it. <b>Turning one off later is different:</b> by then residents
              will have assessments against it, and those stay on file with their author
              and date while unanswered ones stop counting as gaps. It is the same
              setting, changed from Settings, at a moment when it reaches back.
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
              The same invitation Team Management sends, and they appear on the team
              list as somebody whose access has not been set up. Nothing is emailed:
              there is no mail here, and an invitation nobody receives is recorded as
              exactly that.
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
        <Link to="/settings/figures" className={styles.link}>
          Back to Settings
        </Link>
      </p>
    </div>
  )
}
