import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Resident } from '@/data/types'
import type { HandoverBoard } from '@/data/access/handover-store'
import { getHandoverBoard } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { residentsBySite } from '@/data/fixtures/residents'
import {
  Avatar,
  Button,
  Card,
  Section,
  SelectedMark,
  Toast,
} from '@/components/primitives'
import { Settled } from '@/components/status'
import { SHIFT_NAMES } from '@/lib/shift'
import { formatDate } from '@/lib/format'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { HandoverStatusBadge } from './HandoverStatusBadge'
import { LastNoteLine } from './LastNoteLine'
import { UnsignedHandover } from './UnsignedHandover'
import { formatCount } from '@/lib/format'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { groupRows, type GroupId } from './handover-groups'
import { StatusDialog } from './StatusDialog'
import { SignaturePanel } from './SignaturePanel'
import styles from './handover.module.css'

/**
 * Shift handover. PRD §6.3.
 *
 * The sentence this screen exists to say: **these residents have not been
 * looked at, and you are about to sign.** Everything else on it is context,
 * and the layout has to say so — Rule 3b applied to a page rather than to a
 * status.
 *
 * So it is four titled sections with air between them, not a stack of equal
 * cards:
 *
 *   This shift at a glance   four coverage cards, Not reviewed leading
 *   Earlier handovers        a handover nobody countersigned. Hatched.
 *   Residents                grouped, Not reviewed first
 *   Signature                the dual signature, or the signed record
 *
 * The screen exists for its fourth resident state. Three statuses would let a
 * shift that ran out of time mark the last four residents All Well and go
 * home, and nothing afterwards could tell that from four people who were
 * checked. Here every resident at the site is listed whether or not anybody
 * got to them, and the ones nobody got to are hatched and counted.
 *
 * **The list is built from the site's residents, never from the handover
 * entries.** A resident missing from the record renders as Not Reviewed, which
 * is a true statement about them. Iterating the entries would have made
 * "nobody looked at Mrs Adeyemi" indistinguishable from "Mrs Adeyemi is not
 * here".
 */

