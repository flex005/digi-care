import type {
  DocumentCategoryId,
  DocumentId,
  DocumentRecord,
  ExpiryDecision,
  IsoDate,
  Resident,
  ResidentId,
  SiteId,
  StaffRef,
} from '../types'
import { medicationsFor } from './medications'
import { carersAndSeniors, managers, sites, staffNwosu } from './organisation'
import { residents } from './residents'
import { daysAgo, daysAhead, makeRandom, toIsoDate } from './generate'

/**
 * The document library. PRD §6.7, Phase 11.
 *
 * Its own random stream, so adding a document cannot move a care note or a
 * medication round.
 *
 * **What this set has to produce**, or the screens cannot be reviewed:
 * every expiry state including the two that are decisions rather than dates,
 * categories that are quietly empty, categories another module says should not
 * be empty, and references from other modules that resolve to nothing. Each is
 * a branch on a screen, and a branch no fixture reaches is a branch nobody has
 * seen.
 */

const rng = makeRandom(0xd0c5f100)

/** Of documents that could carry an expiry date, how many have one recorded. */
const HAS_EXPIRY_DATE = 0.46
/** Of the rest, how many carry a recorded decision that they do not expire. */
const RECORDED_PERMANENT = 0.55
/** Of dated documents, how many have already lapsed. */
const ALREADY_EXPIRED = 0.14
/** Of the dated documents still valid, how many fall inside the window. */
const INSIDE_WINDOW = 0.16
/** Of ids referenced by other modules, how many resolve to a document. */
const REFERENCE_RESOLVES = 0.78

/**
 * Titles by category, so a library reads like a library rather than a table
 * of "Document 4". Deliberately uneven: some categories hold many kinds of
 * thing, some hold one.
 */
const TITLES: Record<DocumentCategoryId, string[]> = {
  legal_authority: ['Court of Protection order', 'Deputyship order'],
  identity_admission: [
    'Admission agreement, signed',
    'Photographic ID',
    'Funding authority: local authority',
    'NHS number confirmation',
  ],
  health_clinical: [
    'GP summary care record',
    'Hospital discharge summary',
    'Outpatient clinic letter',
    'Dietitian assessment',
    'Podiatry report',
    'Optician report',
  ],
  assessments_care_planning: [
    'Pre-admission assessment',
    'Moving and handling assessment',
    'Care plan, signed copy',
  ],
  consent_records: [
    'Consent to care and support, signed',
    'Consent to share information, signed',
    'Photography consent form',
  ],
  correspondence: [
    'Letter from family: visiting arrangements',
    'Email from social worker',
    'Letter from GP practice',
    'Complaint response',
  ],
  photographs_media: [
    'Photograph: resident portrait',
    'Photograph: activities session',
  ],
}

/**
 * How likely a resident has anything at all in a category.
 *
 * **Uneven on purpose.** Photographs and media is thin because most homes
 * never file one, and that is exactly the category where an empty section has
 * to still be listed — a library that only shows what it holds cannot show
 * what it does not.
 */
const FILL: Record<DocumentCategoryId, number> = {
  legal_authority: 0.3,
  identity_admission: 0.82,
  health_clinical: 0.88,
  assessments_care_planning: 0.55,
  consent_records: 0.62,
  correspondence: 0.44,
  photographs_media: 0.18,
}

const FORMATS = ['PDF', 'PDF', 'PDF', 'JPG', 'DOCX']

function fileOf(): { kind: 'described'; format: string; bytes: number } {
  return {
    kind: 'described',
    format: rng.pick(FORMATS),
    bytes: rng.int(90, 4200) * 1024,
  }
}

/**
 * An expiry decision, drawn rather than defaulted.
 *
 * The three members are drawn in one place so the spread is visible and
 * nothing falls through to `not_recorded` because a branch forgot it. A
 * fallback into the unrecorded member would make every gap on this screen an
 * artefact of the generator rather than a fact about the home.
 */
