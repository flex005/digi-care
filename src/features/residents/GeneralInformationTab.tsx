import { now as appNow } from '@/data/fixtures/clock'
import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import type { Resident } from '@/data/types'
import { Card, CardHeader } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Field, FieldList } from './FieldList'
import { GENERAL_INFORMATION_SECTIONS } from './general-information-fields'
import styles from './profile.module.css'
import { useState } from 'react'
import type { IsoDateTime } from '@/data/types'
import { editResident } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'

/**
 * The General Information tab. PRD §6.2 — "all fields from source PRD §16.2".
 *
 * Five sections, each headed by a 20px title and a one-line description of
 * what the section is for in the reader's terms, above a divider. The
 * description is not decoration: "Care team" alone does not tell a care
 * worker that this is who to ring about somebody's health rather than who to
 * ring about somebody's laundry.
 *
 * Three rules govern every row:
 *
 *  1. **Never an empty row, never an em dash.** A field either has a value or
 *     says in words that nobody recorded one. "—" is the most common way a
 *     care record turns "nobody asked" into "nothing to report".
 *  2. **The three answer types stay visibly apart.** A recorded value reads
 *     plainly; a recorded negative is a settled tinted pill with an author and
 *     a date, because somebody asked and confirmed it; a gap is hatched and
 *     says what is missing. Ismail Sowande's Placement section and Wilfred
 *     Merrivale's Care team each show all three at once.
 *  3. **Clinical and compliance fields carry their author and date**
 *     (CLAUDE.md §6). Person-centred fields do not, because sixteen
 *     attribution lines would bury the values they annotate.
 *
 * Allergies are a full-width panel at the top of Clinical rather than a row —
 * see AllergyPanel for why that is not a cosmetic preference.
 *
 * **Editing arrives in Phase 16, and it is field by field.** Each change has
 * its own author, its own moment and its own confirmation; a form with a save
 * button invites somebody to sweep four corrections and a clinical change into
 * one signature, which is the wrong shape for a clinical record.
 */
export function GeneralInformationTab() {
  const { resident, site } = useOutletContext<ResidentProfile>()
  const { currentUser } = useSession()
  const [, setVersion] = useState(0)

  return (
    <div className={styles.tabPanel}>
      <ProfileSections
        resident={resident}
        siteName={site.name}
        onRecordNoneKnown={() => {
          void editResident({
            residentId: resident.id,
            field: 'no known allergies',
            patch: {
              allergies: {
                kind: 'none_known',
                recordedBy: currentUser,
                recordedAt: appNow().toISOString() as IsoDateTime,
              },
            },
            by: currentUser,
          }).then(() => setVersion((count) => count + 1))
        }}
      />
    </div>
  )
}

/**
 * The five field sections. Exported so the structural guard can iterate all 32
 * residents against **the real rendering** rather than a test harness that
 * re-implements it — a guard that tests a copy of the logic proves only that
 * the copy agrees with itself.
 */
export function ProfileSections({
  resident,
  /** Named on any confirmation a banner raises. See ProfileSection.banner. */
  siteName,
  onRecordNoneKnown,
}: {
  resident: Resident
  siteName: string
  /** What a banner's write affordance calls. Absent in the structural guard. */
  onRecordNoneKnown?: () => void
}) {
  return (
    <>
      {GENERAL_INFORMATION_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.title} subtitle={section.description} />
          {section.banner
            ? section.banner(resident, siteName, onRecordNoneKnown ?? (() => {}))
            : null}
          <div className={styles.sectionBody}>
            <FieldList>
              {section.fields.map((field) => (
                <Field
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  width={field.width}
                >
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
