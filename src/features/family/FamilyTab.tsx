import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { AnyConsent, FamilyMember, FamilyRevision, Resident } from '@/data/types'
import { currentDetails, levelHistory, levelLabel, recordedAccess } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Button, Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { familyFor, removeAccess } from '@/data/access/family-access-store'
import { staffLabel } from '@/data/access/team-store'
import { ACCESS_RECORDED } from './family-statement'
import { FamilyMemberDialog, type DialogMode } from './FamilyMemberDialog'
import styles from './family.module.css'

/**
 * Who may see this resident's updates. AM v2.0 FAM-01, rebuilt in Phase 27.
 *
 * **A list with an action, not a form on a page.** What this tab is for is
 * saying who has access. Naming somebody is an act performed occasionally, so
 * it is a button and a dialog rather than fields standing open on every visit,
 * asking to be filled in by somebody who came to read.
 *
 * **The consent is read here and owned by the Consent tab.** The basis sits
 * above the list because it is the justification for showing a record to a
 * third party, and a reader needs it before the names rather than after them.
 * Nothing here records a consent, and `scripts/check-family-writes.mjs` fails
 * the build if that ever changes.
 *
 * **Where the consent no longer stands, the people already named stay
 * visible.** Hiding them would take the finding off the screen at exactly the
 * moment somebody needs to act on it. What goes is naming anybody else, and
 * correcting what an unauthorised access says: removing is the act left,
 * because it is the one that ends it.
 */
export function FamilyTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  /*
   * Bumped when somebody is named, corrected or removed. The store is this
   * session's and the list reads it on render, so a counter is what makes the
   * screen agree with what somebody just did.
   */
  const [, setVersion] = useState(0)
  const [dialog, setDialog] = useState<DialogMode>({ kind: 'closed' })
  const changed = () => setVersion((count: number) => count + 1)

  return (
    <div className={styles.tabPanel} data-family-panel>
      <FamilyAccess resident={resident} onOpenDialog={setDialog} onChanged={changed} />
      <FamilyMemberDialog
        resident={resident}
        mode={dialog}
        onClose={() => setDialog({ kind: 'closed' })}
        onSaved={changed}
      />
    </div>
  )
}

