import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import {
  disclosureHistory,
  isSharedWithFamily,
  resetSessionDisclosures,
  share,
  withdrawSharing,
} from '@/data/access/family-disclosure-store'
import {
  familyFor,
  grantAccess,
  removeAccess,
  resetSessionFamilyAccess,
} from '@/data/access/family-access-store'
import { resetSessionResidents } from '@/data/access/resident-store'
import { recordConsent } from '@/data/access/client'
import { residents } from '@/data/fixtures/residents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { NOTHING_WAS_SENT, TELL_THEM } from './family-statement'
import { FamilyAccessSection } from './FamilyAccessSection'
import type { CareNoteId, IsoDate } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { zonedDate } from '@/lib/format'
import type { IsoDateTime } from '@/data/types'
import { configuredSites } from '@/data/access/settings-store'

/**
 * Family Portal management. Phase 21.
 *
 * **Pinned instant**, because a consent's date is derived from the clock and
 * these write one. The fixtures' own instant rather than the wall clock.
 */
const TODAY: IsoDate = zonedDate(
  appNow().toISOString() as IsoDateTime,
  configuredSites()[0]!.timeZone,
)

afterEach(() => {
  resetSessionDisclosures()
  resetSessionFamilyAccess()
  resetSessionResidents()
})

const someone = () =>
  residents.find((r) => r.consents.family_portal.kind === 'not_sought')!

function renderSection(residentId: string) {
  const resident = residents.find((r) => r.id === residentId)!
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <FamilyAccessSection resident={resident} onChanged={() => {}} />,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <SignInAs as="registered_manager" />
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('family access leans on the consent rather than recording it again', () => {
  it('refuses to name anybody until the consent is on file, and says where', async () => {
    const resident = someone()
    const { container } = renderSection(resident.id)

    await waitFor(() =>
      expect(container.querySelector('[data-consent-missing]')).toBeTruthy(),
    )
    // No second way in: the form is not there at all, and the screen names the
    // record that authorises it.
    expect(container.querySelector('[data-grant-form]')).toBeNull()
    expect(container.querySelector('[data-open-consent]')).toBeTruthy()
  }, 20000)

  it('offers no "Invited" state anywhere', async () => {
    const resident = residents.find((r) => r.consents.family_portal.kind === 'given')
    if (resident === undefined) return
    grantAccess({
      residentId: resident.id,
      name: 'Sarah Whitcombe',
      relationship: 'daughter',
      email: 'sarah.whitcombe@example.com',
      level: 'full',
      by: staffOkonkwo,
    })

    const { container } = renderSection(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-access-state]')).toBeTruthy(),
    )

    /*
     * "Invited" implies an email travelling and a state that turns Active.
     * Nothing was sent and nothing can activate, so the state would be
     * permanent and its name a promise.
     */
    expect(container.textContent).not.toMatch(/invited/i)
    expect(container.querySelector('[data-access-state]')!.textContent).toMatch(
      /nothing sent/i,
    )
  }, 20000)

  it('says what to do instead, on the control rather than behind a click', async () => {
    const resident = residents.find((r) => r.consents.family_portal.kind === 'given')
    if (resident === undefined) return

    const { container } = renderSection(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-grant-form]')).toBeTruthy(),
    )

    const said = container.querySelector('[data-nothing-sent]')!
    // An instruction, not a caveat: it says what to do, because the risk is
    // somebody believing the act happened and skipping the real one.
    expect(said.textContent).toContain(TELL_THEM.access)
    expect(said.textContent).toContain(NOTHING_WAS_SENT)
  }, 20000)
})

describe('recording a consent is an act the build now has', () => {
  it('writes it, and the module can do more than take consent away', async () => {
    const resident = someone()
    const assessment = {
      id: 'cap-test-001' as never,
      residentId: resident.id,
      finding: { kind: 'has_capacity' as const },
      covers: { family_portal: true } as const,
      assessedOn: TODAY,
      assessedBy: staffOkonkwo,
      note: 'Talked it through; she was clear about who would see what.',
    }

    const updated = await recordConsent({
      residentId: resident.id,
      consentType: 'family_portal',
      outcome: { kind: 'given', method: 'verbal' },
      authority: { kind: 'the_resident', assessment },
      by: staffOkonkwo,
      on: TODAY,
    })

    expect(updated.consents.family_portal.kind).toBe('given')
  })

  it('refuses a second decision over somebody’s answer', async () => {
    const resident = residents.find((r) => r.consents.family_portal.kind === 'given')
    if (resident === undefined) return
    await expect(
      recordConsent({
        residentId: resident.id,
        consentType: 'family_portal',
        outcome: { kind: 'refused', note: 'no' },
        authority:
          resident.consents.family_portal.kind === 'given'
            ? resident.consents.family_portal.by
            : ({} as never),
        by: staffOkonkwo,
        on: TODAY,
      }),
    ).rejects.toThrow(/already has a .* decision on record/i)
  })
})

describe('a disclosure is appended, and withdrawing does not unsay it', () => {
  const noteId = 'note-test-001' as CareNoteId

  it('keeps the earlier entry when sharing stops', () => {
    const resident = someone()
    const subject = { kind: 'care_note' as const, noteId }

    share(resident.id, subject, staffOkonkwo)
    expect(isSharedWithFamily(subject)).toBe(true)

    withdrawSharing(resident.id, subject, staffOkonkwo)
    expect(isSharedWithFamily(subject)).toBe(false)

    /*
     * **The assertion this log exists for.** A note a family could read for
     * three weeks was disclosed, and a boolean flipped back to false would
     * destroy that entirely. Two entries, oldest first, both kept.
     */
    const history = disclosureHistory(subject)
    expect(history).toHaveLength(2)
    expect(history[0]!.decision).toBe('shared')
    expect(history[1]!.decision).toBe('withdrawn')
    expect(history[0]!.by.id).toBe(staffOkonkwo.id)
  })

  it('refuses a family message with nothing in it', () => {
    const resident = someone()
    expect(() =>
      share(
        resident.id,
        { kind: 'incident', incidentId: 'inc-0001' as never, message: '   ' },
        staffOkonkwo,
      ),
    ).toThrow(/disclosure of nothing/i)
  })

  it('refuses to share twice, which would record that nothing changed', () => {
    const resident = someone()
    const subject = { kind: 'care_note' as const, noteId }
    share(resident.id, subject, staffOkonkwo)
    expect(() => share(resident.id, subject, staffOkonkwo)).toThrow(/already shared/i)
  })
})

describe('family access is a list of who may see things now', () => {
  it('removes rather than supersedes, and the reason is the difference', () => {
    const resident = someone()
    const member = grantAccess({
      residentId: resident.id,
      name: 'Sarah Whitcombe',
      relationship: 'daughter',
      email: '',
      level: 'basic',
      by: staffOkonkwo,
    })
    expect(familyFor(resident.id)).toHaveLength(1)

    /*
     * Unlike a disclosure, nothing here was ever shown to anybody: there is no
     * disclosure to preserve, only a decision that no longer stands.
     */
    removeAccess(member.id)
    expect(familyFor(resident.id)).toHaveLength(0)
  })
})
