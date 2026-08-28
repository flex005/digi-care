import { now as appNow } from '@/data/fixtures/clock'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Button, Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatCount, pluralise } from '@/lib/format'
import { Metric, groupTotals } from './GroupParts'
import { loadGroup, type GroupData, type SiteFigure } from './group-figures'
import styles from './group.module.css'

/**
 * All homes. PRD §6.7, Phase 15.
 *
 * The sentence: **where the two homes differ, then each home's own standing,
 * and never a group figure that hides a thin home inside a healthy one.**
 *
 * This is the only screen in the product whose subject is the organisation.
 * Everything else answers about a site, and comparing two meant switching,
 * reading, switching back and remembering — which is the one thing this could
 * not be got any other way.
 *
 * **There is no group rating and there will not be one.** A rating is a
 * judgement, judgements belong on the compliance panel per home, and a single
 * organisation figure would be the most reassuring thing this product could
 * render — most reassuring exactly when one home is thinnest.
 */
export function GroupOverviewRoute() {
  const { organisation, sites, setActiveSite } = useSession()
  const navigate = useNavigate()
  const [data, setData] = useState<GroupData | 'loading'>('loading')
  const totals = useMemo(
    () => groupTotals(data === 'loading' ? [] : data.cards),
    [data],
  )

  useEffect(() => {
    let live = true
    const now = appNow().toISOString() as IsoDateTime
    void loadGroup(sites, now).then((loaded) => {
      if (live) setData(loaded)
    })
    return () => {
      live = false
    }
  }, [sites])

  if (data === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading both homes…</p>
      </div>
    )
  }

  return (
    <div className={styles.page} data-group-overview>
      {/*
       * Across all homes, in figures rather than in a paragraph.
       *
       * Every one carries its denominator and every one is a count: a count
       * needs no population floor, which is what lets a four-resident home sit
       * in the same strip as a twenty-eight-resident one without either being
       * hidden inside a rate.
       */}
      <section className={styles.allHomes} data-all-homes>
        <div className={styles.allHomesHead}>
          <h2 className={styles.allHomesTitle}>Across all homes</h2>
          <p className={styles.allHomesMeta}>
            {pluralise(sites.length, 'home')} at {organisation.name}
          </p>
        </div>
        <div className={styles.metricRow}>
          <Metric
            label="Residents"
            value={totals.residents}
            of={pluralise(sites.length, 'home')}
          />
          {totals.rows.map((row) => (
            <Metric
              key={row.id}
              label={row.label}
              value={row.value}
              of={row.note}
              tone={row.tone}
            />
          ))}
        </div>
      </section>

      {/* Cards side by side. Two homes read as two homes; a table would read
          as a league — the Phase 13 constraint applied to sites. */}
      <div className={styles.sites}>
        {data.cards.map((card) => (
          <section key={card.site.id} className={styles.site} data-site={card.site.id}>
            <header className={styles.siteHead}>
              <div>
                <h2 className={styles.siteName}>{card.site.name}</h2>
                <p className={styles.siteMeta}>
                  {formatCount(card.residents)} residents · {card.site.timeZone}
                </p>
              </div>
              {card.thin ? (
                /*
                 * Said once, in the head, rather than on every row it affects.
                 * A tag repeated down a card is noise; a tag in the head is a
                 * property of the home.
                 */
                <span data-thin-tag>
                  <Unrecorded variant="chip" label="Too small for most rates" />
                </span>
              ) : null}
            </header>

            {/* Counts, not rates: a count needs no population floor, and
                counts are what a manager acts on. */}
            <div className={styles.metricGrid}>
              {card.rows.map((row) => (
                <Metric
                  key={row.id}
                  label={row.label}
                  value={row.value}
                  of={row.note}
                  tone={row.tone}
                  site={card.site.id}
                />
              ))}
            </div>

            <footer className={styles.siteFoot}>
              {/*
               * Switch the session to that home and go to its front door.
               * Changing the active site without moving left the reader on a
               * screen about every home, with no sign that the click had done
               * anything.
               */}
              <Button
                variant="secondary"
                data-open-site={card.site.id}
                onClick={() => {
                  setActiveSite(card.site)
                  navigate('/')
                }}
              >
                Open {card.site.name}
              </Button>
            </footer>
          </section>
        ))}
      </div>

      <Card>
        <div className={styles.groupHead}>
          <h2 className={styles.groupTitle}>Across both homes</h2>
          <p className={styles.groupNote}>
            Each figure names both homes, because a rate over{' '}
            {formatCount(totals.residents)} residents clears any population floor while
            hiding a {formatCount(totals.smallest)}-resident home inside it.
          </p>
        </div>

        <ul className={styles.groupRows}>
          {data.rows.map((row) => (
            <li key={row.id}>
              <div className={styles.groupRow} data-group-row={row.id}>
                <div>
                  <p className={styles.groupName}>{row.name}</p>
                  <p className={styles.groupSpread} data-spread>
                    {row.spread}
                  </p>
                </div>

                {row.perSite.map((figure) => (
                  <SiteCell key={figure.site.id} figure={figure} />
                ))}
              </div>
            </li>
          ))}
        </ul>

        {/* Inert, because nothing here is a gap anybody can close. */}
        <div className={styles.noRating} data-no-rating>
          <p>
            <b>There is no group rating on this screen, and there will not be one.</b> A
            rating is a judgement and judgements belong on the compliance panel, per
            home. A single figure for the organisation would be the most reassuring
            thing this product could render, and it would be most reassuring exactly
            when one home is thinnest: no arithmetic turns one home&rsquo;s Insufficient
            Evidence and another&rsquo;s amber into a number that means anything.
          </p>
        </div>
      </Card>
    </div>
  )
}

/**
 * One home's own standing on one question.
 *
 * A home that cannot support a rate gets the hatched chip — not a blank, which
 * would read as nothing to say, and not a zero, which would read as a finding.
 */
function SiteCell({ figure }: { figure: SiteFigure }) {
  if (figure.kind === 'insufficient') {
    return (
      <div data-site-figure={figure.site.id} data-figure="insufficient">
        <Unrecorded
          variant="chip"
          label={`${figure.site.name} · insufficient evidence`}
          detail={figure.why}
        />
      </div>
    )
  }

  return (
    <p
      className={styles.siteFigure}
      data-site-figure={figure.site.id}
      data-figure="measured"
    >
      <span className={styles.siteFigureValue} data-numeric>
        {formatCount(figure.percentage)}%
      </span>
      <span className={styles.siteFigureNote}>
        {figure.site.name} · {formatCount(figure.covered)} of{' '}
        {formatCount(figure.total)}
      </span>
    </p>
  )
}
