import { Link, useParams } from 'react-router-dom'
import { now as appNow } from '@/data/fixtures/clock'
import type { DocumentId, IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { documents as fixtureDocuments } from '@/data/fixtures/documents'
import { residents as allResidents } from '@/data/fixtures/residents'
import { zonedDate } from '@/lib/format'
import { categoryLabel } from './categories'
import { ExpiryChip, FileFactsText, FiledBy } from './DocumentParts'
import { DocumentSample } from './DocumentSample'
import { expiryFinding } from './expiry'
import { documentReferrers } from './referrers'
import styles from './viewer.module.css'

/**
 * Opening a document. PRD §6.6f.
 *
 * **This replaces "not retrievable" for a document whose metadata is real, and
 * replaces nothing else.** A broken reference still says "cannot open, not on
 * file", because that message is the product working: a module claiming a
 * document exists that the library cannot produce is a finding, and it is a
 * different thing from a document that is on file in a build with no file
 * storage.
 *
 * The stage shows a representative sample of the document type, and the banner
 * above it says so. Nothing is written across the page: a watermark would make
 * the sample unreadable, and this build has already learned once what an
 * interface that obscures its own content costs.
 *
 * The rail is why the viewer is worth opening rather than being a picture. It
 * carries what points at this document, each linked, which is the
 * broken-reference relationship seen from the other end: not "a module says
 * this exists and it does not", but "if this went, here is what would break".
 */
export function DocumentViewerRoute() {
  const { documentId } = useParams<{ documentId: string }>()
  const { activeSite } = useSession()

  const document = fixtureDocuments.find((entry) => entry.id === documentId)

  if (document === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.errorTitle}>No document with that id</p>
        <p className={styles.errorBody}>
          Nothing is shown rather than a page of somebody else&rsquo;s document under an
          id nobody recognised.
        </p>
        <Link to="/documents" className={styles.backLink}>
          Back to the library
        </Link>
      </div>
    )
  }

  const ownership = document.owner
  const owner =
    ownership.kind === 'resident'
      ? allResidents.find((entry) => entry.id === ownership.residentId)
      : undefined

  const today = zonedDate(appNow().toISOString() as IsoDateTime, activeSite.timeZone)
  const finding = expiryFinding(document.expiry, today)
  const referrers = documentReferrers(document.id as DocumentId, allResidents)

  return (
    <div className={styles.page} data-document-viewer={document.id}>
      <Link to="/documents" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Documents
      </Link>

      <div className={styles.viewer}>
        <div className={styles.stage}>
          <div className={styles.stageBar}>
            <div>
              <p className={styles.stageName}>
                {document.title}
                {owner ? `: ${owner.fullLegalName}` : ''}
              </p>
              <p className={styles.stageMeta}>
                Page 1 of 1 · <FiledBy staff={document.filedBy} on={document.filedOn} />
              </p>
            </div>
          </div>

          {/*
           * Above the page, never across it. A watermark would make the
           * sample unreadable, and an interface that obscures its own content
           * is a lesson this build has already paid for once.
           */}
          <p className={styles.sampleBanner} data-sample-banner>
            <b>This is a sample document.</b> diGi-Care has no file storage, so nothing
            real is held behind this record. What you are looking at is a representative{' '}
            {document.title}, showing how a document of this type renders in the viewer.
            The name, dates and filing details on it are this record&rsquo;s own.
          </p>

          <DocumentSample document={document} resident={owner} />
        </div>

        <aside className={styles.rail}>
          <section className={styles.railSection}>
            <h2 className={styles.railTitle}>This document</h2>
            <RailField label="Category" value={categoryLabel(document.category)} />
            <RailField
              label="Filed"
              value={<FiledBy staff={document.filedBy} on={document.filedOn} />}
            />
            <RailField label="Format" value={<FileFactsText file={document.file} />} />
            <RailField label="Expiry" value={<ExpiryChip finding={finding} />} />
          </section>

          <section className={styles.railSection}>
            <h2 className={styles.railTitle}>What points at this document</h2>
            {referrers.length === 0 ? (
              /*
               * Zero is an answer, and a different one from a broken
               * reference: nothing relies on this document, so removing it
               * would take evidence away from no record.
               */
              <p className={styles.railHint} data-no-referrers>
                No record in the product points at this document. Removing it would
                leave nothing behind a claim somewhere else, which is what the
                library&rsquo;s broken references are.
              </p>
            ) : (
              <>
                <ul className={styles.usedBy}>
                  {referrers.map((referrer) => (
                    <li key={`${referrer.label}-${referrer.to}`}>
                      <Link
                        to={referrer.to}
                        className={styles.usedByRow}
                        data-referrer={referrer.to}
                      >
                        {referrer.label}
                        <span className={styles.usedByGo}>
                          Open
                          <Icon
                            name="arrows-sharp/arrow-right-01-sharp"
                            size={16}
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className={styles.railHint}>
                  {referrers.length === 1
                    ? 'One record relies'
                    : `${referrers.length} records rely`}{' '}
                  on this document. If it were removed,{' '}
                  {referrers.length === 1 ? 'it' : 'each'} would render as a broken
                  reference rather than quietly losing the evidence behind it.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function RailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.railField}>
      <p className={styles.railKey}>{label}</p>
      <div className={styles.railValue}>{value}</div>
    </div>
  )
}
