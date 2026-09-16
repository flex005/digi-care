import type { MarCellState, Medication, StockBalance } from '@/data/types'
import { Select } from '@/components/primitives'
import { MarCell, Unrecorded } from '@/components/status'
import { NOT_GIVEN_REASONS, expectedAfter, isAnswered, type Answer } from './round'
import { quantityWithUnit } from './units'
import styles from './medications.module.css'

/**
 * One scheduled dose, and the answer somebody has to give it.
 *
 * **No dose can be left blank.** An unanswered dose renders the hatch and says
 * so in words — "Nothing recorded for this dose yet" — because on a screen
 * where every other row has a green or amber answer, the one with nothing on
 * it is the one that has to be impossible to walk past. An empty space would
 * read as a row already dealt with.
 *
 * Given and Not given are two buttons, not a toggle and not a dropdown. A
 * toggle has a default, and a default here is a dose recorded by nobody
 * looking at it.
 *
 * The controlled-drug block appears only when the drug is controlled **and**
 * the answer is Given. A witness on a dose that was refused is a signature for
 * something that did not happen.
 *
 * **A dose already signed for shows the record, not the buttons.** It arrived
 * here rendering as unanswered, which put a second signature over somebody
 * else's on every dose the earlier half of the round had already recorded —
 * and made a complete record look like a gap, which is the invariant read
 * backwards. Recorded and unremarkable renders quietly: plain text, author and
 * time, no pill (§3b).
 */
