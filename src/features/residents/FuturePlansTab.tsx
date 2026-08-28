import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import { Card, CardHeader } from '@/components/primitives'
import { Field, FieldList } from './FieldList'
import { FUTURE_PLANS_SECTIONS } from './future-plans-sections'
import styles from './profile.module.css'

/**
 * The Future Plans tab. PRD §6.2 — "DNAR, ADRT, advance care plan, preferred
 * place of care and death, funeral and religious preferences. Every entry
 * date-stamped, signed, version-controlled. Changing a DNAR or ADRT raises a
 * confirmation naming the resident and warning that all staff on shift are
 * notified."
 *
 * Same visual language as the three tabs before it. Two things are particular
 * to this one:
 *
 *  1. **The resuscitation decision is a panel, not a row.** §2.1 — "for DNAR
 *     the same ambiguity is catastrophic in both directions". It is the only
 *     field on the tab somebody reads in seconds, under pressure, and the only
 *     one whose unrecorded state is itself an outcome: with no decision
 *     recorded, CPR is attempted.
 *  2. **The two change controls are live.** They raise a real confirmation
 *     naming the resident and the site whose staff are notified, and write
 *     nothing. See ClinicalChangeControl.
 *
 * Every entry shows who signed it, when, and which version — the three things
 * §6.2 asks for, all visible, none hover-only.
 */
export function FuturePlansTab() {
  const profile = useOutletContext<ResidentProfile>()

  return (
    <div className={styles.tabPanel}>
      <Card padded>
        <p className={styles.tabIntro}>
          Recorded in advance, while this person could say what they wanted. Every entry
          is listed, recorded or not.
        </p>
      </Card>

      {FUTURE_PLANS_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.title} subtitle={section.description} />
          {section.banner ? section.banner(profile) : null}
          <div className={styles.sectionBody}>
            <FieldList>
              {section.entries.map((entry) => (
                <Field
                  key={entry.id}
                  id={entry.id}
                  label={entry.label}
                  width={entry.width}
                >
                  {entry.render(profile)}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </div>
  )
}
