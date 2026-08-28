import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { FuturePlans, Recorded, Resident, SignedEntry } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import type { FieldWidth } from './FieldList'
import { RecordedValueField } from './FieldList'
import { SignedValue } from './SignedValue'
import { ResuscitationPanel } from './ResuscitationPanel'
import { ClinicalChangeControl } from './ClinicalChangeControl'
import styles from './profile.module.css'

/**
 * Future Plans. PRD §6.2 — "DNAR, ADRT, advance care plan, preferred place of
 * care and death, funeral and religious preferences. Every entry date-stamped,
 * signed, version-controlled."
 *
 * All eight members of `FuturePlans` are declared and all eight render for
 * every resident. Absence from a list is the same bug as a blank cell, and on
 * this tab the omissions are the point: most residents have most of these
 * unrecorded, and a tab that showed only the completed ones would suggest a
 * person whose wishes are known.
 *
 * Ordered by when somebody needs them — what to do in an emergency, then where
 * this person wants to be, then what happens after they die. Not by how
 * complete the record is, and not alphabetically.
 *
 * `missingDetail` is doing more work here than anywhere else in the product.
 * "Preferred place of death not recorded" is a true statement about a form;
 * "nobody has asked where this person wants to die, so the default is hospital"
 * is the same fact with the consequence attached, and the consequence is what
 * makes somebody go and ask.
 */

export interface FuturePlanEntry {
  id: string
  label: string
  /** `full` for an entry whose answer is the person's own words rather than a
   *  place name. See ProfileField.width. */
  width?: FieldWidth
  isUnrecorded: (plans: FuturePlans) => boolean
  render: (profile: ResidentProfile) => ReactNode
}

export interface FuturePlansSection {
  id: string
  title: string
  /** One line, plain English, what this section is for. Never a bare count. */
  /**
   * Only where a reader would misread the section without it. Most headings
   * do not need one: a description that restates its own heading is a line
   * between the reader and the record.
   */
  description?: string
  /** A full-width panel above the fields. Only "In an emergency" has one. */
  banner?: (profile: ResidentProfile) => ReactNode
  entries: FuturePlanEntry[]
}

/**
 * The common shape: a `Recorded<SignedEntry<string>>` rendered as free text.
 *
 * Six of the eight entries are exactly this. The two that are not each have a
 * reason: the ADRT carries a document reference alongside its text, and the
 * resuscitation decision is not a `SignedEntry` at all — it is signed by a
 * clinician who is usually not a member of staff here, so it has its own
 * three-state union and renders as the banner.
 *
 * The reader is typed to the exact field type rather than to
 * `FuturePlans[keyof FuturePlans]`, so a field whose shape does not match is
 * a compile error at the call site instead of a cast in here.
 */
function signedText(
  read: (resident: Resident) => Recorded<SignedEntry<string>>,
  label: string,
  missingDetail: string,
) {
  return (profile: ResidentProfile) => (
    <RecordedValueField
      record={read(profile.resident)}
      label={label}
      missingDetail={missingDetail}
      attributed={false}
      render={(entry) => (
        <SignedValue
          entry={entry}
          render={(value) => <span className={styles.planText}>{value}</span>}
        />
      )}
    />
  )
}

