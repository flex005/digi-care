import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import type { CareNote, IsoDateTime, Resident, Site } from '@/data/types'
import { submitCareNote } from '@/data/access/client'
import { useSession, useTimeZone } from '@/app/session/use-session'
import { shiftAt } from '@/lib/shift'
import { Button, Dialog, Toast } from '@/components/primitives'
import { NoteForm, type NoteDraft } from './NoteForm'

/**
 * The note composer. PRD §6.3, and the first real write surface in the
 * product.
 *
 * It writes. Unlike the two controls on Future Plans, which raise a real
 * confirmation and record nothing, a care note needs no clinician's signature
 * and no document reference: the author is whoever is signed in and the
 * timestamp is now. There is nothing to fabricate, so faking it would have
 * been a choice rather than a constraint.
 *
 * It carries a subject header naming the resident (§2.4) and the submit button
 * names them again, because the sentence somebody presses is the last chance to
 * notice they are writing about the wrong person.
 */
export function NoteComposer({
  resident,
  site,
  onWritten,
}: {
  resident: Resident
  site: Site
  onWritten: (note: CareNote) => void
}) {
  const { currentUser } = useSession()
  const timeZone = useTimeZone()

  const [open, setOpen] = useState(false)
  const [written, setWritten] = useState(false)
  const [error, setError] = useState('')

  // Read when the dialog opens, not on every render, so the shift the form
  // shows is the shift it submits even if somebody takes a while typing.
  const [clockAt, setClockAt] = useState(() => appNow().toISOString() as IsoDateTime)

  const submit = async (draft: NoteDraft) => {
    const at = appNow().toISOString() as IsoDateTime
    try {
      const note = await submitCareNote({
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
        flag: draft.flag,
      })
      setOpen(false)
      setError('')
      setWritten(true)
      onWritten(note)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The note was not written')
    }
  }

  return (
    <>
      <Button
        size="large"
        onClick={() => {
          setClockAt(appNow().toISOString() as IsoDateTime)
          setError('')
          setOpen(true)
        }}
      >
        Write a care note
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Write a care note about ${resident.preferredName}`}
        description="It is saved as written, with your name and the time, and cannot be edited afterwards."
      >
        <NoteForm
          resident={resident}
          site={site}
          clockShift={shiftAt(clockAt, timeZone)}
          initialCategory="general"
          bodyLabel="What happened?"
          submitLabel={`Record this note for ${resident.preferredName}`}
          error={error}
          onCancel={() => setOpen(false)}
          onSubmit={submit}
        />
      </Dialog>

      <Toast
        open={written}
        onOpenChange={setWritten}
        tone="positive"
        title={`Care note recorded for ${resident.preferredName}`}
        description="It is on the timeline now, and cannot be edited."
      />
    </>
  )
}
