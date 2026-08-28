import type { ConsentTypeId } from '@/data/types'

/**
 * What consenting to each type actually permits, in plain English.
 *
 * **A consent nobody can explain is not informed**, and this line is the
 * difference between a record of consent and a record of a signature. It is
 * declared as a complete map over the constant, so a ninth consent type is a
 * compile error rather than a row with a blank where the explanation goes.
 *
 * Written to the reader rather than about the resident: "staff holding and
 * giving your medicines", not "administration of prescribed medication".
 */
export const CONSENT_MEANS: Record<ConsentTypeId, string> = {
  care_and_support:
    'Day-to-day personal care: help with washing, dressing and moving about.',
  medication:
    'Staff holding and giving their medicines rather than them managing their own.',
  photography:
    'Photographs in the home, on the noticeboards, and in the Family Portal.',
  data_sharing:
    'Sharing their records with the GP, district nurses and the local authority.',
  family_portal: 'Named family seeing their care records through the Family Portal.',
  research_audit: 'Their anonymised records being used in service audits and research.',
  medical_treatment:
    'Routine treatment arranged through the home, such as a flu vaccination.',
  electronic_records: 'Their care being recorded in this system rather than on paper.',
}