function FamilyAccess({
  resident,
  onOpenDialog,
  onChanged,
}: {
  resident: Resident
  onOpenDialog: (mode: DialogMode) => void
  onChanged: () => void
}) {
  const format = useSiteFormat()
  const viewer = useViewer()

  const consent = resident.consents.family_portal as AnyConsent
  const members = familyFor(resident.id)
  const stands = consent.kind === 'given'
  const mayWrite = viewer.canRecordIn('/family')

  return (
    <section className={styles.section} data-family-access>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Family Portal access</h2>
        {stands && mayWrite ? (
          <Button
            size="small"
            data-add-family
            onClick={() => onOpenDialog({ kind: 'add' })}
          >
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Add a family member
          </Button>
        ) : null}
      </div>

      {/*
       * **The basis, above the list it authorises.** Read from the consent
       * record and never written here: who decided, on whose authority, when.
       */}
      {stands ? (
        <p className={styles.basis} data-basis={consent.by.kind}>
          Recorded on <span data-numeric>{format.date(consent.on)}</span> by{' '}
          {consent.recordedBy.displayName}
          {consent.by.kind === 'the_resident'
            ? `, on ${resident.preferredName}'s own decision.`
            : consent.by.kind === 'lpa_holder'
              ? `, by ${consent.by.who} under a health and welfare LPA.`
              : `, as a best-interests decision, having consulted ${consent.by.consulted.join(', ')}.`}
        </p>
      ) : (
        <div className={styles.blocked} data-consent-missing={consent.kind}>
          <Unrecorded
            variant="panel"
            label={
              consent.kind === 'not_sought'
                ? 'Nobody has been asked about Family Portal access'
                : `Family Portal access is ${consent.kind.replace(/_/g, ' ')}`
            }
            detail={`Naming somebody who may see ${resident.preferredName}'s record needs Family Portal consent on file first, recorded on the Consent tab.`}
          />
          <Link
            to={`/residents/${resident.id}/consent`}
            className={styles.blockedLink}
            data-open-consent
          >
            Open the consent record
          </Link>
        </div>
      )}

      {!stands && members.length > 0 ? (
        <p className={styles.instruction} data-access-without-consent={members.length}>
          <b>
            {members.length === 1
              ? 'One person is still named here, and the consent that allowed it no longer stands.'
              : `${members.length} people are still named here, and the consent that allowed it no longer stands.`}
          </b>{' '}
          Nothing removes them automatically. Remove anybody who should no longer see{' '}
          {resident.preferredName}
          &rsquo;s updates, or record the consent again on the Consent tab if it should
          stand.
        </p>
      ) : null}

      {members.length === 0 ? (
        /*
         * **The state, not an empty list.** "Nobody is named" is a fact about
         * this resident; a list with no rows under it reads as a screen that
         * failed to load one.
         */
        <p className={styles.noMembers} data-no-family>
          {stands
            ? `Nobody has been named. The consent stands, and no family member has been given access to ${resident.preferredName}'s updates under it.`
            : 'Nobody is named, and no consent is on file.'}
        </p>
      ) : (
        <Card>
          <ul className={styles.members}>
            {members.map((member) => (
              <li key={member.id}>
                <Member
                  member={member}
                  stands={stands}
                  mayWrite={mayWrite}
                  onEdit={() => onOpenDialog({ kind: 'edit', member })}
                  onRemove={() => {
                    removeAccess(member.id)
                    onChanged()
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

function Member({
  member,
  stands,
  mayWrite,
  onEdit,
  onRemove,
}: {
  member: FamilyMember
  stands: boolean
  mayWrite: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const format = useSiteFormat()
  const now = currentDetails(member)
  const first = recordedAccess(member)
  const levels = levelHistory(member)
  const correction = member.revisions.length > 1 ? now : undefined

  return (
    <div className={styles.member} data-family-member={member.id}>
      <span>
        <b className={styles.memberName}>{now.name}</b>
        <span className={styles.memberMeta}>
          {now.relationship} · {levelLabel(now.level)}
        </span>
        <Email email={now.email} />

        {/* Who recorded the access, and when. A correction never moves it. */}
        <span className={styles.memberState} data-access-state>
          {ACCESS_RECORDED} · {staffLabel(first.by)} ·{' '}
          <span data-numeric>{format.dateTime(first.at)}</span>
        </span>

        {/*
         * **Two facts, not one over the other.** A correction adds who changed
         * it, what they changed, and when, beside the recording above.
         */}
        {correction !== undefined ? (
          <span
            className={styles.memberChange}
            data-last-change={correction.changed.join(' ')}
          >
            {correction.changed.join(' and ')} changed by {staffLabel(correction.by)} ·{' '}
            <span data-numeric>{format.dateTime(correction.at)}</span>
          </span>
        ) : null}

        {/*
         * Every level this access has stood at. The earlier one stays, because
         * what was shared while it stood was shared under it.
         */}
        {levels.length > 1 ? (
          <span className={styles.memberChange} data-level-history={levels.length}>
            {levels
              .map(
                (revision) =>
                  `${levelLabel(revision.level)} from ${format.instantDate(revision.at)}`,
              )
              .join(', then ')}
          </span>
        ) : null}
      </span>

      {mayWrite ? (
        <span className={styles.memberActions}>
          {/*
           * Correcting needs a consent standing behind it. Where one does not,
           * adjusting what an unauthorised access says is not the act somebody
           * needs, and ending it is.
           */}
          {stands ? (
            <Button
              variant="secondary"
              size="small"
              data-edit-family={member.id}
              onClick={onEdit}
            >
              Edit
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="small"
            data-remove-family={member.id}
            onClick={onRemove}
          >
            Remove
          </Button>
        </span>
      ) : null}
    </div>
  )
}

/**
 * Their email, or the fact that nobody has taken one.
 *
 * Never an empty line: a blank would read as a person with no email, which is
 * a different thing from an address nobody has asked for.
 */
function Email({ email }: { email: FamilyRevision['email'] }) {
  if (email.kind === 'unrecorded') {
    return (
      <span className={styles.memberEmail} data-email="unrecorded">
        <Unrecorded
          variant="chip"
          label="No email recorded"
          detail="nobody has taken an address for them"
        />
      </span>
    )
  }
  return (
    <span className={styles.memberEmail} data-email="recorded">
      {email.value}
    </span>
  )
}
