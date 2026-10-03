/*
 * **The gate on this screen, and why there is no `permission-ok` here.**
 *
 * This file carried one, and the claim in it stopped being true the moment the
 * screen moved. It read "refused by the shell, not by this file":
 * `set_up_organisation` carried `route: '/settings/setup'`, `AppShell` refuses
 * any path matching an admin act the viewer may not perform, and `/settings`
 * is `no_access` for four of the six roles besides. All of that was correct
 * while the wizard was nested under the shell route.
 *
 * It is at `/setup` now, outside the shell, where no shell renders and neither
 * refusal runs. A screen that was unreachable for five roles would have become
 * reachable by every role that can sign in, under an opt-out comment asserting
 * it was covered — the §8 class of a comment claiming a guarantee, arriving in
 * the one place meant to stop it.
 *
 * So the gate is below, in `SetupWizardRoute` itself: signed out goes to
 * sign-in, and a signed-in viewer without the act gets the same refusal the
 * thirteen module gates give. `set_up_organisation.route` is `undefined` for
 * the same reason — a route the shell cannot reach is configuration that looks
 * like a gate.
 *
 * **The opt-out is deleted rather than reworded**, which is the part worth
 * keeping. `check-write-gates` only counts a `permission-ok` on a file that
 * asks nothing about the viewer; this file now asks, so the marker would never
 * be read again — and left in place it would have been a standing excuse
 * waiting for somebody to delete the gate, at which point the guard would have
 * counted this file as deliberate instead of failing it. The run says so:
 * deliberate opt-outs went from 2 to 1.
 */
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { Logo } from '@/components/brand/Logo'
import { Button, Card, buttonClassName } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { NoAccess } from '@/app/NoAccess'
import { actById } from '@/features/team/permissions'
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
import { type OrganisationType, type TermId } from '@/lib/vocabulary'

import { DEFAULT_BRAND_ID } from '@/lib/brand'
import { BrandControls, VocabularyControls } from './OrganisationControls'
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
  { id: 'vocabulary', name: 'What kind of service it is', required: true },
  { id: 'brand', name: 'Its colour', required: false },
  { id: 'site', name: 'Its first home', required: true },
  { id: 'templates', name: 'Risk assessments this home carries out', required: false },
  { id: 'invite', name: 'The first person to invite', required: false },
]

/**
 * The gate, and the reason it is a wrapper rather than an early return.
 *
 * The wizard below reads the session, the site and six pieces of configured
 * state before it renders anything, and hooks cannot be called conditionally —
 * so the refusal has to happen in a component that runs first and renders
 * nothing else.
 *
 * Two refusals, not one, because they are different facts. Nobody signed in
 * has not been refused: they have not been asked yet, and they go to sign-in
 * carrying where they were going, exactly as `RequireSignIn` does for the
 * product. Somebody signed in without the act **has** been refused, and gets
 * the same screen every module gate gives, naming the act and linking to what
 * they do hold.
 */
const SETUP_ACT = 'set_up_organisation' as const

export function SetupWizardRoute() {
  const { signIn } = useSession()
  const viewer = useViewer()
  const act = actById(SETUP_ACT)

  if (signIn.kind === 'signed_out') {
    return <Navigate to="/sign-in" replace state={{ from: '/setup' }} />
  }
  if (!viewer.may(SETUP_ACT)) return <NoAccess act={act} />

  return <SetupWizard />
}

