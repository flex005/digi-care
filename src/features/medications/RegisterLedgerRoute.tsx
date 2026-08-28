import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { MarWitness, StaffRef } from '@/data/types'
import { getRegister } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { buildRegister, registerBalance, registerState } from './register'
import { quantityWithUnit, unitFor } from './units'
import type { RegisterEntry } from './register'
import type { RegisterData } from './RegisterRoute'
import styles from './medications.module.css'

/**
 * One controlled drug's register. PRD §6.4.
 *
 * The sentence: **this is every movement of this drug, and what the balance
 * was after each one.**
 *
 * Column order is the argument: date, entry, change, **balance after**,
 * signatures. The balance is the rightmost figure because it is the running
 * total the register exists to carry, and a reader should be able to run down
 * that column without crossing another.
 *
 * **A drug with no entries renders no table.** An empty table with headers
 * would say the register exists and happens to have nothing in it, when the
 * truth is that it was never opened — so what renders instead is the hatch,
 * saying what is missing and what closes it.
 */
export function RegisterLedgerRoute() {
  const { activeSite } = useSession()
  const { medicationId } = useParams<{ medicationId: string }>()

  const load = useCallback(() => getRegister(activeSite.id), [activeSite.id])
  const resource = useResource<RegisterData>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <Link to=".." relative="path" className={styles.backLink}>
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
          All controlled drugs
        </Link>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading this register…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>This register could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial register is not shown,
              because a balance built from some of the entries is a wrong figure rather
              than an incomplete one.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Ledger data={resource.data} medicationId={medicationId ?? ''} />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Ledger({ data, medicationId }: { data: RegisterData; medicationId: string }) {
  const format = useSiteFormat()

  const medication = data.medications.find((med) => med.id === medicationId)
  const resident = data.residents.find((person) => person.id === medication?.residentId)

  if (!medication || !resident) {
    return (
      <Card padded>
        <p className={styles.errorTitle}>No such controlled drug at this site</p>
        <p className={styles.errorBody}>
          Nothing is missing from the register; this address does not name a drug
          prescribed here.
        </p>
      </Card>
    )
  }

  const counts = data.counts.filter((count) => count.medicationId === medication.id)
  const balance = registerBalance(counts)
  const state = registerState(counts)
  const entries = buildRegister(medication, counts, data.movements, data.records)

  return (
    <Card>
      <div className={styles.ledgerHead}>
        <div>
          <h2 className={styles.ledgerTitle}>{medication.name}</h2>
          {/* The subject, on a screen that is about one person's drug. §2.4. */}
          <p className={styles.ledgerSubtitle}>
            {medication.form} · {resident.fullLegalName}
            {resident.room.kind === 'recorded'
              ? ` · Room ${resident.room.value}`
              : ' · Room not recorded'}
          </p>
        </div>
        <div className={styles.ledgerBalance} data-balance={balance.kind}>
          {balance.kind === 'counted' ? (
            <>
              <span className={styles.ledgerFigure} data-numeric>
                {balance.value}
              </span>
              <span className={styles.ledgerUnit}>
                {unitFor(balance.value, medication.stockUnit)} remaining
              </span>
            </>
          ) : (
            <Unrecorded
              variant="chip"
              label="No balance recorded"
              detail="nothing has been counted"
            />
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        /* No table at all. Headers over an empty body would say the register
           exists and happens to be empty; it was never opened. */
        <div className={styles.openNote} data-empty-register>
          Nothing has ever been counted for this drug, so there is no register to show,
          not an empty one. It was prescribed for {resident.preferredName} and no
          opening balance has been taken, which means there is no running total and
          nothing a count could reconcile against. The next person to administer it
          counts the cabinet and records that count as the opening balance, with two
          signatures.
        </div>
      ) : (
        <>
          <div className={styles.ledgerScroll}>
            <table className={styles.ledgerTable}>
              <caption className={styles.ledgerCaption}>
                Every movement of {medication.name} for {resident.fullLegalName}, newest
                first, with the balance after each one in {medication.stockUnit}.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.ledgerHeadCell}>
                    Date and time
                  </th>
                  <th scope="col" className={styles.ledgerHeadCell}>
                    Entry
                  </th>
                  <th
                    scope="col"
                    className={`${styles.ledgerHeadCell} ${styles.ledgerNum}`}
                  >
                    Change
                  </th>
                  <th
                    scope="col"
                    className={`${styles.ledgerHeadCell} ${styles.ledgerNum}`}
                  >
                    Balance after
                  </th>
                  <th scope="col" className={styles.ledgerHeadCell}>
                    Signatures
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.at}`}
                    className={
                      entry.kind === 'routine_count' && !entry.reconciles
                        ? styles.ledgerFlagged
                        : undefined
                    }
                    data-entry={entry.kind}
                  >
                    <td className={styles.ledgerCell}>
                      <span data-numeric>{format.dateTime(entry.at)}</span>
                    </td>
                    <td className={styles.ledgerCell}>
                      <span className={styles.entryKind}>
                        {KIND_LABEL[entry.kind]}
                        <small>{detailOf(entry, medication.stockUnit)}</small>
                      </span>
                    </td>
                    <td className={`${styles.ledgerCell} ${styles.ledgerNum}`}>
                      <Change entry={entry} />
                    </td>
                    <td className={`${styles.ledgerCell} ${styles.ledgerNum}`}>
                      <span data-numeric>{entry.balanceAfter}</span>
                    </td>
                    <td className={styles.ledgerCell}>
                      <Signatures entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.kind === 'discrepancy' ? (
            /* Beneath the table, not inside it. The row is the record; this is
               what the record means, and it does not claim to explain it. */
            <p className={styles.discrepancyNote} data-discrepancy>
              The count on <span data-numeric>{format.dateTime(state.at)}</span> does
              not reconcile. The register expected{' '}
              <span data-numeric>
                {quantityWithUnit(state.expected, medication.stockUnit)}
              </span>
              ;{' '}
              <span data-numeric>
                {quantityWithUnit(state.counted, medication.stockUnit)}
              </span>{' '}
              was counted.{' '}
              <span data-numeric>
                {quantityWithUnit(
                  Math.abs(state.expected - state.counted),
                  medication.stockUnit,
                )}
              </span>{' '}
              is unaccounted for. The entries above are what the register holds: this is
              an open finding, and nothing here explains it.
            </p>
          ) : null}
        </>
      )}
    </Card>
  )
}

const KIND_LABEL: Record<RegisterEntry['kind'], string> = {
  opening_count: 'Opening count',
  routine_count: 'Routine count',
  administered: 'Administered',
  received: 'Received from pharmacy',
  disposed: 'Disposed',
}

function detailOf(entry: RegisterEntry, unit: string): string {
  switch (entry.kind) {
    case 'opening_count':
      return 'Cabinet counted, balance started'
    case 'routine_count':
      return `Expected ${entry.expected}, counted ${entry.counted}`
    case 'administered':
      return quantityWithUnit(entry.quantity, unit)
    case 'received':
      return `${entry.from} · ${quantityWithUnit(entry.quantity, unit)}`
    case 'disposed':
      return entry.reason
  }
}

/** A count does not change the stock; it says what the stock is. */
function Change({ entry }: { entry: RegisterEntry }) {
  if (entry.kind === 'opening_count' || entry.kind === 'routine_count') {
    return <span className={styles.changeNone}>No change</span>
  }
  const delta = entry.kind === 'received' ? entry.quantity : -entry.quantity
  return (
    <span className={delta < 0 ? styles.changeMinus : styles.changePlus} data-numeric>
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )
}

/**
 * Both signatures, always.
 *
 * A row with one signature is not a valid register entry, so where the second
 * was never captured this renders the gap rather than the column looking
 * ordinary. §3a — the dose was given *and* the witness is missing, two facts.
 */
function Signatures({ entry }: { entry: RegisterEntry }) {
  if (entry.kind === 'administered') {
    return (
      <span className={styles.signatures}>
        Given by <strong>{entry.by.displayName}</strong>
        <br />
        <Witness witness={entry.witness} />
      </span>
    )
  }

  const by: StaffRef = entry.by
  const witness: StaffRef = entry.witnessedBy
  return (
    <span className={styles.signatures}>
      {entry.kind === 'received' ? 'Received by' : 'Recorded by'}{' '}
      <strong>{by.displayName}</strong>
      <br />
      Witnessed by <strong>{witness.displayName}</strong>
    </span>
  )
}

function Witness({ witness }: { witness: MarWitness }) {
  switch (witness.kind) {
    case 'witnessed':
      return (
        <>
          Witnessed by <strong>{witness.by.displayName}</strong>
        </>
      )
    case 'not_required':
      return <>No second signature required</>
    case 'required_not_recorded':
      return (
        <Unrecorded
          variant="chip"
          label="Second signature not recorded"
          detail="a controlled drug given without a witness is half a record"
        />
      )
  }
}
