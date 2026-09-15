import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnyConsent, FamilyMember, Resident } from '@/data/types'
import { Button } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { useSession } from '@/app/session/use-session'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  ACCESS_LEVELS,
  type FamilyAccessLevel,
  defaultAccessLevel,
  familyFor,
  grantAccess,
  removeAccess,
} from '@/data/access/family-access-store'
import { ACCESS_RECORDED, NOTHING_WAS_SENT, TELL_THEM } from './family-statement'
import styles from './family.module.css'

/**
 * Who may see this resident's updates. AM v2.0 FAM-01, Phase 21, its own tab
 * from Phase 26.
 *
 * **The basis is the `family_portal` consent, and this screen does not ask for
 * it again.** AM v2.0 puts three grounds on this form — resident consent, an
 * LPA holder, a best-interests decision — and those are already
 * `DecisionAuthority`'s three members, each carrying a `CapacityAssessment`
 * whose `covers` must name this consent type. Asking here as well would be two
 * records of one fact.
 *
 * So the consent is the gate: **nobody new can be named until it has been
 * recorded**, and where it has not, this section says which screen records it
 * rather than offering a second way in.
 *
 * **What it no longer does is hide the people already named.** Until Phase 26
 * the whole list rendered only while the consent stood, so a withdrawal made
 * everybody holding access invisible — at precisely the moment somebody needed
 * to remove them. A permission that outlives its authorisation is a finding,
 * and a finding nobody can see is one nobody can act on. Removing is offered
 * there; naming somebody new is not.
 *
 * **No "Invited" anywhere.** That status implies an email travelling and a
 * state that turns Active; nothing is sent and nothing can activate.
 */
export function FamilyAccessSection({
  resident,
  onChanged,
}: {
  resident: Resident
  onChanged: () => void
}) {
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const viewer = useViewer()
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  /* The home's default, which is a setting. It applies to this decision and
     to no decision already made. */
  const [level, setLevel] = useState<FamilyAccessLevel>(defaultAccessLevel())

  const consent = resident.consents.family_portal as AnyConsent
  const members = familyFor(resident.id)
  const stands = consent.kind === 'given'
  const mayWrite = viewer.canRecordIn('/family')
  const ready = name.trim() !== '' && relationship.trim() !== ''

  return (
    <section className={styles.section} data-family-access>
      <h2 className={styles.sectionTitle}>Family Portal access</h2>

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
            detail={`Naming somebody who may see ${resident.preferredName}'s record needs that decision on file first, with who made it and on what basis. It is recorded on the Consent tab, through the capacity question, and not here: a second way in would be a second record of the same fact.`}
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

      {/*
       * **The finding, on the resident's own screen.** Access that outlived
       * the consent authorising it. It is stated rather than counted alone:
       * a number tells somebody how many, and the sentence tells them what it
       * means and what to do about it.
       */}
      {!stands && members.length > 0 ? (
        <p className={styles.instruction} data-access-without-consent={members.length}>
          <b>
            {members.length === 1
              ? 'One person is still named here, and the consent that allowed it no longer stands.'
              : `${members.length} people are still named here, and the consent that allowed it no longer stands.`}
          </b>{' '}
          Nothing removes them automatically, and nothing was ever sent to them by this
          build. Remove anybody who should no longer see {resident.preferredName}
          &rsquo;s updates, or record the consent again on the Consent tab if it should
          stand.
        </p>
      ) : null}

      <ul className={styles.members}>
        {members.length === 0 ? (
          <li className={styles.noMembers} data-no-family>
            {stands
              ? 'Nobody has been named yet. The consent stands and no family member has been given access under it.'
              : 'Nobody is named, and no consent is on file. Both are true, and neither is a gap in the other.'}
          </li>
        ) : (
          members.map((member) => (
            <li
              key={member.id}
              className={styles.member}
              data-family-member={member.id}
            >
              <span>
                <b className={styles.memberName}>{member.name}</b>
                <span className={styles.memberMeta}>
                  {member.relationship} ·{' '}
                  {ACCESS_LEVELS.find((entry) => entry.id === member.level)?.label}
                </span>
                <Email member={member} />
                <span className={styles.memberState} data-access-state>
                  {ACCESS_RECORDED} · {member.by.displayName} ·{' '}
                  <span data-numeric>{format.dateTime(member.at)}</span>
                </span>
              </span>
              {mayWrite ? (
                <Button
                  variant="secondary"
                  size="small"
                  data-remove-family={member.id}
                  onClick={() => {
                    removeAccess(member.id)
                    onChanged()
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {stands && mayWrite ? (
        <div className={styles.grantForm} data-grant-form>
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
             * empty string: "we have no address for her" and "she has no
             * email" are different facts about a person somebody may need to
             * reach.
             */}
            <span className={styles.memberEmail}>
              Nothing is sent to it. Leave it blank if nobody has taken one, and the
              record will say that rather than showing an empty line.
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
          </fieldset>

          {/*
           * **On the control, not behind a click.** Everywhere else in this
           * build the statement is one click away, because a paragraph in
           * front of a form is a paragraph nobody reads. Here the risk is
           * somebody not clicking: a reader who believes an invitation went
           * out will not ring the family to tell them they have access.
           */}
          <p className={styles.instruction} data-nothing-sent>
            <b>{TELL_THEM.access}</b> {NOTHING_WAS_SENT}
          </p>

          <Button
            disabled={!ready}
            data-grant-access
            onClick={() => {
              grantAccess({
                residentId: resident.id,
                name,
                relationship,
                email,
                level,
                by: currentUser,
              })
              setName('')
              setRelationship('')
              setEmail('')
              onChanged()
            }}
          >
            Record their access
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Their email, or the fact that nobody has taken one.
 *
 * Never an empty line: a blank would read as a person with no email, which is
 * a different thing from an address nobody has asked for.
 */
function Email({ member }: { member: FamilyMember }) {
  if (member.email.kind === 'unrecorded') {
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
      {member.email.value}
    </span>
  )
}
