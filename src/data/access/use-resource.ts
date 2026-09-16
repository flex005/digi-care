import { now as appNow } from '@/data/fixtures/clock'
/**
 * Read a promise-shaped fixture function into an AsyncResource.
 *
 * Deliberately small. It exists so that Loading and Error are states a screen
 * must handle rather than states it can forget, and so that swapping the
 * fixture layer for a real API is a change in one place.
 */

import { useCallback, useEffect, useState } from 'react'
import type { AsyncResource } from './resource'
import { isNotYours } from './record-not-yours'
import type { IsoDateTime } from '../types'

function nowIso(): IsoDateTime {
  return appNow().toISOString() as IsoDateTime
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncResource<T> {
  const [resource, setResource] = useState<AsyncResource<T>>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setResource({ kind: 'loading' })
    setAttempt((previous) => previous + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setResource({ kind: 'ready', data, fetchedAt: nowIso() })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        /*
         * A refusal is not a failure, so it does not become one here. The
         * record loaded; this viewer is not appointed to the home it belongs
         * to, and the screen says that rather than offering a retry that would
         * fail again for the same reason.
         */
        if (isNotYours(error)) {
          setResource({
            kind: 'refused',
            what: error.what,
            home: error.home,
            yours: error.yours,
          })
          return
        }
        setResource({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load this data.',
          retry,
        })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, retry, ...deps])

  return resource
}
