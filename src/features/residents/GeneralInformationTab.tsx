import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import type { Resident } from '@/data/types'
import { Card, CardHeader } from '@/components/primitives'
import { AllergyBadge, Unrecorded } from '@/components/status'
import { Field, FieldList } from './FieldList'
import { GENERAL_INFORMATION_SECTIONS } from './general-information-fields'
import styles from './profile.module.css'

/**
 * The General Information tab. PRD §6.2 — "all fields from source PRD §16.2".
 *
 * Two rules govern every row:
 *
 *  1. **Never an empty row, never an em dash.** A field either has a value or
 *     says in words that nobody recorded one. "—" is the most common way a
 *     care record turns "nobody asked" into "nothing to report".
 *  2. **Clinical and compliance fields carry their author and date**
 *     (CLAUDE.md §6). Person-centred fields do not, because sixteen
 *     attribution lines would bury the values they annotate.
 *
 * Allergies get a panel rather than a row. §6.2: they render in
 * `--status-critical` wherever they appear. As one row among twenty they would
 * read like any other; they are the field on this tab most likely to kill
 * somebody, and the only one with a three-state union where a recorded
 * negative must look different again from both a finding and a gap.
 *
 * There are no edit controls. No phase in either document builds resident
 * editing, and a disabled Edit button would be inventing a feature in order to
 * disable it.
 */
export function GeneralInformationTab() {
  const { resident } = useOutletContext<ResidentProfile>()

  return (
    <div className={styles.tabPanel}>
      <Card>
        <CardHeader
          title="Allergies and adverse reactions"
          subtitle="Shown here, in the profile header, and on every medication and care screen."
        />
        <div className={styles.allergyPanel}>
          <AllergyBadge status={resident.allergies} />
          {resident.allergies.kind === 'allergies' ? (
            <ul className={styles.allergyDetail}>
              {resident.allergies.items.map((allergy) => (
                <li key={allergy.substance}>
                  <strong>{allergy.substance}</strong> — {allergy.reaction} (
                  {allergy.severity})
                </li>
              ))}
            </ul>
          ) : null}
          {resident.allergies.kind === 'not_recorded' ? (
            <p className={styles.allergyNote}>
              Nobody has recorded whether this person has allergies. That is not the
              same as having none, and medication must not be given on the assumption
              that it is.
            </p>
          ) : null}
        </div>
      </Card>

      <ProfileSections resident={resident} />
    </div>
  )
}

/**
 * The five field sections. Exported so the structural guard can iterate all 32
 * residents against **the real rendering** rather than a test harness that
 * re-implements it — a guard that tests a copy of the logic proves only that
 * the copy agrees with itself.
 */
export function ProfileSections({ resident }: { resident: Resident }) {
  return (
    <>
      {GENERAL_INFORMATION_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.title} subtitle={section.description} />
          <div className={styles.sectionBody}>
            <FieldList>
              {section.fields.map((field) => (
                <Field key={field.id} id={field.id} label={field.label}>
                  {field.isUnrecorded(resident) && field.whenMissing === 'hatch' ? (
                    <Unrecorded label={`${field.label} not recorded`} />
                  ) : (
                    field.render(resident)
                  )}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </>
  )
}
