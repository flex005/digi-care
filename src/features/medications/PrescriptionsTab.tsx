import { useOutletContext } from 'react-router-dom'
import type { IsoDateTime, Medication, Recorded } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { medicationsFor } from '@/data/fixtures/medications'
import { Button, Card, Tooltip } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { formatCount, formatRelative, pluralise } from '@/lib/format'
import { hasUnenforceable, requirementsFor } from './requirements'
import { joinTimes, quantityWithUnit } from './units'
import styles from './medications.module.css'

/**
 * What was prescribed. PRD §5.3, §6.4.
 *
 * The sentence: **this is what each of this resident's drugs requires of
 * whoever gives it.**
 *
 * The chart's counterpart, and the reason the two are separate: the chart says
 * what was recorded, this says what was prescribed and what following it
 * costs. A second signature, a count in millilitres, a patch site rotated and
 * written down — none of it is visible on a grid of cells, and all of it is an
 * obligation on somebody standing at a trolley.
 *
 * **A requirement the system cannot enforce turns the block critical.** A PRN
 * with no 24-hour maximum recorded is the case: nothing can check a further
 * dose against a ceiling nobody wrote down, so the check does not run and a
 * person has to carry it. That is the Evidence Invariant applied to a rule
 * rather than to a record — the gap is not only missing data, it is a safety
 * check that cannot happen.
 */
export function PrescriptionsTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  const viewer = useViewer()

  const prescriptions = medicationsFor(resident.id)
  const controlled = prescriptions.filter((med) => med.isControlledDrug).length
  const asRequired = prescriptions.filter((med) => med.isPrn).length

  return (
    <div className={styles.prescriptions}>
      <div className={styles.prescriptionCount}>
        <p className={styles.countLine}>
          <strong className={styles.countFigure} data-numeric>
            {formatCount(prescriptions.length)}
          </strong>{' '}
          {prescriptions.length === 1 ? 'medication' : 'medications'} prescribed ·{' '}
          <span data-numeric>{formatCount(controlled)}</span> controlled{' '}
          {controlled === 1 ? 'drug' : 'drugs'} ·{' '}
          <span data-numeric>{formatCount(asRequired)}</span> as required
        </p>
        {/*
         * **Disabled, and no longer saying a phase will bring it.**
         * "Coming in a later phase" is a promise; this is not waiting on a
         * phase. Prescribing is a clinical act by a prescriber, and this build
         * has no prescriber, no directions model and no interaction checking —
         * making it writable would be the largest invented clinical capability
         * in the product.
         *
         * The same distinction as "not held here": a gap somebody can close,
         * against one nothing on any screen can.
         *
         * Not rendered at all for the auditor, the one role signing into this
         * platform with zero write, because a disabled button implies a
         * capability they will never have.
         *
         * **What would make this writable**: v4 of the source PRD adds a
         * Clinician role, and PRN authorisation is named as one of its acts.
         * That is what this is waiting on. The role model here is deliberately
         * this build's own, so the answer is recorded rather than acted on.
         */}
        {viewer.canRecordIn('/medications') ? (
          <Tooltip content="Prescribing is a prescriber's act. diGi-Care has no prescriber, no directions model and no interaction checking, so it records prescriptions rather than making them.">
            <span>
              <Button
                variant="primary"
                disabled
                aria-disabled="true"
                data-add-medication
              >
                <Icon name="add-remove-delete/add-01" size={16} />
                Add medication
              </Button>
            </span>
          </Tooltip>
        ) : null}
      </div>

      {prescriptions.length === 0 ? (
        <Card padded>
          <p className={styles.settledNote}>
            Nothing is prescribed for {resident.preferredName}. This is a complete
            answer, not an empty screen, no medication has been prescribed and none is
            missing.
          </p>
        </Card>
      ) : (
        prescriptions.map((medication) => (
          <PrescriptionCard key={medication.id} medication={medication} />
        ))
      )}
    </div>
  )
}

