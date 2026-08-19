import 'vitest'
import type { AxeMatchers } from 'vitest-axe/matchers'

/**
 * vitest-axe still declares its matchers on the old global `Vi` namespace,
 * which Vitest 4 no longer reads. The matchers are registered at runtime in
 * src/test/setup.ts; this re-declares them for the compiler so
 * `expect(results).toHaveNoViolations()` typechecks.
 *
 * Remove when vitest-axe ships a `declare module 'vitest'` augmentation.
 */
declare module 'vitest' {
  // The type parameter is unused here but must match Vitest's own
  // declaration, or the interfaces will not merge.
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  interface Assertion<T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}
