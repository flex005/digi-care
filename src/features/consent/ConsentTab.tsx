import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { AnyConsent, ConsentTypeId } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Card } from '@/components/primitives'
import { ConsentBadge } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount } from '@/lib/format'
import { ConsentAuthority, EffectCountValue } from './ConsentParts'
import { CONSENT_MEANS } from './consent-meaning'
import { FamilyAccessSection } from '@/features/family/FamilyAccessSection'
import styles from './consent.module.css'

/**
 * A resident's consents. PRD §6.7, Phase 10.
 *
 * The sentence: **these consents have never been sought.**
 *
 * All eight types always listed, iterated from the constant — a list of only
 * the ones somebody got round to asking about reads as a complete picture, and
 * absence from a list is the same bug as a blank cell.
 *
 * **Never sought is not refusal and it is not permission.** Care given without
 * either is care given without consent, which is why it takes the hatch rather
 * than sitting quietly at the bottom of the list.
 */
export function ConsentTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  /*
   * Bumped when a family member is named or removed. The store is this
   * session's and the section reads it on render, so a counter is what makes
   * the list agree with what somebody just did.
   */
  const [, setVersion] = useState(0)
  const onChanged = () => setVersion((count: number) => count + 1)

  const rows = CONSENT_TYPES.map((type) => ({
    type,
    status: resident.consents[type.id] as AnyConsent,
  }))
  const neverSought = rows.filter((row) => row.status.kind === 'not_sought').length

  return (
    <div className={styles.tabPanel} data-consent-panel>
      <div className={styles.lead} data-never-sought={neverSought}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(neverSought)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            of <span data-numeric>{formatCount(rows.length)}</span> consents have never
            been sought
          </span>
          <span className={styles.leadDetail}>
            Nobody has asked {resident.preferredName}, and nobody has decided on their
            behalf. Never sought is not refusal and it is not permission, care given
            without either is care given without consent.
          </span>
        </span>
      </div>

      <Card>
        <ul className={styles.consentList}>
          {rows.map(({ type, status }) => (
            <li key={type.id}>
              <div className={styles.consentRow} data-consent={type.id}>
                <div>
                  <p className={styles.typeName}>{type.name}</p>
                  {/* A consent nobody can explain is not informed. */}
                  <p className={styles.typeMeans} data-means>
                    {CONSENT_MEANS[type.id as ConsentTypeId]}
                  </p>
                  {status.kind === 'withdrawn' && status.remains.length > 0 ? (
                    <Remains status={status} />
                  ) : null}
                </div>

                <span data-outcome={status.kind}>
                  <ConsentBadge status={status} />
                </span>

                <ConsentAuthority status={status} />

                <Link
                  to={type.id}
                  className={
                    status.kind === 'not_sought' ? styles.actionPrimary : styles.action
                  }
                  data-action={status.kind === 'not_sought' ? 'seek' : 'change'}
                  aria-label={`${
                    status.kind === 'not_sought' ? 'Seek' : 'Change'
                  } consent for ${type.name}, ${resident.fullLegalName}`}
                >
                  {status.kind === 'not_sought' ? 'Seek consent' : 'Change'}
                  <Icon
                    name="arrows-sharp/arrow-right-01-sharp"
                    size={16}
                    aria-hidden
                  />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {/*
       * **FAM-01, on the Consent tab, which is where AM v2.0 puts it and where
       * it belongs.** The basis for family access is this resident's
       * `family_portal` consent, so the screen that names family members sits
       * beside the record that authorises them rather than in a module of its
       * own — two places would be two records of one fact.
       */}
      <FamilyAccessSection resident={resident} onChanged={onChanged} />
    </div>
  )
}

/**
 * What withdrawing did not undo, still true today.
 *
 * Rendered from the record rather than from a sentence, so a withdrawal that
 * left photographs on file cannot read as one that removed them.
 */
function Remains({ status }: { status: Extract<AnyConsent, { kind: 'withdrawn' }> }) {
  return (
    <div className={styles.remains} data-remains={status.remains.length}>
      <p className={styles.remainsTitle}>What withdrawing did not undo</p>
      <p className={styles.remainsIntro}>
        Withdrawing stopped anything new. It did not remove what already exists, and
        nothing here happened automatically: each of these is somebody&rsquo;s job.
      </p>
      <ul className={styles.remainsList}>
        {status.remains.map((effect) => (
          <li className={styles.effect} key={effect.name} data-effect={effect.name}>
            <span>
              <span className={styles.effectName}>{effect.name}</span>
              <span className={styles.effectWhy}>{effect.explanation}</span>
            </span>
            <EffectCountValue count={effect.count} />
          </li>
        ))}
      </ul>
    </div>
  )
}
