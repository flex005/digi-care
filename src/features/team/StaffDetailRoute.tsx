import { now as appNow } from '@/data/fixtures/clock'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { StaffStanding } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import {
  inviteMember,
  isAddedThisSession,
  memberById,
  removeMember,
  setStanding,
  suspendMember,
} from '@/data/access/team-store'
import { sites } from '@/data/fixtures/organisation'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { Avatar, Button, Card, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { formatDate } from '@/lib/format'
import { NotAPerformanceRecord, Standing } from './TeamParts'
import { AssignmentSection } from './AssignmentSection'
import { SitesSection } from './SitesSection'
import { useViewer } from '@/app/session/use-viewer'
import { RECENT_ACTS, staffActivity } from './staff-activity'
import styles from './team.module.css'

/**
 * One member of staff. PRD §6.7, Phase 14.
 *
 * The sentence: **who this person is and what access they have, then plainly
 * that supervision and appraisal are not held here, then what they have
 * recorded.**
 *
 * **No counts on this page, and that is the point rather than an omission.**
 * There is no rota and no shift record, so a count of what somebody recorded
 * has no honest denominator, and a bare count beside another person's bare
 * count is a ranking the reader performs themselves. The figures are not
 * wrong; they are wrong without the framing the report gives them, so they
 * live there with their period and denominators stated.
 */
/**
 * Why somebody's access ended, in the four ways it does. AM v2.0 TM-05.
 *
 * A closed list rather than free text, because the reason is read back beside
 * their name for as long as the record exists and "left" and "suspended
 * pending an investigation" are different facts about a person. Free text here
 * would be a field somebody fills with the date.
 */
const REMOVAL_REASONS = [
  'left the service',
  'role changed and a new account is needed',
  'a security concern',
  'another reason, recorded elsewhere',
] as const

export function StaffDetailRoute() {
  const { staffId } = useParams()
  const { currentUser } = useSession()
  const format = useSiteFormat()
  const [version, setVersion] = useState(0)
  const viewer = useViewer()
  const [confirming, setConfirming] = useState(false)
  const [removalReason, setRemovalReason] = useState('')
  const [typedConfirm, setTypedConfirm] = useState('')
  const [suspending, setSuspending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reason, setReason] = useState('')
  const navigate = useNavigate()

  const member = staffId === undefined ? undefined : memberById(staffId)

  const acts = useMemo(
    () => (member === undefined ? [] : staffActivity(member.id).slice(0, RECENT_ACTS)),
    [member, version],
  )

  if (member === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.errorTitle}>Nobody here by that name</p>
        <Link to=".." relative="path" className={styles.backLink}>
          Back to the team
        </Link>
      </div>
    )
  }

  const site = sites.find((entry) => member.siteIds.includes(entry.id))
  const hasAccessNow = member.standing.kind === 'has_access'

  const change = (standing: StaffStanding) => {
    setStanding(member.id, standing)
    setVersion((count) => count + 1)
    setConfirming(false)
    setRemovalReason('')
    setTypedConfirm('')
  }

  return (
    <div className={styles.page} data-staff-detail={member.id}>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Team
      </Link>

      <Card>
        <header className={styles.hero}>
          <Avatar
            photo={{ kind: 'not_on_file' }}
            name={member.ref.fullName}
            size="large"
            tone="brand"
          />
          <div>
            {/* Says what kind of record this is before it says whose. A person
                on a care screen is a resident; here they are neither. */}
            <p className={styles.heroKind}>Team member</p>
            <h1 className={styles.heroName}>{member.ref.fullName}</h1>
            <p className={styles.heroRole}>
              {STAFF_ROLE_NAMES[member.role]} · {site?.name ?? 'Site not on record'}
            </p>
          </div>
          <div className={styles.heroActions}>
            {/*
             * **Every act on this header is the registered person's**, and a
             * manager reads the page without them. AM v2.0's TM-01 gives a
             * manager the staff list in read-only and none of the acts on it;
             * knowing who is on the team is what they need, and deciding it is
             * not theirs.
             */}
            {!viewer.may('manage_team') ? (
              <p className={styles.hint} data-staff-read-only>
                Your role is {viewer.roleName}, which reads this record and changes
                nothing on it.
              </p>
            ) : null}
            {viewer.may('manage_team') &&
            member.standing.kind === 'never_given_access' ? (
              <Button
                data-invite
                onClick={() => {
                  inviteMember(member.id, currentUser)
                  setVersion((count) => count + 1)
                }}
              >
                Give access
              </Button>
            ) : null}

            {!viewer.may('manage_team') ? null : hasAccessNow ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setSuspending(true)}
                  data-suspend
                >
                  Suspend
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirming(true)}
                  data-remove-access
                >
                  Remove access
                </Button>
              </>
            ) : member.standing.kind === 'never_given_access' ? null : (
              <Button
                variant="secondary"
                data-restore-access
                onClick={() =>
                  change({
                    kind: 'has_access',
                    since: todayIso(),
                    grantedBy: currentUser,
                  })
                }
              >
                Restore access
              </Button>
            )}

            <Link
              to="../permissions"
              relative="path"
              className={styles.heroLink}
              data-permissions
            >
              Permissions
            </Link>

            {viewer.may('manage_team') && isAddedThisSession(member.id) ? (
              <Button variant="ghost" onClick={() => setDeleting(true)} data-delete>
                Delete
              </Button>
            ) : null}
          </div>
        </header>

        {/* Role, site, access. Nothing else — a field nobody has asked for is a
            field nobody has decided how to protect. */}
        <section className={styles.section}>
          <dl className={styles.fields}>
            <div className={styles.field} data-field="role">
              <dt className={styles.fieldLabel}>Role</dt>
              <dd className={styles.fieldValue}>{STAFF_ROLE_NAMES[member.role]}</dd>
            </div>
            <div className={styles.field} data-field="site">
              <dt className={styles.fieldLabel}>Site</dt>
              <dd className={styles.fieldValue}>
                {site?.name ?? 'Site not on record'}
              </dd>
            </div>
            <div className={styles.field} data-field="standing">
              <dt className={styles.fieldLabel}>Access</dt>
              <dd className={styles.fieldValue}>
                <Standing standing={member.standing} />
              </dd>
            </div>
          </dl>

          {member.standing.kind === 'no_longer_has_access' ? (
            <p className={styles.unchanged} data-removal-unchanged>
              <b>Removing access changed nothing on the record.</b> Every care note,
              medication entry and signature {member.ref.fullName.split(' ')[0]} made is
              still there with their name on it.
            </p>
          ) : null}
        </section>

        {/*
         * Beneath access and above the activity. Who somebody covers belongs
         * with what they can reach rather than with what they have done: the
         * moment it sits above a list of records, the two read as one claim
         * about a person.
         */}
        <SitesSection member={member} onChanged={() => setVersion((c) => c + 1)} />

        <AssignmentSection member={member} />

        {/* Above the activity, never below it. */}
        <section className={styles.section}>
          <NotAPerformanceRecord />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            What {member.ref.fullName.split(' ')[0]} has recorded recently
          </h2>

          {acts.length === 0 ? (
            <p className={styles.noActs} data-no-acts>
              Nothing in this record was written by {member.ref.fullName}.
            </p>
          ) : (
            <ul className={styles.acts}>
              {acts.map((act) => (
                <li key={act.id}>
                  <div className={styles.act} data-act={act.id}>
                    <p className={styles.actWhen}>
                      <span>{format.time(act.at)}</span>
                      <span className={styles.actDate}>
                        {format.instantDate(act.at)}
                      </span>
                    </p>
                    <div>
                      <p className={styles.actWhat}>{act.what}</p>
                      <p className={styles.actModule}>{act.module}</p>
                    </div>
                    <Link
                      to={act.to}
                      className={styles.actLink}
                      aria-label={`Open the record: ${act.what}`}
                    >
                      Open the record
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
          )}

          <div className={styles.noCounts} data-no-counts>
            <p>
              <b>There are no counts on this page.</b> The figures are on the care note
              coverage report, with their period and denominators.
            </p>
            <Link
              to="/reports/care-note-coverage"
              className={styles.noCountsLink}
              data-coverage-link
            >
              Open the coverage report
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </Card>

      {suspending ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setSuspending(false)
          }}
          title={`Suspend ${member.ref.fullName}?`}
          description="The reason goes on the record with your name."
          actions={
            <>
              <Button variant="ghost" onClick={() => setSuspending(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                data-confirm-suspend
                disabled={reason.trim() === ''}
                onClick={() => {
                  suspendMember(member.id, reason.trim(), currentUser)
                  setReason('')
                  setSuspending(false)
                  setVersion((count) => count + 1)
                }}
              >
                Suspend
              </Button>
            </>
          }
        >
          <label className={styles.formField}>
            <span className={styles.formLabel}>Why</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-field="suspend-reason"
              autoComplete="off"
            />
            {/*
             * In words, never a code. A standing with no reason is a flag
             * rather than a record, and the person it is about is entitled to
             * know what it says.
             */}
          </label>
        </Dialog>
      ) : null}

      {deleting ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setDeleting(false)
          }}
          title={`Delete ${member.ref.fullName} from the team?`}
          actions={
            <>
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                data-confirm-delete
                onClick={() => {
                  removeMember(member.id)
                  navigate('..', { relative: 'path' })
                }}
              >
                Delete
              </Button>
            </>
          }
        />
      ) : null}

      {confirming ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setConfirming(false)
          }}
          title={`Remove ${member.ref.fullName}'s access?`}
          description={`${member.ref.fullName} will no longer be able to open diGi-Care.`}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep access
              </Button>
              <Button
                variant="primary"
                disabled={removalReason === '' || typedConfirm.trim() !== 'CONFIRM'}
                data-confirm-remove
                onClick={() =>
                  change({
                    kind: 'no_longer_has_access',
                    on: todayIso(),
                    reason: removalReason,
                    by: currentUser,
                  })
                }
              >
                Remove access
              </Button>
            </>
          }
        >
          {/*
           * **A reason from a list, and the reason goes on the record.** It was
           * the string "access removed from the team screen", which describes
           * where somebody clicked rather than why anybody left: a record whose
           * reason names the screen is a record with no reason in it. AM v2.0's
           * TM-05 asks for four, and they are the four because they are
           * different things — somebody leaving and somebody being stopped are
           * not the same standing, however the same the click is.
           */}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Why is access being removed?</span>
            <div className={styles.roleChoices} data-removal-reasons>
              {REMOVAL_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={removalReason === reason ? styles.choiceOn : styles.choice}
                  data-removal-reason={reason}
                >
                  <input
                    type="radio"
                    name="removal-reason"
                    checked={removalReason === reason}
                    onChange={() => setRemovalReason(reason)}
                  />
                  {reason}
                </label>
              ))}
            </div>
          </div>

          {/*
           * **Typing the word, which is AM v2.0's TM-05 and is not ceremony.**
           * Every other confirmation in this build is a click, because every
           * other one is reversible or is a record somebody can correct with a
           * second record. This one ends somebody's access while they may be
           * mid-shift, and a click lands in the same place a mis-aimed click
           * does.
           */}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Type CONFIRM to remove {member.ref.fullName.split(' ')[0]}&rsquo;s access
            </span>
            <input
              type="text"
              value={typedConfirm}
              onChange={(event) => setTypedConfirm(event.target.value)}
              data-field="confirm-removal"
            />
          </label>

          {/* What does not change is the part somebody needs to be told. */}
          <p className={styles.confirmBody} data-confirm-unchanged>
            <b>Nothing on the record changes.</b>
          </p>
          <p className={styles.confirmBody}>
            It will be recorded as {formatDate(todayIso())}, by {currentUser.fullName}.
          </p>
        </Dialog>
      ) : null}
    </div>
  )
}

/** Today, as a date. A standing change is dated, not timed. */
const todayIso = () =>
  appNow().toISOString().slice(0, 10) as `${number}-${number}-${number}`
