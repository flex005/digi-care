import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ResidentId } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Button, Card, Select } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { residentsBySite } from '@/data/fixtures/residents'
import { documents } from '@/data/fixtures/documents'
import styles from './interim.module.css'

/**
 * A medication that arrived between cycles. PRD §6.4.
 *
 * **This screen records a prescription that exists somewhere else; it does not
 * create one.** So the source is the first question and it is required: a
 * medication with no source is a drug nobody can trace back to a prescriber,
 * and every route below leaves a document or a name behind it.
 *
 * **A controlled drug cannot be added by this route at all, and the screen says
 * so before anybody types.** A CD needs a written prescription meeting legal
 * requirements and no interim path substitutes for one. Refusing on submit
 * would let somebody fill in eleven fields to be told the answer was no from
 * the start.
 *
 * **Allergies render beside the resident**, because a prescription is where an
 * allergy is most likely to be checked and most costly to miss.
 */
type SourceId = 'discharge' | 'gp_written' | 'verbal' | 'pharmacy_interim'

const SOURCES: { id: SourceId; label: string; hint: string }[] = [
  {
    id: 'discharge',
    label: 'Hospital discharge letter',
    hint: 'The letter is filed in Health and clinical, and this medication links to it.',
  },
  {
    id: 'gp_written',
    label: 'Written GP order',
    hint: 'A prescription or signed note from the practice, filed alongside.',
  },
  {
    id: 'verbal',
    label: 'Verbal order from a prescriber',
    hint: 'Requires a second member of staff to witness the call, and written confirmation within 24 hours.',
  },
  {
    id: 'pharmacy_interim',
    label: 'Pharmacy interim supply',
    hint: "Sent between cycles, with the pharmacy's own reference.",
  },
]

