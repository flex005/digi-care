import { useMemo, useState } from 'react'
import type { ResidentSummary } from '@/data/access/client'
import type { RiskLevel, SiteId } from '@/data/types'
import { recordCompleteness } from '@/data/completeness'

/**
 * Filtering and sorting for the residents list. PRD §6.2.
 *
 * The list is not a directory. It is the instrument a manager uses to find the
 * residents nobody has looked at, and two decisions here carry that:
 *
 *  - **"Oldest care note" sorts never-noted residents FIRST.** Treating a
 *    missing note as a missing date pushes them to the bottom, which hides
 *    exactly the people the sort was built to surface. Never written up is
 *    more neglected than written up a long time ago.
 *  - **The records filter has two levels.** "Critical gaps only" is the
 *    default because a chip that fires on every resident discriminates
 *    nothing; "Any incomplete record" is one click away, so nothing is hidden.
 */

export type SortKey = 'name' | 'room' | 'newestNote' | 'oldestNote'
export type SiteFilter = SiteId | 'all'
export type RiskFilter = RiskLevel | 'all' | 'not_assessed'
/**
 * `not_up_to_date` covers overdue AND never scheduled together.
 *
 * It exists because counting only `overdue` would have let a whole category
 * vanish from the analytics tiles. At Ashgrove Lodge nothing is overdue and
 * three of four residents have never had a review scheduled at all — an
 * "overdue" tile there reads 0 and looks settled, which is exactly PRD §2.1's
 * named failure: "'Never scheduled' and 'scheduled and completed on time'
 * must not both render as untroubled."
 */
export type ReviewFilter =
  'all' | 'overdue' | 'due' | 'never_scheduled' | 'not_up_to_date'

/** Frank's number, not an invented threshold. */
export const STALE_NOTE_HOURS = 48
export type RecordsFilter = 'critical' | 'any_incomplete' | 'all'

export interface ResidentFilters {
  site: SiteFilter
  risk: RiskFilter
  review: ReviewFilter
  records: RecordsFilter
}

export const DEFAULT_FILTERS: Omit<ResidentFilters, 'site'> = {
  risk: 'all',
  review: 'all',
  // Critical only. The chip and this default agree deliberately: what the
  // column shouts about is what the filter narrows to.
  records: 'critical',
}

/** Milliseconds, or -Infinity for a resident who has never been written up. */
function noteTime(summary: ResidentSummary): number {
  if (summary.latestNote === 'none') return Number.NEGATIVE_INFINITY
  return new Date(summary.latestNote.recordedAt).getTime()
}

function matchesRisk(summary: ResidentSummary, filter: RiskFilter): boolean {
  const falls = summary.resident.risks.falls
  if (filter === 'all') return true
  if (filter === 'not_assessed') return falls.kind === 'not_assessed'
  return falls.kind === 'assessed' && falls.level === filter
}

function matchesReview(summary: ResidentSummary, filter: ReviewFilter): boolean {
  const review = summary.resident.carePlanReview
  if (filter === 'all') return true
  if (filter === 'overdue') return review.kind === 'overdue'
  if (filter === 'due') return review.kind === 'due'
  if (filter === 'never_scheduled') return review.kind === 'never_scheduled'
  return review.kind === 'overdue' || review.kind === 'never_scheduled'
}

/**
 * True when nobody has written this resident up inside the window — including
 * when nobody ever has. Exported so the analytics tile and the filter cannot
 * drift into counting different people.
 */
export function hasNoNoteWithinWindow(summary: ResidentSummary, now: number): boolean {
  if (summary.latestNote === 'none') return true
  const age = now - new Date(summary.latestNote.recordedAt).getTime()
  return age > STALE_NOTE_HOURS * 3_600_000
}

function matchesRecords(summary: ResidentSummary, filter: RecordsFilter): boolean {
  if (filter === 'all') return true
  const completeness = recordCompleteness(summary.resident)
  return filter === 'critical' ? completeness.hasCriticalGaps : !completeness.isComplete
}

/**
 * The list scopes to the site in the top bar.
 *
 * There is no site control in the filter row any more: §2.4 requires the
 * active site to be permanently visible, and it is — in the header, above
 * everything. A second control for the same fact could disagree with the
 * first, and a resident list showing one home under a header naming another
 * is the wrong-subject failure at the scale of a whole building.
 */
