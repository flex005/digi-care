import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Medication, RegisterMovement, Resident, StockCount } from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { getRegister } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount } from '@/lib/format'
import {
  registerBalance,
  registerOrder,
  registerState,
  type RegisterState,
} from './register'
import { quantityWithUnit, unitFor } from './units'
import styles from './medications.module.css'

/**
 * The controlled drug register. PRD §6.4.
 *
 * The sentence: **this is what the register says every controlled drug in the
 * home is standing at, and these are the ones it cannot account for.**
 *
 * **Two findings, side by side, never one card and never a sum.** A drug
 * nobody has counted is an *absence* and takes the hatch; a count that does
 * not come out is a *finding* and takes critical. Adding them together would
 * produce a number that means nothing — you cannot act on "2 problems" when
 * one needs a first count and the other needs an investigation — and that
 * confusion is precisely what a register exists to prevent.
 */

export interface RegisterData {
  medications: Medication[]
  residents: Resident[]
  counts: StockCount[]
  movements: RegisterMovement[]
  records: MarRecord[]
}

export function RegisterRoute() {
  const { activeSite } = useSession()

  const load = useCallback(() => getRegister(activeSite.id), [activeSite.id])
  const resource = useResource<RegisterData>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading the controlled drug register…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>The register could not be loaded</p>
            <p className={styles.errorBody}>Nothing has been lost; this is a read.</p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found data={resource.data} siteName={activeSite.name} />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Found({ data, siteName }: { data: RegisterData; siteName: string }) {
  const rows = data.medications
    .map((medication) => {
      const counts = data.counts.filter((count) => count.medicationId === medication.id)
      return {
        medication,
        resident: data.residents.find(
          (resident) => resident.id === medication.residentId,
        ),
        state: registerState(counts),
        balance: registerBalance(counts),
      }
    })
    // A drug whose resident cannot be resolved is dropped rather than rendered:
    // a controlled drug balance with nobody attached to it is the
    // wrong-subject failure with a schedule-two drug on it (§2.4).
    .filter((row) => row.resident !== undefined)
    .sort(
      (a, b) =>
        registerOrder(a.state) - registerOrder(b.state) ||
        a.medication.name.localeCompare(b.medication.name),
    )

  const total = rows.length
  const discrepancies = rows.filter((row) => row.state.kind === 'discrepancy').length
  const neverCounted = rows.filter((row) => row.state.kind === 'never_counted').length

  return (
    <>
      <div className={styles.findings}>
        <div className={`${styles.finding} ${styles.findingDiscrepancy}`}>
          <span className={styles.findingFigure} data-numeric>
            {discrepancies}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              {discrepancies === 1
                ? 'count does not reconcile'
                : 'counts do not reconcile'}
            </span>
            <span className={styles.findingDetail}>
              A balance that does not match what was counted. Of{' '}
              <span data-numeric>{formatCount(total)}</span> controlled{' '}
              {total === 1 ? 'drug' : 'drugs'} at {siteName}.
            </span>
          </span>
        </div>

        {/* The hatch, not a second critical card. Nobody has counted these, and
            an absence is not a milder version of a finding. */}
        <div className={`${styles.finding} ${styles.findingNever}`}>
          <span className={styles.findingFigure} data-numeric>
            {neverCounted}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>never counted</span>
            <span className={styles.findingDetail}>
              Prescribed, but no opening balance has been taken, so there is nothing for
              a count to reconcile against. Of{' '}
              <span data-numeric>{formatCount(total)}</span> controlled{' '}
              {total === 1 ? 'drug' : 'drugs'} at {siteName}.
            </span>
          </span>
        </div>
      </div>

      <Card>
        <div className={styles.ledgerHead}>
          <div>
            <h2 className={styles.ledgerTitle}>Controlled drug register</h2>
            <p className={styles.ledgerSubtitle}>
              <span data-numeric>{formatCount(total)}</span> controlled{' '}
              {total === 1 ? 'drug' : 'drugs'} at {siteName} · findings first, then by
              drug
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className={styles.settledNote}>
            No controlled drugs are prescribed at {siteName}.
          </p>
        ) : (
          <ul className={styles.registerList}>
            {rows.map((row) => (
              <li key={row.medication.id}>
                <Link
                  to={row.medication.id}
                  className={styles.registerRow}
                  data-register-row={row.medication.id}
                  data-state={row.state.kind}
                >
                  <span className={styles.registerWho}>
                    <span className={styles.registerName}>
                      {row.resident!.preferredName}
                    </span>
                    <span className={styles.registerMeta}>
                      {row.resident!.fullLegalName}
                      {row.resident!.room.kind === 'recorded'
                        ? ` · Room ${row.resident!.room.value}`
                        : ' · Room not recorded'}
                    </span>
                  </span>

                  <span className={styles.registerDrug}>
                    <span className={styles.registerName}>{row.medication.name}</span>
                    <span className={styles.registerMeta}>{row.medication.form}</span>
                  </span>

                  {/* Rightmost figure, after everything else, because it is the
                      running total the register carries and the eye should be
                      able to go down it without crossing another column. */}
                  <span
                    className={
                      row.balance.kind === 'counted'
                        ? styles.registerBalance
                        : styles.registerBalanceNone
                    }
                    data-balance={row.balance.kind}
                  >
                    {row.balance.kind === 'counted' ? (
                      <>
                        <span className={styles.balanceFigure} data-numeric>
                          {row.balance.value}
                        </span>
                        <span className={styles.balanceUnit}>
                          {unitFor(row.balance.value, row.medication.stockUnit)}{' '}
                          remaining
                        </span>
                      </>
                    ) : (
                      // Never a zero and never a dash. Both would read as a
                      // balance somebody had established.
                      <Unrecorded
                        variant="chip"
                        label="No balance"
                        detail="nobody has counted this drug"
                      />
                    )}
                  </span>

                  <StateChip state={row.state} unit={row.medication.stockUnit} />

                  <span className={styles.registerOpen}>
                    Open register
                    <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function StateChip({ state, unit }: { state: RegisterState; unit: string }) {
  const format = useSiteFormat()

  switch (state.kind) {
    case 'never_counted':
      return (
        <span className={styles.registerState}>
          <Unrecorded
            variant="chip"
            label="Never counted"
            detail="no opening balance has been taken"
          />
        </span>
      )
    case 'discrepancy':
      return (
        <span
          className={`${styles.registerState} ${styles.stateDiscrepancy}`}
          data-state-chip="discrepancy"
        >
          Count does not reconcile
          <small>
            <span data-numeric>
              {quantityWithUnit(Math.abs(state.expected - state.counted), unit)}
            </span>{' '}
            unaccounted for, <span data-numeric>{format.dateTime(state.at)}</span>
          </small>
        </span>
      )
    case 'reconciled':
      // Recorded and unremarkable. Plain text with its timestamp, never a
      // filled green pill (§3b) — a register full of green would drown the two
      // rows that are not.
      return (
        <span className={styles.registerState} data-state-chip="reconciled">
          Reconciled
          <small>
            counted <span data-numeric>{format.dateTime(state.at)}</span>
          </small>
        </span>
      )
  }
}
