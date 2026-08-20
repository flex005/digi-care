/**
 * The closed reference lists, from the source PRD.
 *
 * These exist as constants rather than as whatever happens to be in the data,
 * because **absence from a list is the same bug as a blank cell**
 * (CLAUDE.md §1). All ten risk assessment templates are listed even if none
 * has been completed. All eight consent types. All ten care plan domains.
 * A screen iterates the constant and looks up what it has; it never iterates
 * what it has and calls that the list.
 */

/** The ten built-in risk assessment templates. Source PRD §4.3. */
export const RISK_ASSESSMENT_TEMPLATES = [
  { id: 'falls', name: 'Falls Risk', framework: 'Morse Fall Scale' },
  { id: 'pressure_ulcer', name: 'Pressure Ulcer Risk', framework: 'Waterlow Score' },
  {
    id: 'nutrition',
    name: 'Nutritional Risk',
    framework: 'MUST (Malnutrition Universal Screening Tool)',
  },
  {
    id: 'moving_handling',
    name: 'Moving and Handling',
    framework: 'Manual Handling Operations Regulations assessment',
  },
  {
    id: 'mental_capacity',
    name: 'Mental Capacity',
    framework: 'Mental Capacity Act 2005 two-stage test',
  },
  { id: 'skin_integrity', name: 'Skin Integrity', framework: 'Braden Scale' },
  { id: 'choking', name: 'Choking and Dysphagia', framework: 'IDDSI Framework' },
  {
    id: 'behaviour',
    name: 'Behaviour Support',
    framework: 'ABC (Antecedent-Behaviour-Consequence) chart',
  },
  {
    id: 'environmental',
    name: 'Environmental Risk',
    framework: 'Custom template, configurable per organisation',
  },
  {
    id: 'coshh',
    name: 'COSHH (Cleaning Products)',
    framework: 'UK COSHH Regulations template',
  },
] as const

export type RiskTemplateId = (typeof RISK_ASSESSMENT_TEMPLATES)[number]['id']

/** The eight consent types. Source PRD §19.2. */
export const CONSENT_TYPES = [
  { id: 'care_and_support', name: 'Care and Support' },
  { id: 'medication', name: 'Medication Administration' },
  { id: 'photography', name: 'Photography and Video' },
  { id: 'data_sharing', name: 'Data Sharing' },
  { id: 'family_portal', name: 'Family Portal Access' },
  { id: 'research_audit', name: 'Research and Audit' },
  { id: 'medical_treatment', name: 'Medical Treatment' },
  { id: 'electronic_records', name: 'Electronic Records' },
] as const

export type ConsentTypeId = (typeof CONSENT_TYPES)[number]['id']

/** The ten care plan domains. Source PRD §3. */
export const CARE_PLAN_DOMAINS = [
  { id: 'personal_care', name: 'Personal Care and Hygiene' },
  { id: 'nutrition', name: 'Nutrition and Hydration' },
  { id: 'mobility', name: 'Mobility and Moving and Handling' },
  { id: 'continence', name: 'Continence' },
  { id: 'communication', name: 'Communication' },
  { id: 'cognitive', name: 'Cognitive and Mental Health' },
  { id: 'social_emotional', name: 'Social and Emotional Wellbeing' },
  { id: 'end_of_life', name: 'End of Life' },
  { id: 'physical_health', name: 'Physical Health' },
  { id: 'medication', name: 'Medication' },
] as const

export type CarePlanDomainId = (typeof CARE_PLAN_DOMAINS)[number]['id']

/**
 * The five need groups shown on the Needs tab, each generated from the care
 * plan domains it draws on. Source PRD §16.2.
 */
export const NEED_GROUPS = [
  {
    id: 'physical',
    name: 'Physical care needs',
    domains: ['personal_care', 'mobility', 'continence', 'nutrition'],
  },
  {
    id: 'cognitive',
    name: 'Cognitive and mental health needs',
    domains: ['cognitive'],
  },
  {
    id: 'social',
    name: 'Social and emotional needs',
    domains: ['social_emotional'],
  },
  {
    id: 'communication',
    name: 'Communication needs',
    domains: ['communication'],
  },
  {
    id: 'clinical',
    name: 'Clinical needs',
    domains: ['medication', 'physical_health'],
  },
] as const satisfies ReadonlyArray<{
  id: string
  name: string
  domains: ReadonlyArray<CarePlanDomainId>
}>

/** The eight care note categories. Source PRD §16 (care notes). */
export const CARE_NOTE_CATEGORIES = [
  { id: 'personal_care', name: 'Personal Care' },
  { id: 'nutrition', name: 'Nutrition and Hydration' },
  { id: 'mobility', name: 'Mobility' },
  { id: 'medication', name: 'Medication' },
  { id: 'social_emotional', name: 'Social and Emotional' },
  { id: 'health_observation', name: 'Health Observation' },
  { id: 'behaviour', name: 'Behaviour' },
  { id: 'general', name: 'General' },
] as const

export type CareNoteCategoryId = (typeof CARE_NOTE_CATEGORIES)[number]['id']

/** Funding sources. Source PRD §16.2. */
export const FUNDING_SOURCES = [
  { id: 'local_authority', name: 'Local authority' },
  { id: 'nhs_continuing_care', name: 'NHS continuing care' },
  { id: 'self_funded', name: 'Self-funded' },
  { id: 'insurance', name: 'Insurance' },
] as const

export type FundingSourceId = (typeof FUNDING_SOURCES)[number]['id']

/** How a contact prefers to be reached. Source PRD §16.2. */
export const CONTACT_METHODS = [
  { id: 'phone', name: 'Phone' },
  { id: 'email', name: 'Email' },
  { id: 'letter', name: 'Letter' },
  { id: 'in_person', name: 'In person' },
] as const

export type ContactMethodId = (typeof CONTACT_METHODS)[number]['id']
