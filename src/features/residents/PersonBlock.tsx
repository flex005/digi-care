import type {
  CommunicationPreference,
  ContactDetails,
  ImportantPerson,
  Recorded,
} from '@/data/types'
import { CONTACT_METHODS } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { telHref } from '@/lib/phone'
import { PrimaryContactControl } from './PrimaryContactControl'
import styles from './profile.module.css'

/**
 * A person, rendered the same way wherever one appears on Important People.
 *
 * Name and relationship first, then the ways to reach them, then how they
 * have asked to be reached, then whether they are the one the home rings
 * first. In that order because that is the order somebody needs them: the
 * relationship qualifies the name, and the communication preference qualifies
 * the phone number above it.
 */

const METHOD_NAMES = new Map(CONTACT_METHODS.map((method) => [method.id, method.name]))

export function ContactLines({ contact }: { contact: ContactDetails }) {
  return (
    <p className={styles.personLine}>
      <a className={styles.contactLink} href={telHref(contact.phone)}>
        {contact.phone}
      </a>
      <span className={styles.contactMeta}> · {contact.email}</span>
    </p>
  )
}

/**
 * How this person has asked to be contacted, and in what language.
 *
 * `unrecorded` is not cosmetic here. Ringing somebody who asked to be written
 * to, or ringing in English somebody who asked for Yoruba, is how a family
 * finds out something has happened from the wrong person in the wrong words.
 */
export function CommunicationPreferenceLine({
  preference,
}: {
  preference: Recorded<CommunicationPreference>
}) {
  if (preference.kind === 'unrecorded') {
    return (
      <div className={styles.personPreference}>
        <span className={styles.personPreferenceLabel}>Preferred contact</span>
        <Unrecorded
          variant="chip"
          label="Not recorded"
          detail="nobody has asked how this person wants to be contacted, or in what language"
        />
      </div>
    )
  }

  return (
    <div className={styles.personPreference}>
      <span className={styles.personPreferenceLabel}>Preferred contact</span>
      <span className={styles.personPreferenceValue}>
        {METHOD_NAMES.get(preference.value.method) ?? preference.value.method} ·{' '}
        {preference.value.language}
      </span>
    </div>
  )
}

export function PersonBlock({
  person,
  residentName,
  /** Extra facts this person carries that a plain contact does not — an LPA
   *  type and its document, a local authority and its review date. */
  extra,
}: {
  person: ImportantPerson
  residentName: string
  extra?: React.ReactNode
}) {
  return (
    <div className={styles.person}>
      <p className={styles.personName}>
        {person.name}
        <span className={styles.personRelationship}> · {person.relationship}</span>
      </p>
      <ContactLines contact={person.contact} />
      <p className={styles.personLine}>{person.address}</p>
      {extra}
      <CommunicationPreferenceLine preference={person.communicationPreference} />
      {person.isPrimaryContact ? (
        // Marks which of the people on this tab holds it. The panel at the
        // top says what holding it means, so this does not repeat it.
        <StatusPill tone="info" label="Primary contact" />
      ) : (
        <PrimaryContactControl
          personName={person.name}
          relationship={person.relationship}
          residentName={residentName}
        />
      )}
    </div>
  )
}
