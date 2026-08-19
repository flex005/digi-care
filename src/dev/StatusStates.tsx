import type { ReactNode } from 'react'
import type { MarCellState } from '@/data/types'
import {
  AggregateFigure,
  ConsentBadge,
  MarCell,
  RecordedValue,
  ResuscitationBadge,
  ReviewBadge,
  RiskBadge,
} from '@/components/status'
import {
  aggregateStates,
  consentStates,
  marStates,
  recordedStates,
  resuscitationStates,
  reviewStates,
  riskStates,
} from './states.fixtures'
import styles from './dev.module.css'

/**
 * Every state of every status primitive, side by side. PRD §6.1.
 *
 * The lists come from states.fixtures.ts, which is typed so that adding a
 * member to any status union breaks the build until an example exists here.
 * Nothing on this page is hand-maintained in a way that can silently fall
 * behind the types.
 */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.stack}>{children}</div>
    </div>
  )
}

const MAR_CONTEXT = '08:00, 19 August, Amlodipine 5mg'

/** Keyed by the union itself, so a new MarCellState member fails to compile
 *  here until it has been given a heading. */
const MAR_SLOT_LABELS: Record<MarCellState['kind'], string> = {
  not_due: 'not_due — nothing expected',
  due: 'due — window open, no action yet',
  given: 'given — a complete record',
  not_given: 'not_given — ALSO a complete record',
  omitted: 'omitted — the window closed empty',
}

export function StatusStates() {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>MarCellState — five states</h2>
        <p className={styles.sectionNote}>
          The reason this product exists. An empty MAR cell can mean “not due yet”,
          “due, window open, nobody has acted”, or “window closed, no record — this is
          an omission”. Three different meanings behind one blank, so here they are
          three different things. Note that{' '}
          <strong>not_given is a complete record and looks settled</strong>; only
          omitted is a gap, and only omitted is hatched. Each cell also carries a
          full-sentence accessible name — inspect one with a screen reader.
        </p>
        {Object.entries(marStates).map(([kind, states]) => (
          <div key={kind} className={styles.group}>
            <span className={styles.groupTitle}>
              {MAR_SLOT_LABELS[kind as MarCellState['kind']]}
            </span>
            <div className={styles.marRow}>
              {states.map((state, index) => (
                <div key={index} className={styles.marSlot}>
                  <MarCell state={state} context={MAR_CONTEXT} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>RiskStatus</h2>
        <p className={styles.sectionNote}>
          The absence of a badge is never silence. No FALLS RISK badge reads as
          “assessed, he’s fine” — it may mean nobody has ever looked.
        </p>
        <Group title="not_assessed">
          {riskStates.not_assessed.map((status, index) => (
            <RiskBadge key={index} name="Falls risk" status={status} />
          ))}
        </Group>
        <Group title="assessed — low · moderate · high">
          {riskStates.assessed.map((status, index) => (
            <RiskBadge key={index} name="Falls risk" status={status} />
          ))}
        </Group>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ResuscitationStatus</h2>
        <p className={styles.sectionNote}>
          Ambiguity here is catastrophic in both directions: a missing badge must never
          read as “DNAR”, and never as “for resuscitation”. DNAR uses the brand tone
          rather than red or green, because it is a recorded clinical decision and not
          good or bad news.
        </p>
        {Object.entries(resuscitationStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <ResuscitationBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ReviewState</h2>
        <p className={styles.sectionNote}>
          “Never scheduled” and “completed on time” must not both render as untroubled.
          In a list, never_scheduled is its own row — absence from a list is the same
          failure as a blank cell.
        </p>
        {Object.entries(reviewStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((state, index) => (
              <ReviewBadge key={index} state={state} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ConsentStatus — six outcomes</h2>
        <p className={styles.sectionNote}>
          Pending, Refused, Withdrawn and Lacks Capacity — Best Interest are legally
          distinct outcomes. None of them is a blank, and every one carries its author.
        </p>
        {Object.entries(consentStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <ConsentBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recorded&lt;T&gt;</h2>
        <p className={styles.sectionNote}>
          The general shape, shown on allergies — the sharpest case. Three different
          things: allergies present, allergies confirmed absent, and nobody has asked.
        </p>
        <Group title="unrecorded">
          {recordedStates.unrecorded.map((record, index) => (
            // The generic is pinned because the unrecorded member carries no
            // value to infer it from — which is rather the point of it.
            <RecordedValue<string>
              key={index}
              name="Allergies"
              record={record}
              render={(value) => value}
            />
          ))}
        </Group>
        <Group title="recorded — a positive, then a recorded negative">
          {recordedStates.recorded.map((record, index) => (
            <RecordedValue<string>
              key={index}
              name="Allergies"
              record={record}
              tone={index === 0 ? 'critical' : 'positive'}
              render={(value) => value}
            />
          ))}
        </Group>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Aggregate — every figure has a denominator
        </h2>
        <p className={styles.sectionNote}>
          No bare counts, no bare percentages, anywhere. Insufficient Evidence is not a
          milder Red — Red is a finding, this is the absence of one — so it renders in
          the unrecorded treatment and never in a RAG hue.
        </p>
        <div className={styles.row}>
          <AggregateFigure
            caption="Safe — falls risk assessments"
            aggregate={aggregateStates.insufficient_evidence[0]}
            denominatorNoun="residents"
          />
          <AggregateFigure
            caption="Care note compliance"
            aggregate={aggregateStates.measured[0]}
            denominatorNoun="expected notes"
          />
          <AggregateFigure
            caption="Incidents this month"
            aggregate={aggregateStates.measured[1]}
            denominatorNoun="residents"
          />
        </div>
      </section>
    </>
  )
}
