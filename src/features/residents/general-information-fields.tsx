import type { ReactNode } from 'react'
import type { Resident } from '@/data/types'
import { FUNDING_SOURCES } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { formatDate, ageFrom } from '@/lib/format'
import { PlainValue, RecordedListField, RecordedValueField } from './FieldList'
import styles from './profile.module.css'

/**
 * General Information. Every field from source PRD §16.2, declared rather than
 * hardcoded into a render function.
 *
 * The declaration is the guard. `general-information.test.tsx` asserts that
 * every field renders something non-empty for all 32 residents, and that any
 * field whose value is unrecorded renders the hatch. A field cannot be added
 * without saying what it looks like when nobody has recorded it, and none of
 * the existing ones can silently vanish — the same structural approach as the
 * Risk flags column and the badge strip.
 *
 * §16.2's sixteen bullets become more than sixteen rows because several bundle
 * two facts — "Full legal name and preferred name", "Admission date and
 * anticipated length of stay", "Diagnosis and medical history (free text, plus
 * structured fields for primary and secondary diagnoses)". Splitting them is
 * more precise, not less faithful: each half can be recorded or missing on its
 * own, and a bundled row would have to hedge about which half was absent.
 *
 * Grouping into five sections is presentation only. No field is added,
 * dropped or reworded.
 */

export interface ProfileField {
  id: string
  label: string
  /**
   * How the field looks when nobody has recorded it.
   *
   * `hatch` for everything, with exactly one exception. A photograph is an
   * identity aid, not a clinical or compliance record; spending the hatch on
   * it would blunt the signal that matters, so it renders an initials monogram
   * and says plainly that no photograph is on file. The test asserts the
   * exception list is exactly this one field.
   */
  whenMissing: 'hatch' | 'plain'
  /** True when nobody has recorded this. Always false for facts that cannot
   *  be absent — a legal name, a date of birth. */
  isUnrecorded: (resident: Resident) => boolean
  render: (resident: Resident) => ReactNode
}

export interface ProfileSection {
  id: string
  title: string
  /** Shown under the section title. Never a bare count. */
  description: string
  fields: ProfileField[]
}

const always = () => false

