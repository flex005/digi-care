import { now as appNow } from '@/data/fixtures/clock'
import { useEffect, useMemo, useState } from 'react'
import type { IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { loadCompliance, type ComplianceData } from './data'
import { runPanels, type Panel } from './key-questions'

/**
 * One read of the record, for every compliance screen.
 *
 * **One loader, one instant.** The overview and the drill-down both derive
 * from this, so the two cannot disagree: a panel rated amber on one screen and
 * red on the next would be two reads taken seconds apart, and nobody could
 * tell which was true.
 */
export function useComplianceData(): ComplianceData | 'loading' {
  const { activeSite } = useSession()
  const [data, setData] = useState<ComplianceData | 'loading'>('loading')

  useEffect(() => {
    let live = true
    const now = appNow().toISOString() as IsoDateTime
    void loadCompliance(activeSite, now).then((loaded) => {
      if (live) setData(loaded)
    })
    return () => {
      live = false
    }
  }, [activeSite])

  return data
}

export function usePanels(): Panel[] | 'loading' {
  const data = useComplianceData()
  return useMemo(() => (data === 'loading' ? 'loading' : runPanels(data)), [data])
}
