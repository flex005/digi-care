import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/icon/Icon'
import { useOutletContext } from 'react-router-dom'
import type {
  CategoryState,
  DocumentRecord,
  IsoDate,
  LibraryRow,
  Resident,
} from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { residentDocuments } from '@/data/access/document-store'
import { Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import { BrokenReference, ExpiryChip, FileFactsText, FiledBy } from './DocumentParts'
import { UploadDrawer } from './UploadDrawer'
import { expiryFinding } from './expiry'
import { residentLibrary } from './library'
import { useSiteToday } from './today'
import styles from './documents.module.css'

/**
 * A resident's documents. PRD §6.7, Phase 11.
 *
 * The sentence: **what has expired, what is about to, and what nobody can
 * tell you about — then the seven categories in the order an emergency needs
 * them.**
 *
 * All seven always listed, iterated from the constant. A library showing only
 * the categories it holds tells a reader there are four kinds of document.
 */
export function DocumentsTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  const today = useSiteToday()

  /*
   * The store is not reactive, so what is on file is held in state and read
   * again when this screen files something.
   *
   * It carries the resident it was read for, and resets during render when
   * that changes. **The subject comes from the route** (§2.4): if this screen
   * kept the previous resident's documents for one render, it would be showing
   * one person's library under another person's name — which is the wrong
   * subject failure with a filing cabinet around it.
   */
  const [filed, setFiled] = useState(() => ({
    residentId: resident.id,
    onFile: residentDocuments(resident.id),
  }))
  if (filed.residentId !== resident.id) {
    setFiled({ residentId: resident.id, onFile: residentDocuments(resident.id) })
  }
  const onFile = filed.onFile

  const library = useMemo(
    () => residentLibrary(resident, onFile, today),
    [resident, onFile, today],
  )

  return (
    <div className={styles.tabPanel} data-documents-panel>
      <Findings counts={library.counts} resident={resident} />

      <div className={styles.tabActions}>
        <UploadDrawer
          owner={{ kind: 'resident', residentId: resident.id }}
          subjectName={
            resident.room.kind === 'recorded'
              ? `${resident.fullLegalName} · Room ${resident.room.value}`
              : `${resident.fullLegalName} · room not recorded`
          }
          onFiled={() =>
            setFiled({
              residentId: resident.id,
              onFile: residentDocuments(resident.id),
            })
          }
        />
      </div>

      <Card>
        {library.categories.map((category) => (
          <section
            key={category.id}
            className={styles.category}
            data-category={category.id}
          >
            <header className={styles.categoryHead}>
              <h2 className={styles.categoryTitle}>{category.label}</h2>
              <p className={styles.categoryCount} data-category-count>
                {category.state.kind === 'filled'
                  ? `${formatCount(category.state.rows.length)} ${category.state.rows.length === 1 ? 'entry' : 'entries'}`
                  : 'nothing on file'}
              </p>
            </header>
            <CategoryBody state={category.state} holds={category.holds} today={today} />
          </section>
        ))}
      </Card>
    </div>
  )
}

/**
 * Three findings, never summed.
 *
 * Expired and expiring are findings about documents somebody decided about.
 * **No expiry recorded is not a milder third** — it is the absence of the fact
 * the other two are made of, so it takes the hatch while they take critical
 * and caution. A single "needs attention" number would weigh a lapsed DNAR
 * and an unclassified photograph the same.
 */
