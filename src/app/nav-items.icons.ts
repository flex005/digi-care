import type { IconName } from '@/components/icon/registry.names.generated'
import type { TermId, Vocabulary } from '@/lib/vocabulary'

/**
 * The left sidebar. PRD §4.7.
 *
 * All seventeen items are listed from Phase 0 onward, in this order, and the
 * ones whose module is not yet built are present but disabled with a "Coming
 * in a later phase" tooltip — so the shell does not change shape as phases
 * land, and nobody has to relearn where things are.
 *
 * This file is named *.icons.ts deliberately: the icon usage scanner treats
 * every icon-shaped string literal in a *.icons.ts file as a used icon name,
 * which is how names that are not written inline in JSX still make it into
 * the generated registry. See scripts/icons/scan-usage.mjs.
 */

export interface NavItem {
  /**
   * What the item is called, for every item whose name is fixed.
   *
   * **`subject` is the exception and it names a form, not a word.** The
   * Residents module is called whatever this organisation calls the people it
   * serves, and two renderers show that label — the sidebar and the
   * permission matrix. Having each substitute the word itself would be two
   * owners of one term; declaring which *form* the label needs leaves the
   * word with `Term` and the choice of form with the item.
   */
  label: string
  /**
   * Which term and which form this item's name comes from, where it is not
   * fixed. Two renderers show these labels — the sidebar and the permission
   * matrix — so declaring the form here keeps the word with the vocabulary
   * and the choice of form with the item, rather than each renderer
   * substituting and the two drifting.
   */
  term?: { id: TermId; form: 'One' | 'Many' }
  path: string
  icon: IconName
  /** The phase in FRONTEND_PRD.md §8 that builds this module. */
  phase: number
  /** False until that phase lands. Disabled items stay visible. */
  enabled: boolean
  /** Which section heading this item sits under. */
  section: NavSectionId
}

/**
 * Section headings. §4.7 gives the sidebar's order and this preserves it
 * exactly — the headings are inserted at boundaries that already fall in that
 * sequence, so nothing is reordered. They exist because seventeen unbroken
 * rows is a wall: a manager looking for Consent should not have to read
 * sixteen labels to find out it is there. `navItems.length` is the count that
 * matters; prose repeating it goes stale, as this comment did.
 */
export type NavSectionId = 'overview' | 'delivery' | 'planning' | 'governance' | 'admin'

export interface NavSection {
  id: NavSectionId
  /** Empty for the first group, which needs no heading above one item. */
  label: string
}

/**
 * Labels whose inner capital is correct, because they are names.
 *
 * **Sentence case is this build's convention and the shell was the last place
 * still breaking it.** The group headings here were always sentence case —
 * 'Care delivery', 'Planning and risk' — and the item labels were title case,
 * and the two sat in one file without anybody noticing. The reason is the same
 * one that hid it in the vocabulary: nine of the items are single words, and a
 * single word is the same string in both conventions. Only a multi-word label
 * can tell them apart, and until the vocabulary produced some there were
 * almost none.
 *
 * "Family Portal" is a separate product with its own PRD and its own UI
 * (CLAUDE.md, Scope). It is a name, not a description of a section, so its
 * capital is right. `scripts/check-shell-labels.mjs` reads this list in both
 * directions: a label with an inner capital that is not named here fails, and
 * a name here that has no inner capital fails too, so an entry cannot go stale
 * and keep excusing something.
 */
export const PRODUCT_NAMES_IN_LABELS: readonly string[] = ['Family Portal']

export const navSections: NavSection[] = [
  { id: 'overview', label: '' },
  { id: 'delivery', label: 'Care delivery' },
  { id: 'planning', label: 'Planning and risk' },
  { id: 'governance', label: 'Governance' },
  { id: 'admin', label: 'Administration' },
]

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    // The front door, not a screen beside it. The index route *is* the
    // Dashboard, so the item points at `/` rather than at a second URL for
    // the same screen.
    path: '/',
    icon: 'dashboard/dashboard-square-01',
    phase: 12,
    enabled: true,
    section: 'overview',
  },
  {
    label: 'Residents',
    term: { id: 'subject', form: 'Many' },
    path: '/residents',
    icon: 'users/user-multiple',
    phase: 1,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Care notes',
    path: '/care-notes',
    icon: 'note-task/note-01',
    phase: 2,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    phase: 2,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Medications',
    term: { id: 'medication', form: 'Many' },
    path: '/medications',
    icon: 'medical/medicine-01',
    phase: 3,
    enabled: true,
    section: 'delivery',
  },
  {
    /*
     * **"Incidents" is fixed, and the Incident Report term reaches the records
     * inside it.** The module is named for the events — a fall, a medication
     * error — and every option of that term names the *record* of one. The
     * difference showed up as a default the product never chose: declaring
     * `term: { id: 'incidentReport', form: 'Many' }` here renamed the sidebar
     * item to "Incident Reports" for every home on the default vocabulary,
     * which is a copy change wearing a configuration change's clothes. Two
     * other sweeps of this phase reached the same reading independently, in
     * `permissions.ts` ("reporting an incident" is the act) and in the review
     * outcomes ("Incident raised" is the event).
     *
     * The term reaches the log's heading and its "New …" control instead,
     * which are about the records.
     */
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    phase: 4,
    enabled: true,
    section: 'planning',
  },
  {
    /*
     * **No declared form, and the reason is the qualifier.** "Assessment" is
     * configurable, and the options are Assessment, Clinical Assessment and
     * Care Assessment — none of which composes behind "Risk": "Risk Care
     * Assessments" is not a phrase. Dropping the qualifier instead would read
     * as every assessment in the product, and this module is not the capacity
     * assessment behind a consent. So the module keeps its name, and the term
     * reaches the sentences inside it.
     */
    label: 'Risk assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    phase: 5,
    enabled: true,
    section: 'planning',
  },
  {
    /* The fallback, which `navLabel` only reaches if the term above is ever
       removed — so it is sentence case like every other fixed label rather
       than a title-case string waiting to come back. */
    label: 'Care plans',
    term: { id: 'carePlan', form: 'Many' },
    path: '/care-plans',
    icon: 'education/clipboard',
    phase: 7,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Reviews',
    path: '/reviews',
    icon: 'date-and-time/calendar-01',
    phase: 7,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    phase: 8,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    phase: 9,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    phase: 10,
    enabled: true,
    section: 'governance',
  },
  {
    /*
     * **A product's name, not this service's word for relatives.** The `family`
     * term renames the people; the Family Portal is a separate product with its
     * own PRD and its own UI, and it is called that whatever this home calls
     * next of kin.
     */
    label: 'Family Portal',
    path: '/family',
    icon: 'users/user-sharing',
    phase: 26,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    phase: 11,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: 'check-validation/checkmark-badge-01',
    phase: 12,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'business-and-finance/analytics-01',
    phase: 13,
    enabled: true,
    section: 'governance',
  },
  /*
   * **One entry for the whole administrative area.** Team, homes and the
   * figures this build runs on were three sidebar items and are three tabs
   * under this one: they are all things a manager configures rather than
   * things a manager does during a shift, and the sidebar's job is the second
   * list. Nothing was removed — each screen keeps its route under /settings.
   */
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings/setting-02',
    phase: 15,
    enabled: true,
    section: 'admin',
  },
]

