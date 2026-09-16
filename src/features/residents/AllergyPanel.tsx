import type { AllergyStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { ClinicalChangeControl } from './ClinicalChangeControl'
import { Attribution } from './FieldList'
import styles from './profile.module.css'

/**
 * Allergies, as a full-width panel at the top of Clinical rather than as row
 * twelve of sixteen.
 *
 * This is the one field on the tab where being easy to miss has a body count,
 * and it is also the sharpest illustration of the Evidence Invariant in the
 * whole product — the reason `AllergyStatus` has three members and not a
 * nullable array. Each renders as a visibly different kind of answer:
 *
 *   Penicillin — anaphylaxis          a recorded value, critical
 *   No known allergies                a recorded NEGATIVE, settled and green
 *   Not recorded                      a gap, hatched
 *
 * Green for the recorded negative and blue for the recorded negative on the
 * care team lists is not an inconsistency. "Somebody asked, and there are no
 * allergies" is genuinely good news that makes the next medication round
 * safer; "somebody asked, and there are no consultants" is neutral news
 * nobody is better off for. PRD §6.2 names the allergy case green
 * specifically, and that is the one it names.
 *
 * The hatched state goes through <Unrecorded>, which is the only component
 * permitted to apply the hatch. It therefore carries that component's border
 * rather than the thicker left edge the other two have — the alternative was
 * composing the hatch into a second stylesheet, which is precisely the hole
 * scripts/check-hatch.mjs exists to keep shut.
 */

const CAPTION = 'Allergies and adverse reactions'

const SEVERITY: Record<'mild' | 'moderate' | 'severe' | 'anaphylaxis', string> = {
  mild: 'mild reaction',
  moderate: 'moderate reaction',
  severe: 'severe reaction',
  anaphylaxis: 'anaphylaxis',
}

/**
 * What recording an allergy would say, per state. Named here rather than
 * inline so all three read as one decision — the DNAR panel does the same.
 *
 * Every one says what the record changes for whoever gives medication; the
 * resident is named in the question (PRD §2.4).
 */
const CHANGE: Record<
  AllergyStatus['kind'],
  { button: string; action: string; description: string; confirm: string }
> = {
  not_recorded: {
    button: 'Record allergies',
    action: 'Record allergies',
    description:
      'Until it is recorded, medication must not be given on the assumption there are none.',
    confirm: 'Record allergies',
  },
  none_known: {
    button: 'Change allergy record',
    action: 'Change the allergy record',
    description: 'Changing it alters what staff may give {name}.',
    confirm: 'Change record',
  },
  allergies: {
    button: 'Change allergy record',
    action: 'Change the allergy record',
    description: 'Changing a recorded allergy alters what staff may give {name}.',
    confirm: 'Change record',
  },
}

export function AllergyPanel({
  status,
  residentName,
  siteName,
  onRecordNoneKnown,
}: {
  status: AllergyStatus
  residentName: string
  siteName: string
  /**
   * Records the negative. Live from Phase 16, and only the negative.
   *
   * **An allergy itself needs a substance, a reaction and a severity**, which
   * is a form rather than a confirmation — it is on the admission screen and
   * belongs on an edit drawer, not behind a yes/no dialog. What this control
   * can honestly write is "no known allergies", which is a recorded negative
   * with somebody's name on it.
   */
  onRecordNoneKnown?: () => void
}) {
  const copy = CHANGE[status.kind]
  const fill = (text: string) => text.replaceAll('{name}', residentName)

  /**
   * The write affordance allergies did not have.
   *
   * DNAR and the primary contact both carried a phase-tagged stub; allergies —
   * the field PRD §2.1 names as the one a blank cell gets fatally wrong, and
   * the one every medication screen reads — had no control at all. A reader
   * looking at "Not recorded" had nowhere to go and nothing telling them the
   * writing of it is simply unbuilt.
   *
   * From Phase 16 it records the negative — a care worker can say "no known
   * allergies" and put their name to it. Recording an allergy itself needs
   * three fields and lives on the edit drawer.
   */
  const control = (
    <ClinicalChangeControl
      residentName={residentName}
      siteName={siteName}
      buttonLabel={copy.button}
      action={copy.action}
      description={fill(copy.description)}
      confirmLabel={copy.confirm}
      destructive={status.kind !== 'not_recorded'}
      {...(status.kind === 'not_recorded' && onRecordNoneKnown !== undefined
        ? { onConfirmed: onRecordNoneKnown }
        : {})}
    />
  )

  switch (status.kind) {
    case 'not_recorded':
      return (
        <div className={styles.bannerSlot} data-allergies={status.kind}>
          <Unrecorded
            variant="panel"
            caption={CAPTION}
            label="Not recorded"
            detail="Nobody has recorded whether this person has allergies. That is not the same as having none, and medication must not be given on the assumption that it is."
          />
          <div className={styles.bannerActions}>{control}</div>
        </div>
      )

    case 'none_known':
      return (
        <div className={styles.bannerSlot} data-allergies={status.kind}>
          <div className={`${styles.banner} ${styles.bannerSettled}`}>
            <p className={styles.bannerCaption}>{CAPTION}</p>
            <p className={styles.bannerHeadline}>No known allergies</p>
            <p className={styles.bannerDetail}>
              Somebody asked and confirmed there are none. This is a complete record,
              not a gap.
            </p>
            <Attribution by={status.recordedBy} at={status.recordedAt} />
          </div>
          <div className={styles.bannerActions}>{control}</div>
        </div>
      )

    case 'allergies':
      return (
        <div className={styles.bannerSlot} data-allergies={status.kind}>
          <div className={`${styles.banner} ${styles.bannerCritical}`}>
            <p className={styles.bannerCaption}>
              <Icon name="alert-notification/alert-02" size={16} />
              {CAPTION}
            </p>
            <ul className={styles.bannerList}>
              {status.items.map((allergy) => (
                <li key={allergy.substance}>
                  <span className={styles.bannerHeadline}>{allergy.substance}</span>
                  <span className={styles.bannerDetail}>
                    {allergy.reaction} · {SEVERITY[allergy.severity]}
                  </span>
                </li>
              ))}
            </ul>
            <Attribution by={status.recordedBy} at={status.recordedAt} />
          </div>
          <div className={styles.bannerActions}>{control}</div>
        </div>
      )

    default:
      return assertNever(status)
  }
}