function Findings({
  counts,
  resident,
}: {
  counts: { expired: number; expiring: number; notRecorded: number; total: number }
  resident: Resident
}) {
  const of = `Of ${formatCount(counts.total)} ${counts.total === 1 ? 'document' : 'documents'} on file for ${resident.preferredName}.`

  return (
    <div className={styles.findings}>
      <div className={styles.finding} data-finding="expired">
        <span className={styles.findingFigure} data-numeric>
          {formatCount(counts.expired)}
        </span>
        <span>
          <span className={styles.findingTitle}>expired</span>
          <span className={styles.findingDetail}>{of}</span>
        </span>
      </div>

      <div className={styles.finding} data-finding="expiring">
        <span className={styles.findingFigure} data-numeric>
          {formatCount(counts.expiring)}
        </span>
        <span>
          <span className={styles.findingTitle}>expire within 30 days</span>
          <span className={styles.findingDetail}>{of}</span>
        </span>
      </div>

      {/* The hatch, marked as the hatch — the same `data-state` the Unrecorded
          component sets, so the treatment is checkable wherever it appears. */}
      <div
        className={styles.findingHatched}
        data-finding="not_recorded"
        data-state="unrecorded"
      >
        <span className={styles.findingFigure} data-numeric>
          {formatCount(counts.notRecorded)}
        </span>
        <span>
          <span className={styles.findingTitle}>no expiry recorded</span>
          <span className={styles.findingDetail}>
            {of} Nobody has said whether they expire.
          </span>
        </span>
      </div>
    </div>
  )
}

function CategoryBody({
  state,
  holds,
  today,
}: {
  state: CategoryState
  holds: string
  today: IsoDate
}) {
  if (state.kind === 'filled') {
    return (
      <ul className={styles.rows}>
        {state.rows.map((row) => (
          <li key={rowKey(row)}>
            <Row row={row} today={today} />
          </li>
        ))}
      </ul>
    )
  }

  /*
   * Empty is not always emptiness. A category nothing implies anything about
   * is quietly empty; a category another module's record says should hold
   * something is a gap, and the two are opposite states behind the same blank
   * space.
   */
  if (state.kind === 'expected_but_empty') {
    return (
      <div className={styles.categoryGap} data-empty="expected">
        <Unrecorded
          variant="panel"
          label={state.missing}
          detail={state.because}
          caption="The care record says a document exists"
        />
      </div>
    )
  }

  return (
    <p className={styles.categoryEmpty} data-empty="nothing">
      No documents in this category. It holds {holds}.
    </p>
  )
}

const rowKey = (row: LibraryRow) =>
  row.kind === 'document' ? row.document.id : row.reference.id

function Row({ row, today }: { row: LibraryRow; today: IsoDate }) {
  if (row.kind === 'referenced_not_on_file') {
    return (
      <div className={styles.row} data-row="referenced_not_on_file">
        <div>
          <p className={styles.rowTitle}>{row.reference.title}</p>
          <p className={styles.rowMeta}>{row.reference.detail}</p>
        </div>
        <BrokenReference reference={row.reference} />
        <p className={styles.rowFiled} data-filed>
          Referenced by {row.reference.origin}
        </p>
        {/* Never a link that fails on click. */}
        <span className={styles.rowActionDisabled} data-action="cannot_open">
          Cannot open, not on file
        </span>
      </div>
    )
  }

  return <DocumentRow document={row.document} today={today} />
}

function DocumentRow({
  document,
  today,
}: {
  document: DocumentRecord
  today: IsoDate
}) {
  const notRetrievable = document.file.kind === 'not_retrievable'

  return (
    <div className={styles.row} data-row="document" data-document={document.id}>
      <div>
        <p className={styles.rowTitle}>{document.title}</p>
        <p className={styles.rowMeta}>
          <FileFactsText file={document.file} />
        </p>
      </div>

      <ExpiryChip finding={expiryFinding(document.expiry, today)} />

      <p className={styles.rowFiled} data-filed>
        <FiledBy staff={document.filedBy} on={document.filedOn} />
      </p>

      {/*
       * **A document whose metadata is real opens; one added this session does
       * not.** The viewer shows a representative sample of the type and says
       * so above the page, which is honest about a build with no file storage
       * and is worth opening for the rail: what points at this document, and
       * what would break without it.
       *
       * A document added this session has no type to sample and no filing
       * behind it, so the message it had is still the true one.
       */}
      {notRetrievable ? (
        <span className={styles.rowActionDisabled} data-action="not_retrievable">
          Not retrievable: added this session
        </span>
      ) : (
        <Link
          to={`/documents/${document.id}`}
          className={styles.rowAction}
          data-action="open"
          aria-label={`Open ${document.title}`}
        >
          Open
          <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
        </Link>
      )}
    </div>
  )
}