export const FUTURE_PLANS_SECTIONS: FuturePlansSection[] = [
  {
    id: 'emergency',
    title: 'In an emergency',
    description:
      'What staff do if this person collapses. Both are checked before CPR is started.',
    banner: (profile) => (
      <ResuscitationPanel
        status={profile.resident.futurePlans.resuscitation}
        residentName={profile.resident.preferredName}
        siteName={profile.site.name}
      />
    ),
    entries: [
      {
        id: 'adrt',
        label: 'Advance decision to refuse treatment',
        isUnrecorded: (plans) => plans.adrt.kind === 'unrecorded',
        render: (profile) => (
          <>
            <RecordedValueField
              record={profile.resident.futurePlans.adrt}
              label="Advance decision to refuse treatment"
              // Not "this person has no ADRT". An ADRT that exists and has not
              // been recorded here is still legally binding, and treating an
              // unrecorded one as absent is how a refused treatment gets given.
              missingDetail="no ADRT is recorded, which is not the same as there being none, and an ADRT that exists is legally binding whether or not this screen knows about it"
              attributed={false}
              render={(entry) => (
                <SignedValue
                  entry={entry}
                  render={(adrt) => (
                    <>
                      <span className={styles.planText}>{adrt.text}</span>
                      {/*
                       * Live from Phase 11. It lands on the document library,
                       * where an ADRT whose id resolves to nothing renders as
                       * the broken reference it is rather than a dead link.
                       */}
                      <Link
                        to={`/residents/${profile.resident.id}/documents`}
                        className={styles.documentLink}
                        aria-label={`Open the advance decision document for ${profile.resident.preferredName}`}
                        data-document-link
                      >
                        Open document
                      </Link>
                    </>
                  )}
                />
              )}
            />
            <ClinicalChangeControl
              residentName={profile.resident.preferredName}
              siteName={profile.site.name}
              buttonLabel={
                profile.resident.futurePlans.adrt.kind === 'unrecorded'
                  ? 'Record an advance decision'
                  : 'Change this advance decision'
              }
              action={
                profile.resident.futurePlans.adrt.kind === 'unrecorded'
                  ? 'Record an advance decision to refuse treatment'
                  : 'Change the advance decision to refuse treatment'
              }
              description={
                profile.resident.futurePlans.adrt.kind === 'unrecorded'
                  ? `An ADRT is a legally binding refusal of specific treatment. Recording one changes what staff and paramedics may do for ${profile.resident.preferredName}, and every member of staff on shift at ${profile.site.name} is notified the moment it is recorded.`
                  : `An ADRT is a legally binding refusal of specific treatment. Changing it overrides a signed document about what may be done to ${profile.resident.preferredName}, and every member of staff on shift at ${profile.site.name} is notified the moment it changes.`
              }
              confirmLabel={
                profile.resident.futurePlans.adrt.kind === 'unrecorded'
                  ? 'Record advance decision'
                  : 'Change advance decision'
              }
              destructive={profile.resident.futurePlans.adrt.kind === 'recorded'}
            />
          </>
        ),
      },
      {
        id: 'advance-care-plan',
        label: 'Advance care plan',
        // Written in this person's own voice and usually a paragraph of it.
        width: 'full',
        isUnrecorded: (plans) => plans.advanceCarePlan.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.advanceCarePlan,
          'Advance care plan',
          'nobody has recorded what this person wants to happen as their health changes, in their own words',
        ),
      },
    ],
  },
  {
    id: 'where',
    title: 'Where this person wants to be',
    entries: [
      {
        id: 'place-of-care',
        label: 'Preferred place of care',
        isUnrecorded: (plans) => plans.preferredPlaceOfCare.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.preferredPlaceOfCare,
          'Preferred place of care',
          'nobody has asked where this person would rather be cared for as they become less well',
        ),
      },
      {
        id: 'place-of-death',
        label: 'Preferred place of death',
        isUnrecorded: (plans) => plans.preferredPlaceOfDeath.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.preferredPlaceOfDeath,
          'Preferred place of death',
          'nobody has asked where this person wants to die, and in the absence of an answer the ambulance is called and the answer becomes hospital',
        ),
      },
    ],
  },
  {
    id: 'after',
    title: 'After death',
    entries: [
      {
        id: 'funeral',
        label: 'Funeral preferences',
        isUnrecorded: (plans) => plans.funeralPreferences.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.funeralPreferences,
          'Funeral preferences',
          'nobody has recorded whether this person wanted burial or cremation, or whether anything is already arranged',
        ),
      },
      {
        id: 'religious',
        label: 'Religious preferences at the end of life',
        isUnrecorded: (plans) => plans.religiousPreferences.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.religiousPreferences,
          'Religious preferences',
          'nobody has recorded whether a priest, imam or other minister should be called, or how soon, and some of these cannot be done late',
        ),
      },
      {
        id: 'contact-on-death',
        label: 'Who to contact',
        isUnrecorded: (plans) => plans.contactOnDeath.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.contactOnDeath,
          'Who to contact',
          'nobody has recorded who should be told first, or in what order',
        ),
      },
    ],
  },
]

/** Every entry, flattened — what the guard iterates. */
export const FUTURE_PLAN_ENTRIES: FuturePlanEntry[] = FUTURE_PLANS_SECTIONS.flatMap(
  (section) => section.entries,
)
