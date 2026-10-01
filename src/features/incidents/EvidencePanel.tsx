import { useState } from 'react'
import type { IncidentEvidence } from '@/data/types'
import { Dialog } from '@/components/primitives'
import { useSiteFormat } from '@/app/session/use-session'
import { formatSize } from './EvidenceField'
import styles from './incidents.module.css'

/**
 * The photographs and video somebody attached when they reported it.
 *
 * **Shown for real, not described.** A thumbnail that opens the full image and
 * a video element that plays — a placeholder standing in for evidence would be
 * the same defect as a fabricated fixture, one step later: a reader would take
 * the row as proof a photograph exists.
 *
 * **Empty is a state and it says which one.** Most incidents have no
 * photographs, and that is ordinary rather than a gap — but "nobody attached
 * anything" is still a fact about the record, so it is said rather than left
 * as a missing section a reader has to notice the absence of.
 */
export function EvidencePanel({ evidence }: { evidence: IncidentEvidence[] }) {
  const format = useSiteFormat()
  const [open, setOpen] = useState<IncidentEvidence | 'none'>('none')

  return (
    <section className={styles.section} data-section="evidence">
      <h2 className={styles.sectionTitle}>Photographs and video</h2>

      {evidence.length === 0 ? (
        <p className={styles.sectionNote} data-no-evidence>
          Nothing was attached. Most incidents have none, so this is ordinary rather
          than something missing.
        </p>
      ) : (
        <>
          <ul className={styles.evidenceList} data-evidence-count={evidence.length}>
            {evidence.map((entry) => (
              <li
                key={entry.id}
                className={styles.evidenceItem}
                data-evidence={entry.id}
              >
                {entry.kind === 'photo' ? (
                  <button
                    type="button"
                    className={styles.evidenceOpen}
                    data-open-evidence={entry.id}
                    onClick={() => setOpen(entry)}
                  >
                    <img
                      className={styles.evidenceThumb}
                      src={entry.url}
                      alt={`Photograph attached to this incident: ${entry.fileName}`}
                    />
                  </button>
                ) : (
                  /*
                   * **No caption track, and not because the rule was
                   * inconvenient.** `jsx-a11y/media-has-caption` is written
                   * for authored media, where captions exist and somebody
                   * left them out. This is a phone recording somebody made in
                   * the minutes after an incident; there is no caption file
                   * and inventing an empty `<track>` would satisfy the linter
                   * by asserting captions exist, which is the fabricated
                   * record this build refuses everywhere else.
                   *
                   * What a screen reader can be given honestly is what this
                   * is, who recorded it and when, so it has that.
                   */
                  // eslint-disable-next-line jsx-a11y/media-has-caption -- no caption track exists for a recording made at the scene; an empty one would claim otherwise
                  <video
                    className={styles.evidenceVideo}
                    src={entry.url}
                    controls
                    aria-label={`Video attached to this incident: ${entry.fileName}, recorded by ${entry.attached.by.displayName}`}
                    data-evidence-video={entry.id}
                  />
                )}

                <span className={styles.evidenceAbout}>
                  <span className={styles.evidenceName}>{entry.fileName}</span>
                  {/* Who attached it and when, always visible. A photograph
                      nobody is named against is one nobody can ask about. */}
                  <span className={styles.evidenceMeta}>
                    {entry.kind === 'photo' ? 'Photo' : 'Video'} ·{' '}
                    <span data-numeric>{formatSize(entry.size)}</span> · attached by{' '}
                    {entry.attached.by.displayName} ·{' '}
                    <span data-numeric>{format.dateTime(entry.attached.at)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/*
           * **Not the hatch.** `Unrecorded` is the one entry point to the
           * unrecorded treatment and it means a clinical fact is missing.
           * Nothing is missing here: the evidence is recorded, with who
           * attached it and when. This is a storage caveat, and dressing it in
           * gap vocabulary spends the alarm on something nobody has to act on
           * — which is how the alarm stops working where there is a gap.
           *
           * The same sentence is a plain paragraph on the report form, and the
           * two say the identical thing because it is the identical fact.
           */}
          <p className={styles.sessionOnly} data-evidence-session-only>
            Held on this device for this session only, like everything else here.
            Nothing is uploaded anywhere, so if this needs to be kept, keep the original
            too.
          </p>
        </>
      )}

      {open === 'none' ? null : (
        <Dialog
          open
          onOpenChange={(next) => (next ? undefined : setOpen('none'))}
          title={open.fileName}
          description={`Attached by ${open.attached.by.displayName} · ${format.dateTime(open.attached.at)}`}
        >
          <img className={styles.evidenceFull} src={open.url} alt={open.fileName} />
        </Dialog>
      )}
    </section>
  )
}