function SetupWizard() {
  const { organisation, activeSite, reconfigured } = useSession()
  /* Whether there is anything to pick up from — see the header. */
  const resumed = ORDER.some((entry) => isConfirmed(entry.id) || isSkipped(entry.id))
  const [brandChoice, setBrandChoice] = useState<string>(
    brandIdAsConfigured() ?? DEFAULT_BRAND_ID,
  )
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

  const next = () => {
    const following = resumeAt(ORDER.map((entry) => entry.id))
    if (following !== undefined) setStep(following)
    bump()
  }

  return (
    <div className={styles.page} data-setup-wizard>
      <header className={styles.head}>
        {/*
         * **The mark, because the two pages before this one carry it.** Sign-in
         * renders it at 40 and verification at 32; this was the third page in
         * one outside-the-app sequence and the only one that dropped the brand,
         * immediately after the page somebody arrives from. Matching
         * verification rather than sign-in for that reason.
         */}
        <Logo height={32} title="Radiant digicare" />
        <h1 className={styles.title}>Set up {organisation.name}</h1>
        {/*
         * **Only once there is something to say, and a state rather than a
         * mechanism.** This always said "It picks up at the first step nobody
         * has confirmed or skipped" — which on a first run describes a resume
         * that is not happening, and "nobody" is strange wording for one person
         * setting up their own organisation.
         *
         * The first replacement was "Picking up where this was left", and a
         * screenshot killed it: confirm step 1 and you land on step 2 with
         * something confirmed, having left nothing. Any sentence claiming a
         * return is wrong in the middle of a first pass, because this build has
         * no way to tell the two apart — a reload clears the session entirely.
         * So it states what is true whenever it appears, and says nothing about
         * how somebody got there.
         *
         * **The wording is Frank's to settle**; this is the proposal.
         */}
        {resumed ? (
          <p className={styles.nothingRemembers} data-nothing-remembers>
            Confirmed and skipped steps are marked below.
          </p>
        ) : null}
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
            /* The one being looked at, separately from whether it is done:
               somebody can go back to a confirmed step and change it. */
            data-current={entry.id === step ? 'true' : undefined}
          >
            <button type="button" onClick={() => setStep(entry.id)}>
              <span className={styles.stepName}>
                {position + 1}. {entry.name}
              </span>
              {/*
               * **Where somebody is, not what each step demands.** Every open
               * step said "Required" or "Can be skipped" — which is the rule,
               * true before anybody starts and true after they finish, so the
               * strip described the form rather than the progress through it.
               * Past the single highlight a reader could not tell done from
               * ahead.
               *
               * Four states now, and the one being looked at says so. The rule
               * still shows, on the steps it is still a question for: once a
               * step is confirmed or skipped, whether it was required is
               * history.
               */}
              <span className={styles.stepMeta}>
                {isConfirmed(entry.id)
                  ? 'Confirmed'
                  : isSkipped(entry.id)
                    ? 'Skipped'
                    : entry.id === step
                      ? 'Doing this now'
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
            {/*
             * **No heading here, and that is the fix rather than an omission.**
             * The page title already names the organisation, the chip above
             * says "1. The organisation", and the field label says
             * "Organisation name" — so a heading reading "What the organisation
             * is called" was the same fact a third time, within 60px of the
             * label. §8's repeated-segment entry: read the screen back and look
             * for a value stated twice. The label is the one that survives,
             * because it is also the input's accessible name.
             *
             * It also stopped the step asking a question it knows the answer
             * to. The organisation has a name, the field is pre-filled with it
             * and the button says "Confirm and continue": this is a
             * confirmation, and a heading phrased as a question made it read as
             * though nothing were known.
             */}
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
                  reconfigured()
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
            <VocabularyControls
              value={{ type: orgType, subjectTermId: termId, choices: termChoices }}
              onChange={(next) => {
                setOrgType(next.type)
                setTermId(next.subjectTermId)
                setTermChoices(next.choices)
              }}
            />

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
            <BrandControls value={brandChoice} onChange={setBrandChoice} />

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
                  reconfigured()
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
        {/*
         * **"Step 1 of 6" is gone; the chips own that.** It restated a numbered
         * strip sitting directly above with one of its six highlighted — the
         * reader got the position twice and no second fact.
         */}
        <span className={styles.footerSays}>
          {requiredDone()
            ? 'The two required steps are confirmed. Anything skipped can be done from Settings or the team list at any time.'
            : 'The organisation and its first home have to be confirmed before setup is done.'}
        </span>
        {/*
         * **Always into the app, never back to Settings.** This used to offer
         * "Back to the organisation" to anybody who arrived from that tab, and
         * there is no longer such a person: the Organisation tab's button into
         * the wizard is gone, and the way in is the offer after verification.
         * Setup finishes by arriving somewhere, which is the product.
         */}
        {/*
         * **A control, not a phrase at the end of a sentence.** It was an
         * inline link appended to a sentence about what setup still requires,
         * so the only way out read as part of that requirement. §8 records a
         * way *into* a screen failing because it was styled as the text around
         * it; this is the same shape pointed at a way out.
         */}
        <Link
          to="/"
          className={buttonClassName({ variant: 'secondary' })}
          data-setup-exit
        >
          Go to the dashboard
        </Link>
      </p>
    </div>
  )
}
