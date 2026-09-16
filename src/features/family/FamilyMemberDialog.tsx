import { useState } from 'react'
import type { FamilyAccessLevel, FamilyMember, Resident } from '@/data/types'
import { ACCESS_LEVELS, currentDetails, recordedAccess } from '@/data/types'
import { Button, Dialog } from '@/components/primitives'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import {
  defaultAccessLevel,
  editMember,
  grantAccess,
} from '@/data/access/family-access-store'
import { staffLabel } from '@/data/access/team-store'
import { NOTHING_WAS_SENT, TELL_THEM } from './family-statement'
import styles from './family.module.css'

/**
 * Naming somebody, or correcting what is on their record. Phase 27.
 *
 * **The form lives here rather than open on the tab.** A tab whose job is to
 * say who has access is a list with an action; a form sitting open on it is a
 * screen asking to be filled in, on every visit, whether or not anybody is
 * adding anybody.
 *
 * **And the statement that nothing is sent belongs at the point of
 * recording.** On the tab it is a standing notice nobody reads by the second
 * visit. Here it is in front of somebody at the moment they would otherwise
 * assume a family member has been told, which is the act it exists to stop.
 *
 * **An edit keeps the original recording.** Correcting a mistyped email by
 * removing somebody and naming them again would discard who granted the access
 * and when — the record of the decision rather than a detail of it. So the
 * dialog says whose recording it is keeping, and the store appends a revision.
 */
export type DialogMode =
  { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; member: FamilyMember }

export function FamilyMemberDialog({
  resident,
  mode,
  onClose,
  onSaved,
}: {
  resident: Resident
  mode: DialogMode
  onClose: () => void
  onSaved: () => void
}) {
  if (mode.kind === 'closed') return null
  return (
    <Form
      /*
       * Keyed by who is being edited, so opening the dialog on a second person
       * builds fresh state rather than showing the first one's details in the
       * second one's form — a wrong-subject write on a screen whose whole
       * subject is who may see somebody's record.
       */
      key={mode.kind === 'edit' ? mode.member.id : 'add'}
      resident={resident}
      mode={mode}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function Form({
  resident,
  mode,
  onClose,
  onSaved,
}: {
  resident: Resident
  mode: Exclude<DialogMode, { kind: 'closed' }>
  onClose: () => void
  onSaved: () => void
}) {
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const existing = mode.kind === 'edit' ? currentDetails(mode.member) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [relationship, setRelationship] = useState(existing?.relationship ?? '')
  const [email, setEmail] = useState(
    existing?.email.kind === 'recorded' ? existing.email.value : '',
  )
  const [level, setLevel] = useState<FamilyAccessLevel>(
    existing?.level ?? defaultAccessLevel(),
  )
  const [failure, setFailure] = useState('')

  const named = name.trim() !== '' && relationship.trim() !== ''
  const unchanged =
    existing !== undefined &&
    name.trim() === existing.name &&
    relationship.trim() === existing.relationship &&
    email.trim() === (existing.email.kind === 'recorded' ? existing.email.value : '') &&
    level === existing.level

  const waiting: string[] = []
  if (name.trim() === '') waiting.push('their name')
  if (relationship.trim() === '') waiting.push('how they are related')
  if (unchanged) waiting.push('something to change')

  const save = () => {
    if (!named || unchanged) return
    try {
      if (mode.kind === 'edit') {
        editMember(mode.member.id, {
          name,
          relationship,
          email,
          level,
          by: currentUser,
        })
      } else {
        grantAccess({
          residentId: resident.id,
          name,
          relationship,
          email,
          level,
          by: currentUser,
        })
      }
      onSaved()
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={
        mode.kind === 'edit'
          ? `Change what is recorded for ${existing!.name}`
          : `Give somebody access to ${resident.preferredName}'s updates`
      }
      description={
        mode.kind === 'edit'
          ? 'A correction, kept beside the original recording rather than in place of it.'
          : `They go on ${resident.preferredName}'s record as somebody who may see their updates, under the consent already on file.`
      }
      actions={
        <>
          <p className={styles.hint} data-dialog-waiting>
            {waiting.length > 0 ? `Waiting on: ${waiting.join(' · ')}` : ''}
          </p>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={!named || unchanged}
            data-save-member
            onClick={save}
          >
            {mode.kind === 'edit' ? 'Save the change' : 'Record their access'}
          </Button>
        </>
      }
    >
      <div className={styles.dialogForm} data-member-dialog={mode.kind}>
        {mode.kind === 'edit' ? (
          /*
           * **Who recorded the access, and that this does not move it.** The
           * reason remove-and-re-add is not a correction, said where somebody
           * would otherwise be deciding between the two.
           */
          <p className={styles.memberState} data-keeps-recording>
            Recorded by {staffLabel(recordedAccess(mode.member).by)} on{' '}
            <span data-numeric>{format.dateTime(recordedAccess(mode.member).at)}</span>.
            That stays as it is, and your name goes on the change.
          </p>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Their name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-field="family-name"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Their relationship to {resident.preferredName}
          </span>
          <input
            type="text"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            data-field="family-relationship"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Their email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-field="family-email"
          />
          {/*
           * Left blank is recorded as nobody having taken one, never as an
           * empty string: "we have no address for her" and "she has no email"
           * are different facts about a person somebody may need to reach.
           */}
          <span className={styles.hint}>
            Leave it blank if nobody has taken one, and the record will say that rather
            than showing an empty line.
          </span>
        </label>

        <fieldset className={styles.levels}>
          <legend className={styles.fieldLabel}>How much they would see</legend>
          {ACCESS_LEVELS.map((entry) => (
            /*
             * `htmlFor` rather than wrapping. jsx-a11y could not see the
             * label's text through two nested spans and said so, and the
             * explicit association is what a screen reader wants anyway.
             */
            <label
              key={entry.id}
              htmlFor={`family-level-${entry.id}`}
              className={level === entry.id ? styles.levelOn : styles.level}
              data-level-option={entry.id}
            >
              <input
                id={`family-level-${entry.id}`}
                type="radio"
                name="family-level"
                checked={level === entry.id}
                onChange={() => setLevel(entry.id)}
              />
              <b className={styles.levelName}>{entry.label}</b>
              <span className={styles.levelMeans}>{entry.means}</span>
            </label>
          ))}
          {mode.kind === 'edit' && level !== existing!.level ? (
            <span className={styles.hint} data-level-appends>
              The level they had stays on the record with the date it changed, because
              what was shared with them while it stood was shared under it.
            </span>
          ) : null}
        </fieldset>

        {/*
         * **At the point of recording, not on the tab.** The risk is somebody
         * believing an invitation went out and not telephoning the family, and
         * that decision is taken here rather than while reading a list.
         */}
        <p className={styles.instruction} data-nothing-sent>
          <b>{TELL_THEM.access}</b> {NOTHING_WAS_SENT}
        </p>

        {failure !== '' ? (
          <p className={styles.instruction} data-save-failure>
            {failure}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
