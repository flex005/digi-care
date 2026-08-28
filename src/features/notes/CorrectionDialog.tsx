import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { CareNote, IsoDateTime, Resident, Site } from '@/data/types'
import { submitCorrectionNote } from '@/data/access/client'
import { useSession, useTimeZone } from '@/app/session/use-session'
import { shiftAt } from '@/lib/shift'
import { Button, Dialog, Toast } from '@/components/primitives'
import { NoteForm, type NoteDraft } from './NoteForm'

/**
 * "Add correction note". PRD §6.3.
 *
 * There is no edit control on this screen and there never will be. This writes
 * a **second** note saying what was actually the case, and marks the first as
 * superseded while leaving it exactly as it was written. Both stay readable,
 * and so does the fact that somebody first recorded the wrong thing.
 *
 * It uses the same form as the composer, because a correction that captured
 * less than the note it corrects would be a downgrade dressed as a fix.
 */
export function CorrectionDialog({
  original,
  resident,
  site,
  onWritten,
}: {
  original: CareNote
  resident: Resident
  site: Site
  onWritten: (note: CareNote) => void
}) {
  const { currentUser } = useSession()
  const timeZone = useTimeZone()

  const [open, setOpen] = useState(false)
  const [written, setWritten] = useState(false)
  const [error, setError] = useState('')
  const [clockAt, setClockAt] = useState(() => appNow().toISOString() as IsoDateTime)

  const submit = async (draft: NoteDraft) => {
    const at = appNow().toISOString() as IsoDateTime
    try {
      const note = await submitCorrectionNote({
        corrects: original.id,
        residentId: resident.id,
        category: draft.category,
        body: draft.body,
        mood:
          draft.mood === 'not_recorded'
            ? { kind: 'not_recorded' }
            : {
                kind: 'recorded',
                score: draft.mood,
                recordedBy: currentUser,
                recordedAt: at,
              },
        shift: draft.shift,
        author: currentUser,
        at,
        flagForReview: draft.flagForReview,
      })
      setOpen(false)
      setError('')
      setWritten(true)
      onWritten(note)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The correction failed')
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="large"
        onClick={() => {
          setClockAt(appNow().toISOString() as IsoDateTime)
          setError('')
          setOpen(true)
        }}
      >
        Add correction note
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Correct this note about ${resident.preferredName}`}
        description="The note above stays on the record exactly as it was written, marked as superseded. This adds a second note saying what was actually the case."
      >
        <NoteForm
          resident={resident}
          site={site}
          clockShift={shiftAt(clockAt, timeZone)}
          initialCategory={original.category}
          showSuggestions={false}
          bodyLabel="What was actually the case?"
          submitLabel={`Record this correction for ${resident.preferredName}`}
          error={error}
          onCancel={() => setOpen(false)}
          onSubmit={submit}
        />
      </Dialog>

      <Toast
        open={written}
        onOpenChange={setWritten}
        tone="positive"
        title={`Correction recorded for ${resident.preferredName}`}
        description="The original note is still on the timeline, marked as superseded. Nothing was deleted."
      />
    </>
  )
}
