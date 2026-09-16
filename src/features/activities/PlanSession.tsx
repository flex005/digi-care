import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { Activity, IsoDate, IsoDateTime, Resident, SiteId } from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { planSession } from '@/data/access/activity-store'
import { pluralise } from '@/lib/format'
import { siteInstant } from './session-time'
import styles from './activities.module.css'

/**
 * Planning a session. AM v2.0 ACT-01, Phase 25.
 *
 * `planSession` was written in Phase 20 and reported as done, and nothing
 * called it. This is the caller.
 *
 * **Who is invited is asked for here and cannot be left out**, because it is
 * the denominator for every figure about the session: "nobody came" and
 * "nobody was asked" are different facts, and a session planned for nobody
 * makes the first read as the second. The store refuses it too; the form says
 * so before anybody gets that far.
 *
 * **A session is planned for later, not for earlier.** One that has already
 * started would land on the calendar as a session nobody recorded attendance
 * for, the finding this module leads on, created by the act of writing it
 * down.
 */
export function PlanSession({
  siteId,
  timeZone,
  residents,
  onPlanned,
}: {
  siteId: SiteId
  timeZone: TimeZone
  residents: Resident[]
  onPlanned: (activity: Activity) => void
}) {
  const { currentUser } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [invited, setInvited] = useState<string[]>([])

  const startsAt =
    date !== '' && starts !== ''
      ? siteInstant(date as IsoDate, starts, timeZone)
      : undefined
  const endsAt =
    date !== '' && ends !== ''
      ? siteInstant(date as IsoDate, ends, timeZone)
      : undefined
  const now = appNow().toISOString() as IsoDateTime

  const waiting: string[] = []
  if (name.trim() === '') waiting.push('what it is called')
  if (place.trim() === '') waiting.push('where it is')
  if (description.trim() === '') waiting.push('what it is')
  if (startsAt === undefined || endsAt === undefined)
    waiting.push('when it starts and ends')
  else if (endsAt <= startsAt) waiting.push('an end after its start')
  else if (startsAt <= now) waiting.push('a start that has not already passed')
  if (invited.length === 0) waiting.push('at least one resident invited')

  const reset = () => {
    setName('')
    setPlace('')
    setDescription('')
    setDate('')
    setStarts('')
    setEnds('')
    setInvited([])
  }

  const save = () => {
    if (waiting.length > 0 || startsAt === undefined || endsAt === undefined) return
    const activity = planSession({
      siteId,
      name: name.trim(),
      description: description.trim(),
      place: place.trim(),
      startsAt,
      endsAt,
      residentIds: invited,
      by: currentUser,
    })
    reset()
    setOpen(false)
    onPlanned(activity)
  }

  return (
    <>
      <Button size="small" data-plan-open onClick={() => setOpen(true)}>
        <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
        Plan a session
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        title="Plan a session"
        description="It goes on the calendar with your name on it."
        actions={
          <>
            <p className={styles.hint} data-plan-waiting>
              {waiting.length > 0
                ? `Waiting on: ${waiting.join(' · ')}`
                : `${pluralise(invited.length, 'resident')} invited`}
            </p>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              disabled={waiting.length > 0}
              data-plan-save
              onClick={save}
            >
              Plan it
            </Button>
          </>
        }
      >
        <div className={styles.sessionForm}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>What it is called</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              data-field="session-name"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Where</span>
            <input
              type="text"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              data-field="session-place"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>What it is</span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              data-field="session-description"
            />
          </label>
          <SessionTimes
            date={date}
            starts={starts}
            ends={ends}
            onDate={setDate}
            onStarts={setStarts}
            onEnds={setEnds}
          />

          <fieldset className={styles.inviteList} data-invite-list>
            <legend className={styles.fieldLabel}>Who is invited</legend>
            {residents.map((resident) => (
              <label
                key={resident.id}
                className={styles.inviteOption}
                data-invite-resident={resident.id}
              >
                <input
                  type="checkbox"
                  checked={invited.includes(resident.id)}
                  onChange={() =>
                    setInvited((current) =>
                      current.includes(resident.id)
                        ? current.filter((id) => id !== resident.id)
                        : [...current, resident.id],
                    )
                  }
                />
                {resident.fullLegalName}
                {resident.room.kind === 'recorded'
                  ? ` · Room ${resident.room.value}`
                  : ''}
              </label>
            ))}
          </fieldset>
        </div>
      </Dialog>
    </>
  )
}

/** The day and the two times, as the home's clock reads them. Shared with editing. */
export function SessionTimes({
  date,
  starts,
  ends,
  onDate,
  onStarts,
  onEnds,
}: {
  date: string
  starts: string
  ends: string
  onDate: (value: string) => void
  onStarts: (value: string) => void
  onEnds: (value: string) => void
}) {
  return (
    <div className={styles.sessionTimes}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Day</span>
        <input
          type="date"
          value={date}
          onChange={(event) => onDate(event.target.value)}
          data-field="session-date"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Starts</span>
        <input
          type="time"
          value={starts}
          onChange={(event) => onStarts(event.target.value)}
          data-field="session-starts"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Ends</span>
        <input
          type="time"
          value={ends}
          onChange={(event) => onEnds(event.target.value)}
          data-field="session-ends"
        />
      </label>
    </div>
  )
}