function expiryOf(filedOn: IsoDate, decidedBy: StaffRef): ExpiryDecision {
  if (rng.chance(HAS_EXPIRY_DATE)) {
    if (rng.chance(ALREADY_EXPIRED)) {
      return { kind: 'expires', on: toIsoDate(daysAgo(rng.int(2, 240))) }
    }
    if (rng.chance(INSIDE_WINDOW)) {
      return { kind: 'expires', on: toIsoDate(daysAhead(rng.int(1, 29))) }
    }
    return { kind: 'expires', on: toIsoDate(daysAhead(rng.int(45, 900))) }
  }
  if (rng.chance(RECORDED_PERMANENT)) {
    return { kind: 'does_not_expire', decidedBy, on: filedOn }
  }
  return { kind: 'not_recorded' }
}

let sequence = 0
const nextId = (): DocumentId => {
  sequence += 1
  return `doc-lib-${String(sequence).padStart(4, '0')}` as DocumentId
}

const filedBy = (): StaffRef =>
  rng.chance(0.4) ? rng.pick(managers) : rng.pick(carersAndSeniors)

function documentFor(
  resident: Resident,
  category: DocumentCategoryId,
  title: string,
  id: DocumentId = nextId(),
): DocumentRecord {
  const staff = filedBy()
  const filedOn = toIsoDate(daysAgo(rng.int(20, 700)))
  return {
    id,
    owner: { kind: 'resident', residentId: resident.id },
    category,
    title,
    file: fileOf(),
    expiry: expiryOf(filedOn, staff),
    filedBy: staff,
    filedOn,
  }
}

/**
 * The ids other modules already hold, and what they say about them.
 *
 * These were written across four phases with nothing behind them — a DNAR's
 * `documentId`, an ADRT's, an LPA's, a scanned prescription's. This is where
 * they either become a document or become a finding; there is no third option
 * where the id quietly means nothing.
 */
interface ReferencedId {
  id: DocumentId
  category: DocumentCategoryId
  title: string
}

export function referencedIds(resident: Resident): ReferencedId[] {
  const found: ReferencedId[] = []

  const resuscitation = resident.futurePlans.resuscitation
  if (resuscitation.kind === 'dnar_in_place') {
    found.push({
      id: resuscitation.documentId,
      category: 'legal_authority',
      title: 'DNAR form',
    })
  }

  const adrt = resident.futurePlans.adrt
  if (adrt.kind === 'recorded') {
    found.push({
      id: adrt.value.value.documentId,
      category: 'legal_authority',
      title: 'Advance Decision to Refuse Treatment',
    })
  }

  const lpa = resident.importantPeople.lpaHolder
  if (lpa.kind === 'recorded') {
    found.push({
      id: lpa.value.documentId,
      category: 'legal_authority',
      title: `Lasting Power of Attorney: ${lpa.value.lpaType === 'health_and_welfare' ? 'health and welfare' : 'property and financial affairs'}`,
    })
  }

  for (const medication of medicationsFor(resident.id)) {
    if (medication.prescriptionDocument.kind === 'on_file') {
      found.push({
        id: medication.prescriptionDocument.documentId,
        category: 'health_clinical',
        title: `Prescription: ${medication.name}`,
      })
    }
  }

  return found
}

const residentDocuments: DocumentRecord[] = []

for (const resident of residents) {
  /*
   * Referenced ids first, so the ordinary documents are drawn from what is
   * left. A resident whose DNAR is not on file still has a Legal and authority
   * section — it is the section that carries the finding.
   */
  for (const reference of referencedIds(resident)) {
    if (!rng.chance(REFERENCE_RESOLVES)) continue
    residentDocuments.push(
      documentFor(resident, reference.category, reference.title, reference.id),
    )
  }

  for (const [category, chance] of Object.entries(FILL) as [
    DocumentCategoryId,
    number,
  ][]) {
    if (!rng.chance(chance)) continue
    const pool = TITLES[category]
    for (const title of rng.sample(pool, rng.int(1, Math.min(3, pool.length)))) {
      residentDocuments.push(documentFor(resident, category, title))
    }
  }
}

/**
 * The home's own documents — the other half of the organisation library.
 *
 * Insurance and registration are the ones that expire, which is why the
 * organisation library leads on expiry rather than on volume: a home whose
 * employer's liability certificate lapsed is not a filing problem.
 */
