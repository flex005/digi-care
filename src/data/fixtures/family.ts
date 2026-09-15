import type { FamilyMember, IsoDateTime, ResidentId } from '../types'
import { daysAgo, toIsoDateTime } from './generate'
import { staffHalloran, staffOkonkwo } from './organisation'

/**
 * Family members already named, before anybody opens this build. Phase 26.
 *
 * **Why these exist at all.** Until this phase the list started empty on every
 * load, so the module screen's finding — consent given and nobody named —
 * would have read the whole population every time it was opened. A figure that
 * is the whole denominator on every load cannot fall, and a reader cannot tell
 * one of those from a broken figure. §8 names it: a fixture has to reach every
 * state a screen can render, including the settled one.
 *
 * So three populations exist here on purpose:
 *
 * 1. **Consent given, people named.** The settled state, which a screen
 *    reviewed only against gaps is never seen working.
 * 2. **Consent given, nobody named.** The lead finding: permission granted and
 *    never used. Left to the residents this file does not mention.
 * 3. **Consent withdrawn, people still named.** A permission outliving its
 *    authorisation — and invisible on the resident's own tab until Phase 26,
 *    which is exactly when somebody needs to remove it. Doris Kavanagh and
 *    Reginald Thorne carry it, matching the withdrawals in `residents.ts`.
 *
 * Emails are recorded for some and not for others, because nobody having taken
 * an address is a different fact from somebody having no email, and a blank
 * string cannot tell them apart.
 */

const at = (days: number): IsoDateTime => toIsoDateTime(daysAgo(days))

const named = (
  id: string,
  residentId: string,
  name: string,
  relationship: string,
  email: string | 'none',
  level: FamilyMember['level'],
  days: number,
  by = staffOkonkwo,
): FamilyMember => ({
  id,
  residentId: residentId as ResidentId,
  name,
  relationship,
  email:
    email === 'none'
      ? { kind: 'unrecorded' }
      : { kind: 'recorded', value: email, recordedBy: by, recordedAt: at(days) },
  level,
  by,
  at: at(days),
})

export const familyMembers: FamilyMember[] = [
  // Consent given, and people named. Rosewood Court.
  named(
    'fam-f-001',
    'res-okafor',
    'Adaeze Okafor',
    'daughter',
    'adaeze.okafor@example.com',
    'full',
    240,
  ),
  named('fam-f-002', 'res-okafor', 'Chidi Okafor', 'son', 'none', 'basic', 240),
  named(
    'fam-f-003',
    'res-nwachukwu',
    'Ekene Nwachukwu',
    'husband',
    'ekene.nwachukwu@example.com',
    'full',
    180,
    staffHalloran,
  ),
  named(
    'fam-f-004',
    'res-braithwaite',
    'Margaret Braithwaite',
    'daughter',
    'm.braithwaite@example.com',
    'basic',
    95,
  ),
  named(
    'fam-f-005',
    'res-bello',
    'Tunde Bello',
    'son',
    'none',
    'full',
    60,
    staffHalloran,
  ),
  // Ashgrove Lodge, so the second home is not a home where nobody was ever named.
  named(
    'fam-f-006',
    'res-brennan',
    'Siobhan Brennan',
    'daughter',
    'siobhan.brennan@example.com',
    'full',
    410,
  ),

  /*
   * Consent withdrawn, and these people are still named. The finding the
   * module screen leads its second figure on.
   */
  named(
    'fam-f-007',
    'res-kavanagh',
    'Philip Kavanagh',
    'son',
    'philip.kavanagh@example.com',
    'full',
    420,
  ),
  named('fam-f-008', 'res-kavanagh', 'Eileen Fahey', 'niece', 'none', 'basic', 300),
  named(
    'fam-f-009',
    'res-thorne',
    'Celia Thorne',
    'daughter',
    'celia.thorne@example.com',
    'basic',
    290,
    staffHalloran,
  ),
]
