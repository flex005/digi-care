import { now as appNow } from '@/data/fixtures/clock'
import { SigningIdentity, canSign } from '@/components/signing/SigningIdentity'
import { useCallback, useState } from 'react'
import type {
  IsoDate,
  IsoDateTime,
  Medication,
  MedicationId,
  Resident,
  StaffRef,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import {
  getRound,
  prnGivenThisSession,
  recordRound,
  stockBalanceFor,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { AlertDialog, Avatar, Button, Card, Toast } from '@/components/primitives'
import { AllergyBadge, NotYourHome } from '@/components/status'
import { useSession } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatDate, zonedDate } from '@/lib/format'
import { carersAndSeniors } from '@/data/fixtures/organisation'
import { DoseRow } from './DoseRow'
import { PrnSection } from './PrnSection'
import {
  EMPTY_ANSWER,
  buildRound,
  currentRound,
  isAnswered,
  openingCountFor,
  outstanding,
  progressOf,
  stateFor,
  type Answer,
  type RoundResident,
} from './round'
import styles from './medications.module.css'

/**
 * The medication round. PRD §6.4.
 *
 * The sentence: **these doses are due now, for this person, and you are about
 * to sign for them.**
 *
 * Resident by resident, in room order — the physical order of the trolley.
 * Not drug by drug, and not alphabetical: a list in any other order makes
 * somebody walk the corridor twice or skip a door. Residents already done stay
 * in the list, marked, because a round you cannot see the shape of is one you
 * lose your place in.
 *
 * **The subject strip is the wrong-subject control**, on the screen where
 * getting it wrong is fatal (§2.4). Large, permanent, and carrying allergies
 * in all three of their states — a dose given to somebody whose allergies you
 * could not see while giving it is the failure next door.
 */

export function RoundRoute() {
  const { activeSite, currentUser } = useSession()

  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const [written, setWritten] = useState(0)
  const [chosenRound, setChosenRound] = useState<string | 'auto'>('auto')
  const [selected, setSelected] = useState<string | 'auto'>('auto')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [confirming, setConfirming] = useState(false)
  const [recorded, setRecorded] = useState<string | 'none'>('none')
  const [error, setError] = useState('')
  /**
   * The PIN. Four digits, and it signs the record.
   *
   * Cleared whenever the dialog closes: a PIN left in a field on a trolley
   * somebody else picks up is the same failure as a shared login, which is
   * the thing this control exists to prevent.
   */
  const [pin, setPin] = useState('')

  const load = useCallback(() => getRound(activeSite.id), [activeSite.id])
  const resource = useResource<{
    residents: Resident[]
    medications: Medication[]
    records: MarRecord[]
  }>(load, [activeSite.id, written])

  if (resource.kind === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading} role="status">
          Loading this round…
        </p>
      </div>
    )
  }

  /* The record exists, in a home this viewer is not appointed to. */

  if (resource.kind === 'refused') {
    return <NotYourHome refusal={resource} />
  }

  if (resource.kind === 'error') {
    return (
      <div className={styles.page}>
        <Card padded>
          <p className={styles.errorTitle}>This round could not be loaded</p>
          <p className={styles.errorBody}>
            Nothing has been lost; this is a read. No round is shown rather than a
            partial one, because a round missing an unknown number of residents is one
            somebody would work through and believe finished.
          </p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  const timeZone = activeSite.timeZone
  const date = zonedDate(now, timeZone)
  const hhmm = new Date(now).toTimeString().slice(0, 5)

  const allRounds = [
    ...new Set(resource.data.medications.flatMap((m) => m.roundTimes)),
  ].sort()
  const roundTime = chosenRound === 'auto' ? currentRound(allRounds, hhmm) : chosenRound

  const round = buildRound(
    resource.data.residents,
    resource.data.medications,
    resource.data.records,
    roundTime,
    date,
  )

  const firstUndone = round.residents.find((entry) => !entry.done) ?? round.residents[0]
  const current =
    selected === 'auto'
      ? firstUndone
      : (round.residents.find((entry) => entry.resident.id === selected) ?? firstUndone)

  const done = round.residents.filter((entry) => entry.done).length

  return (
    <SiteTimeZone timeZone={timeZone}>
      <div className={styles.page}>
        <RoundBar
          roundTime={roundTime}
          siteName={activeSite.name}
          date={date}
          done={done}
          total={round.residents.length}
          slots={round.slots}
          onRound={(next) => {
            setChosenRound(next)
            setSelected('auto')
            setAnswers({})
          }}
        />

        <div className={styles.roundColumns}>
          <Card>
            <div className={styles.queueHeadRound}>
              <h2 className={styles.queueTitle}>This round, in room order</h2>
              <p className={styles.queueSubtitle}>The order the trolley goes in</p>
            </div>
            <ul className={styles.roundQueue}>
              {round.residents.map((entry) => (
                <li key={entry.resident.id}>
                  <button
                    type="button"
                    className={[
                      styles.queueItem,
                      current?.resident.id === entry.resident.id
                        ? styles.queueItemCurrent
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={
                      current?.resident.id === entry.resident.id ? 'true' : undefined
                    }
                    data-queue={entry.resident.id}
                    data-done={entry.done}
                    onClick={() => {
                      setSelected(entry.resident.id)
                      setAnswers({})
                    }}
                  >
                    {/*
                     * A dash here is the blank this product exists to refuse:
                     * it cannot be told apart from a room nobody typed.
                     */}
                    {entry.resident.room.kind === 'recorded' ? (
                      <span
                        className={styles.queueRoom}
                        data-queue-room="recorded"
                        data-numeric
                      >
                        {entry.resident.room.value}
                      </span>
                    ) : (
                      <span className={styles.queueRoom} data-queue-room="unrecorded">
                        No room recorded
                      </span>
                    )}
                    <span className={styles.queueWho}>
                      <span className={styles.queueName}>
                        {entry.resident.preferredName}
                      </span>
                      <span className={styles.queueStatus}>{queueStatus(entry)}</span>
                    </span>
                    <span
                      className={entry.done ? styles.markDone : styles.markPending}
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {current === undefined ? (
            <Card padded>
              <p className={styles.settledNote}>
                Nothing is due at {roundTime} at {activeSite.name}.
              </p>
            </Card>
          ) : (
            <Card>
              <ResidentPanel
                entry={current}
                roundTime={roundTime}
                answers={answers}
                onAnswers={setAnswers}
                error={error}
                onSubmit={() => {
                  setError('')
                  setConfirming(true)
                }}
                onPrnChanged={() => setWritten((count) => count + 1)}
              />
            </Card>
          )}
        </div>

        {current === undefined ? null : (
          <AlertDialog
            open={confirming}
            onOpenChange={(next) => {
              setConfirming(next)
              if (!next) setPin('')
            }}
            subject={{
              kind: 'resident',
              name: current.resident.fullLegalName,
              ...(current.resident.room.kind === 'recorded'
                ? { room: current.resident.room.value }
                : {}),
            }}
            action={`Record ${roundTime} medications`}
            description={
              <ConfirmBody
                entry={current}
                answers={answers}
                roundTime={roundTime}
                signer={currentUser}
                pin={pin}
                onPin={setPin}
              />
            }
            confirmLabel="Confirm and sign"
            confirmDisabled={!canSign(currentUser, pin)}
            onConfirm={() => {
              void submit()
            }}
          />
        )}

        <Toast
          open={recorded !== 'none'}
          onOpenChange={(open) => {
            if (!open) setRecorded('none')
          }}
          tone="positive"
          title={recorded === 'none' ? '' : `${recorded}'s medications recorded`}
          description="In this build it is held in memory and will be gone on reload."
        />
      </div>
    </SiteTimeZone>
  )

  async function submit() {
    if (current === undefined) return
    const at = appNow().toISOString() as IsoDateTime

    // An opening balance per controlled drug the register has never held one
    // for. Written in the same act as the doses, because the count and the
    // signature are the same two people in the same moment.
    const openingCounts = current.due.flatMap((dose) => {
      if (isAnswered(dose.state)) return []
      const answer = answers[dose.medication.id] ?? EMPTY_ANSWER
      const counted = openingCountFor(answer, stockBalanceFor(dose.medication.id))
      const witness = carersAndSeniors.find((staff) => staff.id === answer.witness)
      if (counted === 'none' || !witness) return []
      return [{ medicationId: dose.medication.id, counted, witnessedBy: witness }]
    })

    const doses = current.due.flatMap((dose) => {
      // A dose already on the record is not signed again. Overwriting it would
      // put this session's name over whoever actually gave it.
      if (isAnswered(dose.state)) return []
      const answer = answers[dose.medication.id] ?? EMPTY_ANSWER
      const witness = carersAndSeniors.find((staff) => staff.id === answer.witness)
      const state = stateFor(answer, dose.medication, currentUser, at, witness)
      return state ? [{ medicationId: dose.medication.id, state }] : []
    })

    try {
      await recordRound({
        residentId: current.resident.id,
        date,
        roundTime,
        doses,
        openingCounts,
        by: currentUser,
        at,
      })
      setConfirming(false)
      setPin('')
      setRecorded(current.resident.preferredName)
      setAnswers({})
      setSelected('auto')
      setWritten((count) => count + 1)
    } catch (cause) {
      setConfirming(false)
      setPin('')
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }
}

/**
 * How far through this resident's doses the round has got.
 *
 * Derived from the records, never asserted. This line read "nothing recorded
 * yet" from a hardcoded string, which was false for anybody with two doses
 * signed and one omitted — the shape the screen exists to surface.
 */
function queueStatus(entry: RoundResident): string {
  const { answered, total } = progressOf(entry)
  if (answered === total) return 'Recorded'
  if (answered === 0) return `${total} due · nothing recorded yet`
  return `${answered} of ${total} recorded`
}

function RoundBar({
  roundTime,
  siteName,
  date,
  done,
  total,
  slots,
  onRound,
}: {
  roundTime: string
  siteName: string
  date: IsoDate
  done: number
  total: number
  slots: { roundTime: string; done: number; total: number }[]
  onRound: (round: string) => void
}) {
  return (
    <div className={styles.roundBar} data-round-bar>
      <div className={styles.roundBlock}>
        <span className={styles.roundLabel}>Round</span>
        <span className={styles.roundTime} data-numeric>
          {roundTime}
        </span>
      </div>
      <div className={styles.roundBlock}>
        <span className={styles.roundLabel}>Site and date</span>
        <span className={styles.roundValue}>
          {siteName} · <span data-numeric>{formatDate(date)}</span>
        </span>
      </div>
      <div className={styles.roundBlock}>
        <span className={styles.roundLabel}>Other rounds today</span>
        {/* Which rounds are already complete is the thing you need to know
            before starting one — a round selector that hides it makes somebody
            walk a corridor to find out. */}
        <span className={styles.roundSlots}>
          {slots.map((slot) => (
            <button
              key={slot.roundTime}
              type="button"
              className={[
                styles.slot,
                slot.roundTime === roundTime ? styles.slotCurrent : '',
                slot.total > 0 && slot.done === slot.total ? styles.slotComplete : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={slot.roundTime === roundTime}
              data-slot={slot.roundTime}
              data-complete={slot.total > 0 && slot.done === slot.total}
              onClick={() => onRound(slot.roundTime)}
            >
              <span data-numeric>{slot.roundTime}</span>
              <span className={styles.slotCount} data-numeric>
                {slot.done} of {slot.total}
              </span>
            </button>
          ))}
        </span>
      </div>
      <div className={`${styles.roundBlock} ${styles.roundProgressBlock}`}>
        <span className={styles.roundLabel}>Progress</span>
        <span className={styles.roundValue} data-numeric>
          {done} of {total} residents done
        </span>
        <span className={styles.progressTrack}>
          <span
            className={styles.progressFill}
            style={{ width: total === 0 ? '0%' : `${(done / total) * 100}%` }}
          />
        </span>
      </div>
    </div>
  )
}

function ResidentPanel({
  entry,
  roundTime,
  answers,
  onAnswers,
  error,
  onSubmit,
  onPrnChanged,
}: {
  entry: RoundResident
  roundTime: string
  answers: Record<string, Answer>
  onAnswers: (next: Record<string, Answer>) => void
  error: string
  onSubmit: () => void
  onPrnChanged: () => void
}) {
  const { resident } = entry

  // Was `counts[counts.length - 1]?.counted ?? 0`, which reported a balance of
  // zero for every controlled drug nobody had counted — a clinical figure
  // invented by a fallback (§1), and one that made the reconciliation guard
  // demand −1 and so refuse the dose outright.
  const balance = (medicationId: string) =>
    stockBalanceFor(medicationId as MedicationId)

  const open = entry.due.filter((dose) => !isAnswered(dose.state))
  const waiting = outstanding(entry.due, answers, balance)
  const ready = waiting.length === 0

  return (
    <>
      {/* The wrong-subject control. Large and permanent, allergies beside it. */}
      <div className={styles.subjectStrip} data-subject={resident.id}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="large" />
        <div className={styles.subjectWho}>
          <p className={styles.subjectName}>{resident.preferredName}</p>
          <p className={styles.subjectMeta}>
            {resident.fullLegalName}
            {resident.room.kind === 'recorded'
              ? ` · Room ${resident.room.value}`
              : ' · Room not recorded'}{' '}
            · Born <span data-numeric>{formatDate(resident.dateOfBirth)}</span>
          </p>
        </div>
        <div className={styles.subjectAllergy}>
          <AllergyBadge status={resident.allergies} />
        </div>
      </div>

      <div className={styles.doseHead}>
        <h2 className={styles.doseHeadTitle}>Due at {roundTime}</h2>
        <p className={styles.doseHeadCount}>
          {entry.due.length} {entry.due.length === 1 ? 'medication' : 'medications'} ·{' '}
          {queueStatus(entry) === 'Recorded'
            ? 'all recorded'
            : `${progressOf(entry).answered} of ${entry.due.length} on the record`}
        </p>
      </div>

      <ul className={styles.doseList}>
        {entry.due.map((dose) => (
          <DoseRow
            key={dose.medication.id}
            medication={dose.medication}
            roundTime={roundTime}
            recorded={dose.state}
            answer={answers[dose.medication.id] ?? EMPTY_ANSWER}
            balance={balance(dose.medication.id)}
            witnesses={carersAndSeniors.map((staff) => ({
              value: staff.id,
              label: staff.displayName,
            }))}
            onChange={(next) => onAnswers({ ...answers, [dose.medication.id]: next })}
          />
        ))}
      </ul>

      <PrnSection
        resident={resident}
        available={entry.available}
        given={prnGivenThisSession(resident.id)}
        onChanged={onPrnChanged}
      />

      <div className={styles.roundFoot}>
        {/* Names exactly what it is waiting on. A count would make somebody
            hunt, and this is a screen used standing up with a trolley. */}
        <p className={styles.footState}>
          {ready ? (
            <>
              <strong>
                {open.length === entry.due.length
                  ? `All ${entry.due.length} ${entry.due.length === 1 ? 'dose has' : 'doses have'} an answer.`
                  : `The ${open.length} ${open.length === 1 ? 'dose' : 'doses'} still open ${open.length === 1 ? 'has' : 'have'} an answer.`}
              </strong>{' '}
              {/* Counts what this signature covers, not what the round
                  contains. Saying "all 3" over a signature that records one
                  claims two doses this person did not give. */}
              Confirming records {open.length === 1 ? 'it' : 'them'} against{' '}
              {resident.fullLegalName}, signed by you at the moment you confirm.
            </>
          ) : (
            <>
              <strong>Waiting on:</strong> {waiting.join(' · ')}
            </>
          )}
        </p>
        {error === '' ? null : <p className={styles.required}>{error}</p>}
        <Button size="large" disabled={!ready} onClick={onSubmit}>
          Record {roundTime} medications
        </Button>
      </div>
    </>
  )
}

/** Every dose and its answer, listed, so the PIN signs something specific. */
function ConfirmBody({
  entry,
  answers,
  roundTime,
  signer,
  pin,
  onPin,
}: {
  entry: RoundResident
  roundTime: string
  answers: Record<string, Answer>
  signer: StaffRef
  pin: string
  onPin: (pin: string) => void
}) {
  // Only what this signature covers. A dose somebody else already signed for
  // is not in this list, and the count below says so rather than leaving the
  // reader to wonder why the dialog is shorter than the screen.
  const signing = entry.due.filter((dose) => !isAnswered(dose.state))
  const already = entry.due.length - signing.length

  return (
    <span className={styles.confirmBody}>
      <span className={styles.confirmIntro}>
        {signing.length === 1
          ? 'This dose will be recorded against '
          : `These ${signing.length} doses will be recorded against `}
        {entry.resident.fullLegalName} for the {roundTime} round.
        {already === 0
          ? ''
          : ` ${already === 1 ? 'One further dose at this round is' : `${already} further doses at this round are`} already on the record and not signed again here.`}
      </span>
      <span className={styles.confirmList}>
        {signing.map((dose) => {
          const answer = answers[dose.medication.id] ?? EMPTY_ANSWER
          return (
            <span key={dose.medication.id} className={styles.confirmRow}>
              <span className={styles.confirmDrug}>
                {dose.medication.name} {dose.medication.dose}
              </span>
              <span
                className={
                  answer.choice === 'given'
                    ? styles.confirmGiven
                    : styles.confirmNotGiven
                }
              >
                {answer.choice === 'given' ? 'Given' : 'Not given'}
              </span>
            </span>
          )
        })}
      </span>
      <span className={styles.confirmPin}>
        {/*
         * The same identity check every signing surface uses. It asked for
         * four digits and checked only that four had been typed, which says
         * somebody was at the trolley and nothing about who; on a shared
         * trolley that is the shared-login failure with a keypad in front of
         * it.
         */}
        <SigningIdentity
          who={signer}
          code={pin}
          onCode={onPin}
          what={`Recording the ${roundTime} round for ${entry.resident.fullLegalName}. The record is signed by whoever enters this code, not by whoever unlocked the device.`}
        />
      </span>
    </span>
  )
}
