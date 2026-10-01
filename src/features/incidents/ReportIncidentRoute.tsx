import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  BodyRegionId,
  CommunalAreaId,
  ContactState,
  IncidentAct,
  IncidentEvidence,
  IncidentSeverityId,
  IncidentTypeId,
  InjuryMap,
  IsoDateTime,
  Resident,
  SiteId,
  StaffRef,
} from '@/data/types'
import { COMMUNAL_AREAS, INCIDENT_TYPES } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { residentsBySite } from '@/data/fixtures/residents'
import { reportIncident, type IncidentReport } from '@/data/access/incident-store'
import { Avatar, Button, Card, Select } from '@/components/primitives'
import { AllergyBadge } from '@/components/status'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import type { TimeZone } from '@/lib/format'
import { instantFromWallClockField } from '@/lib/format'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { TELL_THEM } from '@/features/family/family-statement'
import { ChoiceMark } from './ChoiceMark'
import { EvidenceField } from './EvidenceField'
import { InjurySection, type InjuryChoice } from './InjurySection'
import styles from './incidents.module.css'

/**
 * Report an incident. PRD §6.5.
 *
 * The sentence: **this happened to this person, and you are the one recording
 * it.**
 *
 * **Single column, no wizard, everything on one screen.** An incident is
 * reported minutes after it happened by somebody who wants to get back to the
 * resident; a wizard makes them answer in an order somebody else chose and
 * hides how much is left.
 *
 * This is the one write surface where **the subject is chosen rather than
 * given**, so §2.4's usual protection — identity from the route parameter —
 * does not apply and something has to replace it. What replaces it is that the
 * choice is explicit and closed: a resident, or a recorded statement that no
 * resident was involved. Never a blank, and never a default.
 */

const SEVERITIES: {
  id: IncidentSeverityId
  name: string
  gloss: string
  tint: string
}[] = [
  {
    id: 'no_harm',
    name: 'No harm',
    gloss: 'nothing came of it',
    tint: styles.severityNoHarm!,
  },
  {
    id: 'low_harm',
    name: 'Low harm',
    gloss: 'minor treatment, no lasting effect',
    tint: styles.severityLowHarm!,
  },
  {
    id: 'moderate_harm',
    name: 'Moderate harm',
    gloss: 'treatment needed, recovery expected',
    tint: styles.severityModerateHarm!,
  },
  {
    id: 'severe_harm',
    name: 'Severe harm',
    gloss: 'permanent or long-term effect',
    tint: styles.severitySevereHarm!,
  },
]

/**
 * The two types that can happen to nobody.
 *
 * A hoist found faulty during a check happened to no resident; a fall did not.
 * Attaching a fall to whoever was nearest would be a lost subject, so the
 * choice is only offered where it can be true.
 */
const NO_RESIDENT_TYPES: IncidentTypeId[] = ['equipment_failure', 'near_miss']

type SubjectChoice = 'resident' | 'no_resident' | undefined
/** Whether the reporter decided the family should be told. */
export type FamilyChoice = 'undecided' | 'should' | 'not'
type ContactChoice = 'not_yet' | 'not_required' | 'contacted'
type EmergencyChoice = 'not_called' | 'ambulance_999' | 'nhs_111'

