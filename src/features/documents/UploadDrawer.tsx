import { useState } from 'react'
import type {
  DocumentCategoryId,
  DocumentOwner,
  ExpiryDecision,
  IsoDate,
} from '@/data/types'
import { fileDocument } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { toIsoDate } from '@/data/fixtures/generate'
import { DOCUMENT_CATEGORIES } from './categories'
import styles from './documents.module.css'

/**
 * Filing a document. PRD §6.7, Phase 11.
 *
 * The sentence: **who this belongs to, then what it is, then whether it
 * expires, then the file.**
 *
 * **The subject is first and locks once a file is chosen** (§2.4). This is the
 * screen whose entire purpose is attaching something to somebody, so the
 * wrong-subject write here is not a mis-typed note — it is a stranger's DNAR
 * in this person's folder.
 *
 * **Expiry is answered before the file and has no default.** A pre-selected
 * "does not expire" would be a permanence decision nobody made. Leaving it
 * unanswered is allowed, and the row afterwards says so in the hatch, because
 * an unanswered question is a different thing from an answered one.
 */
export function UploadDrawer({
  owner,
  subjectName,
  onFiled,
}: {
  owner: DocumentOwner
  /** Named in the drawer and in the confirmation. Never inferred. */
  subjectName: string
  onFiled: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} data-add-document>
        <Icon name="download-upload/upload-01" size={16} aria-hidden />
        Add a document
      </Button>
      {open ? (
        <UploadForm
          owner={owner}
          subjectName={subjectName}
          onClose={() => setOpen(false)}
          onFiled={onFiled}
        />
      ) : null}
    </>
  )
}

type FileChoice = { kind: 'none' } | { kind: 'chosen'; name: string; format: string }

type ExpiryAnswer = 'unanswered' | 'expires' | 'does_not_expire'

function UploadForm({
  owner,
  subjectName,
  onClose,
  onFiled,
}: {
  owner: DocumentOwner
  subjectName: string
  onClose: () => void
  onFiled: () => void
}) {
  const { currentUser } = useSession()
  const [category, setCategory] = useState<DocumentCategoryId | ''>('')
  const [title, setTitle] = useState('')
  const [answer, setAnswer] = useState<ExpiryAnswer>('unanswered')
  const [expiresOn, setExpiresOn] = useState('')
  const [file, setFile] = useState<FileChoice>({ kind: 'none' })

  const waiting: string[] = []
  if (category === '') waiting.push('which category it belongs in')
  if (title.trim() === '') waiting.push('what this document is')
  if (answer === 'expires' && expiresOn === '') waiting.push('the date it expires')
  if (file.kind === 'none') waiting.push('a file')

  const today = toIsoDate(new Date())

  const submit = () => {
    if (waiting.length > 0 || category === '') return

    const expiry: ExpiryDecision =
      answer === 'expires'
        ? { kind: 'expires', on: expiresOn as IsoDate }
        : answer === 'does_not_expire'
          ? { kind: 'does_not_expire', decidedBy: currentUser, on: today }
          : { kind: 'not_recorded' }

    void fileDocument({
      owner,
      category,
      title: title.trim(),
      format: file.kind === 'chosen' ? file.format : '',
      expiry,
      filedBy: currentUser,
      filedOn: today,
    }).then(() => {
      onFiled()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Add a document for ${subjectName}`}
      description="The subject is answered first and cannot be changed once a file is chosen."
    >
      <div className={styles.drawer}>
        <section className={styles.drawerSection} data-drawer-section="subject">
          <h3 className={styles.drawerHeading}>Who this belongs to</h3>
          <p className={styles.subjectLocked} data-subject={subjectName}>
            {subjectName}
            {file.kind === 'chosen' ? (
              <span className={styles.subjectLockNote} data-subject-locked>
                Locked: a file has been chosen. Close this and start again to file it
                against somebody else.
              </span>
            ) : null}
          </p>
        </section>

        <section className={styles.drawerSection} data-drawer-section="what">
          <h3 className={styles.drawerHeading}>What it is</h3>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Category</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as DocumentCategoryId | '')
              }
              data-field="category"
            >
              <option value="">Choose a category</option>
              {DOCUMENT_CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>What this document is</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-field="title"
            />
          </label>
        </section>

        <section className={styles.drawerSection} data-drawer-section="expiry">
          <h3 className={styles.drawerHeading}>Does it expire?</h3>
          <div className={styles.choices}>
            <label className={styles.choice} data-choice="expires">
              <input
                type="radio"
                name="expiry"
                checked={answer === 'expires'}
                onChange={() => setAnswer('expires')}
              />
              <b>Yes, on a date</b>
              <span className={styles.choiceHint}>
                It appears in expiry tracking as that date approaches.
              </span>
            </label>
            <label className={styles.choice} data-choice="does_not_expire">
              <input
                type="radio"
                name="expiry"
                checked={answer === 'does_not_expire'}
                onChange={() => setAnswer('does_not_expire')}
              />
              <b>No: this document does not expire</b>
              <span className={styles.choiceHint}>
                Recorded as {currentUser.displayName}&rsquo;s decision, dated today. An
                empty date field cannot say this.
              </span>
            </label>
          </div>

          {answer === 'expires' ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Expires on</span>
              <input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                data-field="expires-on"
              />
            </label>
          ) : null}

          <p className={styles.choiceNote} data-unanswered-note>
            Leaving this unanswered is allowed. It renders as a gap on the library,
            because nothing will be able to tell anybody whether the document is still
            valid.
          </p>
        </section>

        <section className={styles.drawerSection} data-drawer-section="file">
          <h3 className={styles.drawerHeading}>The file</h3>
          <div className={styles.choices}>
            {['PDF', 'JPG', 'DOCX'].map((format) => (
              <button
                key={format}
                type="button"
                className={styles.fileChoice}
                data-choose-file={format}
                aria-pressed={file.kind === 'chosen' && file.format === format}
                onClick={() =>
                  setFile({ kind: 'chosen', name: `${title || 'Document'}`, format })
                }
              >
                Choose a {format}
              </button>
            ))}
          </div>

          {/*
           * Where the file is chosen, not afterwards in a toast. A control that
           * does not do what it appears to says so where it appears.
           */}
          <p className={styles.notStored} data-not-stored data-state="unrecorded">
            The file itself is not stored in this build. Its details are added to the
            library for this session and are gone on reload, and the row will say the
            same: there is nothing to download and nothing has been saved to a server.
          </p>
        </section>

        <footer className={styles.drawerFoot}>
          <p className={styles.waiting} data-waiting>
            {waiting.length > 0 ? (
              <>
                <b>Waiting on:</b> {waiting.join(' · ')}
              </>
            ) : (
              <>
                Filing against <b>{subjectName}</b>.
              </>
            )}
          </p>
          <Button
            variant="primary"
            disabled={waiting.length > 0}
            onClick={submit}
            data-file-document
          >
            Add to the library
          </Button>
        </footer>
      </div>
    </Dialog>
  )
}
