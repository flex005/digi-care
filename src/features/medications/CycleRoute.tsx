import { useMemo, useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { Button, Card, Dialog } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatCount, formatDate, pluralise } from '@/lib/format'
import { residentsBySite } from '@/data/fixtures/residents'
import { cycle, gapsAgainst, type CycleRow } from '@/data/fixtures/medication-cycle'
import {
  acceptRow,
  actionFor,
  allHandled,
  queryRow,
  stopHere,
} from '@/data/access/cycle-store'
import styles from './cycle.module.css'

/**
 * The cycle the pharmacy sent, against what the home holds. PRD §6.4.
 *
 * **Nothing on this screen creates a prescription.** Every row is a change a
 * prescriber already made, named on the row with the date they made it; the
 * home is recording that it received it. A care home that could invent a
 * prescription would be the most dangerous thing in this product.
 *
 * **The fourth tally is the finding, and it takes the hatch.** A drug the home
 * is still giving that the pharmacy has stopped supplying appears on neither
 * side's list: the cycle does not mention it and the MAR chart looks entirely
 * normal. It exists only in the comparison, which is why this screen is one.
 *
 * **There is no "accept all".** One click asserting nineteen medication
 * changes nobody read is the handover failure with prescriptions in it, and the
 * store has no function that could implement one.
 */