/** Icons the shell itself uses, outside the nav list. */
export const shellIcons = {
  /*
   * The product mark is not here. It was `medical/healtcare` — a stethoscope
   * standing in until there was a real one — and a stand-in that outlives the
   * thing it stood in for is indistinguishable from a decision. The mark is
   * now `src/assets/brand/`, rendered by `<Logo />`, and it is not an icon:
   * the registry is single-colour and normalised to `currentColor`, which
   * would flatten a two-tone lockup.
   */
  search: 'search/search',
  alerts: 'alert-notification/notification-02',
  siteSwitcher: 'arrows-sharp/arrow-down-01-sharp',
  collapseSidebar: 'dashboard/sidebar-left',
  /** The app switcher grid — 3x3 circles, the launcher glyph. Not
   *  dashboard/dashboard-square-01, which the Dashboard nav item wears. */
  appSwitcher: 'more-menu/more-02',
} satisfies Record<string, IconName>

/**
 * The prototype's status kitchen sink at /dev/states. Not a product module, so
 * it is not in `navItems` and no structural guard counts it — but it is
 * declared here rather than in the sidebar because this file is what the icon
 * usage scanner reads. An icon name written in a plain object literal in a
 * .tsx file is invisible to the JSX scan, drops out of the generated registry,
 * and throws when the component renders. That is how this landed here.
 */
export const devStatesItem: NavItem = {
  label: 'Status states',
  path: '/dev/states',
  icon: 'check-validation/validation',
  phase: 0,
  enabled: true,
  section: 'overview',
}

/**
 * What a nav item is called, with the vocabulary in force.
 *
 * **One owner of the resolution, not just of the word.** `label` and `term`
 * are two ways of naming the same thing and something has to choose between
 * them. That choice was written out in the sidebar and again in the permission
 * matrix — the two renderers the `term` field's own docblock names as the
 * reason it exists — and it was about to be written a third time in the tests
 * and a fourth in the activity log. A rule stated in four places is the §6
 * defect the `term` field was introduced to prevent, one level up: the word has
 * an owner and the choice of word did not.
 *
 * It is also what the activity log and the document library have to call: both
 * restate module names ("Care Plans", "Medications") as their own string
 * constants, and a second spelling of one module's name is two owners of it.
 */
export function navLabel(item: NamedByTerm, terms: Vocabulary): string {
  return item.term === undefined ? item.label : terms[item.term.id][item.term.form]
}

/**
 * The two fields a label is resolved from, and nothing else.
 *
 * Named structurally rather than as `NavItem` because the permission matrix
 * does not hold nav items: `PERMISSION_MODULES` projects each one down to an
 * id, a label and a term. Asking for the whole item would make the narrower
 * caller restate the rule, which is the thing this function exists to stop.
 */
export interface NamedByTerm {
  label: string
  term?: { id: TermId; form: 'One' | 'Many' } | undefined
}

/**
 * A module's name, resolved from the item that declares it.
 *
 * **Keyed by path, so a wrong key throws rather than rendering plausibly.**
 * Two modules outside the sidebar restate these names as their own string
 * constants — the staff activity log's `module` and the document library's
 * `origin` — and both say in their own docblocks that the nav declaration owns
 * the wording. That was true while every label was fixed. Now that Medications
 * and Care Plans take a configured term, a restated copy is a second owner
 * that silently stops agreeing: the sidebar would say "Care & support plans"
 * and the activity log beside it "Care Plans", with nothing failing.
 */
export function moduleName(path: string, terms: Vocabulary): string {
  const item = navItems.find((entry) => entry.path === path)
  if (item === undefined) throw new Error(`No nav item declares the module ${path}`)
  return navLabel(item, terms)
}
