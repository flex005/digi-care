import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import type { CarePlanDomainId, CarePlanDomainRecord } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { Card, CardHeader } from '@/components/primitives'
import { useSiteFormat } from '@/app/session/use-session'
import { DomainStatusBadge, SupportLevelBadge, Unrecorded } from '@/components/status'
import { NEEDS_SECTIONS } from './needs-sections'
import styles from './profile.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The Needs tab. PRD §6.2 — "read-only, generated from care plan domains, with
 * support level per domain. A domain with no care plan content shows the
 * unrecorded treatment and links to create it."
 *
 * Built in the same visual language as General Information, deliberately: the
 * same 20px section header over a one-line plain-English description and a
 * divider, the same label-left value-right rhythm, the same three answer
 * types. Two tabs on the same record that answer questions in two different
 * shapes make the reader re-learn where to look, and the one thing they must
 * be able to do on both without thinking is spot a gap.
 *
 * Each domain is a term; its three facts are its definitions. Care plan
 * status, support level and what the person actually said are separate
 * answers with separate treatments, never merged — Rule 3a. A domain that is
 * `not_started` with `not_assessed` support has two gaps, and shows two.
 *
 * Three things this screen must not do:
 *
 *  1. **Omit a domain.** All ten are listed for every resident, whether or not
 *     anybody has written them. Absence from a list is the same bug as a blank
 *     cell, and a Needs tab showing only the domains somebody got round to
 *     would read as a complete picture of a person's needs.
 *  2. **Let "Independent" and "not assessed" look alike.** They are opposite
 *     claims about somebody's safety, and reading the second as the first is
 *     how a person gets left to manage the stairs alone. Support level is its
 *     own labelled answer for exactly that reason — never a blank, never
 *     folded into the status badge beside it.
 *  3. **Offer a dead link.** The care plan editor is Phase 6, so the "write
 *     this domain" affordance is present and disabled, matching the sidebar.
 */

const DOMAIN_NAMES = new Map(
  CARE_PLAN_DOMAINS.map((domain) => [domain.id, domain.name]),
)

/** One fact about a domain: label left, answer right. The Field rhythm, at
 *  the scale of a row rather than a card. */
function DomainFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.domainFact}>
      <dt className={styles.domainFactLabel}>{label}</dt>
      <dd className={styles.domainFactValue}>{children}</dd>
    </div>
  )
}

/**
 * Somebody is rewriting this domain, said quietly.
 *
 * **It is a fact about the current plan, and this tab is a summary of the
 * current plan.** A reader who sees a domain here and does not know it is
 * under revision may act on a version that is about to be superseded — so the
 * silence was not neutral, even though nothing the tab claimed was false.
 *
 * Plain text at the weight the settled facts sit at: no chip, no tint, no
 * hatch. This tab is read-only and its job is what this person needs; the
 * revision is context, not a call to action, and giving it a treatment would
 * put it above the three facts it sits beside.
 *
 * **It never touches the status.** The signed version is still in force and
 * still what staff follow — only a signature changes that. Rendered only where
 * a signature exists to be in force: with nothing signed, `in_progress`
 * already says it, and saying it twice in one cell is volume drowning a
 * distinction in miniature.
 */
function RevisionInProgress({ record }: { record: CarePlanDomainRecord }) {
  const format = useSiteFormat()
  if (record.draft.kind !== 'draft') return null
  if (record.status.kind === 'in_progress') return null

  return (
    <p className={styles.domainRevision} data-revision>
      A revision is in progress, not yet signed,{' '}
      {format.attributionOn(staffLabel(record.draft.updatedBy), record.draft.updatedAt)}
      .
    </p>
  )
}

function DomainRow({
  domainId,
  record,
}: {
  domainId: CarePlanDomainId
  record: CarePlanDomainRecord | undefined
}) {
  const name = DOMAIN_NAMES.get(domainId) ?? domainId

  // A domain missing from a resident's care plan array entirely — which
  // fixtures.test.ts forbids, but the screen must not assume.
  if (!record) {
    return (
      <li className={styles.domainRow} data-domain={domainId}>
        <h3 className={styles.domainName}>{name}</h3>
        <dl className={styles.domainFacts}>
          <DomainFact label="Care plan">
            <Unrecorded
              variant="chip"
              label={`${name} is not on this care plan`}
              // Was a sentence naming the care plan *template*, repeated on every
              // unwritten domain. The label already says it, and "template" is
              // an implementation word a care worker has no use for.
              detail="nothing has been written for this domain"
            />
          </DomainFact>
        </dl>
        <div className={styles.domainAction} />
      </li>
    )
  }

  const notStarted = record.status.kind === 'not_started'

  return (
    <li className={styles.domainRow} data-domain={domainId}>
      <h3 className={styles.domainName}>{name}</h3>

      <dl className={styles.domainFacts}>
        <DomainFact label="Care plan">
          <DomainStatusBadge status={record.status} />
          <RevisionInProgress record={record} />
        </DomainFact>

        {/* Its own answer, always. `not_assessed` is a real member of the
            union and renders hatched; it is never a blank and never absent. */}
        <DomainFact label="Support level">
          <SupportLevelBadge level={record.supportLevel} />
        </DomainFact>

        <DomainFact label="In this person's words">
          {notStarted || record.summary === '' ? (
            <Unrecorded
              variant="chip"
              label="No care plan content"
              detail="nothing written"
            />
          ) : (
            // Written in the resident's own voice, per source PRD §3.3.
            <p className={styles.domainQuote}>{record.summary}</p>
          )}
        </DomainFact>
      </dl>

      {/*
        The editor, reached from the gap it would fill.
        
        Beside the hatch and never instead of it: the row still has to read as
        a gap after the affordance is there. Same two labels the care plan tab
        uses, because they are the same act from two screens and a reader who
        has learned one should not have to learn the other.
      */}
      <div className={styles.domainAction}>
        <Link
          to={`../care-plan/${domainId}`}
          relative="path"
          className={styles.domainActionLink}
          data-domain-editor={domainId}
          aria-label={`${notStarted ? 'Write' : 'Open'} the ${name} care plan domain`}
        >
          {notStarted ? 'Write this domain' : 'Open domain'}
        </Link>
      </div>
    </li>
  )
}

export function NeedsTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))

  return (
    <div className={styles.tabPanel}>
      <Card padded>
        <p className={styles.tabIntro}>
          Generated from the care plan and read-only. All ten domains are listed, filled
          in or not.
        </p>
      </Card>

      {NEEDS_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.name} subtitle={section.description} />
          <ul className={styles.domainList}>
            {section.domainIds.map((domainId) => (
              <DomainRow
                key={domainId}
                domainId={domainId}
                record={byDomain.get(domainId)}
              />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
