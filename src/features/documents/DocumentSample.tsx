import type { DocumentRecord, Resident } from '@/data/types'
import { formatDate } from '@/lib/format'
import styles from './viewer.module.css'

/**
 * A representative sample of a document type. PRD §6.6f.
 *
 * **This build stores no files, so what the viewer shows is the type, not the
 * document.** The banner above says so in words; nothing is written across the
 * page. A watermark would make the sample unreadable and would be the second
 * thing in this build to obscure its own content, after the export stub that
 * offered a file it could not produce.
 *
 * The resident's real name, date of birth and room are on it, because the
 * metadata *is* real and hiding it would make the sample less honest rather
 * than more: what is invented is the body of the form, and the banner names
 * exactly that.
 */
export function DocumentSample({
  document,
  resident,
}: {
  document: DocumentRecord
  resident: Resident | undefined
}) {
  const name = resident?.fullLegalName ?? 'The resident'
  const room = resident?.room.kind === 'recorded' ? resident.room.value : 'not recorded'

  return (
    <article className={styles.doc} data-document-sample={document.category}>
      <header className={styles.crest}>
        <div>
          <p className={styles.org}>Thornfield Integrated Care Board</p>
          <p className={styles.orgSub}>{document.title}</p>
        </div>
        <p className={styles.ref}>
          Sample form
          <br />
          Page 1 of 1
          <br />
          Retain in the resident record
        </p>
      </header>

      <h2 className={styles.docTitle}>{document.title}</h2>
      <p className={styles.strap}>
        {STRAP[document.category] ??
          'A form of this type, as it renders in the viewer.'}
      </p>

      <dl className={styles.fields}>
        <Field label="Full name" value={name} />
        {resident ? (
          <Field label="Date of birth" value={formatDate(resident.dateOfBirth)} />
        ) : null}
        <Field label="Room" value={room} />
        <Field label="Filed" value={formatDate(document.filedOn)} />
      </dl>

      <div className={styles.block}>
        <p className={styles.blockTitle}>
          {BLOCK[document.category]?.title ?? 'Record'}
        </p>
        <p className={styles.blockBody}>
          {BLOCK[document.category]?.body ??
            'The body of a form of this type would appear here, in the wording the issuing organisation uses.'}
        </p>
      </div>

      <div className={styles.sigRow}>
        <div className={styles.sig}>
          <p className={styles.sigWho}>Signature</p>
          <p className={styles.sigRole}>The issuing clinician or organisation</p>
        </div>
        <div className={styles.sig}>
          <p className={styles.sigWho}>{document.filedBy.displayName}</p>
          <p className={styles.sigRole}>
            Filed at the home on {formatDate(document.filedOn)}
          </p>
        </div>
      </div>

      <footer className={styles.docFoot}>
        {/*
         * The title as it was written, not lowercased to fit a sentence.
         * "DNAR form" became "dnar form" here, which is the same move as
         * agreeing a plural at the call site: whoever is appending a value
         * does not get to decide how it reads.
         */}
        <span>Sample of a {document.title}</span>
        <span>Original held on paper</span>
      </footer>
    </article>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fieldRow}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{value}</dd>
    </div>
  )
}

const STRAP: Partial<Record<DocumentRecord['category'], string>> = {
  legal_authority:
    'This form records one decision. It does not affect any other treatment or care.',
  health_clinical: 'A clinical record issued by the service that made it.',
  consent_records: 'A record of what was agreed, by whom, and on what date.',
  assessments_care_planning: 'An assessment carried out on the date shown.',
  identity_admission: 'Held to establish identity at admission.',
  correspondence: 'Correspondence held on the resident record.',
  photographs_media: 'An image held with the resident’s consent.',
}

const BLOCK: Partial<
  Record<DocumentRecord['category'], { title: string; body: string }>
> = {
  legal_authority: {
    title: 'Decision',
    body: 'The decision this form records would be stated here, in the issuing organisation’s own wording, with the reason and who it was discussed with.',
  },
  health_clinical: {
    title: 'Clinical summary',
    body: 'The clinical detail would appear here as the issuing service wrote it, including any changes to medication and what follow-up was arranged.',
  },
  consent_records: {
    title: 'What was agreed',
    body: 'What was consented to, who gave it, and on what authority, in the words used at the time.',
  },
}
