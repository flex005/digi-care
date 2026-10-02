import { useState } from 'react'
import type { Incident, Resident } from '@/data/types'
import { subjectResidentId } from '@/data/types'
import { Button, Toast } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useTerm, useTerms } from '@/app/session/use-term'
import { incidentPdfContent } from './incident-pdf'

/**
 * Taking an incident away as a file.
 *
 * **Not silent.** A download that produces a file and says nothing leaves a
 * reader checking their downloads folder to find out whether it worked, and a
 * failed one looks identical to a slow one. Both outcomes are stated.
 *
 * **One call site: the detail header.** It was on the log row as well, as an
 * icon-only control, and the `iconOnly` prop existed for that one place — the
 * row's column floors are tuned to fill the content column at 1280 exactly,
 * and a labelled button pushed the row 114px past its own box. The log's
 * download has been taken off, so the prop went with it rather than staying
 * as a variant nothing can reach.
 */
export function DownloadIncident({
  incident,
  residents,
  size = 'small',
}: {
  incident: Incident
  residents: Resident[]
  /**
   * Still a prop with both values declared, though the one remaining call site
   * passes `medium`, so the `small` default is currently unreached.
   */
  size?: 'small' | 'medium'
}) {
  const { activeSite } = useSession()
  const format = useSiteFormat()
  const term = useTerm()
  const terms = useTerms()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [failure, setFailure] = useState('')

  const residentId = subjectResidentId(incident)
  const resident = residents.find((person) => person.id === residentId)
  const residentName =
    incident.subject.kind === 'no_resident_involved'
      ? `No ${term.one} involved`
      : (resident?.fullLegalName ?? 'Not recorded')

  const content = incidentPdfContent(incident, {
    residentName,
    siteName: activeSite.name,
    format: { dateTime: format.dateTime, date: format.date },
    terms,
  })

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        data-download-incident={incident.id}
        aria-label={`Download the ${residentName} incident of ${format.dateTime(incident.occurredAt)} as a PDF`}
        onClick={() => {
          /*
           * Loaded on the click, not on the page.
           *
           * jsPDF reaches `html2canvas` and `purify.es`, about 450 kB that
           * nothing in this build uses — it writes text and calls `addImage`,
           * and never rasterises HTML. Behind a static import that weight
           * landed in the main chunk for every visitor to every screen,
           * including the ones with no download on them.
           *
           * `incidentPdfContent` stays a top-level import: it touches no PDF
           * library and `content` is built on every render, for the file name
           * the toast prints.
           *
           * A chunk that fails to load lands in the same `catch` as a file
           * that fails to write, which is the right place for it — both are
           * "nothing was downloaded", and the toast already says so.
           */
          void import('./download-incident')
            .then(({ downloadIncidentPdf }) => downloadIncidentPdf(content))
            .then(() => {
              setState('done')
            })
            .catch((cause: unknown) => {
              setFailure(
                cause instanceof Error ? cause.message : 'The file was not written.',
              )
              setState('failed')
            })
        }}
      >
        <Icon name="download-upload/download-01" size={16} aria-hidden />
        Download
      </Button>

      <Toast
        open={state !== 'idle'}
        onOpenChange={(open) => {
          if (!open) setState('idle')
        }}
        tone={state === 'failed' ? 'critical' : 'positive'}
        title={state === 'failed' ? 'Nothing was downloaded' : 'Incident downloaded'}
        description={state === 'failed' ? failure : content.fileName}
      />
    </>
  )
}
