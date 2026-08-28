import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import type { Resident } from '@/data/types'
import { Card, CardHeader } from '@/components/primitives'
import { Field, FieldList } from './FieldList'
import { IMPORTANT_PEOPLE_SECTIONS } from './important-people-sections'
import styles from './profile.module.css'

/**
 * The Important People tab. PRD §6.2 — "next of kin, emergency contact, LPA
 * holder with document link, social worker, professionals. Each with
 * communication preference. Primary contact toggle."
 *
 * Same visual language as General Information and Needs: 20px section title
 * over a one-line description above a divider, label-left value-right rows,
 * the same three answer types.
 *
 * The failure this tab is exposed to is not a blank field — it is a missing
 * category. All seven are listed for every resident. A tab that showed only
 * the people somebody had got round to entering would read as the complete
 * set of people who matter to this person, and "no advocate recorded" and
 * "assessed as not needing one" would be the same empty space.
 *
 * Who the home rings first is a panel rather than a marker on one of seven
 * blocks — see PrimaryContactPanel. The toggle PRD §6.2 names is a button that
 * raises a real confirmation naming the subject, and writes nothing; see
 * PrimaryContactControl for why both halves of that are deliberate.
 */
export function ImportantPeopleTab() {
  const { resident } = useOutletContext<ResidentProfile>()

  return (
    <div className={styles.tabPanel}>
      <PeopleSections resident={resident} />
    </div>
  )
}

/**
 * Exported so the structural guard can iterate all 32 residents against **the
 * real rendering** rather than a harness that re-implements it.
 */
export function PeopleSections({ resident }: { resident: Resident }) {
  return (
    <>
      {IMPORTANT_PEOPLE_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.title} subtitle={section.description} />
          {section.banner ? section.banner(resident) : null}
          <div className={styles.sectionBody}>
            <FieldList>
              {section.categories.map((category) => (
                <Field key={category.id} id={category.id} label={category.label}>
                  {category.render(resident)}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </>
  )
}
