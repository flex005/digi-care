import type { CareNoteCategoryId } from '@/data/types'

/**
 * Category-based suggested phrases for the composer. PRD §6.3.
 *
 * **Openers, not answers.** Every one is a fragment that has to be finished:
 * "Ate ", "Declined ", "Observations taken: ". A suggestion that completes a
 * sentence gets pressed instead of typed, and a care record filled with
 * identical sentences is a record nobody wrote — it looks like evidence and
 * contains none.
 *
 * That is why none of these carries a judgement either. There is no "settled
 * throughout" and no "no concerns": those are findings, and a button that
 * writes a finding is a button that records something nobody observed.
 */
export const SUGGESTED_PHRASES: Record<CareNoteCategoryId, string[]> = {
  personal_care: ['Supported with ', 'Declined ', 'Chose ', 'Skin checked: '],
  nutrition: ['Ate ', 'Drank ', 'Needed prompting with ', 'Fluid chart updated: '],
  mobility: ['Walked to ', 'Transferred using ', 'Reluctant to ', 'Used the '],
  medication: [
    'Administered as prescribed: ',
    'Refused ',
    'PRN given for ',
    'GP contacted about ',
  ],
  social_emotional: ['Joined ', 'Talked about ', 'Family visited: ', 'Preferred to '],
  health_observation: [
    'Observations taken: ',
    'Reported ',
    'Skin: ',
    'GP informed of ',
  ],
  behaviour: [
    'Became distressed when ',
    'Settled after ',
    'Called out ',
    'Approach that worked: ',
  ],
  general: ['Slept ', 'Spent the morning ', 'Spent the afternoon ', 'Visitors: '],
}