export function HandoverRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  /*
   * Not reviewed leads, and it is the tab that opens. Urgent is information
   * you have already received either way; not reviewed is the only group still
   * fixable before the signature goes on.
   */
  const [status, setStatus] = useState<GroupId>('not_reviewed')
  const [written, setWritten] = useState(0)
  /**
   * What the last write did, announced by the screen.
   *
   * **Not by the control.** Recording a status moves the row from one group to
   * another, which unmounts the `<li>` holding the dialog — a toast owned
   * there would be destroyed by the action it was confirming and never seen.
   * The same shape cost the note review its confirmation until it was found.
   */
  const [done, setDone] = useState<{ title: string; description: string } | 'none'>(
    'none',
  )

  const load = useCallback(() => getHandoverBoard(activeSite.id), [activeSite.id])
  const resource = useResource<HandoverBoard>(load, [activeSite.id, written])

  const residents = useMemo(() => {
    const byId = new Map<string, Resident>()
    for (const resident of residentsBySite(activeSite.id))
      byId.set(resident.id, resident)
    return byId
  }, [activeSite.id])

  if (resource.kind === 'loading') {
    return (
      <p className={styles.loading} role="status">
        Loading the handover…
      </p>
    )
  }

  if (resource.kind === 'error') {
    return (
      <Card padded>
        <p className={styles.errorTitle}>This handover could not be loaded</p>
        <p className={styles.errorBody}>
          Nothing has been lost; this is a read. A partial handover is not shown,
          because it is one somebody would sign.
        </p>
        <Button variant="secondary" onClick={resource.retry}>
          Try again
        </Button>
      </Card>
    )
  }

  const board = resource.data
  const { session } = board
  const groups = groupRows(board.rows)
  const countOf = (id: string) =>
    groups.find((group) => group.id === id)?.rows.length ?? 0

  const total = board.rows.length

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <header className={styles.pageHead}>
          <h1 className={styles.pageTitle}>
            {SHIFT_NAMES[session.outgoingShift]} shift handover
          </h1>
          <p className={styles.pageFacts}>
            {activeSite.name} · <span data-numeric>{formatDate(session.date)}</span> ·
            handing over to the {SHIFT_NAMES[session.incomingShift].toLowerCase()} shift
          </p>
        </header>

        {/* ---- 1. the coverage figures ------------------------------------ */}
        <Section
          title="This shift at a glance"
          note="Every resident at this site, whether or not anybody has got to them yet."
        >
          {/*
           * The same card the residents list uses, and the lead is the one
           * still fixable before signing.
           *
           * The three findings are measured across the people somebody
           * actually looked at. That denominator is deliberately not the whole
           * site: counting the unreviewed in it would claim a coverage nobody
           * has. Each is a measured count, so none of them ever wears the
           * unrecorded treatment, which is reserved for the absence of a
           * finding (PRD §2.3, §4.5).
           */}
          <div data-glance>
            <MetricTiles label={`This shift at ${activeSite.name}`}>
              <MetricTile
                label="Not reviewed"
                emphasis="lead"
                icon={metricIcons.alert}
                figure={<MetricValue>{formatCount(board.notReviewed)}</MetricValue>}
                of={`of ${formatCount(total)} residents living at ${activeSite.name}`}
                note="The only figure here you can still change before you sign."
              />
              <MetricTile
                label="Urgent"
                emphasis="supporting"
                icon={metricIcons.urgent}
                figure={<MetricValue>{formatCount(countOf('urgent'))}</MetricValue>}
                of={`of ${formatCount(board.reviewed)} residents reviewed this shift`}
              />
              <MetricTile
                label="Needs attention"
                emphasis="supporting"
                icon={metricIcons.attention}
                figure={
                  <MetricValue>{formatCount(countOf('needs_attention'))}</MetricValue>
                }
                of={`of ${formatCount(board.reviewed)} residents reviewed this shift`}
              />
              <MetricTile
                label="All well"
                emphasis="supporting"
                icon={metricIcons.settled}
                figure={<MetricValue>{formatCount(countOf('all_well'))}</MetricValue>}
                of={`of ${formatCount(board.reviewed)} residents reviewed this shift`}
              />
            </MetricTiles>
          </div>
        </Section>

        {/* ---- 2. the stale state ----------------------------------------- */}
        <Section
          title="Earlier handovers"
          note="A handover is complete only when both shifts have signed it."
        >
          <Card padded>
            {board.unsigned.length === 0 ? (
              // Rule 3b. Stated, not celebrated — and stated at all, because
              // an empty section here and a section nobody rendered would
              // look identical, which is the blank cell one level up.
              <Settled
                label="Every earlier handover at this site has both signatures."
                detail={`Measured across every handover recorded for ${activeSite.name}, not only recent ones.`}
              />
            ) : (
              <ul className={styles.unsignedList}>
                {board.unsigned.map((old) => (
                  <UnsignedHandover key={old.id} session={old} />
                ))}
              </ul>
            )}
          </Card>
        </Section>

        {/* ---- 3. the residents ------------------------------------------- */}
        <Section title="Residents">
          {/*
           * One tab per status, and the count on each.
           *
           * The four were stacked sections, which made the shape of the shift
           * something a reader assembled by scrolling. As tabs the counts sit
           * side by side and the reader chooses which group to work through,
           * while every status stays visible even at zero: absence from the
           * strip would be the same bug as a blank cell.
           */}
          <div className={styles.statusTabs} role="group" aria-label="Resident status">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={[
                  styles.statusTab,
                  status === group.id ? styles.statusTabActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={status === group.id}
                onClick={() => setStatus(group.id)}
                data-status-tab={group.id}
              >
                <SelectedMark selected={status === group.id} />
                {group.title}
                <span className={styles.statusTabCount} data-numeric>
                  {formatCount(group.rows.length)}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.groups} data-handover-groups>
            {groups
              .filter((group) => group.id === status)
              .map((group) => {
                const denominator =
                  group.denominator === 'all_residents' ? total : board.reviewed
                return (
                  <Card key={group.id}>
                    <div className={styles.groupHead} data-group={group.id}>
                      <h3 className={styles.groupTitle}>{group.title}</h3>
                      {/* Rule 4, and the denominators are not the same number:
                        "not reviewed" is out of everybody, the rest are out of
                        the people somebody actually looked at. */}
                      <p className={styles.groupCount}>
                        <span data-numeric>
                          {group.rows.length} of {denominator}
                        </span>{' '}
                        {group.denominator === 'all_residents'
                          ? 'residents living here'
                          : 'residents reviewed'}
                      </p>
                    </div>

                    {group.rows.length === 0 ? (
                      <p className={styles.groupEmpty}>{group.emptyNote}</p>
                    ) : (
                      <ul className={styles.rows}>
                        {group.rows.map((row) => {
                          const resident = residents.get(row.residentId)
                          if (!resident) return null
                          return (
                            <li
                              key={row.residentId}
                              className={styles.row}
                              data-resident={row.residentId}
                              data-status={row.status.kind}
                            >
                              <div className={styles.rowWho}>
                                <Avatar
                                  photo={resident.photo}
                                  name={resident.fullLegalName}
                                  size="small"
                                />
                                <div>
                                  <Link
                                    className={styles.rowName}
                                    to={`/residents/${resident.id}/notes`}
                                  >
                                    {resident.preferredName}
                                  </Link>
                                  <p className={styles.rowFacts}>
                                    {resident.fullLegalName}
                                    {resident.room.kind === 'recorded'
                                      ? ` · Room ${resident.room.value}`
                                      : ' · Room not recorded'}
                                  </p>
                                </div>
                              </div>

                              <div className={styles.rowStatus}>
                                <HandoverStatusBadge status={row.status} />
                                {row.status.kind === 'needs_attention' ||
                                row.status.kind === 'urgent' ? (
                                  <p className={styles.rowNote}>{row.status.note}</p>
                                ) : null}
                                {/* A hatched row with no context says only that
                                  nobody looked. With the silence measured, it
                                  says which unreviewed resident to go to
                                  first. */}
                                {row.status.kind === 'not_reviewed' ? (
                                  <LastNoteLine last={row.lastNote} />
                                ) : null}
                              </div>

                              <div className={styles.rowAction}>
                                {!viewer.canRecordIn('/handover') ? null : (
                                  <StatusDialog
                                    handoverId={session.id}
                                    resident={resident}
                                    current={row.status}
                                    onRecorded={(name, status) => {
                                      setDone({
                                        title: `${name} recorded as ${status}`,
                                        description:
                                          'The incoming shift will see it on this handover. In this build it is held in memory and will be gone on reload.',
                                      })
                                      setWritten((count) => count + 1)
                                    }}
                                  />
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                )
              })}
          </div>
        </Section>

        {/* ---- 4. the signature ------------------------------------------- */}
        <Section title="Signature">
          <Card>
            <div className={styles.signatures}>
              <SignaturePanel
                handoverId={session.id}
                side="outgoing"
                shift={session.outgoingShift}
                signature={session.outgoing}
                reviewed={board.reviewed}
                notReviewed={board.notReviewed}
                siteName={activeSite.name}
                onSigned={(summary) => {
                  setDone(summary)
                  setWritten((count) => count + 1)
                }}
              />
              <SignaturePanel
                handoverId={session.id}
                side="incoming"
                shift={session.incomingShift}
                signature={session.incoming}
                reviewed={board.reviewed}
                notReviewed={board.notReviewed}
                siteName={activeSite.name}
                onSigned={(summary) => {
                  setDone(summary)
                  setWritten((count) => count + 1)
                }}
              />
            </div>
          </Card>
        </Section>

        <Toast
          open={done !== 'none'}
          onOpenChange={(open) => {
            if (!open) setDone('none')
          }}
          tone="positive"
          title={done === 'none' ? '' : done.title}
          description={done === 'none' ? undefined : done.description}
        />
      </div>
    </SiteTimeZone>
  )
}