export function CycleRoute() {
  const { activeSite, currentUser } = useSession()
  const [version, setVersion] = useState(0)
  const [asking, setAsking] = useState<{ row: string; kind: 'query' | 'stop' } | null>(
    null,
  )
  const [note, setNote] = useState('')

  const residents = useMemo(() => residentsBySite(activeSite.id), [activeSite.id])
  const byId = useMemo(
    () => new Map(residents.map((one) => [one.id, one])),
    [residents],
  )

  const rows = cycle.rows.filter((row) => byId.has(row.residentId))
  const gaps = useMemo(
    () =>
      gapsAgainst(
        rows,
        residents.map((one) => one.id),
      ),
    [rows, residents],
  )

  const tally = {
    added: rows.filter((row) => row.kind === 'new').length,
    changed: rows.filter((row) => row.kind === 'changed').length,
    stopped: rows.filter((row) => row.kind === 'stopped').length,
  }

  const everyId = [...rows.map((row) => row.id), ...gaps.map((gap) => gap.medicationId)]
  const handled = everyId.filter((id) => actionFor(id) !== undefined).length
  const bump = () => setVersion((count) => count + 1)

  const closeDialog = () => {
    setAsking(null)
    setNote('')
  }

  return (
    <div className={styles.page} data-cycle={cycle.id} data-version={version}>
      <header>
        <h2 className={styles.title}>
          {cycle.pharmacy} · cycle received {formatDate(cycle.receivedOn)}
        </h2>
        <p className={styles.subtitle}>
          Covers {formatDate(cycle.coversFrom)} to {formatDate(cycle.coversTo)} at{' '}
          {activeSite.name}. Nothing here creates a prescription: every row is a change
          a prescriber already made, and the home is recording that it received it.
        </p>
      </header>

      <div className={styles.tallies} data-cycle-tallies>
        <Tally label="New" value={tally.added} note="not currently on a MAR chart" />
        <Tally
          label="Changed"
          value={tally.changed}
          note="dose, timing or directions"
        />
        <Tally label="Stopped" value={tally.stopped} note="no longer supplied" />
        {/*
         * The finding. It is on neither list, so it takes the hatch: nobody
         * has decided to stop these, and the pharmacy has stopped sending
         * them.
         */}
        <div className={styles.tallyGap} data-state="unrecorded" data-tally="gap">
          <p className={styles.tallyLabel}>On the MAR, not in the cycle</p>
          <p className={styles.tallyValue} data-numeric>
            {formatCount(gaps.length)}
          </p>
          <p className={styles.tallyNote}>still being given, not supplied</p>
        </div>
      </div>

      <Card>
        <ul className={styles.rows}>
          {rows.map((row) => {
            const resident = byId.get(row.residentId)!
            const action = actionFor(row.id)
            return (
              <li key={row.id}>
                <div className={styles.row} data-cycle-row={row.id}>
                  <div>
                    <p className={styles.drug}>{row.drug}</p>
                    <p className={styles.form}>{row.form}</p>
                    <p className={styles.who}>
                      {resident.fullLegalName}
                      {resident.room.kind === 'recorded'
                        ? ` · Room ${resident.room.value}`
                        : ' · Room not recorded'}
                    </p>
                  </div>

                  <span className={KIND_CLASS[row.kind]} data-kind={row.kind}>
                    {KIND_LABEL[row.kind]}
                    <small>
                      by {row.prescriber}, {formatDate(row.changedOn)}
                    </small>
                  </span>

                  {/* Old and new on one line: two rows to compare is how a
                      change gets read as two medications. */}
                  <p className={styles.was}>
                    <b>{row.was}</b> <span className={styles.arrow}>→</span>{' '}
                    <b>{row.now}</b>
                  </p>

                  <div className={styles.acts}>
                    {action ? (
                      <span className={styles.done} data-row-action={action.kind}>
                        {action.kind === 'accepted' ? 'Accepted' : 'Queried'} by{' '}
                        {action.by.displayName}
                        {action.note === '' ? '' : ` · ${action.note}`}
                      </span>
                    ) : (
                      <>
                        <Button
                          size="small"
                          data-accept={row.id}
                          onClick={() => {
                            acceptRow(row.id, currentUser)
                            bump()
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          data-query={row.id}
                          onClick={() => setAsking({ row: row.id, kind: 'query' })}
                        >
                          Query
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}

          {gaps.map((gap) => {
            const resident = byId.get(gap.residentId)!
            const action = actionFor(gap.medicationId)
            return (
              <li key={gap.medicationId}>
                <div className={styles.row} data-cycle-gap={gap.medicationId}>
                  <div>
                    <p className={styles.drug}>{gap.drug}</p>
                    <p className={styles.form}>{gap.form}</p>
                    <p className={styles.who}>
                      {resident.fullLegalName}
                      {resident.room.kind === 'recorded'
                        ? ` · Room ${resident.room.value}`
                        : ' · Room not recorded'}
                    </p>
                  </div>

                  <span data-kind="gap">
                    <Unrecorded
                      variant="chip"
                      label="On the MAR, not in this cycle"
                      detail="the pharmacy has not supplied it"
                    />
                  </span>

                  <p className={styles.was}>
                    Still being given at {gap.rounds}. Nobody has stopped it here.
                  </p>

                  <div className={styles.acts}>
                    {action ? (
                      <span className={styles.done} data-row-action={action.kind}>
                        {action.kind === 'stopped_here' ? 'Stopped here' : 'Queried'} by{' '}
                        {action.by.displayName} · {action.note}
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="small"
                          data-query={gap.medicationId}
                          onClick={() =>
                            setAsking({ row: gap.medicationId, kind: 'query' })
                          }
                        >
                          Query the pharmacy
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          data-stop={gap.medicationId}
                          onClick={() =>
                            setAsking({ row: gap.medicationId, kind: 'stop' })
                          }
                        >
                          Stop it here
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className={styles.foot}>
          <p className={styles.footState} data-cycle-state>
            <b>Each row is accepted on its own. There is no &ldquo;accept all&rdquo;</b>
            , because one click asserting{' '}
            {/* The changes, not the rows: the gaps below them are findings the
                pharmacy did not send, and they are not changes to accept. */}
            {pluralise(rows.length, 'medication change')} nobody read is the same
            failure as signing a handover for residents nobody looked at.{' '}
            <span data-numeric>{formatCount(handled)}</span> of{' '}
            <span data-numeric>{formatCount(everyId.length)}</span> handled so far.
          </p>
          <Button disabled={!allHandled(everyId)} data-close-cycle>
            Close the cycle
          </Button>
        </div>
      </Card>

      <Dialog
        open={asking !== null}
        onOpenChange={(next) => (next ? undefined : closeDialog())}
        title={
          asking?.kind === 'stop'
            ? 'Stop this medication here?'
            : 'What are you asking the pharmacy?'
        }
        description={
          asking?.kind === 'stop'
            ? 'The pharmacy has stopped supplying it and nobody here has stopped it.'
            : 'The question goes on the record with your name.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              disabled={note.trim() === ''}
              data-confirm-note={asking?.kind}
              onClick={() => {
                if (asking === null) return
                if (asking.kind === 'stop') stopHere(asking.row, note, currentUser)
                else queryRow(asking.row, note, currentUser)
                closeDialog()
                bump()
              }}
            >
              {asking?.kind === 'stop' ? 'Stop it here' : 'Send the query'}
            </Button>
          </>
        }
      >
        <label className={styles.noteField}>
          <span className={styles.noteLabel}>
            {asking?.kind === 'stop' ? 'Why it is being stopped' : 'The question'}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            data-cycle-note
          />
        </label>
      </Dialog>
    </div>
  )
}

function Tally({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className={styles.tally} data-tally={label}>
      <p className={styles.tallyLabel}>{label}</p>
      <p className={styles.tallyValue} data-numeric>
        {formatCount(value)}
      </p>
      <p className={styles.tallyNote}>{note}</p>
    </div>
  )
}

const KIND_LABEL: Record<CycleRow['kind'], string> = {
  new: 'New',
  changed: 'Dose changed',
  stopped: 'Stopped',
}

const KIND_CLASS: Record<CycleRow['kind'], string> = {
  new: styles.kindNew,
  changed: styles.kindChanged,
  stopped: styles.kindStopped,
}
