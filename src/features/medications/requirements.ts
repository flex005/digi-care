import type { Medication } from '@/data/types'
import { pluralise } from '@/lib/format'
import { quantityWithUnit } from './units'

/**
 * What a prescription requires of whoever administers it.
 *
 * **A prescription is not data, it is an obligation.** Two signatures, a count
 * in millilitres, a patch site rotated and recorded — none of that is on the
 * chart and none of it is on the drug's name. Saying it on the screen where
 * somebody sets the drug up is the point of the screen.
 *
 * Derived from the prescription rather than typed alongside it, so a
 * requirement cannot drift from the drug it belongs to: change a drug to a
 * controlled one and the second signature appears, because it was never a
 * sentence somebody remembered to write.
 */
export interface Requirement {
  text: string
  /**
   * True where the requirement **cannot be met** because something is
   * unrecorded.
   *
   * Not "this is important" — a gap in the rule itself. A PRN with no 24-hour
   * maximum is the case: the system cannot tell anybody when a further dose
   * would exceed it, so the check does not run and somebody has to carry it
   * from the prescription. The Evidence Invariant applied to a rule rather
   * than to a record.
   */
  unenforceable: boolean
}

export function requirementsFor(medication: Medication): Requirement[] {
  const out: Requirement[] = []

  if (medication.isControlledDrug) {
    out.push({
      text:
        medication.stockUnit === 'patches'
          ? 'Two signatures at every change: the person applying it and a witness who saw it applied.'
          : 'Two signatures at every administration: the person giving it and a witness who saw it given.',
      unenforceable: false,
    })
    out.push({
      text: `The cabinet counted after the dose, in ${medication.stockUnit}, and the count recorded in the register.`,
      unenforceable: false,
    })
    out.push({
      text: 'A count that does not reconcile blocks the record and raises a discrepancy.',
      unenforceable: false,
    })
  }

  if (medication.stockUnit === 'patches') {
    out.push({
      text: 'Rotate the site and record where the patch was applied.',
      unenforceable: false,
    })
    out.push({
      text: 'The used patch accounted for on disposal, with both signatures.',
      unenforceable: false,
    })
  }

  if (medication.intervalDays > 1) {
    out.push({
      text: `Changed every ${pluralise(medication.intervalDays, 'day')}. On the days between, the chart shows not due: that is the schedule, not a missed dose.`,
      unenforceable: false,
    })
  }

  if (medication.isPrn) {
    out.push({
      text: 'A reason and a symptom before it is given, and an outcome recorded afterwards.',
      unenforceable: false,
    })

    switch (medication.maximumIn24Hours.kind) {
      case 'recorded':
        out.push({
          text: `No more than ${quantityWithUnit(medication.maximumIn24Hours.quantity, medication.stockUnit)} in 24 hours.`,
          unenforceable: false,
        })
        break
      case 'not_recorded':
        // The one that turns the whole block critical.
        out.push({
          text: 'No 24-hour maximum is recorded, so check the prescription before a further dose.',
          unenforceable: true,
        })
        break
      case 'not_applicable':
        break
    }
  }

  if (medication.instructions.kind === 'recorded') {
    out.push({ text: medication.instructions.value, unenforceable: false })
  }

  return out
}

/** Whether any requirement here is one the system cannot enforce. */
export function hasUnenforceable(requirements: Requirement[]): boolean {
  return requirements.some((requirement) => requirement.unenforceable)
}