export const GENERAL_INFORMATION_SECTIONS: ProfileSection[] = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'Who this person is, and how they wish to be addressed.',
    fields: [
      {
        id: 'legal-name',
        label: 'Full legal name',
        whenMissing: 'hatch',
        isUnrecorded: always,
        render: (resident) => <PlainValue>{resident.fullLegalName}</PlainValue>,
      },
      {
        id: 'preferred-name',
        label: 'Preferred name',
        whenMissing: 'hatch',
        isUnrecorded: always,
        render: (resident) => <PlainValue>{resident.preferredName}</PlainValue>,
      },
      {
        id: 'pronouns',
        label: 'Preferred pronouns',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.pronouns.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.pronouns}
            label="Preferred pronouns"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'dob',
        label: 'Date of birth and age',
        whenMissing: 'hatch',
        isUnrecorded: always,
        render: (resident) => (
          <PlainValue>
            <span data-numeric>
              {formatDate(resident.dateOfBirth)} · {ageFrom(resident.dateOfBirth)} years
              old
            </span>
          </PlainValue>
        ),
      },
      {
        id: 'photo',
        label: 'Photograph',
        // The one exception to the hatch. See ProfileField.whenMissing.
        whenMissing: 'plain',
        isUnrecorded: (resident) => resident.photo.kind === 'not_on_file',
        render: (resident) => (
          <div className={styles.photoField}>
            <Avatar photo={resident.photo} name={resident.fullLegalName} size="large" />
            <p className={styles.photoNote}>
              {resident.photo.kind === 'on_file'
                ? 'Photograph on file.'
                : 'No photograph on file — initials shown. A photograph helps staff confirm they are with the right person before writing a record.'}
            </p>
          </div>
        ),
      },
      {
        id: 'nhs-number',
        label: 'NHS number',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.nhsNumber.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.nhsNumber}
            label="NHS number"
            attributed
            render={(value) => <span data-numeric>{value}</span>}
          />
        ),
      },
    ],
  },
  {
    id: 'placement',
    title: 'Placement',
    description: 'Where this person lives in the service, and who funds it.',
    fields: [
      {
        id: 'admitted',
        label: 'Admission date',
        whenMissing: 'hatch',
        isUnrecorded: always,
        render: (resident) => (
          <PlainValue>
            <span data-numeric>{formatDate(resident.admittedOn)}</span>
          </PlainValue>
        ),
      },
      {
        id: 'length-of-stay',
        label: 'Anticipated length of stay',
        whenMissing: 'hatch',
        isUnrecorded: (resident) =>
          resident.anticipatedLengthOfStay.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.anticipatedLengthOfStay}
            label="Anticipated length of stay"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'funding',
        label: 'Funding source',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.fundingSource.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.fundingSource}
            label="Funding source"
            attributed
            render={(value) =>
              FUNDING_SOURCES.find((source) => source.id === value)?.name ?? value
            }
          />
        ),
      },
      {
        id: 'room',
        label: 'Room',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.room.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.room}
            label="Room"
            attributed={false}
            render={(value) => <span data-numeric>Room {value}</span>}
          />
        ),
      },
    ],
  },
  {
    id: 'clinical',
    title: 'Clinical',
    description:
      'Diagnoses and history. Allergies are shown above and on every medication and care screen.',
    fields: [
      {
        id: 'primary-diagnosis',
        label: 'Primary diagnosis',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.primaryDiagnosis.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.primaryDiagnosis}
            label="Primary diagnosis"
            attributed
            render={(value) => value}
          />
        ),
      },
      {
        id: 'secondary-diagnoses',
        label: 'Secondary diagnoses',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.secondaryDiagnoses.kind === 'not_recorded',
        render: (resident) => (
          <RecordedListField
            list={resident.secondaryDiagnoses}
            label="Secondary diagnoses"
            noneLabel="No secondary diagnoses"
            attributed
            render={(values) => (
              <ul className={styles.inlineList}>
                {values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            )}
          />
        ),
      },
      {
        id: 'medical-history',
        label: 'Medical history',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.medicalHistory.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.medicalHistory}
            label="Medical history"
            attributed
            render={(value) => value}
          />
        ),
      },
    ],
  },
  {
    id: 'care-team',
    title: 'Care team',
    description: 'The clinicians and services outside this home.',
    fields: [
      {
        id: 'gp',
        label: 'GP',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.gp.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.gp}
            label="GP"
            attributed
            render={(gp) => (
              <>
                <span>
                  {gp.name} · {gp.practice}
                </span>
                <br />
                <a className={styles.contactLink} href={`tel:${gp.contact.phone}`}>
                  {gp.contact.phone}
                </a>
              </>
            )}
          />
        ),
      },
      {
        id: 'consultants',
        label: 'Consultants and specialists',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.consultants.kind === 'not_recorded',
        render: (resident) => (
          <RecordedListField
            list={resident.consultants}
            label="Consultants and specialists"
            // A recorded negative, not a gap: somebody asked and there are
            // none under this resident's care.
            noneLabel="No consultants or specialists involved"
            attributed
            render={(contacts) => (
              <ul className={styles.contactList}>
                {contacts.map((contact) => (
                  <li key={`${contact.name}-${contact.role}`}>
                    <span>
                      {contact.name} · {contact.role}
                    </span>
                    <br />
                    <span className={styles.contactMeta}>{contact.organisation}</span>
                    <br />
                    <a
                      className={styles.contactLink}
                      href={`tel:${contact.contact.phone}`}
                    >
                      {contact.contact.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          />
        ),
      },
      {
        id: 'pharmacy',
        label: 'Pharmacy',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.pharmacy.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.pharmacy}
            label="Pharmacy"
            attributed
            render={(pharmacy) => (
              <>
                <span>{pharmacy.name}</span>
                <br />
                <a
                  className={styles.contactLink}
                  href={`tel:${pharmacy.contact.phone}`}
                >
                  {pharmacy.contact.phone}
                </a>
              </>
            )}
          />
        ),
      },
    ],
  },
  {
    id: 'person',
    title: 'The person',
    description:
      'How this person communicates, what matters to them, and what they eat.',
    fields: [
      {
        id: 'language',
        label: 'Primary language',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.primaryLanguage.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.primaryLanguage}
            label="Primary language"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'communication',
        label: 'Communication needs and preferences',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.communicationNeeds.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.communicationNeeds}
            label="Communication needs"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'religion',
        label: 'Religion',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.religion.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.religion}
            label="Religion"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'culture',
        label: 'Cultural background',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.culturalBackground.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.culturalBackground}
            label="Cultural background"
            attributed={false}
            render={(value) => value}
          />
        ),
      },
      {
        id: 'diet',
        label: 'Dietary requirements and preferences',
        whenMissing: 'hatch',
        isUnrecorded: (resident) => resident.dietaryRequirements.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.dietaryRequirements}
            label="Dietary requirements"
            // Attributed, despite reading like a preference. Texture-modified
            // and allergy-adjacent needs are clinical instructions that reach
            // a plate; a field mixing "no pork" with "IDDSI level 4" needs a
            // source.
            attributed
            render={(value) => value}
          />
        ),
      },
    ],
  },
]

/** Every field, flattened — what the guard iterates. */
export const GENERAL_INFORMATION_FIELDS: ProfileField[] =
  GENERAL_INFORMATION_SECTIONS.flatMap((section) => section.fields)
