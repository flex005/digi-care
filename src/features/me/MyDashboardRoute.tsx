import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { residentsBySite } from '@/data/fixtures/residents'
import { notesForResidents } from '@/data/access/note-store'
import { memberById } from '@/data/access/team-store'
import { roundsToday } from '@/features/dashboard/series'
import { flaggedNotReviewed, withoutNoteToday } from '@/features/notes/care-notes-views'
import { staffActivity } from '@/features/team/staff-activity'
import { SHIFT_NAMES, shiftAt } from '@/lib/shift'
import { formatCount, formatDate, formatTime, pluralise, zonedDate } from '@/lib/format'
import styles from './me.module.css'

/**
 * One person's own screen. PRD §6.7.
 *
 * **This is "what is mine", not "what is late here".** The site Dashboard is
 * the home's; this is one shift.
 *
 * **There are no counts of this person's work on it, and there will not be.**
 * diGi-Care has no rota, so a count of what somebody recorded has no honest
 * denominator — and a figure about a person without what it is out of is an
 * accusation rather than a measurement. Phase 14 refused to put one on the
 * manager's staff screen; it applies with more force where the person reading
 * it is the person being counted, because a screen showing somebody their own
 * productivity figures is a performance record whoever built it says it is not.
 *
 * **The absence of a rota also limits what can honestly be called theirs.**
 * Nobody is allocated to a round or to a resident in this build, so a tile
 * saying "your residents" would be inventing an allocation nobody made. The
 * two tiles that are genuinely one person's are the flags they raised and
 * waited on; the rest of the screen says whose figures they are.
 */
