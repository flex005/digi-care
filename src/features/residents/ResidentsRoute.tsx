import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ResidentSummary } from '@/data/access/client'
import { getResidentSummaries } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Table,
  TableCell,
  TableRow,
  Tooltip,
} from '@/components/primitives'
import { ReviewBadge, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import type { TableColumn } from '@/components/primitives'
import { ResidentsFilterBar } from './ResidentsFilterBar'
import { RiskFlagsCell } from './RiskFlagsCell'
import { RiskFlagsLegend } from './RiskFlagsLegend'
import { CriticalGapsChip } from './CriticalGapsChip'
import { LastNoteCell } from './LastNoteCell'
import { useResidentFilters, type SortKey } from './use-resident-filters'
import styles from './residents.module.css'

/**
 * The residents list. PRD §6.2.
 *
 * Not a directory. PRD §6.2 is explicit that "the 'oldest care note' sort
 * exists specifically so a manager can find neglected records; it is not
 * decoration" — so this screen is the instrument for finding the people
 * nobody has looked at, and every column is built to serve that.
 */

/**
 * The care-note column carries both of PRD §6.2's note sorts — "most recent"
 * and "oldest" — because they are one column in two directions. Its sortKey
 * tracks whichever is active so the header reads as sorted either way.
 */
function columnsFor(sortKey: SortKey, showSite: boolean): TableColumn<SortKey>[] {
  return [
    // Photo sits inside the Resident cell rather than in a column of its own.
    // PRD §6.2 lists both; putting them together keeps every column visible at
    // 1440px, and the Records column is the one this screen exists for — it
    // cannot be the one that falls off the right-hand edge.
    { label: 'Resident', sortKey: 'name' },
    { label: 'Room', sortKey: 'room' },
    // Only when the list spans sites. §2.4 requires the active site to be
    // permanently visible, and it is — in the top bar, in the filter, and in
    // the table caption. A column repeating "Rosewood Court" 28 times adds no
    // information and costs the Records column its place on screen.
    ...(showSite ? [{ label: 'Site' } as TableColumn<SortKey>] : []),
    { label: 'Risk flags' },
    { label: 'Review status' },
    {
      label: sortKey === 'oldestNote' ? 'Last care note — oldest' : 'Last care note',
      sortKey: sortKey === 'oldestNote' ? 'oldestNote' : 'newestNote',
    },
    { label: 'Records' },
  ]
}

/**
 * A prototype-only affordance for reviewing the states that deliberately
 * seeded fixtures cannot produce. It always renders a visible banner, so a
 * simulated state can never be mistaken for the real screen.
 *
 * Remove when a real backend lands.
 */
type Simulation = 'empty' | 'error' | 'loading' | 'none'

function useSimulation(): Simulation {
  const [params] = useSearchParams()
  const sim = params.get('sim')
  return sim === 'empty' || sim === 'error' || sim === 'loading' ? sim : 'none'
}

export function ResidentsRoute() {
  const { sites, activeSite, accessMode } = useSession()
  const simulation = useSimulation()

  const load = useCallback(() => getResidentSummaries('all'), [])
  const resource = useResource<ResidentSummary[]>(load)

  const summaries = resource.kind === 'ready' ? resource.data : []
  const {
    filters,
    setSite,
    setRisk,
    setReview,
    setRecords,
    sortKey,
    sortDirection,
    toggleSort,
    clearFilters,
    hasNarrowingFilters,
    atSite,
    visible,
  } = useResidentFilters(simulation === 'empty' ? [] : summaries, activeSite.id)

  const siteLabel =
    filters.site === 'all'
      ? 'all sites'
      : (sites.find((site) => site.id === filters.site)?.name ?? 'this site')

  const showSite = filters.site === 'all'
  const isLoading = simulation === 'loading' || resource.kind === 'loading'
  const isError = simulation === 'error' || resource.kind === 'error'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Residents</h1>
          <p className={styles.lede}>
            Sort by oldest care note to find the records nobody has looked at —
            residents nobody has ever written up sort first, because that is the most
            neglected record in the home.
          </p>
        </div>
        {/* Resident admission is not built by any phase in the PRD. Present
            but disabled, matching the sidebar, so the screen does not change
            shape when admission is assigned a phase. Under read-only it is not
            rendered at all — an auditor has zero write (PRD §1), and a
            disabled button implies a capability they will never have. */}
        {accessMode === 'read_write' ? (
          <Tooltip content="Add resident — coming in a later phase">
            <span>
              <Button variant="primary" disabled aria-disabled="true">
                <Icon name="add-remove-delete/add-01" size={16} />
                Add resident
              </Button>
            </span>
          </Tooltip>
        ) : null}
      </header>

      {simulation !== 'none' ? (
        <p className={styles.simBanner} role="status">
          <Icon name="alert-notification/alert-02" size={16} />
          Simulated “{simulation}” state — this is a review aid, not real data. Remove{' '}
          <code>?sim={simulation}</code> from the address to see the real list.
        </p>
      ) : null}

      <Card>
        <ResidentsFilterBar
          sites={sites}
          filters={filters}
          onSiteChange={setSite}
          onRiskChange={setRisk}
          onReviewChange={setReview}
          onRecordsChange={setRecords}
        />
        <RiskFlagsLegend />

        {isError ? (
          <div className={styles.errorPanel}>
            <p className={styles.errorTitle}>The resident list could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost — this is a read. Until it loads, this screen is
              showing you nothing rather than something incomplete, because a partial
              resident list is worse than none: you cannot tell who is missing from it.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                if (resource.kind === 'error') resource.retry()
              }}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <p className={styles.loadingNote} role="status">
            Loading residents…
          </p>
        ) : atSite.length === 0 ? (
          // Nobody at this site at all — a different answer from "nobody
          // matches your filters", and collapsing the two would be the
          // Evidence Invariant failing at the level of a result set.
          <EmptyState
            title={`No residents at ${siteLabel} yet`}
            body="Nobody has been admitted here. This is not a filter result — the site is empty."
            actions={
              accessMode === 'read_write' ? (
                <Tooltip content="Add resident — coming in a later phase">
                  <span>
                    <Button disabled aria-disabled="true">
                      Add resident
                    </Button>
                  </span>
                </Tooltip>
              ) : undefined
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No residents match these filters"
            body={`There are ${atSite.length} residents at ${siteLabel}, but none of them match the filters you have set. They are still here — this view is narrowed.`}
            actions={
              hasNarrowingFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table
            caption={`${visible.length} of ${atSite.length} residents at ${siteLabel}, sorted by ${SORT_LABELS[sortKey]}, ${sortDirection}.`}
            columns={columnsFor(sortKey, showSite)}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={toggleSort}
          >
            {visible.map(({ resident, latestNote }) => {
              const site = sites.find((entry) => entry.id === resident.siteId)
              return (
                // Each row renders in ITS OWN site's timezone. With "All
                // sites" selected the list spans two homes, and rendering
                // every record in whichever site happens to be active would
                // be the viewer-local bug wearing a different hat. PRD §3.6.
                <SiteTimeZone
                  key={resident.id}
                  timeZone={site?.timeZone ?? activeSite.timeZone}
                >
                  <TableRow>
                    <TableCell>
                      <span className={styles.nameCell}>
                        <Avatar
                          photo={resident.photo}
                          name={resident.fullLegalName}
                          size="medium"
                        />
                        <span className={styles.nameText}>
                          <Link
                            to={`/residents/${resident.id}`}
                            className={styles.preferredName}
                          >
                            {resident.preferredName}
                          </Link>
                          <span className={styles.legalName}>
                            {resident.fullLegalName}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell numeric>
                      {resident.room.kind === 'recorded' ? (
                        <span className={styles.roomCell}>{resident.room.value}</span>
                      ) : (
                        <Unrecorded label="Room not recorded" />
                      )}
                    </TableCell>
                    {showSite ? (
                      <TableCell>
                        <span className={styles.siteCell}>
                          {site ? site.name : 'Unknown site'}
                        </span>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <RiskFlagsCell resident={resident} />
                    </TableCell>
                    <TableCell>
                      <ReviewBadge state={resident.carePlanReview} />
                    </TableCell>
                    <TableCell>
                      <LastNoteCell note={latestNote} />
                    </TableCell>
                    <TableCell>
                      <CriticalGapsChip resident={resident} />
                    </TableCell>
                  </TableRow>
                </SiteTimeZone>
              )
            })}
          </Table>
        )}
      </Card>
    </div>
  )
}

const SORT_LABELS: Record<SortKey, string> = {
  name: 'name',
  room: 'room',
  newestNote: 'most recent care note',
  oldestNote: 'oldest care note',
}
