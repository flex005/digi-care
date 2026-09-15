import { useState } from 'react'
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'
import type { SiteId } from '@/data/types'
import { Switch } from '@/components/primitives'
import { isActive, setActive } from '@/data/access/site-config-store'
import { residentsBySite } from '@/data/fixtures/residents'
import { pluralise } from '@/lib/format'
import styles from './group.module.css'

/**
 * Which questions this home asks. AM v2.0 SETT-01, Phase 22.
 *
 * **These are the settings that reach back**, which is what separates them
 * from the review interval two sections up. Changing the interval is a claim
 * about the future and moves nothing already written. Turning a template off
 * changes what a record already on file is saying: `RiskStatus.not_assessed`
 * stops meaning only *nobody has done this* and starts also meaning *this home
 * does not do this*, which is a blank meaning two things inside the type built
 * to refuse one.
 *
 * So the toggle states what it will do before it is thrown, counted. Turning
 * one off does not clear a single assessment — somebody did those, with their
 * name and the date on them — and it does not hide them either. What changes
 * is what an *unanswered* one means, and the screens that iterate these lists
 * render the pair.
 */
export function ConfiguredLists({
  siteId,
  siteName,
  onChanged,
}: {
  siteId: SiteId
  siteName: string
  onChanged: () => void
}) {
  const [, setVersion] = useState(0)
  const residents = residentsBySite(siteId).length

  const sets = [
    {
      id: 'templates',
      title: 'Risk assessments this home carries out',
      items: RISK_ASSESSMENT_TEMPLATES.map((t) => ({ id: t.id, name: t.name })),
      /*
       * Nine rather than the ten AM v2.0 names. The Mental Capacity Act
       * two-stage test left the risk assessments in Phase 5 as a recorded
       * departure: it is a capacity determination and not a risk, and forcing
       * it into a union whose job is to produce a risk level would make it say
       * something it does not say.
       */
      note: 'Nine, not the ten the source PRD names: the Mental Capacity Act two-stage test is a capacity determination rather than a risk, and it lives in the consent module.',
    },
    {
      id: 'domains',
      title: 'Care plan domains this home writes',
      items: CARE_PLAN_DOMAINS.map((d) => ({ id: d.id, name: d.name })),
      note: 'These ten and no others. Adding a domain of a home’s own is not built yet, and there is no control for it on any screen. The rules for it are agreed: it would belong to one home, that home’s denominator would say so, and no rate would be compared across homes whose domains differ.',
    },
    {
      id: 'consents',
      title: 'Consents this home seeks',
      items: CONSENT_TYPES.map((c) => ({ id: c.id, name: c.name })),
      note: 'These eight and no others. A resident’s consents are a mapped type over exactly these keys, which is what makes a blanket capacity decision unexpressible and stops a consent referencing an assessment that does not name its type; a custom type would give that up for all eight.',
    },
  ]

  return (
    <>
      {sets.map((set) => (
        <section
          key={set.id}
          className={styles.settingsSection}
          data-settings-section={set.id}
        >
          <h2 className={styles.settingsTitle}>{set.title}</h2>
          <p className={styles.settingsNote}>{set.note}</p>
          <p className={styles.settingsNote}>
            <b>Turning one off clears nothing.</b> Every assessment, domain and consent
            already recorded stays exactly where it is, with the name and date it was
            written under. What changes is what an <em>unanswered</em> one means: it
            stops being a gap somebody can close and becomes a question this home does
            not ask. That moves what {siteName} is expected to hold, across{' '}
            {pluralise(residents, 'resident')}.
          </p>

          <ul className={styles.toggles}>
            {set.items.map((item) => {
              const on = isActive(siteId, item.id)
              return (
                <li key={item.id} className={styles.toggleRow} data-toggle={item.id}>
                  <span
                    className={styles.toggleState}
                    data-toggle-state={on ? 'on' : 'off'}
                  >
                    {on
                      ? `asked of every resident at ${siteName}`
                      : 'not asked here; anything already recorded stays'}
                  </span>
                  <Switch
                    label={item.name}
                    checked={on}
                    onCheckedChange={(next) => {
                      setActive(siteId, item.id, next)
                      setVersion((count) => count + 1)
                      onChanged()
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
