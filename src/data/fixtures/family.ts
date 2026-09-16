import type {
  FamilyAccessLevel,
  FamilyMember,
  FamilyRevision,
  IsoDateTime,
  ResidentId,
  StaffRef,
} from '../types'
import { daysAgo, toIsoDateTime } from './generate'
import { staffHalloran, staffOkonkwo } from './organisation'

/**
 * Family members already named, before anybody opens this build. Phase 26,
 * carrying revisions from Phase 27.
 *
 * **Why these exist at all.** Until Phase 26 the list started empty on every
 * load, so the module screen's finding — consent given and nobody named —
 * would have read the whole population every time it was opened. A figure that
 * is the whole denominator on every load cannot fall, and a reader cannot tell
 * one of those from a broken figure.
 *
 * Four states exist here on purpose:
 *
 * 1. **Consent given, people named.** The settled state, which a screen
 *    reviewed only against gaps is never seen working.
 * 2. **Consent given, nobody named.** The lead finding: permission granted and
 *    never used. Left to the residents this file does not mention.
 * 3. **Consent withdrawn, people still named.** A permission outliving its
 *    authorisation, which the module screen counts as its own finding.
 * 4. **Access somebody has already corrected**, both kinds: an email put right,
 *    and a level raised. Neither renders like a fresh record, and a screen that
 *    has never met one is a screen nobody has seen working.
 *
 * Emails are recorded for some and not for others, because nobody having taken
 * an address is a different fact from somebody having no email.
 */

const at = (days: number): IsoDateTime => toIsoDateTime(daysAgo(days))

const recorded = (
  value: string,
  days: number,
  by: StaffRef,
): FamilyRevision['email'] => ({
  kind: 'recorded',
  value,
  recordedBy: by,
  recordedAt: at(days),
})

/** The first revision: the access as somebody recorded it, changing nothing. */
const granted = (input: {
  name: string
  relationship: string
  email: string | 'none'
  level: FamilyAccessLevel
  days: number
  by?: StaffRef
}): FamilyRevision => {
  const by = input.by ?? staffOkonkwo
  return {
    name: input.name,
    relationship: input.relationship,
    email:
      input.email === 'none'
        ? { kind: 'unrecorded' }
        : recorded(input.email, input.days, by),
    level: input.level,
    by,
    at: at(input.days),
    changed: [],
  }
}

const named = (
  id: string,
  residentId: string,
  revisions: [FamilyRevision, ...FamilyRevision[]],
): FamilyMember => ({ id, residentId: residentId as ResidentId, revisions })

export const familyMembers: FamilyMember[] = [
  // Consent given, and people named. Rosewood Court.
  named('fam-f-001', 'res-okafor', [
    granted({
      name: 'Adaeze Okafor',
      relationship: 'daughter',
      email: 'adaeze.okafor@example.com',
      level: 'full',
      days: 240,
    }),
  ]),
  named('fam-f-002', 'res-okafor', [
    granted({
      name: 'Chidi Okafor',
      relationship: 'son',
      email: 'none',
      level: 'basic',
      days: 240,
    }),
  ]),

  /*
   * **An email corrected.** It was taken down wrong at the door and put right
   * a fortnight later. The recording stays with the person who made it; the
   * correction carries its own name and instant.
   */
  named('fam-f-003', 'res-nwachukwu', [
    granted({
      name: 'Ekene Nwachukwu',
      relationship: 'husband',
      email: 'ekene.nwachuwku@example.com',
      level: 'full',
      days: 180,
      by: staffHalloran,
    }),
    {
      name: 'Ekene Nwachukwu',
      relationship: 'husband',
      email: recorded('ekene.nwachukwu@example.com', 166, staffOkonkwo),
      level: 'full',
      by: staffOkonkwo,
      at: at(166),
      changed: ['email'],
    },
  ]),

  /*
   * **A level raised.** Basic at first, Full once the family asked to see the
   * care notes a manager shares. The earlier level stays on the record,
   * because the disclosure log says what was shared while it stood.
   */
  named('fam-f-004', 'res-braithwaite', [
    granted({
      name: 'Margaret Braithwaite',
      relationship: 'daughter',
      email: 'm.braithwaite@example.com',
      level: 'basic',
      days: 95,
    }),
    {
      name: 'Margaret Braithwaite',
      relationship: 'daughter',
      email: recorded('m.braithwaite@example.com', 95, staffOkonkwo),
      level: 'full',
      by: staffHalloran,
      at: at(30),
      changed: ['level'],
    },
  ]),

  named('fam-f-005', 'res-bello', [
    granted({
      name: 'Tunde Bello',
      relationship: 'son',
      email: 'none',
      level: 'full',
      days: 60,
      by: staffHalloran,
    }),
  ]),
  // Ashgrove Lodge, so the second home is not a home where nobody was ever named.
  named('fam-f-006', 'res-brennan', [
    granted({
      name: 'Siobhan Brennan',
      relationship: 'daughter',
      email: 'siobhan.brennan@example.com',
      level: 'full',
      days: 410,
    }),
  ]),

  /*
   * Consent withdrawn, and these people are still named. The finding the
   * module screen leads its second figure on.
   */
  named('fam-f-007', 'res-kavanagh', [
    granted({
      name: 'Philip Kavanagh',
      relationship: 'son',
      email: 'philip.kavanagh@example.com',
      level: 'full',
      days: 420,
    }),
  ]),
  named('fam-f-008', 'res-kavanagh', [
    granted({
      name: 'Eileen Fahey',
      relationship: 'niece',
      email: 'none',
      level: 'basic',
      days: 300,
    }),
  ]),
  named('fam-f-009', 'res-thorne', [
    granted({
      name: 'Celia Thorne',
      relationship: 'daughter',
      email: 'celia.thorne@example.com',
      level: 'basic',
      days: 290,
      by: staffHalloran,
    }),
  ]),
]
