import type { BodyRegionId } from '@/data/types'
import { BodyMap } from '@/assets/body-map/BodyMap'
import { regionLabel } from '@/assets/body-map/regions'
import { Unrecorded } from '@/components/status'
import { Button } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { ChoiceMark } from './ChoiceMark'
import styles from './incidents.module.css'

/**
 * Injury. PRD §6.5.
 *
 * **Three states, not a checkbox.** The distinction is the Evidence Invariant
 * in its original form and it is the whole reason `InjuryMap` has three
 * members:
 *
 *   · **Not checked** — nobody has examined them. A gap, and it shows as one.
 *   · **Checked, none found** — somebody looked. A recorded negative, and it
 *     looks settled (Rule 3).
 *   · **Checked, injuries found** — and then at least one site is required.
 *
 * A checkbox could only say "injury: yes/no", and its unticked state would
 * mean either "no injuries" or "nobody looked" — which are opposite answers on
 * an unwitnessed fall.
 *
 * **"Injuries found" with nothing marked is an incomplete record**, not an
 * empty one, so the list renders hatched until a site is marked and the form
 * will not submit.
 */
export type InjuryChoice = 'not_checked' | 'none_found' | 'found' | undefined

const CHOICES: { id: Exclude<InjuryChoice, undefined>; title: string; note: string }[] =
  [
    {
      id: 'not_checked',
      title: 'Not checked yet',
      note: 'Nobody has examined them. This is a gap, and it will show as one.',
    },
    {
      id: 'none_found',
      title: 'Checked: no injury found',
      note: 'Somebody looked. A recorded negative, not a blank.',
    },
    {
      id: 'found',
      title: 'Checked: injuries found',
      note: 'Mark each site on the body map.',
    },
  ]

export function InjurySection({
  choice,
  marked,
  onChoice,
  onToggle,
}: {
  choice: InjuryChoice
  marked: BodyRegionId[]
  onChoice: (choice: Exclude<InjuryChoice, undefined>) => void
  onToggle: (id: BodyRegionId) => void
}) {
  return (
    <section className={styles.section} aria-labelledby="injury-heading">
      <h2 className={styles.sectionTitle} id="injury-heading">
        Injury
      </h2>

      <div
        className={styles.choices}
        role="radiogroup"
        aria-labelledby="injury-heading"
      >
        {CHOICES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={choice === option.id}
            className={[
              styles.choice,
              choice === option.id ? styles.choiceSelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-injury-choice={option.id}
            onClick={() => onChoice(option.id)}
          >
            <ChoiceMark selected={choice === option.id} />
            <span className={styles.choiceTitle}>{option.title}</span>
            <span className={styles.choiceNote}>{option.note}</span>
          </button>
        ))}
      </div>

      {choice === 'found' ? (
        <div className={styles.mapArea} data-body-map-area>
          <div className={styles.maps}>
            <div className={styles.mapBox}>
              <h3 className={styles.mapCaption}>Front</h3>
              <BodyMap view="front" marked={marked} onToggle={onToggle} />
            </div>
            <div className={styles.mapBox}>
              <h3 className={styles.mapCaption}>Back</h3>
              <BodyMap view="back" marked={marked} onToggle={onToggle} />
            </div>
          </div>

          <div className={styles.markedPanel}>
            <h3 className={styles.mapCaption}>Sites marked</h3>
            <MarkedList marked={marked} onToggle={onToggle} />
            {/* Said on the screen, not only in the code: the list is what the
                record holds, and the map is the way of entering it. */}
            <p className={styles.mapHint}>
              The list is the record; the map is a way of entering it.
            </p>
            <p className={styles.mapHint}>
              Left and right are {"the resident's"}, not yours. Their left arm is on the
              right of the front view and the left of the back view.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function MarkedList({
  marked,
  onToggle,
}: {
  marked: BodyRegionId[]
  onToggle: (id: BodyRegionId) => void
}) {
  if (marked.length === 0) {
    return (
      <div data-marked-empty>
        <Unrecorded
          variant="chip"
          label="No site marked"
          detail={
            '“Injuries found” with nothing marked is an incomplete record: mark each site, or say no injury was found'
          }
        />
      </div>
    )
  }

  return (
    <ul className={styles.markedList}>
      {marked.map((id) => (
        <li key={id} className={styles.markedRow} data-marked-site={id}>
          <span className={styles.markedName}>{regionLabel(id)}</span>
          <Button
            variant="ghost"
            size="small"
            aria-label={`Remove ${regionLabel(id)}`}
            onClick={() => onToggle(id)}
          >
            <Icon name="add-remove-delete/remove-01" size={16} aria-hidden />
            Remove
          </Button>
        </li>
      ))}
    </ul>
  )
}
