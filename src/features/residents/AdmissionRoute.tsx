import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  Allergy,
  AllergyStatus,
  GenderAnswer,
  IsoDate,
  IsoDateTime,
  SiteId,
  StaffRef,
} from '@/data/types'
import { GENDER_ANSWERS } from '@/data/types'
import { admit, fileDocument } from '@/data/access/client'
import { ADMISSION_GAPS, ALLERGY_SOURCES } from '@/data/access/resident-store'
import { useSession } from '@/app/session/use-session'
import { Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import styles from './admission.module.css'

/**
 * Admitting a resident. PRD §6.7, Phase 16.
 *
 * The sentence: **who this person is and which home they are joining, then the
 * one thing it is dangerous not to ask, then plainly that everything else
 * starts unrecorded and where each of those is recorded.**
 *
 * **Six fields and one question.** Anything more asks somebody to guess on the
 * day they know least, and a guess entered on day one is indistinguishable
 * from a fact for as long as the record lasts.
 */
type AllergyAnswer = 'unanswered' | 'recorded' | 'none_known' | 'not_known'

/**
 * The five steps. AM v2.0's RES-01, and which of them a person has to answer.
 *
 * **Step 1 is required and the other four are not.** The source PRD marks
 * step 2 required too, and this strip said so from Phase 24 while nothing on
 * step 2 was required and nothing gated on it: a label claiming a rule the
 * form did not have. `required` here is now asserted by behaviour, not by its
 * text — a step labelled required cannot be left blank, and a step labelled
 * as able to wait can be passed with every field empty.
 *
 * A name, a date of birth and a home are knowable on the day, and a diagnosis
 * frequently is not. A form that requires one on admission day will get one
 * invented, and an invented diagnosis is indistinguishable from a recorded one
 * for as long as the record lasts.
 */
const STEPS = [
  { id: 'who', name: 'Personal details', required: true },
  { id: 'contact', name: 'Contact and GP', required: false },
  { id: 'clinical', name: 'Clinical overview', required: false },
  { id: 'flags', name: 'Risk flags and documents', required: false },
  { id: 'plan', name: 'Care plan and assessments', required: false },
] as const

export function AdmissionRoute() {
  const { sites, activeSite, currentUser } = useSession()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)

  /* Steps 2 to 5. Every one optional, every blank an unrecorded field. */
  const [gender, setGender] = useState<GenderAnswer | ''>('')
  const [pronouns, setPronouns] = useState('')
  const [nhsNumber, setNhsNumber] = useState('')
  const [primaryLanguage, setPrimaryLanguage] = useState('')
  const [kinName, setKinName] = useState('')
  const [kinRelationship, setKinRelationship] = useState('')
  const [kinPhone, setKinPhone] = useState('')
  const [gpName, setGpName] = useState('')
  const [gpPractice, setGpPractice] = useState('')
  const [gpPhone, setGpPhone] = useState('')
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('')
  const [dietaryRequirements, setDietaryRequirements] = useState('')

  const [fullLegalName, setFullLegalName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [admittedOn, setAdmittedOn] = useState(today())
  const [siteId, setSiteId] = useState<SiteId>(activeSite.id)
  const [room, setRoom] = useState('')

  const [answer, setAnswer] = useState<AllergyAnswer>('unanswered')
  const [substance, setSubstance] = useState('')
  const [reaction, setReaction] = useState('')
  const [severity, setSeverity] = useState<Allergy['severity'] | ''>('')
  const [source, setSource] = useState('')

  /*
   * A DNAR form to file once the resident exists, by format. No file is kept in
   * this build, and the step says so beside the control.
   */
  const [dnar, setDnar] = useState<
    { kind: 'none' } | { kind: 'chosen'; format: string }
  >({
    kind: 'none',
  })

  const site = sites.find((entry) => entry.id === siteId) ?? activeSite
  const name = preferredName.trim() || fullLegalName.trim() || 'this resident'

  const waiting: string[] = []
  if (fullLegalName.trim() === '') waiting.push('their full legal name')
  if (dateOfBirth === '') waiting.push('their date of birth')
  if (answer === 'unanswered') waiting.push('the allergies question')
  if (
    answer === 'recorded' &&
    (substance.trim() === '' || reaction.trim() === '' || severity === '')
  ) {
    waiting.push('what they are allergic to, what happens and how badly')
  }
  // The source is what stops the negative becoming pressure to answer.
  if (answer === 'none_known' && source === '') waiting.push('who said there are none')

  /*
   * **Every requirement is on step 1**, so step 1 being answered is what opens
   * the others. Nothing past it can hold the form up.
   */
  const reachable = (index: number) => index === 0 || waiting.length === 0

  const submit = () => {
    if (waiting.length > 0) return
    void admit({
      fullLegalName,
      preferredName,
      dateOfBirth: dateOfBirth as IsoDate,
      admittedOn: admittedOn as IsoDate,
      siteId,
      room,
      allergies: allergyStatusFrom({
        answer,
        substance,
        reaction,
        severity,
        by: currentUser,
      }),
      admittedBy: currentUser,

      /*
       * **Everything from step 2 on, and every one of them may be blank.** A
       * blank is passed through as absent and the store records it as
       * unrecorded rather than as an empty string: a cleared field and a
       * skipped field are the same fact about this resident, and neither is a
       * value somebody typed.
       */
      gender: gender === '' ? undefined : gender,
      pronouns,
      nhsNumber,
      primaryLanguage,
      primaryDiagnosis,
      dietaryRequirements,
      nextOfKin:
        kinName.trim() === ''
          ? undefined
          : { name: kinName, relationship: kinRelationship, phone: kinPhone },
      gp:
        gpName.trim() === ''
          ? undefined
          : { name: gpName, practice: gpPractice, phone: gpPhone },
    }).then(async (resident) => {
      /*
       * **Filed, and the decision still not recorded.** The document goes on
       * the resident's record under Legal and authority, where the fixtures
       * file every DNAR form; `futurePlans.resuscitation` is not touched,
       * because that decision carries a clinician's signature this form does
       * not capture.
       */
      if (dnar.kind === 'chosen') {
        await fileDocument({
          owner: { kind: 'resident', residentId: resident.id },
          category: 'legal_authority',
          title: 'DNAR form',
          format: dnar.format,
          expiry: { kind: 'not_recorded' },
          filedBy: currentUser,
          filedOn: admittedOn as IsoDate,
        })
      }
      navigate(`/residents/${resident.id}`)
    })
  }

  return (
    <div className={styles.page} data-admission>
      <Link to="/residents" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        All residents
      </Link>

      <header>
        <h1 className={styles.pageTitle}>Admit a resident</h1>
        <p className={styles.pageSubtitle}>
          Five steps, and only the first is required. Everything after it can be left
          for the day somebody knows the answer: a blank here is recorded as nobody
          having recorded it, and every screen shows it as the gap it is from the first
          minute.
        </p>

        {/*
         * **The step indicator says which are required, which is the whole of
         * the disagreement with the form this replaces.** That one asked six
         * fields on the argument that anything more asks somebody to guess on
         * the day they know least. The five steps overrule it; the reasoning
         * survives as the rule that nothing past step 1 is required and that a
         * guess is never the easier answer than a blank.
         */}
        <ol className={styles.steps} data-steps>
          {STEPS.map((entry, index) => (
            <li
              key={entry.id}
              className={step === index ? styles.stepOn : styles.step}
              data-step={entry.id}
              data-required={entry.required ? 'yes' : 'no'}
              data-current={step === index ? 'yes' : undefined}
            >
              <button
                type="button"
                disabled={!reachable(index)}
                onClick={() => setStep(index)}
              >
                <span className={styles.stepName}>{entry.name}</span>
                <span className={styles.stepNeed}>
                  {entry.required ? 'Required' : 'Can wait'}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <Card>
        {step === 0 ? (
          <>
            <section className={styles.section} data-section="who">
              <h2 className={styles.sectionTitle}>Who they are</h2>
              <div className={styles.two}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Full legal name</span>
                  <input
                    type="text"
                    value={fullLegalName}
                    onChange={(event) => setFullLegalName(event.target.value)}
                    data-field="full-legal-name"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Preferred name</span>
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(event) => setPreferredName(event.target.value)}
                    data-field="preferred-name"
                  />
                  {/* Blank is a real answer, and it stays blank. */}
                  <span className={styles.hint}>
                    What staff will call them. If they have not said yet, leave it
                    blank, it renders as not recorded rather than defaulting to their
                    legal name.
                  </span>
                </label>
              </div>

              <div className={styles.two}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Date of birth</span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    data-field="date-of-birth"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Admission date</span>
                  <input
                    type="date"
                    value={admittedOn}
                    onChange={(event) => setAdmittedOn(event.target.value)}
                    data-field="admitted-on"
                  />
                </label>
              </div>
            </section>

            <section className={styles.section} data-section="where">
              <h2 className={styles.sectionTitle}>Where they are</h2>
              <div className={styles.two}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Home</span>
                  <select
                    value={siteId}
                    onChange={(event) => setSiteId(event.target.value as SiteId)}
                    data-field="site"
                  >
                    {sites.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>
                    This decides the timezone every clinical record for {name} will be
                    written and read in, for as long as they are here, {site.timeZone}.
                  </span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Room</span>
                  <input
                    type="text"
                    value={room}
                    onChange={(event) => setRoom(event.target.value)}
                    data-field="room"
                  />
                </label>
              </div>
            </section>

            <section className={styles.section} data-section="allergies">
              <h2 className={styles.sectionTitle}>
                The one thing it is dangerous not to ask
              </h2>

              <div className={styles.allergyBox} data-allergy-question>
                <p className={styles.allergyTitle}>Does {name} have any allergies?</p>
                <p className={styles.allergyBody}>
                  Their first medication round may happen before anybody asks again.
                  This is the only clinical question on this form, and it is here
                  because not asking it today is the version that hurts somebody.
                </p>

                <div className={styles.choices}>
                  <label className={styles.choice} data-allergy-choice="recorded">
                    <input
                      type="radio"
                      name="allergies"
                      checked={answer === 'recorded'}
                      onChange={() => setAnswer('recorded')}
                    />
                    <b>Yes: record them</b>
                    <span className={styles.choiceHint}>
                      What they are allergic to, and what happens. Both appear on every
                      medication screen from now on.
                    </span>
                  </label>

                  {answer === 'recorded' ? (
                    <div className={styles.nested}>
                      <div className={styles.two}>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Allergic to</span>
                          <input
                            type="text"
                            value={substance}
                            onChange={(event) => setSubstance(event.target.value)}
                            data-field="allergy-substance"
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>What happens</span>
                          <input
                            type="text"
                            value={reaction}
                            onChange={(event) => setReaction(event.target.value)}
                            data-field="allergy-reaction"
                          />
                        </label>
                      </div>
                      {/*
                       * **Not a seventh field.** It is part of the one clinical
                       * question, and the type has always required it: "rash and
                       * swelling" without saying whether that is mild or
                       * anaphylaxis is the half-record this build refuses, on the
                       * field where the difference is whether somebody carries an
                       * adrenaline pen.
                       */}
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>How bad it gets</span>
                        <select
                          value={severity}
                          onChange={(event) =>
                            setSeverity(event.target.value as Allergy['severity'] | '')
                          }
                          data-field="allergy-severity"
                        >
                          <option value="">Choose</option>
                          <option value="mild">Mild</option>
                          <option value="moderate">Moderate</option>
                          <option value="severe">Severe</option>
                          <option value="anaphylaxis">Anaphylaxis</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <label className={styles.choice} data-allergy-choice="none_known">
                    <input
                      type="radio"
                      name="allergies"
                      checked={answer === 'none_known'}
                      onChange={() => setAnswer('none_known')}
                    />
                    <b>No known allergies</b>
                    <span className={styles.choiceHint}>
                      A recorded negative, not a blank, and it needs a source, because
                      &ldquo;no known allergies&rdquo; with nobody&rsquo;s name on it is
                      a guess wearing a record.
                    </span>
                  </label>

                  {answer === 'none_known' ? (
                    <div className={styles.nested}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Who said so</span>
                        <select
                          value={source}
                          onChange={(event) => setSource(event.target.value)}
                          data-field="allergy-source"
                        >
                          <option value="">Choose a source</option>
                          {ALLERGY_SOURCES.map((entry) => (
                            <option key={entry} value={entry}>
                              {entry}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <label className={styles.choice} data-allergy-choice="not_known">
                    <input
                      type="radio"
                      name="allergies"
                      checked={answer === 'not_known'}
                      onChange={() => setAnswer('not_known')}
                    />
                    <b>Not known yet</b>
                    <span className={styles.choiceHint}>
                      Nobody has been able to find out. Honest, and it will render as a
                      gap on every screen until somebody does.
                    </span>
                  </label>

                  {answer === 'not_known' ? (
                    <div
                      className={styles.hatchNote}
                      data-not-known-note
                      data-state="unrecorded"
                    >
                      Choosing this renders <b>allergies not recorded</b> on {name}
                      &rsquo;s profile header, on every medication screen and on the
                      round: hatched, from the first minute.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/*
             * Steps 2 to 5. Every field optional, and each step says what leaving
             * it blank means rather than leaving somebody to infer it.
             */}
            <section className={styles.section} data-section="identity-more">
              <h2 className={styles.sectionTitle}>More about them</h2>
              <p className={styles.sectionNote}>
                None of this is required. Anything left blank is recorded as nobody
                having recorded it, which is what it is.
              </p>

              <div className={styles.two}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Gender</span>
                  {/*
                   * **"Prefers not to say" sits with the other three, not with the
                   * blank.** Somebody who declined was asked and chose; somebody
                   * nobody has asked is a hole in the record. Both look like
                   * nothing being known and only one of them is still owed.
                   */}
                  <div className={styles.choices} data-gender-choices>
                    {GENDER_ANSWERS.map((entry) => (
                      <label
                        key={entry.id}
                        htmlFor={`gender-${entry.id}`}
                        className={styles.choice}
                        data-gender-option={entry.id}
                      >
                        <input
                          id={`gender-${entry.id}`}
                          type="radio"
                          name="gender"
                          checked={gender === entry.id}
                          onChange={() => setGender(entry.id)}
                        />
                        {entry.label}
                      </label>
                    ))}
                  </div>
                  {gender === '' ? (
                    <span className={styles.hint} data-gender-blank>
                      Nobody has asked yet, which is different from somebody preferring
                      not to say.
                    </span>
                  ) : null}
                </div>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Pronouns</span>
                  <input
                    type="text"
                    value={pronouns}
                    onChange={(event) => setPronouns(event.target.value)}
                    data-field="pronouns"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>NHS number</span>
                  <input
                    type="text"
                    value={nhsNumber}
                    onChange={(event) => setNhsNumber(event.target.value)}
                    data-field="nhs-number"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Main language</span>
                  <input
                    type="text"
                    value={primaryLanguage}
                    onChange={(event) => setPrimaryLanguage(event.target.value)}
                    data-field="primary-language"
                  />
                </label>
              </div>
            </section>
          </>
        ) : null}

        {step === 1 ? (
          <section className={styles.section} data-section="contact">
            <h2 className={styles.sectionTitle}>Who to ring, and their GP</h2>
            <div className={styles.two}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Next of kin</span>
                <input
                  type="text"
                  value={kinName}
                  onChange={(event) => setKinName(event.target.value)}
                  data-field="kin-name"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Their relationship</span>
                <input
                  type="text"
                  value={kinRelationship}
                  onChange={(event) => setKinRelationship(event.target.value)}
                  data-field="kin-relationship"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Their telephone number</span>
                <input
                  type="tel"
                  value={kinPhone}
                  onChange={(event) => setKinPhone(event.target.value)}
                  data-field="kin-phone"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>GP</span>
                <input
                  type="text"
                  value={gpName}
                  onChange={(event) => setGpName(event.target.value)}
                  data-field="gp-name"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Practice</span>
                <input
                  type="text"
                  value={gpPractice}
                  onChange={(event) => setGpPractice(event.target.value)}
                  data-field="gp-practice"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Practice telephone number</span>
                <input
                  type="tel"
                  value={gpPhone}
                  onChange={(event) => setGpPhone(event.target.value)}
                  data-field="gp-phone"
                />
              </label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className={styles.section} data-section="clinical">
            <h2 className={styles.sectionTitle}>What is known clinically</h2>
            {/*
             * **The field a form will get a guess for.** A diagnosis is often not
             * known on the day somebody arrives, and the discharge summary may be
             * days behind them. Saying so here is what makes blank the easier
             * answer than a plausible guess, which is the whole argument the
             * six-field form was built on.
             */}
            <p className={styles.sectionNote} data-diagnosis-note>
              If the discharge summary has not arrived, leave this blank. A diagnosis
              entered on the day somebody knows least is indistinguishable from a
              recorded one for as long as the record lasts, and every screen will show
              this as unrecorded until somebody knows.
            </p>
            <div className={styles.two}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Primary diagnosis</span>
                <input
                  type="text"
                  value={primaryDiagnosis}
                  onChange={(event) => setPrimaryDiagnosis(event.target.value)}
                  data-field="primary-diagnosis"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Dietary requirements</span>
                <input
                  type="text"
                  value={dietaryRequirements}
                  onChange={(event) => setDietaryRequirements(event.target.value)}
                  data-field="dietary-requirements"
                />
              </label>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className={styles.section} data-section="flags">
            <h2 className={styles.sectionTitle}>Risk flags and documents</h2>

            {/*
             * **Filing a DNAR is not recording the decision, and this is where
             * that has to be said.** AM v2.0's step 4 asks for the document and
             * treats attaching it as making the decision. It is not: a
             * resuscitation decision carries a clinician's signature and a
             * document reference, and this build captures neither — which is
             * exactly why Phase 16 and Phase 20 both refused to write one.
             * Supplying the document supplies the second of the two.
             *
             * So the upload is a document, and the header will still read "no
             * decision recorded" afterwards. That will look wrong to somebody who
             * has just uploaded a DNAR unless they are told first, which is why
             * this sits on the step rather than after it.
             */}
            <p className={styles.sectionNote} data-dnar-note>
              <b>
                A DNAR form can be filed with this admission, and filing it does not
                record the decision.
              </b>{' '}
              A resuscitation decision carries the signature of the clinician who made
              it; this product holds documents and does not capture signatures, so
              filing the form leaves the decision unrecorded and this resident&rsquo;s
              header will say so. That is the honest state: a document on file, and the
              record that should point at it still empty. The decision is recorded under
              Future plans, by somebody who can attest to it.
            </p>

            <div className={styles.dnarFile} data-dnar-file>
              {dnar.kind === 'none' ? (
                ['PDF', 'JPG'].map((format) => (
                  <Button
                    key={format}
                    variant="secondary"
                    size="small"
                    onClick={() => setDnar({ kind: 'chosen', format })}
                    data-choose-dnar={format}
                  >
                    File a DNAR form ({format})
                  </Button>
                ))
              ) : (
                <>
                  <span data-dnar-chosen>
                    A DNAR form ({dnar.format}) will be filed on {name}&rsquo;s record,
                    under Legal and authority, when they are admitted.
                  </span>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setDnar({ kind: 'none' })}
                    data-remove-dnar
                  >
                    Do not file it
                  </Button>
                </>
              )}
            </div>
            <p className={styles.hint} data-not-stored>
              The file itself is not kept; only that a form was filed is recorded.
            </p>

            <p className={styles.sectionNote} data-flags-note>
              The five risk flags are not asked here either. Every one of the nine
              assessments starts never assessed, which is not the same as low risk, and
              the badge strip on this resident&rsquo;s header will say so from the first
              minute. Answering them is completing an assessment, not ticking a box on
              an admission form.
            </p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className={styles.section} data-section="plan">
            <h2 className={styles.sectionTitle}>Care plan and assessments</h2>
            {/*
             * **No target dates, and this is a departure from the PRD.** Its step
             * 5 sets an initial review date for each domain and a target date for
             * each assessment. Neither is written here.
             *
             * A review date on a domain nobody has written would put a deadline
             * on a plan that does not exist, and the Reviews queue already leads
             * on never-written for that reason. And a target for a first
             * assessment is a different kind of instant from `ReviewState`'s
             * "when does this fall due again" — storing it there would be the
             * clamp-on-the-wrong-kind-of-instant defect, and storing it anywhere
             * else means a deadline nothing enforces.
             */}
            <p className={styles.sectionNote} data-no-dates>
              <b>Nothing here is given a date, and that is stronger than a date.</b> All
              ten care plan domains start unwritten and all nine assessments start never
              assessed. Every screen in the product shows those gaps for as long as they
              last: the care plan queue leads on domains nobody has written, the
              assessment list leads on risks nobody has assessed, and the header badge
              strip carries them beside this person&rsquo;s name. A target date would
              add a deadline nothing enforces on top of a gap that is already visible
              everywhere.
            </p>
          </section>
        ) : null}

        <div className={styles.stepNav} data-step-nav>
          <Button
            variant="secondary"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
            data-step-back
          >
            Back
          </Button>
          <Button
            variant="secondary"
            disabled={step === STEPS.length - 1 || !reachable(step + 1)}
            onClick={() => setStep((current) => current + 1)}
            data-step-next
          >
            {step === STEPS.length - 1 ? 'Last step' : `Next: ${STEPS[step + 1]!.name}`}
          </Button>
        </div>

        {/* The phase's argument, not a courtesy. */}
        <section className={styles.section} data-section="gaps">
          <div className={styles.gapsLead} data-gaps-lead data-state="unrecorded">
            <p className={styles.gapsTitle}>
              Everything else about {name} starts unrecorded, and that is correct
            </p>
            <p className={styles.gapsBody}>
              Admission does not create a complete record. It creates a person with a
              name, a room and a set of gaps, and every one of those will render as a
              gap rather than as nothing, from the moment they are admitted. This is
              where each is recorded when somebody knows.
            </p>
          </div>

          <ul className={styles.gapList}>
            {ADMISSION_GAPS.map((gap) => (
              <li key={gap.what} className={styles.gapItem} data-gap={gap.what}>
                <span className={styles.gapWhat}>{gap.what}</span>
                <span className={styles.gapWhere}>{gap.where}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className={styles.foot}>
          <p className={styles.state} data-admission-state>
            {waiting.length > 0 ? (
              <>
                <b>Waiting on:</b> {waiting.join(' · ')}
              </>
            ) : (
              <>
                <b>
                  Admitting {name} creates a record that is almost entirely gaps, and
                  every screen will say so.
                </b>{' '}
                They will appear on the residents list with critical records missing, on
                the compliance figures as one more resident nobody has assessed, and on
                the group view as a home whose coverage just fell. All of that is true.
              </>
            )}
          </p>
          <Button
            variant="primary"
            disabled={waiting.length > 0}
            onClick={submit}
            data-admit
          >
            Admit {fullLegalName.trim() === '' ? 'this resident' : fullLegalName.trim()}
          </Button>
        </footer>
      </Card>

      {answer === 'not_known' ? (
        <div data-gap-preview>
          <Unrecorded
            variant="panel"
            caption="What the profile header will say"
            label="Allergies not recorded"
            detail="Nobody has recorded whether this person has any allergies. It is not the same as none, and every medication screen will say so until somebody finds out."
          />
        </div>
      ) : null}
    </div>
  )
}

function allergyStatusFrom(input: {
  answer: AllergyAnswer
  substance: string
  reaction: string
  severity: Allergy['severity'] | ''
  by: StaffRef
}): AllergyStatus {
  const at = appNow().toISOString() as IsoDateTime

  if (input.answer === 'recorded' && input.severity !== '') {
    return {
      kind: 'allergies',
      items: [
        {
          substance: input.substance.trim(),
          reaction: input.reaction.trim(),
          severity: input.severity,
        },
      ],
      recordedBy: input.by,
      recordedAt: at,
    }
  }
  if (input.answer === 'none_known') {
    /*
     * A recorded negative, with a source. "No known allergies" that nobody
     * said is the version that kills somebody, so the source is required by
     * the form and carried by the record.
     */
    return { kind: 'none_known', recordedBy: input.by, recordedAt: at }
  }
  return { kind: 'not_recorded' }
}

const today = () => appNow().toISOString().slice(0, 10)