export function DoseRow({
  medication,
  roundTime,
  recorded,
  answer,
  balance,
  witnesses,
  onChange,
}: {
  medication: Medication
  /** Names the cell this record belongs to, for its accessible name. */
  roundTime: string
  /** What is already on the record for this dose at this round. */
  recorded: MarCellState
  answer: Answer
  /**
   * What the register says this drug is standing at — or that nobody has
   * counted it, which is a state and not a number.
   */
  balance: StockBalance
  witnesses: { value: string; label: string }[]
  onChange: (next: Answer) => void
}) {
  const settled = isAnswered(recorded)
  const answered = answer.choice !== undefined
  const counted = answer.stockAfter.trim()
  // Nothing to reconcile against a balance nobody has taken. The count is
  // still required — it is the opening one — but it cannot be wrong.
  const expected = expectedAfter(balance, medication)
  const reconciles =
    balance.kind === 'no_balance_recorded' ||
    counted === '' ||
    Number(counted) === expected

  return (
    <li
      className={[styles.dose, answered ? styles.doseAnswered : '']
        .filter(Boolean)
        .join(' ')}
      data-dose={medication.id}
      data-answer={settled ? 'recorded' : (answer.choice ?? 'none')}
      data-settled={settled}
    >
      <div className={styles.doseAbout}>
        <p className={styles.doseDrug}>{medication.name}</p>
        <p className={styles.doseStrength}>
          {medication.dose} · {medication.route}
        </p>
        <p className={styles.doseTags}>
          {medication.isControlledDrug ? (
            <span className={`${styles.doseTag} ${styles.doseTagCd}`}>
              Controlled drug
            </span>
          ) : null}
        </p>

        {/* Beneath the answer controls, and only for a dose being given. */}
        {!settled && medication.isControlledDrug && answer.choice === 'given' ? (
          <div className={styles.cdBlock} data-controlled-drug>
            <p className={styles.cdLabel}>
              Controlled drug: second signature and stock count
            </p>
            <div className={styles.cdFields}>
              <Select
                label={
                  balance.kind === 'no_balance_recorded'
                    ? 'Witness: signs the dose and the opening balance'
                    : 'Witness: must be a different member of staff'
                }
                placeholder="Choose a witness"
                value={answer.witness === '' ? undefined : answer.witness}
                onValueChange={(value) => onChange({ ...answer, witness: value })}
                options={witnesses}
              />
              {/**
               * **The field never says what the answer should be.**
               *
               * It carried the expected balance as a placeholder, which
               * turned an independent count into a confirmation prompt: at
               * the end of a round somebody reads 27, types 27, and the
               * reconciliation guard can never fire, because it is checking
               * a number the screen supplied. The one case the count exists
               * to catch is the one where a prefilled answer makes the
               * discrepancy likeliest to be typed straight over.
               *
               * "was 28" stays. Counting a delta needs the starting point,
               * and the starting point is on the register anyway — what is
               * withheld is the arithmetic, which is the whole check.
               */}
              {balance.kind === 'counted' ? (
                <label className={styles.cdField}>
                  <span className={styles.cdFieldLabel}>
                    Stock after: was{' '}
                    <span data-numeric>
                      {quantityWithUnit(balance.value, medication.stockUnit)}
                    </span>
                  </span>
                  <input
                    className={styles.cdInput}
                    type="number"
                    inputMode="numeric"
                    value={answer.stockAfter}
                    onChange={(event) =>
                      onChange({ ...answer, stockAfter: event.target.value })
                    }
                  />
                </label>
              ) : (
                /* One count, not two. The cabinet is counted once, that count
                   becomes the opening balance, and the figure after the dose
                   is arithmetic — asking for both would be asking somebody to
                   count the same cabinet twice and then marking their
                   subtraction. */
                <label className={styles.cdField}>
                  <span className={styles.cdFieldLabel}>
                    Opening balance: count the cabinet
                  </span>
                  <input
                    className={styles.cdInput}
                    type="number"
                    inputMode="numeric"
                    value={answer.openingCount}
                    onChange={(event) =>
                      onChange({ ...answer, openingCount: event.target.value })
                    }
                  />
                </label>
              )}
            </div>

            {answer.witness === '' ? (
              <p className={styles.required}>
                A second signature is required before this can be recorded.
              </p>
            ) : null}

            {/* A mismatch blocks submission and says what follows. Never a
                silent success, and never a claim that the incident was
                raised — Phase 4 builds the incident record. */}
            {/* No balance on the register, so this count is the first one.
                Said plainly rather than left to look like an ordinary count:
                a running total has to show where it started. */}
            {balance.kind === 'no_balance_recorded' ? (
              <Unrecorded
                variant="chip"
                label="No balance recorded for this drug"
                detail="nobody has counted it: your count becomes the opening balance, signed by you and the witness above"
              />
            ) : null}

            {reconciles || balance.kind !== 'counted' ? null : (
              <p className={styles.mismatch} data-mismatch>
                Stock does not reconcile. Expected <span data-numeric>{expected}</span>{' '}
                {medication.stockUnit} after giving one dose;{' '}
                <span data-numeric>{counted}</span> was counted. This cannot be recorded
                until the count is resolved.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.doseAnswers}>
        {settled ? (
          /* The MAR chart's own treatment, not a second one written here: a
             given dose with its author and time, and — where a controlled
             drug's second signature was never captured — the settled record
             and the hatched gap as two separate facts (§3a). */
          <div className={styles.settledDose} data-settled-kind={recorded.kind}>
            <MarCell
              state={recorded}
              context={`${roundTime}, ${medication.name} ${medication.dose}`}
            />
          </div>
        ) : (
          <>
            <div
              className={styles.answerButtons}
              role="group"
              aria-label={medication.name}
            >
              <button
                type="button"
                className={[styles.answerButton, styles.answerGiven]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={answer.choice === 'given'}
                onClick={() => onChange({ ...answer, choice: 'given' })}
              >
                Given
              </button>
              <button
                type="button"
                className={[styles.answerButton, styles.answerNotGiven]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={answer.choice === 'not_given'}
                onClick={() => onChange({ ...answer, choice: 'not_given' })}
              >
                Not given
              </button>
            </div>

            {answer.choice === undefined ? (
              <Unrecorded
                variant="chip"
                label="Nothing recorded for this dose yet"
                detail="an unanswered dose is not a dose that was withheld"
              />
            ) : null}

            {answer.choice === 'not_given' ? (
              <div className={styles.reasonField}>
                <Select
                  label="Why was it not given?"
                  placeholder="Why was it not given?"
                  value={answer.reason === '' ? undefined : answer.reason}
                  onValueChange={(value) =>
                    onChange({ ...answer, reason: value as Answer['reason'] })
                  }
                  options={NOT_GIVEN_REASONS.map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                  }))}
                />
                {answer.reason === 'other' ? (
                  <label className={styles.cdField}>
                    <span className={styles.cdFieldLabel}>Say what happened</span>
                    <input
                      className={styles.cdInput}
                      type="text"
                      value={answer.note}
                      onChange={(event) =>
                        onChange({ ...answer, note: event.target.value })
                      }
                    />
                  </label>
                ) : null}
                {answer.reason === '' ? (
                  <p className={styles.required}>
                    A reason is required. Not given without one is not a record.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}
