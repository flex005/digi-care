import { useState } from 'react'
import type {
  BodyRegionId,
  Incident,
  IncidentAct,
  IncidentSeverityId,
  IncidentTypeId,
  IsoDateTime,
} from '@/data/types'
import {
  correctReport,
  raiseUrgency,
  recordFamilyDecision,
} from '@/data/access/incident-store'
import { AlertDialog, Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { instantFromWallClockField, wallClockField } from '@/lib/format'
import { useViewer } from '@/app/session/use-viewer'
import { InjurySection, type InjuryChoice } from './InjurySection'
import { SeverityPicker } from './SeverityPicker'
import { WhatHappenedSection, type AreaChoice } from './WhatHappenedSection'
import {
  ResponseSection,
  type ContactChoice,
  type EmergencyChoice,
} from './ResponseSection'
import { UrgencyQuestion, NO_RE_RAISE } from './UrgencyQuestion'
import { FamilyQuestion, type FamilyChoice } from './FamilyQuestion'
import { EvidenceField } from './EvidenceField'
import { SectionHeading } from './SectionHeading'
import { contactChoiceOf, contactState } from './contact-state'
import styles from './incidents.module.css'

/**
 * An admin correcting what the reporter wrote.
 *
 * **This overwrites somebody else's account and the original is not kept.**
 * Every other write on an incident adds a record beside what was there; this
 * one replaces it. That is a decision taken knowingly — it is written up in
 * PROGRESS.md — and the person doing it is told before they do it rather than
 * discovering it afterwards.
 *
 * **It cannot reach the manager's review.** `ReporterCorrection` is its own
 * patch type covering exactly the reporter's six fields, so the structural
 * separation this module keeps between the two records survives: a correction
 * cannot quietly become a review, or the other way round.
 *
 * **Gated in the page, not at the route.** `/incidents/:id` is a page every
 * role reads, and `correct_incident_report` carries `route: undefined` for
 * that reason — refusing the whole page would take the incident away from the
 * people who need to read it. What is admin-only is the act.
 */
/**
 * Whether this viewer may rewrite a report.
 *
 * Exported because the trigger and the form are rendered in two places now —
 * the header action row and the panel below it — and **both** ask. One gate
 * read by one caller would leave the other reachable by whoever could find it.
 */
export function mayCorrectReport(viewer: ReturnType<typeof useViewer>): boolean {
  return viewer.may('correct_incident_report')
}

/**
 * The control that opens the form, rendered in the header beside Download.
 *
 * **It belongs with the whole-report actions, not inside a section.** A
 * correction rewrites the type, the severity, when it happened, where, the
 * account and what was done — so a trigger sitting inside "What the reporter
 * recorded" implied it touched only that card's text, which was a smaller
 * claim than the act makes.
 */
export function CorrectReportTrigger({ onOpen }: { onOpen: () => void }) {
  const viewer = useViewer()
  if (!mayCorrectReport(viewer)) return null

  return (
    <Button variant="secondary" size="medium" data-correct-report onClick={onOpen}>
      <Icon name="edit-formatting/edit-02" size={16} aria-hidden />
      Correct this report
    </Button>
  )
}

export function CorrectReportForm({
  incident,
  subjectName,
  open,
  onClose,
  onCorrected,
}: {
  incident: Incident
  /** Who the incident is about, so the confirmation names them (§2.4). */
  subjectName: string
  /** Held by the route, because the trigger lives in its header now. */
  open: boolean
  onClose: () => void
  onCorrected: () => void
}) {
  const { activeSite, currentUser } = useSession()
  const viewer = useViewer()
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState('')

  const [type, setType] = useState<IncidentTypeId>(incident.type)
  const [severity, setSeverity] = useState<IncidentSeverityId>(incident.severity)
  /*
   * The site's wall clock, not the stored UTC. The slice this replaced put a
   * different time in the field from the one the page beside it was showing,
   * for the same incident.
   */
  const [occurredAt, setOccurredAt] = useState(
    wallClockField(incident.occurredAt, activeSite.timeZone),
  )
  const [area, setArea] = useState<AreaChoice>(
    incident.location.kind === 'communal'
      ? incident.location.area
      : incident.location.kind === 'resident_room'
        ? 'resident_room'
        : 'not_recorded',
  )
  const [room, setRoom] = useState(
    incident.location.kind === 'resident_room' ? incident.location.room : '',
  )
  const [description, setDescription] = useState(incident.description)
  const [immediateAction, setImmediateAction] = useState(
    incident.response.immediateAction,
  )

  /*
   * The two observations, opened from the record rather than blank — the same
   * reason the account is: a form that started empty would erase a body map by
   * being saved untouched.
   */
  const [injury, setInjury] = useState<InjuryChoice>(
    incident.injuries.kind === 'marked'
      ? 'found'
      : incident.injuries.kind === 'no_injuries_found'
        ? 'none_found'
        : 'not_checked',
  )
  const [marked, setMarked] = useState<BodyRegionId[]>(
    incident.injuries.kind === 'marked' ? [...incident.injuries.regions] : [],
  )
  const [witnessChoice, setWitnessChoice] = useState<'nobody' | 'witnessed'>(
    incident.response.witnesses.kind === 'witnessed' ? 'witnessed' : 'nobody',
  )
  const [witnessNames, setWitnessNames] = useState(
    incident.response.witnesses.kind === 'witnessed'
      ? incident.response.witnesses.people.join(', ')
      : '',
  )
  /*
   * **Everything the report form asks, seeded from the record.** A field the
   * modal did not carry was a field a correction silently dropped: the
   * evidence especially, because the attachments render with remove controls
   * and an empty list saved over them would destroy every one.
   */
  const [gp, setGp] = useState<ContactChoice>(contactChoiceOf(incident.response.gp))
  const [familyContact, setFamilyContact] = useState<ContactChoice>(
    contactChoiceOf(incident.response.family),
  )
  const [emergency, setEmergency] = useState<EmergencyChoice>(
    incident.response.emergencyServices.kind === 'called'
      ? incident.response.emergencyServices.service
      : 'not_called',
  )
  const [notRequiredReason, setNotRequiredReason] = useState(
    incident.response.gp.kind === 'not_required'
      ? incident.response.gp.reason
      : incident.response.family.kind === 'not_required'
        ? incident.response.family.reason
        : '',
  )
  const [evidence, setEvidence] = useState([...incident.evidence])

  /*
   * Urgency and the family decision are seeded here and written through
   * `raiseUrgency` and `recordFamilyDecision`, never through `correctReport`.
   * Those two own their own rules — a blank reason is refused, a stood-down
   * urgency cannot be re-raised — and a second copy here is how a rule stops
   * being true in one of the two places it lives.
   */
  const [urgentBecause, setUrgentBecause] = useState(
    incident.urgency.kind === 'needs_attention_now' ? incident.urgency.because : '',
  )
  const [tellFamily, setTellFamily] = useState<FamilyChoice>(
    incident.familyTold.kind === 'should_be_told'
      ? 'should'
      : incident.familyTold.kind === 'not_to_be_told'
        ? 'not'
        : 'undecided',
  )
  const [notTellingReason, setNotTellingReason] = useState(
    incident.familyTold.kind === 'not_to_be_told' ? incident.familyTold.reason : '',
  )

  /*
   * The act, not the page. Everybody reads an incident; one role rewrites one.
   * Asked here as well as on the trigger: a form reachable without the trigger
   * would be gated only by whichever control somebody happened to use.
   */
  if (!mayCorrectReport(viewer) || !open) return null

  const names = witnessNames
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')

  /*
   * **What the types make unconstructable, the form has to refuse.**
   * `InjuryMap` 'marked' is `[BodyRegionId, ...BodyRegionId[]]` and
   * `WitnessRecord` 'witnessed' requires a non-empty `people`, so "injuries
   * found" with nothing marked, and "somebody saw it" with nobody named, are
   * not states this record can hold. The report form gates on exactly this;
   * saving is refused here rather than quietly downgrading the answer, which
   * would record a different claim from the one that was made.
   */
  const blank =
    description.trim() === '' ||
    immediateAction.trim() === '' ||
    (injury === 'found' && marked.length === 0) ||
    (witnessChoice === 'witnessed' && names.length === 0) ||
    /*
     * The same rule the report form holds: `not_required` is a decision and a
     * decision carries its reason, so it cannot be saved without one.
     */
    ((gp === 'not_required' || familyContact === 'not_required') &&
      notRequiredReason.trim() === '') ||
    // And a family decision of "no" needs its why, as FamilyDecision requires.
    (tellFamily === 'not' && notTellingReason.trim() === '')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape and the overlay close it too, and they mean the same thing
        // Cancel does.
        if (!next) onClose()
      }}
      size="wide"
      title={`Correct the report about ${subjectName}`}
      actions={
        <>
          <Button variant="ghost" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="small"
            disabled={blank}
            data-correct-save
            onClick={() => {
              setConfirming(true)
            }}
          >
            Save the correction
          </Button>
        </>
      }
    >
      <section className={styles.section} data-section="correct-report">
        {/*
         * Said before the act, not after. Somebody about to overwrite another
         * person's account should know that is what it does.
         */}
        <p className={styles.instruction} data-correction-warning>
          <b>
            This replaces {incident.reported.by.displayName}&rsquo;s own account of what
            happened. What it says now is not kept anywhere, and your name and the time
            go on the record in its place.
          </b>
        </p>
        {failure === '' ? null : (
          <p className={styles.footState} data-correction-failure>
            {failure}
          </p>
        )}
      </section>

      {/*
        **The report form's sections, rendered rather than matched.** These are
        the same components `ReportIncidentRoute` renders, so the two forms
        cannot drift: a hint changed in one is changed in both, and the
        severity scale an admin corrects is the scale the reporter chose from.

        At `h3`, because Radix renders the dialog's title as the `h2` — the
        page's `h1` is not in this document, so `h2` here would skip a level
        while looking identical.

        In the report form's order. "Who this happened to" is the one section
        left out: changing the subject of a clinical record is a different and
        graver act than fixing what it says.
      */}
      <WhatHappenedSection
        level="h3"
        type={type}
        onType={setType}
        occurredAt={occurredAt}
        onOccurredAt={setOccurredAt}
        area={area}
        onArea={setArea}
        room={room}
        onRoom={setRoom}
        witnessChoice={witnessChoice}
        onWitnessChoice={setWitnessChoice}
        witnessNames={witnessNames}
        onWitnessNames={setWitnessNames}
        description={description}
        onDescription={setDescription}
      />

      <SeverityPicker level="h3" severity={severity} onSeverity={setSeverity} />

      <InjurySection
        level="h3"
        choice={injury}
        marked={marked}
        onChoice={setInjury}
        onToggle={(id) => {
          setMarked((current) =>
            current.includes(id)
              ? current.filter((entry) => entry !== id)
              : [...current, id],
          )
        }}
      />

      <ResponseSection
        level="h3"
        immediateAction={immediateAction}
        onImmediateAction={setImmediateAction}
        gp={gp}
        onGp={setGp}
        family={familyContact}
        onFamily={setFamilyContact}
        emergency={emergency}
        onEmergency={setEmergency}
        notRequiredReason={notRequiredReason}
        onNotRequiredReason={setNotRequiredReason}
      />

      <section className={styles.section} data-section="evidence">
        <SectionHeading level="h3">Photographs or video</SectionHeading>
        <p className={styles.sectionNote}>
          Anything you took at the time. Nothing is required.
        </p>
        {/* Seeded from the record, so what is already attached renders with
            its remove control. Starting empty would destroy it on save. */}
        <EvidenceField evidence={evidence} onChange={setEvidence} by={currentUser} />
      </section>

      <UrgencyQuestion
        level="h3"
        urgentBecause={urgentBecause}
        onUrgentBecause={setUrgentBecause}
        refusedReason={incident.urgency.kind === 'stood_down' ? NO_RE_RAISE : undefined}
      />

      <FamilyQuestion
        level="h3"
        tellFamily={tellFamily}
        onTellFamily={setTellFamily}
        notTellingReason={notTellingReason}
        onNotTellingReason={setNotTellingReason}
      />

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{ kind: 'resident', name: subjectName }}
        action={`Replace ${incident.reported.by.displayName}'s account`}
        confirmLabel="Replace it"
        description={
          <span className={styles.confirmBody}>
            <span>
              What they wrote is not kept. The record will say it was edited by you,
              with the time.
            </span>
          </span>
        }
        onConfirm={() => {
          try {
            /*
             * Stamped with the admin doing the correcting. Leaving the
             * original recorder's name on an observation they did not write
             * is what the separate reporter and manager records exist to
             * prevent — and the store only keeps this stamp where the fact
             * actually moved, so a correction to the description does not
             * re-attribute a body map nobody touched.
             */
            const stamp: IncidentAct = {
              by: currentUser,
              at: new Date().toISOString() as IsoDateTime,
            }
            correctReport(
              incident,
              {
                type,
                severity,
                occurredAt: instantFromWallClockField(occurredAt, activeSite.timeZone),
                location:
                  area === 'not_recorded'
                    ? { kind: 'not_recorded' }
                    : area === 'resident_room'
                      ? { kind: 'resident_room', room }
                      : area === ''
                        ? { kind: 'not_recorded' }
                        : { kind: 'communal', area },
                description,
                immediateAction,
                injuries:
                  injury === 'found' && marked.length > 0
                    ? {
                        kind: 'marked',
                        regions: marked as [BodyRegionId, ...BodyRegionId[]],
                        recorded: stamp,
                      }
                    : injury === 'none_found'
                      ? { kind: 'no_injuries_found', recorded: stamp }
                      : { kind: 'not_recorded' },
                witnesses:
                  witnessChoice === 'witnessed' && names.length > 0
                    ? {
                        kind: 'witnessed',
                        people: names as [string, ...string[]],
                        recordedBy: currentUser,
                      }
                    : { kind: 'nobody_witnessed', recordedBy: currentUser },
                gp: contactState(gp, notRequiredReason, currentUser, stamp.at),
                family: contactState(
                  familyContact,
                  notRequiredReason,
                  currentUser,
                  stamp.at,
                ),
                emergencyServices:
                  emergency === 'not_called'
                    ? { kind: 'not_called' }
                    : {
                        kind: 'called',
                        service: emergency,
                        at: stamp.at,
                        by: currentUser,
                        outcome:
                          incident.response.emergencyServices.kind === 'called'
                            ? incident.response.emergencyServices.outcome
                            : '',
                      },
                evidence,
              },
              currentUser,
            )

            /*
             * **Through the owners, and only where the answer moved.**
             * `raiseUrgency` and `recordFamilyDecision` hold their own rules —
             * a blank reason is refused, a stood-down urgency cannot be
             * re-raised — so the modal calls them rather than patching the
             * record itself. And it calls them only on a change, because
             * either one re-stamps: saving a reworded description would
             * otherwise put this admin's name on an urgency somebody else
             * raised, which is the rule `correctReport` already keeps.
             */
            const urgencyNow =
              incident.urgency.kind === 'needs_attention_now'
                ? incident.urgency.because
                : ''
            if (
              incident.urgency.kind !== 'stood_down' &&
              urgentBecause.trim() !== '' &&
              urgentBecause.trim() !== urgencyNow
            ) {
              raiseUrgency(incident, urgentBecause, currentUser)
            }

            const familyNow =
              incident.familyTold.kind === 'should_be_told'
                ? 'should'
                : incident.familyTold.kind === 'not_to_be_told'
                  ? 'not'
                  : 'undecided'
            const reasonNow =
              incident.familyTold.kind === 'not_to_be_told'
                ? incident.familyTold.reason
                : ''
            if (
              tellFamily !== familyNow ||
              (tellFamily === 'not' && notTellingReason.trim() !== reasonNow)
            ) {
              if (tellFamily === 'should') {
                recordFamilyDecision(incident, { kind: 'should' }, currentUser)
              } else if (tellFamily === 'not' && notTellingReason.trim() !== '') {
                recordFamilyDecision(
                  incident,
                  { kind: 'not', reason: notTellingReason.trim() },
                  currentUser,
                )
              }
            }

            setConfirming(false)
            onClose()
            onCorrected()
          } catch (cause) {
            setConfirming(false)
            setFailure(cause instanceof Error ? cause.message : 'Nothing was changed.')
          }
        }}
      />
    </Dialog>
  )
}