export function MyDashboardRoute() {
  const { activeSite, currentUser, signIn } = useSession()

  const nowIso = appNow().toISOString() as IsoDateTime
  const today: IsoDate = zonedDate(nowIso, activeSite.timeZone)
  const shift = shiftAt(nowIso, activeSite.timeZone)

  const residents = useMemo(() => residentsBySite(activeSite.id), [activeSite.id])
  const notes = useMemo(
    () => notesForResidents(residents.map((one) => one.id)),
    [residents],
  )

  /* Their own flags, still waiting. The one figure on this screen that is
     unambiguously about this person and unambiguously not about their output:
     it counts what they asked for and did not get. */
  const waiting = flaggedNotReviewed(notes, residents).filter(
    (entry) =>
      entry.note.review.kind === 'flagged_not_reviewed' &&
      entry.note.review.flaggedBy.id === currentUser.id,
  )
  /*
   * Oldest first, which is how `flaggedNotReviewed` sorts: a supervisory queue
   * ordered newest-first buries the note that has waited three days.
   */
  const oldestFlag = waiting[0]?.note.review
  const oldestOn =
    oldestFlag !== undefined && oldestFlag.kind === 'flagged_not_reviewed'
      ? formatDate(zonedDate(oldestFlag.flaggedAt, activeSite.timeZone))
      : undefined

  const quiet = withoutNoteToday(residents, notes, activeSite.timeZone, nowIso)

  const rounds = roundsToday(activeSite, residents, nowIso)
  const wall = formatTime(nowIso, activeSite.timeZone)
  const next = rounds.find((round) => round.at > wall)

  /* Their own writing today, as a list and never as a total. Read through the
     same function the manager's staff screen uses, so the two cannot disagree
     about what somebody did. */
  const mine = staffActivity(currentUser.id).filter(
    (act) => zonedDate(act.at, activeSite.timeZone) === today,
  )

  const member = memberById(currentUser.id)
  const firstName = currentUser.fullName.split(/\s+/)[0]

  return (
    <div className={styles.page} data-my-dashboard={currentUser.id}>
      <div className={styles.top}>
        <div className={styles.me}>
          <span className={styles.avatar} aria-hidden>
            {initialsOf(currentUser.fullName)}
          </span>
          <div>
            <p className={styles.name}>{firstName}</p>
            <p className={styles.role}>
              {currentUser.fullName} · {STAFF_ROLE_NAMES[currentUser.role]} ·{' '}
              {activeSite.name}
            </p>
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.shiftPill} data-shift={shift}>
            {SHIFT_NAMES[shift]} shift · {activeSite.timeZone}
          </span>
          <Link to="/sign-out" className={styles.plainButton} data-sign-out-link>
            Sign out
          </Link>
        </div>
      </div>

      <div className={styles.statusTiles}>
        <div className={styles.statusTileNow} data-tile="next-round">
          <p className={styles.statusTileKey}>The next round here</p>
          <p className={styles.statusTileValue} data-numeric>
            {next === undefined ? 'None left today' : next.at}
          </p>
          <p className={styles.statusTileDetail}>
            {next === undefined
              ? `Every round at ${activeSite.name} has come round today. The next is tomorrow morning.`
              : `${pluralise(next.expected, 'dose')} scheduled · ${formatCount(next.notDueYet + next.dueSoon)} not yet due`}
          </p>
          <p className={styles.statusTileDetail} data-no-allocation>
            Nobody is allocated to rounds in this build, so this is the home&rsquo;s
            next round rather than one assigned to you.
          </p>
          <div className={styles.statusTileAction}>
            <Link to="/medications/round" className={styles.statusTileButton}>
              Open the round
            </Link>
          </div>
        </div>

        <div className={styles.statusTileWarn} data-tile="waiting">
          <p className={styles.statusTileKey}>You flagged, still waiting</p>
          <p className={styles.statusTileValue} data-numeric>
            {formatCount(waiting.length)}
          </p>
          <p className={styles.statusTileDetail}>
            {waiting.length === 0
              ? 'Nothing you flagged is waiting for a senior.'
              : `${pluralise(waiting.length, 'care note')} you asked a senior to look at, and nobody has. Oldest flagged ${oldestOn ?? 'on a date the record does not carry'}.`}
          </p>
        </div>

        {/*
         * The only tile counting an absence, so it takes the hatch. It is the
         * home's list and it says so: without a rota there is no honest way
         * to say which of these residents were anybody's in particular, and
         * inventing an allocation to make the tile feel personal would put a
         * name against a gap nobody assigned.
         */}
        <div
          className={styles.statusTileGap}
          data-tile="not-written-up"
          data-state="unrecorded"
        >
          <p className={styles.statusTileKey}>Nobody has written up</p>
          <p className={styles.statusTileValue} data-numeric>
            {formatCount(quiet.length)}
          </p>
          <p className={styles.statusTileDetail}>
            of {pluralise(residents.length, 'resident')} at {activeSite.name}, today.
            Not allocated to anybody, including you.
          </p>
        </div>
      </div>

      <div className={styles.two}>
        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>What you have recorded today</h2>
            <p className={styles.panelBody}>
              Each links to the record itself. There are no totals here, and the reason
              is below.
            </p>
          </div>

          {mine.length === 0 ? (
            <p className={styles.empty} data-nothing-today>
              You have not written anything into the record today. That is a fact about
              this list and not about your shift: this build holds only what was written
              here, and it has no rota to say whether you were on.
            </p>
          ) : (
            <ul className={styles.acts}>
              {mine.map((act) => (
                <li key={act.id} className={styles.act} data-act={act.id}>
                  <span className={styles.actWhen}>
                    {formatTime(act.at, activeSite.timeZone)}
                    <span className={styles.actDay}>today</span>
                  </span>
                  <span>
                    <span className={styles.actWhat}>{act.what}</span>
                    <span className={styles.actKind}>{act.module}</span>
                  </span>
                  <Link to={act.to} className={styles.actGo}>
                    Open
                    <Icon
                      name="arrows-sharp/arrow-right-01-sharp"
                      size={16}
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/*
           * The first of the two "not held here" blocks, in its inert
           * treatment. This one is about the figures that are missing on
           * purpose; the one on the permissions screen is about the records
           * this product does not hold at all.
           */}
          <p className={styles.notHeld} data-not-held="no-counts">
            <b>
              There are no counts of your work on this screen, and there will not be.
            </b>{' '}
            diGi-Care has no rota, so a count of what you recorded has no honest
            denominator, and a figure about a person without what it is out of is an
            accusation rather than a measurement. This is a list of what you did, not a
            score for it.
          </p>
        </Card>

        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Yours</h2>
            <p className={styles.panelBody}>
              Your details, your access, and where the rest lives.
            </p>
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <span className={styles.detailKey}>Role</span>
              <span className={styles.detailValue}>
                {STAFF_ROLE_NAMES[currentUser.role]}
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailKey}>Home</span>
              <span className={styles.detailValue}>{activeSite.name}</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailKey}>Access</span>
              <span className={styles.detailValue} data-standing>
                {standingSentence(member)}
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailKey}>This session</span>
              <span className={styles.detailValue} data-session-started>
                {signIn.kind === 'signed_in'
                  ? `Signed in at ${formatTime(signIn.at, activeSite.timeZone)}, in ${activeSite.timeZone}`
                  : 'Not signed in'}
              </span>
            </div>
          </div>

          <div className={styles.panelActions}>
            <Link to="/me/permissions" className={styles.plainButton}>
              What I can do
            </Link>
            <Button variant="secondary" disabled data-no-password>
              Change my password
            </Button>
          </div>
          <p className={styles.panelBody}>
            There is no password to change: nothing is stored and nothing is checked.
          </p>
        </Card>
      </div>
    </div>
  )
}

const initialsOf = (fullName: string) =>
  fullName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

function standingSentence(member: ReturnType<typeof memberById>): string {
  if (member === undefined) return 'Not on the team record'
  const standing = member.standing
  switch (standing.kind) {
    case 'has_access':
      return `Has access since ${formatDate(standing.since)}, granted by ${standing.grantedBy.fullName}`
    case 'suspended':
      return `Suspended on ${formatDate(standing.on)}: ${standing.reason}, by ${standing.by.fullName}`
    case 'no_longer_has_access':
      return `Access ended ${formatDate(standing.on)}: ${standing.reason}, by ${standing.by.fullName}`
    case 'never_given_access':
      return `On the team since ${formatDate(standing.addedOn)}, added by ${standing.addedBy.fullName}. Access was never set up.`
  }
}
