/**
 * A quantity with the unit it is counted in.
 *
 * **One definition, because "1 tablets" turned up twice.** It was fixed in the
 * register's ledger and reappeared on the prescription card three days later,
 * written from scratch — which is the shape the audit calls one concept in two
 * treatments. A clinical quantity is a small enough thing to get wrong in
 * every place it is written by hand.
 *
 * Millilitres close up against the figure the way a volume is written; things
 * that are counted take a space and lose their plural at one.
 */
export function quantityWithUnit(quantity: number, unit: string): string {
  if (unit === 'ml') return `${quantity}ml`
  return `${quantity} ${unitFor(quantity, unit)}`
}

/**
 * The unit word alone, agreeing with the figure it sits under.
 *
 * For the register's stacked layout, where the reference puts the figure on one
 * line and `ml remaining` beneath it. The figure and the word are separate
 * elements there, so `quantityWithUnit` cannot be used — but the rule about
 * which word goes with which number is the same rule, and it stays in one
 * place. Written at the call site it produced "1 patches remaining".
 */
export function unitFor(quantity: number, unit: string): string {
  if (unit === 'ml') return 'ml'
  return quantity === 1 ? singular(unit) : unit
}

function singular(unit: string): string {
  if (unit.endsWith('es')) return unit.slice(0, -2)
  if (unit.endsWith('s')) return unit.slice(0, -1)
  return unit
}

/**
 * `08:00`, `08:00 and 20:00`, `08:00, 14:00 and 20:00`.
 *
 * Joined with a comma up to the last, which takes "and". "08:00 and 14:00 and
 * 20:00" is what a template produces and not what a person writes.
 */
export function joinTimes(times: string[]): string {
  if (times.length <= 1) return times[0] ?? ''
  return `${times.slice(0, -1).join(', ')} and ${times[times.length - 1]}`
}
