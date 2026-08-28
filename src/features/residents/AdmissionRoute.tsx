import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  Allergy,
  AllergyStatus,
  IsoDate,
  IsoDateTime,
  SiteId,
  StaffRef,
} from '@/data/types'
import { admit } from '@/data/access/client'
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

export function AdmissionRoute() {
  const { sites, activeSite, currentUser } = useSession()
  const navigate = useNavigate()

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
    }).then((resident) => {
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
          Six things that identify a person, and one that is dangerous not to ask.
          Everything else about them starts unrecorded, and this form says where each of
          those is recorded rather than asking somebody to guess on the day they know
          least.
        </p>
      </header>

      <Card>
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
                What staff will call them. If they have not said yet, leave it blank, it
                renders as not recorded rather than defaulting to their legal name.
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
              Their first medication round may happen before anybody asks again. This is
              the only clinical question on this form, and it is here because not asking
              it today is the version that hurts somebody.
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
                  &ldquo;no known allergies&rdquo; with nobody&rsquo;s name on it is a
                  guess wearing a record.
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
                  Nobody has been able to find out. Honest, and it will render as a gap
                  on every screen until somebody does.
                </span>
              </label>

              {answer === 'not_known' ? (
                <div
                  className={styles.hatchNote}
                  data-not-known-note
                  data-state="unrecorded"
                >
                  Choosing this renders <b>allergies not recorded</b> on {name}&rsquo;s
                  profile header, on every medication screen and on the round: hatched,
                  from the first minute.
                </div>
              ) : null}
            </div>
          </div>
        </section>

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
