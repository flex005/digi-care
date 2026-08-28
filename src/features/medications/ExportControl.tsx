import { useState } from 'react'
import type { Resident } from '@/data/types'
import { Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { pluralise } from '@/lib/format'
import type { MarRange } from './mar-grid'
import styles from './medications.module.css'

/**
 * MAR PDF export. PRD §6.4 — stubbed in this build.
 *
 * **Never a silent no-op.** A button that does nothing when pressed teaches
 * somebody that the product is broken, and a button that does nothing while
 * looking pleased with itself is worse: on a screen whose whole job is
 * evidence, an export that appears to have happened and did not is a record
 * somebody believes exists.
 *
 * **And it says what it would produce, not only that it cannot.** A disabled
 * control that does not say what it does is a control nobody can plan around:
 * a manager deciding whether the inspector's request can be met needs to know
 * that this button means *this resident's chart for this range, every cell
 * with its state, author and time* — which is a different answer from "a
 * summary" or "the omissions". Naming the contents is the part that survives
 * the stub.
 *
 * Enabled rather than disabled, deliberately. The Add-resident pattern is a
 * capability nobody has yet; this is a capability the build has decided to
 * defer, and the difference is that pressing it has something to tell you.
 */
export function ExportControl({
  resident,
  siteName,
  range,
  rangeLabel,
  medications,
  rounds,
  days,
}: {
  resident: Resident
  /** The resident's own site, whose zone their records render in. */
  siteName: string
  range: MarRange
  /** "Week of 17/08 to 23/08" — exactly what the chart says above the grid. */
  rangeLabel: string
  medications: number
  rounds: number
  days: number
}) {
  const [open, setOpen] = useState(false)
  const cells = medications * rounds * days

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        <Icon name="download-upload/download-01" size={16} aria-hidden />
        Export PDF
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Exporting the MAR chart is not available in this build"
        description="Nothing has been produced and nothing has been sent. This is a prototype, and the export is built in a later phase."
        actions={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className={styles.exportBody} data-export-stub>
          <p className={styles.exportLead}>What it will contain when it exists</p>
          <ul className={styles.exportList}>
            <li>
              {resident.fullLegalName}&rsquo;s medication administration record for the{' '}
              {range} shown,{' '}
              <strong className={styles.exportRange}>{rangeLabel}</strong>.
            </li>
            <li>
              {pluralise(medications, 'medication')} down the page and{' '}
              {pluralise(rounds, 'round')} a day across {pluralise(days, 'day')},{' '}
              <span data-numeric>{cells}</span> cells in all.
            </li>
            <li>
              Every cell in the state the chart shows it in: given, not given with its
              reason, omitted, due, or not due. Never a blank.
            </li>
            <li>
              The author and the time against every recorded dose, and the second
              signature on every controlled drug, or the fact that it was never
              captured.
            </li>
            <li>
              Times in {siteName}&rsquo;s zone, as they are on screen, with the zone
              named on the page.
            </li>
          </ul>
          {/* Said plainly, because an export is the artefact somebody hands an
              inspector. What it leaves out is part of what it is. */}
          <p className={styles.exportNote}>
            It is the chart, not a summary of it. Nothing is aggregated away and no gap
            is closed by the export.
          </p>
        </div>
      </Dialog>
    </>
  )
}
