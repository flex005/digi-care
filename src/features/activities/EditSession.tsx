import { useState } from 'react'
import type { Activity, IsoDate } from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { Button, Dialog } from '@/components/primitives'
import { editSession } from '@/data/access/activity-store'
import { SessionTimes } from './PlanSession'
import { siteInstant, siteWallParts } from './session-time'
import styles from './activities.module.css'

/**
 * Changing a session before it happens. AM v2.0 ACT-01, Phase 25.
 *
 * `editSession` was written in Phase 20 with no caller, like planning.
 *
 * **Only before it starts.** Once a session has begun, its time is what
 * attendance is recorded against, and moving it would move a record somebody
 * made about a resident's afternoon. So the control is offered for a planned
 * session that has not started, and for nothing else.
 *
 * **What it changes is what the store can change**: the name, the place and
 * the times. Who planned it and when stay exactly as they were, which is why
 * the store edits field by field rather than re-saving the session. Who is
 * invited is not changed here, because the store has no way to change it.
 */
export function EditSession({
  activity,
  timeZone,
  onEdited,
}: {
  activity: Activity
  timeZone: TimeZone
  onEdited: () => void
}) {
  const initial = () => {
    const start = siteWallParts(activity.startsAt, timeZone)
    return {
      name: activity.name,
      place: activity.place,
      date: start.date as string,
      starts: start.time,
      ends: siteWallParts(activity.endsAt, timeZone).time,
    }
  }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initial)

  // A cleared input is not a time, and `new Date` would throw on it.
  const complete = form.date !== '' && form.starts !== '' && form.ends !== ''
  const startsAt = complete
    ? siteInstant(form.date as IsoDate, form.starts, timeZone)
    : undefined
  const endsAt = complete
    ? siteInstant(form.date as IsoDate, form.ends, timeZone)
    : undefined

  const waiting: string[] = []
  if (form.name.trim() === '') waiting.push('what it is called')
  if (form.place.trim() === '') waiting.push('where it is')
  if (startsAt === undefined || endsAt === undefined)
    waiting.push('when it starts and ends')
  else if (endsAt <= startsAt) waiting.push('an end after its start')

  const save = () => {
    if (waiting.length > 0 || startsAt === undefined || endsAt === undefined) return
    editSession(activity.id, {
      name: form.name.trim(),
      place: form.place.trim(),
      startsAt,
      endsAt,
    })
    setOpen(false)
    onEdited()
  }

  return (
    <>
      <Button
        variant="secondary"
        size="small"
        data-edit-open
        onClick={() => {
          setForm(initial())
          setOpen(true)
        }}
      >
        Change this session
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Change ${activity.name}`}
        description={`Planned by ${activity.plannedBy.displayName}.`}
        actions={
          <>
            {waiting.length > 0 ? (
              <p className={styles.hint} data-edit-waiting>
                Waiting on: {waiting.join(' · ')}
              </p>
            ) : null}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it as it is
            </Button>
            <Button
              variant="primary"
              disabled={waiting.length > 0}
              data-edit-save
              onClick={save}
            >
              Save the change
            </Button>
          </>
        }
      >
        <div className={styles.sessionForm}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>What it is called</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              data-field="session-name"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Where</span>
            <input
              type="text"
              value={form.place}
              onChange={(event) => setForm({ ...form, place: event.target.value })}
              data-field="session-place"
            />
          </label>
          <SessionTimes
            date={form.date}
            starts={form.starts}
            ends={form.ends}
            onDate={(date) => setForm({ ...form, date })}
            onStarts={(starts) => setForm({ ...form, starts })}
            onEnds={(ends) => setForm({ ...form, ends })}
          />
        </div>
      </Dialog>
    </>
  )
}