function PrescriptionCard({ medication }: { medication: Medication }) {
  const format = useSiteFormat()
  const measured = quantityWithUnit(medication.doseQuantity, medication.stockUnit)
  const requirements = requirementsFor(medication)
  const blocked = hasUnenforceable(requirements)

  return (
    <Card>
      <div className={styles.prescriptionHead}>
        <div className={styles.prescriptionAbout}>
          <h3 className={styles.prescriptionName}>{medication.name}</h3>
          <p className={styles.prescriptionForm}>
            {medication.form} · counted in {medication.stockUnit}
          </p>
          <p className={styles.prescriptionTags}>
            <span className={`${styles.doseTag} ${styles.doseTagRoute}`}>
              {medication.route}
            </span>
            {medication.isControlledDrug ? (
              <span className={`${styles.doseTag} ${styles.doseTagCd}`}>
                Controlled drug
              </span>
            ) : null}
            {medication.isPrn ? (
              <span className={`${styles.doseTag} ${styles.doseTagPrn}`}>
                As required
              </span>
            ) : null}
          </p>
        </div>

        {/* Never a blank. A drug with no schedule has an answer — it is
            available when needed — and that answer is not an empty column. */}
        <div className={styles.prescriptionSchedule}>
          <span className={styles.scheduleTimes} data-numeric={!medication.isPrn}>
            {medication.isPrn ? 'Not scheduled' : joinTimes(medication.roundTimes)}
          </span>
          <span className={styles.scheduleInterval}>
            {medication.isPrn
              ? 'available when needed'
              : medication.intervalDays === 1
                ? 'every day'
                : `every ${pluralise(medication.intervalDays, 'day')}`}
          </span>
        </div>
      </div>

      <div className={styles.prescriptionFields}>
        {/* The measured quantity only where it differs from how the dose
            reads. "2 puffs · 2 puffs measured" says one thing twice. */}
        <Field label="Dose">
          <Value
            main={medication.dose}
            note={
              measured === medication.dose.replace(/\s+/g, ' ')
                ? ''
                : `${measured} measured`
            }
          />
        </Field>

        {medication.isPrn ? (
          <Field label="Maximum in 24 hours">
            {medication.maximumIn24Hours.kind === 'recorded' ? (
              <Value
                main={quantityWithUnit(
                  medication.maximumIn24Hours.quantity,
                  medication.stockUnit,
                )}
                note="in any rolling 24 hours"
              />
            ) : (
              <Unrecorded
                variant="chip"
                label="Not recorded"
                detail="nobody has recorded a 24-hour maximum, so there is nothing to check a dose against"
              />
            )}
          </Field>
        ) : null}

        <Field label="Prescriber">
          <RecordedValue
            record={medication.prescriber}
            render={(value) => <Value main={value.name} note={value.organisation} />}
            missing="nobody has recorded who prescribed this"
          />
        </Field>

        {/* Relative time alongside the absolute date, never instead of it
            (§6). The date is the record; how long ago is about now. */}
        <Field label="Started">
          <Value
            main={format.date(medication.startedOn)}
            note={formatRelative(
              // instant-ok: elapsed time only — the date itself is rendered
              // above, and the hour never reaches the screen
              `${medication.startedOn}T09:00:00.000Z` as IsoDateTime,
            )}
          />
        </Field>

        <Field label="Storage" wide>
          <RecordedValue
            record={medication.storage}
            render={(value) => <Value main={value} note="" />}
            missing="nobody has recorded where this is kept"
          />
        </Field>

        <Field label="Prescription document">
          {medication.prescriptionDocument.kind === 'on_file' ? (
            <Value
              main={`Scanned ${format.date(medication.prescriptionDocument.scannedOn)}`}
              note={medication.prescriptionDocument.scannedBy.displayName}
            />
          ) : (
            <Unrecorded
              variant="chip"
              label="Not on file"
              detail="the prescription has not been scanned into the record"
            />
          )}
        </Field>
      </div>

      {requirements.length === 0 ? null : (
        <div
          className={[styles.requires, blocked ? styles.requiresBlocked : '']
            .filter(Boolean)
            .join(' ')}
          data-requires={blocked ? 'unenforceable' : 'met'}
        >
          <p className={styles.requiresLabel}>
            {blocked
              ? 'What this requires of you, and what is missing'
              : 'What this requires of you'}
          </p>
          <ul className={styles.requiresList}>
            {requirements.map((requirement) => (
              <li
                key={requirement.text}
                className={styles.requiresItem}
                data-unenforceable={requirement.unenforceable}
              >
                {requirement.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Field({
  label,
  wide,
  children,
}: {
  label: string
  /** Anything that would run long takes two columns rather than wrapping. */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={[styles.field, wide ? styles.fieldWide : ''].filter(Boolean).join(' ')}
    >
      <p className={styles.fieldLabel}>{label}</p>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  )
}

function Value({ main, note }: { main: string; note: string }) {
  return (
    <>
      <span className={styles.fieldMain}>{main}</span>
      {note === '' ? null : <span className={styles.fieldNote}>{note}</span>}
    </>
  )
}

/**
 * A field that may never have been filled in.
 *
 * The hatch and a line saying what its absence means — never blank and never a
 * dash, because both read as an answer.
 */
function RecordedValue<T>({
  record,
  render,
  missing,
}: {
  record: Recorded<T>
  render: (value: T) => React.ReactNode
  missing: string
}) {
  if (record.kind === 'recorded') return <>{render(record.value)}</>
  return <Unrecorded variant="chip" label="Not recorded" detail={missing} />
}
