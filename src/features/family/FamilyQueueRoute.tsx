import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnyConsent, FamilyMember, Resident } from '@/data/types'
import { currentDetails } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, Pager, usePaged } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount } from '@/lib/format'
import { allFamilyMembers } from '@/data/access/family-access-store'
import styles from './family.module.css'

/**
 * Family Portal access across the home. AM v2.0 FAM-01, Phase 26.
 *
 * The sentence: **these residents agreed to the Family Portal and nobody has
 * been named.**
 *
 * **Why that finding and not "nobody named".** Counting every resident with
 * nobody named would put four opposite states in one figure: never asked,
 * refused, awaiting a decision, and agreed-but-unused. For a refusal, nobody
 * named is the *correct* state — and recruiting recorded negatives into a
 * missing-evidence count is the defect the documents chart already taught this
 * build, one module along. Consent given with nobody named has one reading:
 * permission exists and has never been used.
 *
 * **The denominator is residents whose consent is given**, at this site, and
 * the residents with no consent on file are stated beside it rather than left
 * out silently — a reader has to know they were excluded rather than clean.
 *
 * **The second finding is a different claim, so it is never added to the
 * first**: people still named where the consent no longer stands. That is a
 * permission outliving its authorisation, and until this phase it was
 * invisible on the resident's own tab at exactly the moment somebody needed to
 * remove it.
 */

type Filter = 'nobody_named' | 'access_without_consent' | 'named' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'nobody_named', label: 'Agreed, nobody named' },
  { id: 'access_without_consent', label: 'Access without a consent' },
  { id: 'named', label: 'Agreed, people named' },
  { id: 'all', label: 'All' },
]

interface Row {
  resident: Resident
  consent: AnyConsent
  members: FamilyMember[]
}

export function FamilyQueueRoute() {
  const { activeSite } = useSession()
  const [filter, setFilter] = useState<Filter>('nobody_named')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Family Portal</h1>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading family access…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>Family access could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer residents waiting than there are.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            residents={resource.data}
            siteName={activeSite.name}
            filter={filter}
            onFilter={setFilter}
          />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Found({
  residents,
  siteName,
  filter,
  onFilter,
}: {
  residents: Resident[]
  siteName: string
  filter: Filter
  onFilter: (value: Filter) => void
}) {
  const everybody = allFamilyMembers()
  const all: Row[] = residents.map((resident) => ({
    resident,
    consent: resident.consents.family_portal as AnyConsent,
    members: everybody.filter((member) => member.residentId === resident.id),
  }))

  const given = all.filter((row) => row.consent.kind === 'given')
  const nobodyNamed = given.filter((row) => row.members.length === 0)
  const withoutConsent = all.filter(
    (row) => row.consent.kind !== 'given' && row.members.length > 0,
  )
  const peopleWithoutConsent = withoutConsent.reduce(
    (total, row) => total + row.members.length,
    0,
  )
  const namedPeople = all.reduce((total, row) => total + row.members.length, 0)

  const visible = all
    .filter((row) => {
      switch (filter) {
        case 'all':
          return true
        case 'nobody_named':
          return row.consent.kind === 'given' && row.members.length === 0
        case 'access_without_consent':
          return row.consent.kind !== 'given' && row.members.length > 0
        case 'named':
          return row.consent.kind === 'given' && row.members.length > 0
      }
    })
    .sort((a, b) => a.resident.fullLegalName.localeCompare(b.resident.fullLegalName))

  const paged = usePaged(visible)

  return (
    <>
      <div className={styles.findings}>
        {/* The lead. Permission granted, and never used. */}
        <div className={styles.findingLead} data-finding="nobody-named">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(nobodyNamed.length)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              of <span data-numeric>{formatCount(given.length)}</span> residents who
              agreed have nobody named
            </span>
            <span className={styles.findingDetail}>
              Family Portal consent is on file at {siteName} and no family member has
              been given access under it. The other{' '}
              <span data-numeric>{formatCount(all.length - given.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> residents have no
              consent on file and are not counted here: nobody named is the correct
              state for somebody who refused or was never asked.
            </span>
          </span>
        </div>

        {/* A different claim, so it is never added to the first. */}
        <div className={styles.findingSecondary} data-finding="access-without-consent">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(peopleWithoutConsent)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              {peopleWithoutConsent === 1
                ? 'person can still be shown a record nobody has consented to share'
                : 'people can still be shown a record nobody has consented to share'}
            </span>
            <span className={styles.findingDetail}>
              Named while the consent stood, and it no longer does: withdrawn, refused
              or never recorded. Nothing removes them when a consent changes, so this is
              a permission outliving what authorised it, across{' '}
              <span data-numeric>{formatCount(withoutConsent.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> residents and{' '}
              <span data-numeric>{formatCount(namedPeople)}</span> named people at{' '}
              {siteName}. Open the resident to remove anybody who should not have it.
            </span>
          </span>
        </div>
      </div>

      <Card>
        <div className={styles.filters}>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={[
                styles.filterTab,
                filter === entry.id ? styles.filterTabActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={filter === entry.id}
              data-filter={entry.id}
              onClick={() => onFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className={styles.errorBody} data-empty={filter}>
            Nothing matches this filter at {siteName}. That is a statement about this
            home today, not about the record.
          </p>
        ) : (
          <ul className={styles.rows}>
            {paged.shown.map((row: Row) => (
              <li key={row.resident.id}>
                <div className={styles.row} data-row={row.resident.id}>
                  <span className={styles.rowWho}>
                    <b>{row.resident.fullLegalName}</b>
                    <span
                      className={styles.rowMeta}
                      data-consent-state={row.consent.kind}
                    >
                      Consent {row.consent.kind.replace(/_/g, ' ')} ·{' '}
                      {row.members.length === 0 ? (
                        'nobody named'
                      ) : (
                        <span data-numeric>
                          {formatCount(row.members.length)} named
                        </span>
                      )}
                    </span>
                    {row.consent.kind !== 'given' && row.members.length > 0 ? (
                      <span data-row-finding="access-without-consent">
                        <Unrecorded
                          variant="chip"
                          label="Access without a consent"
                          detail={row.members
                            .map((member: FamilyMember) => currentDetails(member).name)
                            .join(', ')}
                        />
                      </span>
                    ) : null}
                  </span>
                  <Link
                    to={`/residents/${row.resident.id}/family`}
                    className={styles.blockedLink}
                    data-open-resident={row.resident.id}
                    aria-label={`Open Family Portal access for ${row.resident.fullLegalName}`}
                  >
                    Open
                    <Icon
                      name="arrows-sharp/arrow-right-01-sharp"
                      size={16}
                      aria-hidden
                    />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pager paged={paged} total={visible.length} noun="residents" />
      </Card>
    </>
  )
}
