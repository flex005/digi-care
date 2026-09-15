import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import type { ResidentId, StaffRole } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { familyMembers } from '@/data/fixtures/family'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  familyFor,
  grantAccess,
  removeAccess,
  resetSessionFamilyAccess,
} from '@/data/access/family-access-store'
import { FamilyAccessSection } from './FamilyAccessSection'
import { FamilyQueueRoute } from './FamilyQueueRoute'

/**
 * Family Portal access as a module. Phase 26.
 *
 * **A resident has a family, not a family member.** The store always held a
 * list, and nothing ever added a second person to it — which is how an id
 * built from the length of that list survived: name three, remove one, name
 * another, and two people carry the same id. Removing then takes whichever
 * comes first. The first test here is that sequence.
 */

afterEach(() => resetSessionFamilyAccess())

const UNSEEDED = 'res-pemberton' as ResidentId

function renderSection(residentId: ResidentId, as: StaffRole = 'registered_manager') {
  const resident = residents.find((entry) => entry.id === residentId)!
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
        <SignInAs as={as} />
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

function renderQueue(as: StaffRole = 'registered_manager') {
  const router = createMemoryRouter(
    [{ path: '/family', element: <FamilyQueueRoute /> }],
    {
      initialEntries: ['/family'],
    },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <SignInAs as={as} />
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const add = (residentId: ResidentId, name: string, relationship: string, email = '') =>
  grantAccess({
    residentId,
    name,
    relationship,
    email,
    level: 'full',
    by: staffOkonkwo,
  })

describe('a resident has a family, and removing one removes that one', () => {
  it('keeps three people apart, and removes the person whose button was pressed', () => {
    const daughter = add(UNSEEDED, 'Ann Pemberton', 'daughter')
    const son = add(UNSEEDED, 'Mark Pemberton', 'son')
    const wife = add(UNSEEDED, 'Ruth Pemberton', 'wife')
    expect(familyFor(UNSEEDED)).toHaveLength(3)
    expect(new Set([daughter.id, son.id, wife.id]).size).toBe(3)

    /*
     * **The sequence the length-based id could not survive.** Removing the
     * daughter and naming somebody else reused her id, so the nephew and the
     * wife were both `fam-003` — and removing the nephew took the wife, who
     * keeps access she was meant to keep while he keeps access somebody
     * decided to end.
     */
    removeAccess(daughter.id)
    const nephew = add(UNSEEDED, 'Joe Pemberton', 'nephew')
    expect(nephew.id).not.toBe(wife.id)
    expect(nephew.id).not.toBe(son.id)

    removeAccess(nephew.id)
    const left = familyFor(UNSEEDED).map((member) => member.name)
    expect(left).toEqual(['Mark Pemberton', 'Ruth Pemberton'])
  })

  it('never issues an id a fixture already uses', () => {
    const fixtureIds = new Set(familyMembers.map((member) => member.id))
    const named = add(UNSEEDED, 'Ada Pemberton', 'granddaughter')
    expect(fixtureIds.has(named.id)).toBe(false)
  })

  it('records an email, and records the absence of one as an absence', async () => {
    const user = userEvent.setup()
    const resident = residents.find(
      (entry) => entry.consents.family_portal.kind === 'given',
    )!
    const { container } = renderSection(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-grant-form]')).toBeTruthy(),
    )

    await user.type(
      container.querySelector('[data-field="family-name"]')!,
      'Nadia Iqbal',
    )
    await user.type(
      container.querySelector('[data-field="family-relationship"]')!,
      'daughter',
    )
    await user.click(container.querySelector('[data-grant-access]')!)

    const blank = familyFor(resident.id).find(
      (member) => member.name === 'Nadia Iqbal',
    )!
    // Not an empty string: nobody having taken an address is its own state.
    expect(blank.email.kind).toBe('unrecorded')

    await user.type(
      container.querySelector('[data-field="family-name"]')!,
      'Yusuf Iqbal',
    )
    await user.type(
      container.querySelector('[data-field="family-relationship"]')!,
      'son',
    )
    await user.type(
      container.querySelector('[data-field="family-email"]')!,
      'yusuf.iqbal@example.com',
    )
    await user.click(container.querySelector('[data-grant-access]')!)

    const recorded = familyFor(resident.id).find(
      (member) => member.name === 'Yusuf Iqbal',
    )!
    if (recorded.email.kind !== 'recorded') throw new Error('expected a recorded email')
    expect(recorded.email.value).toBe('yusuf.iqbal@example.com')
    await waitFor(() =>
      expect(container.querySelector('[data-email="unrecorded"]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-email="recorded"]')).toBeTruthy()
  }, 30000)
})

describe('the fixtures reach all three states the module renders', () => {
  const given = residents.filter((r) => r.consents.family_portal.kind === 'given')
  const withdrawn = residents.filter(
    (r) => r.consents.family_portal.kind === 'withdrawn',
  )
  const namedFor = (id: string) => familyMembers.filter((m) => m.residentId === id)

  it('has consent given with people named, and consent given with nobody named', () => {
    expect(given.some((r) => namedFor(r.id).length > 0)).toBe(true)
    expect(given.some((r) => namedFor(r.id).length === 0)).toBe(true)
  })

  it('has a withdrawn consent with people still named', () => {
    expect(withdrawn.length).toBeGreaterThan(0)
    expect(withdrawn.some((r) => namedFor(r.id).length > 0)).toBe(true)
  })

  it('records an email for some and not for others', () => {
    expect(familyMembers.some((m) => m.email.kind === 'recorded')).toBe(true)
    expect(familyMembers.some((m) => m.email.kind === 'unrecorded')).toBe(true)
  })
})

describe('access that outlived its consent is visible where it can be removed', () => {
  const withdrawnResident = () =>
    residents.find(
      (entry) =>
        entry.consents.family_portal.kind === 'withdrawn' &&
        familyMembers.some((member) => member.residentId === entry.id),
    )!

  it('lists the people and says what it means, with no way to name another', async () => {
    const resident = withdrawnResident()
    const { container } = renderSection(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-access-without-consent]')).toBeTruthy(),
    )

    /*
     * Before Phase 26 the list rendered only while the consent stood, so these
     * people were invisible at exactly the moment somebody needed to remove
     * them: a permission outliving its authorisation, hidden by the screen
     * that names it.
     */
    const seeded = familyMembers.filter((member) => member.residentId === resident.id)
    for (const member of seeded) {
      expect(
        container.querySelector(`[data-family-member="${member.id}"]`),
        member.name,
      ).toBeTruthy()
      expect(
        container.querySelector(`[data-remove-family="${member.id}"]`),
      ).toBeTruthy()
    }
    // Naming somebody new still needs a consent, and there is no form here.
    expect(container.querySelector('[data-grant-form]')).toBeNull()
    expect(container.querySelector('[data-open-consent]')).toBeTruthy()
  }, 30000)

  it('removes a fixture member for this session without touching the fixtures', async () => {
    const resident = withdrawnResident()
    const first = familyMembers.find((member) => member.residentId === resident.id)!
    const before = familyFor(resident.id).length

    removeAccess(first.id)
    expect(familyFor(resident.id)).toHaveLength(before - 1)
    expect(familyMembers.some((member) => member.id === first.id)).toBe(true)

    resetSessionFamilyAccess()
    expect(familyFor(resident.id)).toHaveLength(before)
  })

  it('offers no remove control to somebody who cannot record here', async () => {
    const resident = withdrawnResident()
    const { container } = renderSection(resident.id, 'auditor')
    await waitFor(() =>
      expect(container.querySelector('[data-family-access]')).toBeTruthy(),
    )
    // Absent, not disabled.
    expect(container.querySelector('[data-remove-family]')).toBeNull()
    expect(container.querySelector('[data-grant-form]')).toBeNull()
  }, 30000)
})

describe('the module screen leads on permission granted and never used', () => {
  it('counts residents who agreed and named nobody, against those who agreed', async () => {
    const { container } = renderQueue()
    await waitFor(() =>
      expect(container.querySelector('[data-finding="nobody-named"]')).toBeTruthy(),
    )

    const site = residents.filter((r) => r.siteId === 'site-rosewood-court')
    const given = site.filter((r) => r.consents.family_portal.kind === 'given')
    const nobody = given.filter(
      (r) => !familyMembers.some((member) => member.residentId === r.id),
    )
    const lead = container.querySelector('[data-finding="nobody-named"]')!

    /*
     * The denominator is residents who agreed, never every resident: for a
     * refusal, nobody named is the correct state, and counting it would
     * recruit recorded negatives into a missing-evidence figure.
     */
    expect(lead.textContent).toContain(String(nobody.length))
    expect(lead.textContent).toContain(String(given.length))
    expect(lead.textContent).toMatch(/no consent on file and are not counted here/i)
  }, 30000)

  it('counts people whose access outlived the consent, as its own figure', async () => {
    const { container } = renderQueue()
    await waitFor(() =>
      expect(
        container.querySelector('[data-finding="access-without-consent"]'),
      ).toBeTruthy(),
    )

    const site = residents.filter((r) => r.siteId === 'site-rosewood-court')
    const people = site
      .filter((r) => r.consents.family_portal.kind !== 'given')
      .flatMap((r) => familyMembers.filter((member) => member.residentId === r.id))
    expect(people.length).toBeGreaterThan(0)

    const finding = container.querySelector('[data-finding="access-without-consent"]')!
    expect(finding.textContent).toContain(String(people.length))
    // Said, not only counted.
    expect(finding.textContent).toMatch(/outliving what authorised it/i)
  }, 30000)

  it('opens the resident where the people are, from a row', async () => {
    const user = userEvent.setup()
    const { container } = renderQueue()
    await waitFor(() => expect(container.querySelector('[data-filter]')).toBeTruthy())
    await user.click(container.querySelector('[data-filter="access_without_consent"]')!)

    const resident = residents.find(
      (entry) =>
        entry.siteId === 'site-rosewood-court' &&
        entry.consents.family_portal.kind !== 'given' &&
        familyMembers.some((member) => member.residentId === entry.id),
    )!
    await waitFor(() =>
      expect(container.querySelector(`[data-row="${resident.id}"]`)).toBeTruthy(),
    )
    expect(
      container
        .querySelector(`[data-open-resident="${resident.id}"]`)!
        .getAttribute('href'),
    ).toBe(`/residents/${resident.id}/family`)
  }, 30000)
})