export function useResidentFilters(summaries: ResidentSummary[], activeSiteId: SiteId) {
  const site: SiteFilter = activeSiteId
  const [risk, setRisk] = useState<RiskFilter>(DEFAULT_FILTERS.risk)
  const [review, setReview] = useState<ReviewFilter>(DEFAULT_FILTERS.review)
  const [records, setRecords] = useState<RecordsFilter>(DEFAULT_FILTERS.records)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [descending, setDescending] = useState(false)

  const filters: ResidentFilters = { site, risk, review, records }

  /**
   * Filters other than site. Kept separate because "no residents at this site
   * at all" and "no residents match these filters" are different answers and
   * the screen must not collapse them — the Evidence Invariant applied to a
   * result set.
   */
  const atSite = useMemo(
    () => summaries.filter((summary) => summary.resident.siteId === site),
    [summaries, site],
  )

  const visible = useMemo(() => {
    const matched = atSite.filter(
      (summary) =>
        matchesRisk(summary, risk) &&
        matchesReview(summary, review) &&
        matchesRecords(summary, records),
    )

    const sorted = [...matched].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.resident.preferredName.localeCompare(
            b.resident.preferredName,
            'en-GB',
          )
        case 'room': {
          const roomOf = (summary: ResidentSummary) =>
            summary.resident.room.kind === 'recorded' ? summary.resident.room.value : ''
          // An unrecorded room sorts last ascending — it is a gap, and the
          // room column already says so; it should not crowd out the rooms
          // somebody is actually trying to find.
          const left = roomOf(a)
          const right = roomOf(b)
          if (left === '') return 1
          if (right === '') return -1
          return left.localeCompare(right, 'en-GB', { numeric: true })
        }
        case 'newestNote':
          return noteTime(b) - noteTime(a)
        case 'oldestNote':
          // -Infinity for never-noted, so they lead. This is the sort's job:
          // never written up is more neglected than written up long ago, and
          // pushing those residents to the bottom would hide exactly the
          // people PRD §6.2 built this sort to surface.
          return noteTime(a) - noteTime(b)
        default:
          return 0
      }
    })

    // The note sorts already encode their own direction, and reversing them
    // would move never-noted residents to the bottom of "oldest note" — the
    // one thing that sort must never do.
    const reversible = sortKey === 'name' || sortKey === 'room'
    return reversible && descending ? sorted.reverse() : sorted
  }, [atSite, risk, review, records, sortKey, descending])

  function toggleSort(key: SortKey) {
    // The care-note column carries both of PRD §6.2's note sorts. Clicking it
    // flips between "most recent" and "oldest" rather than reversing an
    // array, so "oldest" keeps its deliberate handling of never-noted.
    if (key === 'newestNote' || key === 'oldestNote') {
      setSortKey(sortKey === 'oldestNote' ? 'newestNote' : 'oldestNote')
      setDescending(false)
      return
    }
    if (key === sortKey) {
      setDescending((value) => !value)
      return
    }
    setSortKey(key)
    setDescending(false)
  }

  function clearFilters() {
    setRisk(DEFAULT_FILTERS.risk)
    setReview(DEFAULT_FILTERS.review)
    setRecords(DEFAULT_FILTERS.records)
  }

  const hasNarrowingFilters = risk !== 'all' || review !== 'all' || records !== 'all'

  /**
   * "Most recent first" IS descending by date; "oldest first" IS ascending.
   * Saying so in aria-sort means a screen reader announces the order that is
   * actually on screen rather than an internal flag.
   */
  const sortDirection =
    sortKey === 'newestNote'
      ? ('descending' as const)
      : sortKey === 'oldestNote'
        ? ('ascending' as const)
        : descending
          ? ('descending' as const)
          : ('ascending' as const)

  return {
    filters,
    setRisk,
    setReview,
    setRecords,
    sortKey,
    sortDirection,
    toggleSort,
    clearFilters,
    hasNarrowingFilters,
    /** Everyone at the chosen site, before the other filters. */
    atSite,
    /** What the table renders. */
    visible,
  }
}
