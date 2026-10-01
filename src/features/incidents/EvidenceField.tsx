import { useRef } from 'react'
import type { IncidentEvidence, StaffRef } from '@/data/types'
import type { IsoDateTime } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { Button } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import styles from './incidents.module.css'

/**
 * Photos and video attached to an incident report.
 *
 * **Held for this session and the screen says so.** There is no backend here,
 * so a file lives on an object URL that dies with the tab. Every other write in
 * this build is the same, and the one thing this must not do is imply
 * otherwise: a reader who believes a photograph has been filed somewhere will
 * not take a second one, and the moment to take it has passed.
 *
 * **Stamped, like every act on an incident.** A photograph with no name
 * against it is one nobody can ask about — who took it, and when, is half of
 * what makes it evidence rather than an image.
 *
 * Removable before the report is sent and not after: the report is the record,
 * and an attachment somebody could quietly drop afterwards would be an edit to
 * it with no trace.
 */
export function EvidenceField({
  evidence,
  onChange,
  by,
}: {
  evidence: IncidentEvidence[]
  onChange: (next: IncidentEvidence[]) => void
  by: StaffRef
}) {
  const input = useRef<HTMLInputElement>(null)

  const add = (files: FileList | null) => {
    if (!files) return
    const at = appNow().toISOString() as IsoDateTime
    const added: IncidentEvidence[] = [...files].map((file, index) => ({
      id: `evidence-${String(Date.now())}-${String(index)}`,
      kind: file.type.startsWith('video/') ? 'video' : 'photo',
      fileName: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      attached: { by, at },
    }))
    onChange([...evidence, ...added])
    // So the same file can be chosen again after being removed.
    if (input.current) input.current.value = ''
  }

  const remove = (id: string) => {
    const going = evidence.find((entry) => entry.id === id)
    // The object URL is this session's only copy; dropping the row without
    // revoking it leaks the file for as long as the tab is open.
    if (going) URL.revokeObjectURL(going.url)
    onChange(evidence.filter((entry) => entry.id !== id))
  }

  return (
    <div className={styles.evidence} data-evidence-field>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className={styles.evidenceInput}
        data-evidence-input
        aria-label="Attach photos or video"
        onChange={(event) => add(event.target.files)}
      />

      <p className={styles.hint} data-evidence-note>
        Held on this device for this session only, like everything else here. Nothing is
        uploaded anywhere, so if this needs to be kept, keep the original too.
      </p>

      {evidence.length === 0 ? null : (
        <ul className={styles.evidenceList} data-evidence-count={evidence.length}>
          {evidence.map((entry) => (
            <li key={entry.id} className={styles.evidenceItem} data-evidence={entry.id}>
              {entry.kind === 'photo' ? (
                <img className={styles.evidenceThumb} src={entry.url} alt="" />
              ) : (
                <span className={styles.evidenceThumb} data-video-thumb>
                  <Icon name="image-camera-video/play-circle" size={24} aria-hidden />
                </span>
              )}
              <span className={styles.evidenceAbout}>
                <span className={styles.evidenceName}>{entry.fileName}</span>
                <span className={styles.evidenceMeta}>
                  {entry.kind === 'photo' ? 'Photo' : 'Video'} ·{' '}
                  <span data-numeric>{formatSize(entry.size)}</span>
                </span>
              </span>
              <Button
                variant="ghost"
                size="small"
                data-remove-evidence={entry.id}
                aria-label={`Remove ${entry.fileName}`}
                onClick={() => remove(entry.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Bytes a person can read. One owner, because a size is a formatted value. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