export function InterimRoute() {
  const { activeSite } = useSession()
  const residents = useMemo(() => residentsBySite(activeSite.id), [activeSite.id])

  const [source, setSource] = useState<SourceId | 'none'>('none')
  const [residentId, setResidentId] = useState<ResidentId | 'none'>('none')
  const [documentId, setDocumentId] = useState('none')
  const [prescriber, setPrescriber] = useState('')
  const [witness, setWitness] = useState('')
  const [name, setName] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [directions, setDirections] = useState('')

  const resident = residents.find((one) => one.id === residentId)
  const filed = documents.filter(
    (entry) => entry.owner.kind === 'resident' && entry.owner.residentId === residentId,
  )

  const verbal = source === 'verbal'
  const waiting = [
    source === 'none' ? 'where the prescription came from' : '',
    residentId === 'none' ? 'who it is for' : '',
    prescriber.trim() === '' ? 'the prescriber' : '',
    verbal && witness.trim() === '' ? 'the witness to the call' : '',
    name.trim() === '' ? 'the medication' : '',
    /*
     * A dose with no strength is half a record: "one tablet" is a different
     * prescription at 250mg and at 500mg, and whoever gives it cannot tell
     * which from the MAR chart. Both, or neither goes on.
     */
    strength.trim() === '' ? 'the strength' : '',
    dose.trim() === '' ? 'the dose' : '',
    directions.trim() === '' ? "the prescriber's directions" : '',
  ].filter(Boolean)

  return (
    <div className={styles.page} data-interim>
      <header>
        <h2 className={styles.title}>Add an interim medication</h2>
        <p className={styles.subtitle}>
          For what arrives between cycles: a hospital discharge, a GP visit. This screen
          records a prescription that exists somewhere else. It does not create one.
        </p>
      </header>

      <Card>
        <section className={styles.section} data-section="source">
          <h3 className={styles.sectionTitle}>Where this prescription came from</h3>

          <div className={styles.sourceBox}>
            <p className={styles.sourceTitle}>
              The source is answered first, and it is required
            </p>
            <p className={styles.sourceBody}>
              A medication with no source is a drug nobody can trace to a prescriber.
              Every route below leaves a document or a name behind it, and the MAR chart
              shows which.
            </p>

            <div className={styles.options}>
              {SOURCES.map((entry) => {
                const chosen = source === entry.id
                return (
                  <label
                    key={entry.id}
                    className={chosen ? styles.optionOn : styles.option}
                    data-source-option={entry.id}
                  >
                    <input
                      type="radio"
                      name="interim-source"
                      checked={chosen}
                      onChange={() => setSource(entry.id)}
                    />
                    <b>{entry.label}</b>
                    <span className={styles.optionHint}>{entry.hint}</span>
                  </label>
                )
              })}
            </div>

            {/*
             * Said before anybody types, not on submit. Filling in eleven
             * fields to be told the answer was no from the start is a form
             * wasting somebody's shift.
             */}
            <p className={styles.refusal} data-cd-refusal>
              A controlled drug cannot be added by this route. It needs a written
              prescription meeting the legal requirements, and no interim path
              substitutes for one.
            </p>
          </div>

          {verbal ? (
            <div className={styles.verbal} data-verbal-obligation>
              <p className={styles.verbalTitle}>A verbal order carries a follow-up</p>
              <p className={styles.verbalBody}>
                A second member of staff witnesses the call, and it must be confirmed in
                writing within 24 hours. Both are recorded here; the written
                confirmation stays outstanding on the record until somebody files it.
              </p>
              <label className={styles.field}>
                <span className={styles.label}>Who witnessed the call</span>
                <input
                  type="text"
                  value={witness}
                  onChange={(event) => setWitness(event.target.value)}
                  data-field="witness"
                  autoComplete="off"
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className={styles.section} data-section="who">
          <h3 className={styles.sectionTitle}>Who it is for</h3>
          <div className={styles.two}>
            <div className={styles.field}>
              <Select
                labelVisible
                label="Resident"
                placeholder="Choose a resident"
                value={residentId === 'none' ? undefined : residentId}
                onValueChange={(value) => setResidentId(value as ResidentId)}
                options={residents.map((one) => ({
                  value: one.id,
                  label:
                    one.room.kind === 'recorded'
                      ? `${one.fullLegalName} · Room ${one.room.value}`
                      : `${one.fullLegalName} · room not recorded`,
                }))}
              />
            </div>

            {/*
             * Beside the resident, not on another tab. A prescription is
             * where an allergy is most likely to be checked and most costly
             * to miss.
             */}
            <div className={styles.field} data-allergies={residentId}>
              <span className={styles.label}>Allergies on record</span>
              <Allergies resident={resident} />
            </div>
          </div>
        </section>

        {/*
         * After the resident, not before: documents are filed against a
         * person, so a list of "filed documents" offered before anybody has
         * said who this is for is a list that can only be empty.
         */}
        <section className={styles.section} data-section="paperwork">
          <h3 className={styles.sectionTitle}>The prescriber and the paperwork</h3>
          <div className={styles.two}>
            <label className={styles.field}>
              <span className={styles.label}>Prescriber</span>
              <input
                type="text"
                value={prescriber}
                onChange={(event) => setPrescriber(event.target.value)}
                placeholder="Name and where they work"
                data-field="prescriber"
                autoComplete="off"
              />
            </label>

            <div className={styles.field}>
              <Select
                labelVisible
                label="Supporting document"
                placeholder="Choose a filed document"
                value={documentId === 'none' ? undefined : documentId}
                onValueChange={setDocumentId}
                options={[
                  ...filed.map((entry) => ({ value: entry.id, label: entry.title })),
                ]}
              />
              <p className={styles.hint}>
                If it is not filed yet, file it first: the medication and the document
                go on the record together or not at all.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} data-section="medication">
          <h3 className={styles.sectionTitle}>The medication</h3>
          <div className={styles.two}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-field="name"
                autoComplete="off"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Strength and form</span>
              <input
                type="text"
                value={strength}
                onChange={(event) => setStrength(event.target.value)}
                data-field="strength"
                autoComplete="off"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Dose</span>
            <input
              type="text"
              value={dose}
              onChange={(event) => setDose(event.target.value)}
              data-field="dose"
              autoComplete="off"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Directions, as written by the prescriber
            </span>
            <input
              type="text"
              value={directions}
              onChange={(event) => setDirections(event.target.value)}
              data-field="directions"
              autoComplete="off"
            />
            <p className={styles.hint}>
              Copied from the source document rather than paraphrased: the MAR chart
              shows this wording to whoever gives the dose.
            </p>
          </label>
        </section>

        <div className={styles.foot}>
          <p className={styles.footState} data-interim-state>
            {waiting.length > 0 ? (
              <>
                <b>Waiting on:</b> {waiting.join(' · ')}.
              </>
            ) : (
              <>
                <b>
                  This adds {name} to {resident?.fullLegalName}&rsquo;s MAR chart.
                </b>{' '}
                Held in memory for this session only. Nothing is sent to a pharmacy and
                nothing is saved to a server.
              </>
            )}
          </p>
          <Button disabled={waiting.length > 0} data-add-interim>
            Add to the MAR chart
          </Button>
        </div>
      </Card>

      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Back to medications
      </Link>
    </div>
  )
}

/**
 * What this person is allergic to, or that nobody has asked.
 *
 * Three states, and the middle one is the reason this is not a string: "no
 * known allergies" recorded by somebody is a finding, and nobody having asked
 * is a gap. On a prescribing screen those are opposite.
 */
function Allergies({
  resident,
}: {
  resident: ReturnType<typeof residentsBySite>[number] | undefined
}) {
  if (resident === undefined) {
    return (
      <p className={styles.hint}>Choose a resident and their allergies show here.</p>
    )
  }

  const allergies = resident.allergies
  if (allergies.kind === 'not_recorded') {
    return (
      <span data-allergy-state="not_recorded">
        <Unrecorded
          variant="chip"
          label="Nobody has asked"
          detail="no allergy status is on this record, which is not the same as none"
        />
      </span>
    )
  }

  if (allergies.kind === 'none_known') {
    // A recorded negative, and it looks settled: somebody asked and wrote the
    // answer down, which is a complete record rather than a gap.
    return (
      <p className={styles.noneKnown} data-allergy-state="none_known">
        No known allergies, recorded by {allergies.recordedBy.displayName}.
      </p>
    )
  }

  return (
    <ul className={styles.allergies} data-allergy-state="allergies">
      {allergies.items.map((entry) => (
        <li key={entry.substance} className={styles.allergy}>
          {/* Substance and reaction and severity: the reaction alone is half a
              record, and the difference between mild and anaphylaxis is
              whether that person carries an adrenaline pen. */}
          <b>{entry.substance.toUpperCase()}</b> · {entry.reaction} · {entry.severity}
        </li>
      ))}
    </ul>
  )
}
