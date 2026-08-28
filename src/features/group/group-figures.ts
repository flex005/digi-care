import type { Aggregate, Site } from '@/data/types'
import { CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { minPopulationForARate } from '@/data/access/settings-store'
import { residentsBySite } from '@/data/fixtures/residents'
import { fellDueAt, marRecordsAll } from '@/data/fixtures/medications'
import { getIncidents, getRegister } from '@/data/access/client'
import { projectReviews } from '@/features/reviews/projection'
import { formatCount, pluralise, zonedDate } from '@/lib/format'
import type { IsoDateTime } from '@/data/types'

/**
 * What the two homes can be compared on. PRD §6.7, Phase 15.
 *
 * **Computed per site, always, and never averaged into a third figure.** A
 * rate over 32 residents clears any population floor while hiding a
 * four-resident home inside it — the number would be true and unreadable, and
 * it is the reassurance failure at a new scale.
 *
 * So every row here holds each site's own standing, and the group figure —
 * where there is one — carries its spread in the same sentence as the number.
 * Where both sites are below the floor **the group has none either**: a figure
 * assembled from two unusable ones is not usable.
 */

/** One site's answer to one question. */
export type SiteFigure =
  | { kind: 'measured'; site: Site; covered: number; total: number; percentage: number }
  | { kind: 'insufficient'; site: Site; covered: number; total: number; why: string }

export interface GroupRow {
  id: string
  name: string
  /** Both homes' figures, named, in one sentence with the group total. */
  spread: string
  perSite: SiteFigure[]
  /** Absent where no site can support a figure. */
  group: Aggregate | undefined
}

export interface SiteCounts {
  site: Site
  residents: number
  /** Counts rather than rates: a count needs no population floor. */
  rows: { id: string; label: string; note: string; value: number; tone: Tone }[]
  /** Too small to support most rates. Said once, in the card head. */
  thin: boolean
}

export type Tone = 'critical' | 'caution' | 'calm'

function figureFor(
  site: Site,
  covered: number,
  total: number,
  what: string,
): SiteFigure {
  if (total < minPopulationForARate()) {
    return {
      kind: 'insufficient',
      site,
      covered,
      total,
      // Through the owner: "1 routine counts" is the plural defect that has
      // shipped twice already (§6).
      why: `${pluralise(total, what)} is too few to support a rate of its own`,
    }
  }
  return {
    kind: 'measured',
    site,
    covered,
    total,
    percentage: Math.round((covered / total) * 100),
  }
}

const measured = (figures: SiteFigure[]) =>
  figures.filter(
    (figure): figure is Extract<SiteFigure, { kind: 'measured' }> =>
      figure.kind === 'measured',
  )

function groupFrom(figures: SiteFigure[]): Aggregate | undefined {
  const usable = measured(figures)
  /*
   * **No group figure where no site has one.** Summing two populations that
   * each cannot support a rate produces one that can, arithmetically, and it
   * would be a figure nobody could act on — the whole defect this screen is
   * built against.
   */
  if (usable.length === 0) return undefined

  const covered = figures.reduce((running, figure) => running + figure.covered, 0)
  const total = figures.reduce((running, figure) => running + figure.total, 0)
  return {
    kind: 'measured',
    unit: 'percentage',
    value: Math.round((covered / total) * 100),
    coverage: { covered, total },
  }
}

/** The sentence that makes a group number readable. */
function spreadOf(
  figures: SiteFigure[],
  group: Aggregate | undefined,
  noun: string,
): string {
  const named = figures.map((figure) =>
    figure.kind === 'measured'
      ? `${figure.site.name} ${formatCount(figure.covered)} of ${formatCount(figure.total)}`
      : `${figure.site.name} ${formatCount(figure.covered)} of ${formatCount(figure.total)}, which is too few to support a rate of its own`,
  )
  const unusable = figures.length - measured(figures).length

  if (group === undefined) {
    return `Neither home has enough ${noun} to support a rate, so the group has none either. A group figure assembled from two unusable ones is not usable.`
  }

  return `${formatCount(group.coverage.covered)} of ${formatCount(group.coverage.total)} across ${pluralise(figures.length, 'home')}${
    unusable === 0
      ? ''
      : `, of which ${formatCount(unusable)} cannot support a figure of its own`
  }. ${named.join('; ')}.`
}

export interface GroupData {
  sites: Site[]
  cards: SiteCounts[]
  rows: GroupRow[]
}

export async function loadGroup(sites: Site[], now: IsoDateTime): Promise<GroupData> {
  const perSite = await Promise.all(
    sites.map(async (site) => {
      const [incidents, register] = await Promise.all([
        getIncidents(site.id),
        getRegister(site.id),
      ])
      const residents = residentsBySite(site.id)
      const reviews = projectReviews(residents, now)
      const today = zonedDate(now, site.timeZone)

      let assessed = 0
      let finalised = 0
      for (const resident of residents) {
        for (const template of RISK_ASSESSMENT_TEMPLATES) {
          if (resident.risks[template.id]?.kind === 'assessed') assessed += 1
        }
        for (const domain of resident.carePlan) {
          if (domain.versions.kind === 'finalised') finalised += 1
        }
      }

      let dosesDue = 0
      let missed = 0
      for (const record of marRecordsAll) {
        if (!residents.some((resident) => resident.id === record.residentId)) continue
        const when = fellDueAt(record)
        if (when === 'not_due') continue
        if (zonedDate(when, site.timeZone) < shiftBack(today, 30)) continue
        dosesDue += 1
        if (record.state.kind === 'omitted') missed += 1
      }

      const routine = register.counts.filter((count) => count.entry.kind === 'routine')
      const reconciled = routine.filter(
        (count) =>
          count.entry.kind === 'routine' && count.entry.expected === count.counted,
      ).length

      const overdueReviews = reviews.items.filter(
        (item) => item.standing.kind === 'overdue',
      ).length
      const unacknowledged = incidents.incidents.filter(
        (incident) => incident.status.kind === 'reported_not_acknowledged',
      ).length

      return {
        site,
        residents,
        assessed,
        finalised,
        dosesDue,
        missed,
        routine: routine.length,
        reconciled,
        overdueReviews,
        unacknowledged,
        incidents: incidents.incidents.length,
      }
    }),
  )

  const cards: SiteCounts[] = perSite.map((entry) => ({
    site: entry.site,
    residents: entry.residents.length,
    // A home too small to support most rates says so once, in its head.
    thin: entry.residents.length < minPopulationForARate(),
    rows: [
      {
        id: 'overdue-reviews',
        label: 'Reviews past their date',
        note: `across ${pluralise(entry.residents.length, 'resident')}`,
        value: entry.overdueReviews,
        tone: entry.overdueReviews > 0 ? 'critical' : 'calm',
      },
      {
        id: 'missed-doses',
        label: 'Doses with no record',
        note: `of ${formatCount(entry.dosesDue)} due in 30 days`,
        value: entry.missed,
        tone: entry.missed > 0 ? 'caution' : 'calm',
      },
      {
        id: 'unacknowledged',
        label: 'Unacknowledged incidents',
        note: `of ${formatCount(entry.incidents)} on record`,
        value: entry.unacknowledged,
        tone: entry.unacknowledged > 0 ? 'caution' : 'calm',
      },
      {
        id: 'never-assessed',
        label: 'Risks never assessed',
        note: `of ${formatCount(entry.residents.length * RISK_ASSESSMENT_TEMPLATES.length)} expected`,
        value:
          entry.residents.length * RISK_ASSESSMENT_TEMPLATES.length - entry.assessed,
        tone: 'caution',
      },
    ],
  }))

  const rows: GroupRow[] = [
    row(
      'doses-recorded',
      'Doses with a record against them',
      'doses',
      perSite,
      (entry) => ({
        covered: entry.dosesDue - entry.missed,
        total: entry.dosesDue,
        what: 'dose in 30 days',
      }),
    ),
    row(
      'risks-assessed',
      'Risk assessments completed',
      'assessments',
      perSite,
      (entry) => ({
        covered: entry.assessed,
        total: entry.residents.length * RISK_ASSESSMENT_TEMPLATES.length,
        what: 'expected assessment',
      }),
    ),
    row(
      'plans-written',
      'Care plan domains ever written',
      'domains',
      perSite,
      (entry) => ({
        covered: entry.finalised,
        total: entry.residents.length * CARE_PLAN_DOMAINS.length,
        what: 'expected domain',
      }),
    ),
    row(
      'cd-reconciled',
      'Controlled drug counts that reconcile',
      'counts in 30 days',
      perSite,
      (entry) => ({
        covered: entry.reconciled,
        total: entry.routine,
        what: 'routine count',
      }),
    ),
  ]

  return { sites, cards, rows }
}

function row(
  id: string,
  name: string,
  noun: string,
  entries: {
    site: Site
    residents: unknown[]
    assessed: number
    finalised: number
    dosesDue: number
    missed: number
    routine: number
    reconciled: number
  }[],
  pick: (entry: (typeof entries)[number]) => {
    covered: number
    total: number
    what: string
  },
): GroupRow {
  const perSite = entries.map((entry) => {
    const { covered, total, what } = pick(entry)
    return figureFor(entry.site, covered, total, what)
  })
  const group = groupFrom(perSite)
  return { id, name, spread: spreadOf(perSite, group, noun), perSite, group }
}

const shiftBack = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00.000Z`).getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10)