const SITE_DOCUMENTS: { category: DocumentCategoryId; title: string }[] = [
  { category: 'legal_authority', title: 'CQC registration certificate' },
  { category: 'legal_authority', title: "Employer's liability insurance" },
  { category: 'legal_authority', title: 'Public liability insurance' },
  { category: 'identity_admission', title: 'Statement of purpose' },
  { category: 'identity_admission', title: 'Service user guide' },
  { category: 'health_clinical', title: 'Infection prevention and control policy' },
  { category: 'health_clinical', title: 'Medicines management policy' },
  { category: 'assessments_care_planning', title: 'Fire risk assessment' },
  { category: 'assessments_care_planning', title: 'Legionella risk assessment' },
  { category: 'correspondence', title: 'Local authority quality assurance visit' },
]

const siteDocuments: DocumentRecord[] = []

for (const site of sites) {
  for (const entry of SITE_DOCUMENTS) {
    const staff = rng.pick(managers)
    const filedOn = toIsoDate(daysAgo(rng.int(30, 500)))
    siteDocuments.push({
      id: nextId(),
      owner: { kind: 'site', siteId: site.id },
      category: entry.category,
      title: entry.title,
      file: fileOf(),
      expiry: expiryOf(filedOn, staff),
      filedBy: staff,
      filedOn,
    })
  }
}

/**
 * Pinned: a DNACPR in force on the badge strip, whose document has lapsed.
 *
 * **Deliberate, and not a fixture that needs correcting.** Some DNACPR
 * decisions are genuinely time-limited pending review, so a resuscitation
 * decision the profile still shows as in force, resting on a document that
 * expired three months ago, is a real and serious situation rather than a
 * contradiction. It is exactly what somebody should meet in review.
 *
 * It arrived by accident of the spread and would have vanished on a re-roll,
 * which is the whole argument for pinning it: a case worth meeting is a case
 * that has to be there every run.
 *
 * **Three months, not the seven the spread happened to draw.** Emmanuel's DNAR
 * was signed 180 days ago, and a document cannot lapse before the decision it
 * records was made — the accident was incoherent as well as unrepeatable. The
 * expiry sits after the signature and before today, which is the situation the
 * screen is for.
 *
 * Written literally rather than drawn, so the random stream is untouched and
 * every other document in this file is exactly where it was.
 */
const OKAFOR_DNAR = 'doc-dnar-0041' as DocumentId
const okaforDnarExpiry: ExpiryDecision = {
  kind: 'expires',
  on: toIsoDate(daysAgo(92)),
}

const okafor = residents.find((resident) => resident.id === 'res-okafor')
if (okafor === undefined) throw new Error('The pinned DNAR case needs res-okafor')
if (okafor.futurePlans.resuscitation.kind !== 'dnar_in_place') {
  throw new Error('The pinned DNAR case needs a DNAR in place for res-okafor')
}

const onFileAlready = residentDocuments.find((record) => record.id === OKAFOR_DNAR)
if (onFileAlready) {
  onFileAlready.expiry = okaforDnarExpiry
} else {
  residentDocuments.push({
    id: OKAFOR_DNAR,
    owner: { kind: 'resident', residentId: okafor.id },
    category: 'legal_authority',
    title: 'DNAR form',
    file: { kind: 'described', format: 'PDF', bytes: 512 * 1024 },
    expiry: okaforDnarExpiry,
    filedBy: staffNwosu,
    filedOn: okafor.futurePlans.resuscitation.signedOn,
  })
}

export const documents: DocumentRecord[] = [...residentDocuments, ...siteDocuments]

export function documentsForResident(residentId: ResidentId): DocumentRecord[] {
  return documents.filter(
    (document) =>
      document.owner.kind === 'resident' && document.owner.residentId === residentId,
  )
}

/**
 * Every document at a site — the residents' and the home's together.
 *
 * The organisation library is the whole site's holding, not the home's own
 * policies in isolation: a coverage figure that excluded 291 resident
 * documents and reported on ten policies would be a rate about the easy half.
 */
export function documentsForSite(siteId: SiteId): DocumentRecord[] {
  const here = new Set(
    residents.filter((resident) => resident.siteId === siteId).map((r) => r.id),
  )
  return documents.filter((document) =>
    document.owner.kind === 'site'
      ? document.owner.siteId === siteId
      : here.has(document.owner.residentId),
  )
}