export function ReportIncidentRoute() {
  const { activeSite, currentUser } = useSession()
  const navigate = useNavigate()

  const [subjectChoice, setSubjectChoice] = useState<SubjectChoice>(undefined)
  const [residentId, setResidentId] = useState('')
  const [type, setType] = useState<IncidentTypeId | ''>('')
  const [occurredAt, setOccurredAt] = useState('')
  const [area, setArea] = useState<CommunalAreaId | 'resident_room' | ''>('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<IncidentSeverityId | ''>('')
  const [injury, setInjury] = useState<InjuryChoice>(undefined)
  const [marked, setMarked] = useState<BodyRegionId[]>([])
  const [witnessChoice, setWitnessChoice] = useState<'nobody' | 'witnessed' | ''>('')
  const [witnessNames, setWitnessNames] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [gp, setGp] = useState<ContactChoice | ''>('')
  const [family, setFamily] = useState<ContactChoice | ''>('')
  const [emergency, setEmergency] = useState<EmergencyChoice | ''>('')
  const [notRequiredReason, setNotRequiredReason] = useState('')
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([])
  const [urgentBecause, setUrgentBecause] = useState('')
  const [tellFamily, setTellFamily] = useState<FamilyChoice>('undecided')
  const [notTellingReason, setNotTellingReason] = useState('')
  const [failure, setFailure] = useState('')

  const people = residentsBySite(activeSite.id)
  const resident = people.find((person) => person.id === residentId)

  // Offered only where it can be true, and taken away again if the type
  // changes under it — a fall recorded against nobody is a lost subject.
  const canHaveNoResident = type !== '' && NO_RESIDENT_TYPES.includes(type)
  const subject: SubjectChoice =
    subjectChoice === 'no_resident' && !canHaveNoResident ? undefined : subjectChoice

  const waiting = outstanding({
    subject,
    resident,
    type,
    occurredAt,
    description,
    severity,
    injury,
    marked,
    witnessChoice,
    witnessNames,
    immediateAction,
    gp,
    family,
    emergency,
    notRequiredReason,
    tellFamily,
    notTellingReason,
  })

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <div>
          <h1 className={styles.pageTitle}>Report an incident</h1>
        </div>

        <Card>
          {/* 1 — who */}
          <section className={styles.section} aria-labelledby="subject-heading">
            <h2 className={styles.sectionTitle} id="subject-heading">
              Who this happened to
            </h2>

            <div
              className={styles.choices}
              role="radiogroup"
              aria-labelledby="subject-heading"
            >
              <button
                type="button"
                role="radio"
                aria-checked={subject === 'resident'}
                className={[
                  styles.choice,
                  subject === 'resident' ? styles.choiceSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-subject-choice="resident"
                onClick={() => setSubjectChoice('resident')}
              >
                <ChoiceMark selected={subject === 'resident'} />
                <span className={styles.choiceTitle}>A resident</span>
                <span className={styles.choiceNote}>
                  Choose the person this happened to.
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={subject === 'no_resident'}
                aria-disabled={!canHaveNoResident || undefined}
                className={[
                  styles.choice,
                  subject === 'no_resident' ? styles.choiceSelected : '',
                  canHaveNoResident ? '' : styles.choiceUnavailable,
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-subject-choice="no_resident"
                onClick={() => {
                  if (canHaveNoResident) setSubjectChoice('no_resident')
                }}
              >
                <ChoiceMark selected={subject === 'no_resident'} />
                <span className={styles.choiceTitle}>No resident was involved</span>
                <span className={styles.choiceNote}>
                  {canHaveNoResident
                    ? 'This is a statement that nobody was involved, not a blank.'
                    : 'Available for an equipment failure or a near miss. Choose the type first.'}
                </span>
              </button>
            </div>

            {subject === 'resident' ? (
              <div className={styles.field}>
                <Select
                  labelVisible
                  label="Resident"
                  placeholder="Choose a resident"
                  value={residentId === '' ? undefined : residentId}
                  onValueChange={setResidentId}
                  options={people.map((person) => ({
                    value: person.id,
                    label: `${person.fullLegalName}${
                      person.room.kind === 'recorded'
                        ? ` · Room ${person.room.value}`
                        : ' · Room not recorded'
                    }`,
                  }))}
                />
                {resident ? (
                  <SubjectCard resident={resident} siteName={activeSite.name} />
                ) : null}
              </div>
            ) : null}
          </section>

          {/* 2 — what */}
          <section className={styles.section} aria-labelledby="what-heading">
            <h2 className={styles.sectionTitle} id="what-heading">
              What happened
            </h2>

            <div className={styles.twoUp}>
              <Select
                labelVisible
                label="Type"
                placeholder="Choose a type"
                value={type === '' ? undefined : type}
                onValueChange={(value) => setType(value as IncidentTypeId)}
                options={INCIDENT_TYPES.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                }))}
              />
              <label className={styles.field}>
                <span className={styles.label}>When it happened</span>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                />
                <span className={styles.hint}>Not when you are writing this up.</span>
              </label>
            </div>

            <div className={styles.twoUp}>
              <Select
                labelVisible
                label="Where"
                placeholder="Choose a place"
                value={area === '' ? undefined : area}
                onValueChange={(value) =>
                  setArea(value as CommunalAreaId | 'resident_room')
                }
                options={[
                  { value: 'resident_room', label: "The resident's own room" },
                  ...COMMUNAL_AREAS.map((entry) => ({
                    value: entry.id,
                    label: entry.name,
                  })),
                ]}
              />

              {/* Asked, never left blank. "Leave blank if nobody saw it" would
                  make an empty field mean either "nobody saw it" or "nobody
                  recorded who" — and on an unwitnessed fall that is the
                  difference the record turns on. */}
              <div className={styles.field}>
                <Select
                  labelVisible
                  label="Anyone who saw it"
                  placeholder="Choose an answer"
                  value={witnessChoice === '' ? undefined : witnessChoice}
                  onValueChange={(value) =>
                    setWitnessChoice(value as 'nobody' | 'witnessed')
                  }
                  options={[
                    { value: 'nobody', label: 'Nobody saw it happen' },
                    { value: 'witnessed', label: 'Somebody saw it' },
                  ]}
                />
                {witnessChoice === 'witnessed' ? (
                  <input
                    className={styles.input}
                    type="text"
                    value={witnessNames}
                    onChange={(event) => setWitnessNames(event.target.value)}
                    placeholder="Who saw it"
                    aria-label="Who saw it"
                  />
                ) : null}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>In your own words</span>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What you found, what you saw, what the resident said."
              />
              <span className={styles.hint}>
                Written for whoever reads this next: a manager tonight, an inspector in
                a year.
              </span>
            </label>
          </section>

          {/* 3 — harm */}
          <section className={styles.section} aria-labelledby="harm-heading">
            <h2 className={styles.sectionTitle} id="harm-heading">
              How much harm was caused
            </h2>
            <div
              className={styles.severities}
              role="radiogroup"
              aria-labelledby="harm-heading"
            >
              {SEVERITIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={severity === option.id}
                  className={[
                    styles.severity,
                    option.tint,
                    severity === option.id ? styles.severitySelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-severity={option.id}
                  onClick={() => setSeverity(option.id)}
                >
                  {/* The words carry the meaning; the tint reinforces it and
                      never stands alone (§7). */}
                  <ChoiceMark selected={severity === option.id} />
                  <span className={styles.severityName}>{option.name}</span>
                  <span className={styles.severityGloss}>{option.gloss}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 4 — injury */}
          <InjurySection
            choice={injury}
            marked={marked}
            onChoice={setInjury}
            onToggle={(id) =>
              setMarked((current) =>
                current.includes(id)
                  ? current.filter((entry) => entry !== id)
                  : [...current, id],
              )
            }
          />

          {/* 5 — what you did */}
          <section className={styles.section} aria-labelledby="response-heading">
            <h2 className={styles.sectionTitle} id="response-heading">
              What you did about it
            </h2>

            <label className={styles.field}>
              <span className={styles.label}>Immediate action taken</span>
              <textarea
                className={styles.textarea}
                value={immediateAction}
                onChange={(event) => setImmediateAction(event.target.value)}
                placeholder="What you did in the minutes after."
              />
              {/* Yours, not the manager's. Their account is written later on
                  the review and the two are different records. */}
              <span className={styles.hint}>
                Your words, at the time. The manager writes their own account when they
                review it.
              </span>
            </label>

            <div className={styles.threeUp}>
              <Select
                label="GP contacted"
                placeholder="Choose an answer"
                value={gp === '' ? undefined : gp}
                onValueChange={(value) => setGp(value as ContactChoice)}
                options={[
                  { value: 'not_yet', label: 'Not yet' },
                  { value: 'not_required', label: 'Not required' },
                  { value: 'contacted', label: 'Contacted' },
                ]}
              />
              <Select
                label="Family contacted"
                placeholder="Choose an answer"
                value={family === '' ? undefined : family}
                onValueChange={(value) => setFamily(value as ContactChoice)}
                options={[
                  { value: 'not_yet', label: 'Not yet' },
                  { value: 'not_required', label: 'Not required' },
                  { value: 'contacted', label: 'Contacted' },
                ]}
              />
              <Select
                label="Emergency services"
                placeholder="Choose an answer"
                value={emergency === '' ? undefined : emergency}
                onValueChange={(value) => setEmergency(value as EmergencyChoice)}
                options={[
                  { value: 'not_called', label: 'Not called' },
                  { value: 'ambulance_999', label: '999: ambulance' },
                  { value: 'nhs_111', label: '111' },
                ]}
              />
            </div>

            {/* `not_required` is a decision and a decision carries its reason.
                Without one it is indistinguishable from a call nobody made. */}
            {gp === 'not_required' || family === 'not_required' ? (
              <label className={styles.field}>
                <span className={styles.label}>Why it was not required</span>
                <input
                  className={styles.input}
                  type="text"
                  value={notRequiredReason}
                  onChange={(event) => setNotRequiredReason(event.target.value)}
                  placeholder="No injury and no change in condition."
                />
                <span className={styles.hint}>
                  A decision without a reason reads the same as a call nobody made.
                </span>
              </label>
            ) : null}
          </section>

          <section className={styles.section} data-section="evidence">
            <h2 className={styles.sectionTitle}>Photographs or video</h2>
            <p className={styles.sectionNote}>
              Anything you took at the time. Nothing is required.
            </p>
            <EvidenceField
              evidence={evidence}
              onChange={setEvidence}
              by={currentUser}
            />
          </section>

          {/*
           * **Urgency, not an alert.** Every incident already arrives
           * unacknowledged and already counts on the sidebar badge and the
           * dashboard, so a plain "tell the manager" toggle would restate a
           * signal the product already sends — and a warning that fires on
           * every row stops being read on the one that matters. What only the
           * person who was there can say is that this one cannot wait its
           * turn, and why.
           */}
          <section className={styles.section} data-section="urgency">
            <h2 className={styles.sectionTitle}>Does this need attention now?</h2>
            <p className={styles.sectionNote}>
              Every incident goes to a manager unacknowledged. This says yours should
              not wait its turn, and it shows up on the incident as something owed.
            </p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Why it cannot wait</span>
              <textarea
                className={styles.input}
                rows={2}
                value={urgentBecause}
                data-urgent-because
                placeholder="Leave blank unless it genuinely cannot wait."
                onChange={(event) => setUrgentBecause(event.target.value)}
              />
              <span className={styles.hint}>
                A reason, not a tick: &ldquo;needs attention now&rdquo; with nothing
                behind it tells a manager to hurry and not what about.
              </span>
            </label>
          </section>

          {/*
           * **Deciding is not telling, and the instruction is not behind a
           * click.** This product cannot reach a family member — the Family
           * Portal is a separate product — so what this records is a decision.
           * `TELL_THEM.incident` is in front of the control rather than inside
           * a dialog, because the risk here is precisely somebody not clicking.
           */}
          <section className={styles.section} data-section="family">
            <h2 className={styles.sectionTitle}>Should the family be told?</h2>

            <p className={styles.instruction} data-nothing-sent>
              <b>{TELL_THEM.incident}</b>
            </p>

            <div className={styles.choices} data-family-choices>
              {(
                [
                  ['should', 'Yes, they should be told'],
                  ['not', 'No, and here is why'],
                  ['undecided', 'Not decided yet'],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  className={tellFamily === id ? styles.choiceOn : styles.choice}
                  data-family-choice={id}
                >
                  <input
                    type="radio"
                    name="tell-family"
                    checked={tellFamily === id}
                    onChange={() => setTellFamily(id)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {tellFamily === 'not' ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Why not</span>
                <textarea
                  className={styles.input}
                  rows={2}
                  value={notTellingReason}
                  data-not-telling-reason
                  onChange={(event) => setNotTellingReason(event.target.value)}
                  placeholder="No injury, and the family asked to be told weekly rather than each time."
                />
                <span className={styles.hint}>
                  A decision without a reason reads the same as one nobody made.
                </span>
              </label>
            ) : null}
          </section>

          <div className={styles.foot}>
            {/* Names exactly what is missing, as the round's footer does. A
                count would make somebody hunt. */}
            <p className={styles.footState}>
              {waiting.length === 0 ? (
                <>
                  <strong>Everything needed is here.</strong> It will be reported as
                  unacknowledged until a manager picks it up.
                </>
              ) : (
                <>
                  <strong>Waiting on:</strong> {waiting.join(' · ')}
                </>
              )}
            </p>
            <Button
              size="large"
              disabled={waiting.length > 0}
              data-report-submit
              onClick={() => {
                /*
                 * Guarded rather than trusted to the disabled attribute. The
                 * assembler needs a type and a severity, and `outstanding`
                 * already refuses without them — but a cast here would be the
                 * one §8 names, on the write that creates a clinical record.
                 */
                if (type === '' || severity === '') return
                try {
                  const incident = reportIncident(
                    assembleReport(
                      {
                        siteId: activeSite.id,
                        timeZone: activeSite.timeZone,
                        subject,
                        resident,
                        type,
                        occurredAt,
                        area,
                        description,
                        severity,
                        injury,
                        marked,
                        witnessChoice,
                        witnessNames,
                        immediateAction,
                        gp,
                        family,
                        emergency,
                        notRequiredReason,
                        evidence,
                        urgentBecause,
                        tellFamily,
                        notTellingReason,
                      },
                      currentUser,
                    ),
                    currentUser,
                  )
                  void navigate(`/incidents/${incident.id}`)
                } catch (cause) {
                  setFailure(
                    cause instanceof Error ? cause.message : 'Nothing was reported.',
                  )
                }
              }}
            >
              Report incident
            </Button>
          </div>

          {failure === '' ? null : (
            <p className={styles.footState} data-report-failure>
              {failure}
            </p>
          )}
        </Card>
      </div>
    </SiteTimeZone>
  )
}

/**
 * The subject card, and the allergy on it.
 *
 * **An allergy is an attribute of the person, not an alert on a task** — a
 * wristband rather than a klaxon. It is here for the same reason it is on the
 * round: once the subject card carries allergies anywhere, carrying them
 * everywhere is what keeps their *absence* unambiguous. Shown only where an
 * allergy exists, a blank card would read as "no allergy", which is the
 * blank-means-two-things failure on the most dangerous field in the record.
 *
 * So it renders in all three states, exactly as it does on the round.
 */
function SubjectCard({ resident, siteName }: { resident: Resident; siteName: string }) {
  const format = useSiteFormat()

  return (
    <div className={styles.subjectCard} data-subject={resident.id}>
      <Avatar photo={resident.photo} name={resident.fullLegalName} size="medium" />
      <div className={styles.subjectWho}>
        <p className={styles.subjectName}>{resident.fullLegalName}</p>
        <p className={styles.subjectMeta}>
          {resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'}{' '}
          · Born <span data-numeric>{format.date(resident.dateOfBirth)}</span> ·{' '}
          {siteName}
        </p>
      </div>
      <div className={styles.subjectAllergy}>
        <AllergyBadge status={resident.allergies} />
      </div>
    </div>
  )
}

/**
 * What the form is still waiting on, named item by item.
 *
 * Exported so it can be tested without driving the whole screen — the rule is
 * the thing under test, not the wiring.
 */
/**
 * Everything the form gathered, as the record holds it.
 *
 * **Exported and pure, so the mapping is testable without driving a screen.**
 * This is where a form's answers become a clinical record, and every one of
 * these conversions is somewhere a wrong answer could be written down under
 * somebody's name: a witness list that drops a name, an injury map that says
 * "none found" where nobody looked, a family decision recorded as made when it
 * was not. `outstanding` above refuses an incomplete answer; this one has to
 * carry a complete one faithfully.
 */
export function assembleReport(
  input: {
    siteId: SiteId
    /**
     * The site's zone, because `occurredAt` arrives as a `datetime-local`
     * value and that string names a wall clock with no offset on it. Parsing
     * it with `new Date` reads it as the **viewer's** local time, which is
     * the site's only while the two agree — London and Lagos agree all
     * summer and differ every winter.
     */
    timeZone: TimeZone
    subject: SubjectChoice
    resident: Resident | undefined
    type: IncidentTypeId
    occurredAt: string
    area: CommunalAreaId | 'resident_room' | ''
    description: string
    severity: IncidentSeverityId
    injury: InjuryChoice
    marked: BodyRegionId[]
    witnessChoice: 'nobody' | 'witnessed' | ''
    witnessNames: string
    immediateAction: string
    gp: ContactChoice | ''
    family: ContactChoice | ''
    emergency: EmergencyChoice | ''
    notRequiredReason: string
    evidence: IncidentEvidence[]
    urgentBecause: string
    tellFamily: FamilyChoice
    notTellingReason: string
  },
  by: StaffRef,
): IncidentReport {
  const at = appNow().toISOString() as IsoDateTime
  const stamp: IncidentAct = { by, at }

  const contact = (choice: ContactChoice | ''): ContactState =>
    choice === 'contacted'
      ? { kind: 'contacted', at, by, outcome: '' }
      : choice === 'not_required'
        ? {
            kind: 'not_required',
            reason: input.notRequiredReason.trim(),
            recordedBy: by,
            recordedAt: at,
          }
        : { kind: 'not_yet' }

  /*
   * Three injury states, never two. "Nobody checked" and "checked, nothing
   * found" are the distinction the body map exists to keep, and collapsing
   * them here would undo it at the one point the record is written.
   */
  const injuries: InjuryMap =
    input.injury === 'none_found'
      ? { kind: 'no_injuries_found', recorded: stamp }
      : input.injury === 'found' && input.marked.length > 0
        ? {
            kind: 'marked',
            regions: input.marked as [BodyRegionId, ...BodyRegionId[]],
            recorded: stamp,
          }
        : { kind: 'not_recorded' }

  const names = input.witnessNames
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')

  return {
    siteId: input.siteId,
    subject:
      input.subject === 'resident' && input.resident
        ? { kind: 'resident', residentId: input.resident.id }
        : { kind: 'no_resident_involved', recordedBy: by },
    type: input.type,
    severity: input.severity,
    occurredAt: instantFromWallClockField(input.occurredAt, input.timeZone),
    location:
      input.area === ''
        ? { kind: 'not_recorded' }
        : input.area === 'resident_room'
          ? {
              kind: 'resident_room',
              room:
                input.resident && input.resident.room.kind === 'recorded'
                  ? input.resident.room.value
                  : 'Not recorded',
            }
          : { kind: 'communal', area: input.area },
    description: input.description.trim(),
    response: {
      immediateAction: input.immediateAction.trim(),
      witnesses:
        input.witnessChoice === 'witnessed' && names.length > 0
          ? {
              kind: 'witnessed',
              people: names as [string, ...string[]],
              recordedBy: by,
            }
          : { kind: 'nobody_witnessed', recordedBy: by },
      gp: contact(input.gp),
      family: contact(input.family),
      emergencyServices:
        input.emergency === 'ambulance_999' || input.emergency === 'nhs_111'
          ? { kind: 'called', service: input.emergency, at, by, outcome: '' }
          : { kind: 'not_called' },
    },
    injuries,
    evidence: input.evidence,
    /*
     * Urgency is a judgement with a reason, never a tick. "This one needs
     * attention now" with nothing behind it tells a manager to hurry and not
     * what to hurry about.
     */
    urgency:
      input.urgentBecause.trim() === ''
        ? { kind: 'ordinary' }
        : {
            kind: 'needs_attention_now',
            raised: stamp,
            because: input.urgentBecause.trim(),
          },
    /*
     * Deciding is not telling, and the third state is nobody having decided.
     * `TELL_THEM.incident` says the rest on the screen.
     */
    familyTold:
      input.tellFamily === 'should'
        ? { kind: 'should_be_told', decided: stamp }
        : input.tellFamily === 'not'
          ? {
              kind: 'not_to_be_told',
              decided: stamp,
              reason: input.notTellingReason.trim(),
            }
          : { kind: 'not_decided' },
  }
}

export function outstanding(input: {
  subject: SubjectChoice
  resident: Resident | undefined
  type: IncidentTypeId | ''
  occurredAt: string
  description: string
  severity: IncidentSeverityId | ''
  injury: InjuryChoice
  marked: BodyRegionId[]
  witnessChoice: 'nobody' | 'witnessed' | ''
  witnessNames: string
  immediateAction: string
  gp: ContactChoice | ''
  family: ContactChoice | ''
  emergency: EmergencyChoice | ''
  notRequiredReason: string
  tellFamily: FamilyChoice
  notTellingReason: string
}): string[] {
  const waiting: string[] = []

  if (input.type === '') waiting.push('a type')
  if (input.subject === undefined) waiting.push('who this happened to')
  else if (input.subject === 'resident' && !input.resident) waiting.push('the resident')
  if (input.occurredAt === '') waiting.push('when it happened')
  if (input.description.trim() === '') {
    waiting.push('what happened, in your own words')
  }
  if (input.severity === '') waiting.push('how much harm')
  if (input.injury === undefined) waiting.push('whether they were checked for injury')
  // "Injuries found" with nothing marked is an incomplete record rather than
  // an empty one, so it holds the form exactly as a missing answer does.
  else if (input.injury === 'found' && input.marked.length === 0) {
    waiting.push('at least one injury site')
  }

  if (input.witnessChoice === '') waiting.push('whether anybody saw it')
  else if (input.witnessChoice === 'witnessed' && input.witnessNames.trim() === '') {
    waiting.push('who saw it')
  }

  // Required and non-empty, so there is no blank to interpret.
  if (input.immediateAction.trim() === '') waiting.push('what you did about it')
  if (input.gp === '') waiting.push('whether the GP was contacted')
  if (input.family === '') waiting.push('whether the family were contacted')
  if (input.emergency === '') waiting.push('whether emergency services were called')
  if (
    (input.gp === 'not_required' || input.family === 'not_required') &&
    input.notRequiredReason.trim() === ''
  ) {
    waiting.push('why contact was not required')
  }

  /*
   * **The same rule as the line above it, on the decision that creates the
   * record.** The screen's own hint says a decision without a reason reads the
   * same as one nobody made, and `FamilyDecision` on the detail page already
   * refuses one — its button is disabled until a reason is typed. The report
   * form was the one place it was not enforced, and the only place that
   * actually writes the decision down.
   */
  if (input.tellFamily === 'not' && input.notTellingReason.trim() === '') {
    waiting.push('why the family are not being told')
  }

  return waiting
}
