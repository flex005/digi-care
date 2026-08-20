import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import type { CarePlanDomainId, CarePlanDomainRecord } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { Card, CardHeader, Tooltip } from '@/components/primitives'
import { DomainStatusBadge, SupportLevelBadge, Unrecorded } from '@/components/status'
import { NEEDS_SECTIONS } from './needs-sections'
import styles from './profile.module.css'

/**
 * The Needs tab. PRD §6.2 — "read-only, generated from care plan domains, with
 * support level per domain. A domain with no care plan content shows the
 * unrecorded treatment and links to create it."
 *
 * Three things this screen must not do:
 *
 *  1. **Omit a domain.** All ten are listed for every resident, whether or not
 *     anybody has written them. Absence from a list is the same bug as a blank
 *     cell, and a Needs tab showing only the domains somebody got round to
 *     would read as a complete picture of a person's needs.
 *  2. **Let "Independent" and "not assessed" look alike.** They are opposite
 *     claims about somebody's safety, and reading the second as the first is
 *     how a person gets left to manage the stairs alone.
 *  3. **Offer a dead link.** The care plan editor is Phase 6, so the "write
 *     this domain" affordance is present and disabled, matching the sidebar.
 */

const DOMAIN_NAMES = new Map(
  CARE_PLAN_DOMAINS.map((domain) => [domain.id, domain.name]),
)

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
        <div className={styles.domainName}>{name}</div>
        <Unrecorded label={`${name} is not on this care plan`} />
      </li>
    )
  }

  const notStarted = record.status.kind === 'not_started'

  return (
    <li className={styles.domainRow} data-domain={domainId}>
      <div className={styles.domainName}>{name}</div>
      <div className={styles.domainBadges}>
        <DomainStatusBadge status={record.status} />
        <SupportLevelBadge level={record.supportLevel} />
      </div>
      <div className={styles.domainSummary}>
        {notStarted || record.summary === '' ? (
          <Unrecorded
            variant="chip"
            label="No care plan content"
            detail="nobody has written what this person needs here, or how they want it done"
          />
        ) : (
          // Written in the resident's own voice, per source PRD §3.3.
          <p className={styles.domainQuote}>{record.summary}</p>
        )}
      </div>
      <div className={styles.domainAction}>
        <Tooltip content="Care plan editor — coming in Phase 6">
          <span
            className={styles.domainLink}
            role="link"
            aria-disabled="true"
            aria-label={`Open the ${name} care plan domain — coming in Phase 6`}
            tabIndex={0}
          >
            {notStarted ? 'Write this domain' : 'Open domain'}
          </span>
        </Tooltip>
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
          Generated from the care plan and read-only — this is a summary of what has
          been written elsewhere, not a place to write it. All ten domains are listed
          whether or not anybody has filled them in, because a Needs tab showing only
          the completed ones would read as a complete picture of this person&rsquo;s
          needs.
        </p>
      </Card>

      {NEEDS_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader
            title={section.name}
            subtitle={
              section.note === ''
                ? `${section.domainIds.length} care plan ${section.domainIds.length === 1 ? 'domain' : 'domains'}`
                : section.note
            }
          />
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
