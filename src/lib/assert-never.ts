/**
 * Exhaustiveness check for the closed unions in src/data/types/state.ts.
 *
 * Put it in the `default` branch of every switch over a status union. If a
 * member is ever added to a union, every switch that has not handled it stops
 * compiling — which is precisely Rule 1: "the compiler must refuse to build a
 * screen that forgot the unrecorded case". PRD §2.2.
 *
 * The throw is unreachable in typed code. It exists for the case where
 * untyped data reaches a component at runtime, and it says what arrived
 * rather than rendering something plausible.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`)
}
