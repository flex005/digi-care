import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, TooltipProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import type { ResidentId, StaffRole } from '@/data/types'
import { currentDetails, levelHistory, recordedAccess } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { familyMembers } from '@/data/fixtures/family'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  editMember,
  familyFor,
  grantAccess,
  memberById,
  removeAccess,
  resetSessionFamilyAccess,
} from '@/data/access/family-access-store'
import { FamilyTab } from './FamilyTab'
import { FamilyQueueRoute } from './FamilyQueueRoute'

/**
 * Family Portal access: the tab, the dialog and the module screen. Phase 27.
 *
 * **A resident has a family, not a family member.** The store always held a
 * list, and nothing ever added a second person to it — which is how an id
 * built from the length of that list survived: name three, remove one, name
 * another, and two people carry the same id.
 *
 * **And a correction is not a removal followed by an addition.** That would
 * discard who granted the access and when, which is the record of the decision
 * rather than a detail of it. So the assertions that carry weight here read
 * the recording back *after* an edit, and read the earlier access level back
 * after it has been raised.
 */

afterEach(() => resetSessionFamilyAccess())

const UNSEEDED = 'res-pemberton' as ResidentId

function renderTab(residentId: ResidentId, as: StaffRole = 'registered_manager') {
  const resident = residents.find((entry) => entry.id === residentId)!
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Outlet context={{ resident, refresh: () => {} }} />,
        children: [{ index: true, element: <FamilyTab /> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={as} />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

function renderQueue(as: StaffRole = 'registered_manager') {
  const router = createMemoryRouter(
    [{ path: '/family', element: <FamilyQueueRoute /> }],
    { initialEntries: ['/family'] },
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

const given = () =>
  residents.find((entry) => entry.consents.family_portal.kind === 'given')!

const withdrawnResident = () =>
  residents.find(
    (entry) =>
      entry.consents.family_portal.kind === 'withdrawn' &&
      familyMembers.some((member) => member.residentId === entry.id),
  )!

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
     * wife were both `fam-003` — and removing the nephew took the wife.
     */
    removeAccess(daughter.id)
    const nephew = add(UNSEEDED, 'Joe Pemberton', 'nephew')
    expect(nephew.id).not.toBe(wife.id)
    expect(nephew.id).not.toBe(son.id)

    removeAccess(nephew.id)
    const left = familyFor(UNSEEDED).map((member) => currentDetails(member).name)
    expect(left).toEqual(['Mark Pemberton', 'Ruth Pemberton'])
  })

  it('never issues an id a fixture already uses', () => {
    const fixtureIds = new Set(familyMembers.map((member) => member.id))
    expect(fixtureIds.has(add(UNSEEDED, 'Ada Pemberton', 'granddaughter').id)).toBe(
      false,
    )
  })
})

describe('a correction keeps who recorded the access, and adds who changed it', () => {
  it('appends a revision rather than replacing the recording', () => {
    const member = add(UNSEEDED, 'Nadia Iqbal', 'daughter', 'nadia.iqbel@example.com')
    const recording = recordedAccess(member)

    editMember(member.id, {
      name: 'Nadia Iqbal',
      relationship: 'daughter',
      email: 'nadia.iqbal@example.com',
      level: 'full',
      by: staffOkonkwo,
    })

    const after = memberById(member.id)!
    /*
     * **The assertion this phase exists for.** Remove-and-re-add would have
     * discarded this: who decided a family member may see a resident's record,
     * and when. It is the record of the decision, not a detail of it.
     */
    expect(recordedAccess(after)).toEqual(recording)
    expect(after.revisions).toHaveLength(2)
    expect(currentDetails(after).changed).toEqual(['email'])
    expect(currentDetails(after).email).toMatchObject({
      kind: 'recorded',
      value: 'nadia.iqbal@example.com',
    })
  })

  it('keeps the level somebody held before it was raised', () => {
    const member = add(UNSEEDED, 'Yusuf Iqbal', 'son')
    editMember(member.id, {
      name: 'Yusuf Iqbal',
      relationship: 'son',
      email: '',
      level: 'basic',
      by: staffOkonkwo,
    })

    const after = memberById(member.id)!
    const levels = levelHistory(after).map((revision) => revision.level)
    /*
     * A mistyped email was never true, so correcting it leaves nothing behind.
     * A level *was* true for a period, and the disclosure log records what was
     * shared during it — so the earlier level stays readable.
     */
    expect(levels).toEqual(['full', 'basic'])
    expect(currentDetails(after).level).toBe('basic')
  })

  it('refuses a correction that changes nothing', () => {
    const member = add(UNSEEDED, 'Ada Pemberton', 'granddaughter', 'ada@example.com')
    expect(() =>
      editMember(member.id, {
        name: 'Ada Pemberton',
        relationship: 'granddaughter',
        email: 'ada@example.com',
        level: 'full',
        by: staffOkonkwo,
      }),
    ).toThrow(/did not happen/i)
  })
})

describe('the tab is a list with an action, not a form on a page', () => {
  it('offers the act and keeps the form out of the way until somebody uses it', async () => {
    const user = userEvent.setup()
    const { container } = renderTab(given().id)
    await waitFor(() =>
      expect(container.querySelector('[data-family-access]')).toBeTruthy(),
    )

    // Nothing to fill in on arrival: the tab says who has access.
    expect(container.querySelector('[data-field="family-name"]')).toBeNull()
    expect(container.querySelector('[data-nothing-sent]')).toBeNull()

    await user.click(container.querySelector('[data-add-family]')!)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-member-dialog="add"]')).toBeTruthy()

    /*
     * **The statement belongs at the point of recording.** On the tab it is a
     * standing notice nobody reads by the second visit; here it is in front of
     * somebody at the moment they would otherwise assume a family member has
     * been told.
     */
    expect(dialog.querySelector('[data-nothing-sent]')!.textContent).toMatch(
      /nothing is sent to them/i,
    )
  }, 30000)

  it('records somebody through the dialog, and the list says so', async () => {
    const user = userEvent.setup()
    const resident = given()
    const before = familyFor(resident.id).length
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-add-family]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-add-family]')!)
    const dialog = await screen.findByRole('dialog')
    await user.type(dialog.querySelector('[data-field="family-name"]')!, 'Priya Raman')
    await user.type(
      dialog.querySelector('[data-field="family-relationship"]')!,
      'niece',
    )
    await user.click(dialog.querySelector('[data-save-member]')!)

    await waitFor(() => expect(familyFor(resident.id)).toHaveLength(before + 1))
    const named = familyFor(resident.id).find(
      (member) => currentDetails(member).name === 'Priya Raman',
    )!
    // Blank is nobody having taken an address, never an empty string.
    expect(currentDetails(named).email.kind).toBe('unrecorded')
    await waitFor(() =>
      expect(
        container.querySelector(`[data-family-member="${named.id}"]`),
      ).toBeTruthy(),
    )
  }, 30000)

  it('opens the dialog prefilled when correcting somebody', async () => {
    const user = userEvent.setup()
    const resident = given()
    const member = grantAccess({
      residentId: resident.id,
      name: 'Helen Vance',
      relationship: 'daughter',
      email: 'helen.vence@example.com',
      level: 'basic',
      by: staffOkonkwo,
    })

    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector(`[data-edit-family="${member.id}"]`)).toBeTruthy(),
    )
    await user.click(container.querySelector(`[data-edit-family="${member.id}"]`)!)
    const dialog = await screen.findByRole('dialog')

    const email = dialog.querySelector<HTMLInputElement>('[data-field="family-email"]')!
    expect(
      dialog.querySelector<HTMLInputElement>('[data-field="family-name"]')!.value,
    ).toBe('Helen Vance')
    expect(email.value).toBe('helen.vence@example.com')
    // It says whose recording it is keeping, where somebody is choosing
    // between a correction and removing them to start again.
    expect(dialog.querySelector('[data-keeps-recording]')).toBeTruthy()

    await user.clear(email)
    await user.type(email, 'helen.vance@example.com')
    await user.click(dialog.querySelector('[data-save-member]')!)

    await waitFor(() =>
      expect(currentDetails(memberById(member.id)!).email).toMatchObject({
        value: 'helen.vance@example.com',
      }),
    )
    expect(recordedAccess(memberById(member.id)!).by.id).toBe(staffOkonkwo.id)
    await waitFor(() =>
      expect(container.querySelector('[data-last-change]')).toBeTruthy(),
    )
  }, 40000)

  it('says nobody is named as the state it is, rather than an empty list', async () => {
    const resident = residents.find(
      (entry) =>
        entry.consents.family_portal.kind === 'given' &&
        !familyMembers.some((member) => member.residentId === entry.id),
    )!
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-no-family]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-no-family]')!.textContent).toMatch(
      /Nobody has been named/i,
    )
    expect(container.querySelector('[data-family-member]')).toBeNull()
  }, 20000)
})

describe('the consent gates the act, and never the sight of what exists', () => {
  it('offers no way in where the consent was never sought', async () => {
    const { container } = renderTab(UNSEEDED)
    await waitFor(() =>
      expect(container.querySelector('[data-consent-missing]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-add-family]')).toBeNull()
    expect(container.querySelector('[data-open-consent]')).toBeTruthy()
  }, 20000)

  it('shows people whose consent was withdrawn, with Remove and no correction', async () => {
    const resident = withdrawnResident()
    const { container } = renderTab(resident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-access-without-consent]')).toBeTruthy(),
    )

    const seeded = familyMembers.filter((member) => member.residentId === resident.id)
    for (const member of seeded) {
      expect(
        container.querySelector(`[data-family-member="${member.id}"]`),
      ).toBeTruthy()
      expect(
        container.querySelector(`[data-remove-family="${member.id}"]`),
      ).toBeTruthy()
      // Correcting an unauthorised access is not the act somebody needs here.
      expect(container.querySelector(`[data-edit-family="${member.id}"]`)).toBeNull()
    }
    expect(container.querySelector('[data-add-family]')).toBeNull()
  }, 30000)

  it('offers nothing to somebody who cannot record here', async () => {
    const { container } = renderTab(given().id, 'auditor')
    await waitFor(() =>
      expect(container.querySelector('[data-family-access]')).toBeTruthy(),
    )
    // Absent, not disabled.
    expect(container.querySelector('[data-add-family]')).toBeNull()
    expect(container.querySelector('[data-remove-family]')).toBeNull()
    expect(container.querySelector('[data-edit-family]')).toBeNull()
  }, 30000)
})

describe('the fixtures reach every state these screens render', () => {
  const namedFor = (id: string) => familyMembers.filter((m) => m.residentId === id)
  const withConsent = (kind: string) =>
    residents.filter((r) => r.consents.family_portal.kind === kind)

  it('has consent given with people named, and with nobody named', () => {
    expect(withConsent('given').some((r) => namedFor(r.id).length > 0)).toBe(true)
    expect(withConsent('given').some((r) => namedFor(r.id).length === 0)).toBe(true)
  })

  it('has a withdrawn consent with people still named', () => {
    expect(withConsent('withdrawn').some((r) => namedFor(r.id).length > 0)).toBe(true)
  })

  it('has an email corrected and a level raised, so neither renders untested', () => {
    const corrected = familyMembers.filter((member) => member.revisions.length > 1)
    expect(corrected.length).toBeGreaterThan(0)
    const changes = corrected.flatMap((member) =>
      member.revisions.flatMap((revision) => revision.changed),
    )
    expect(changes).toContain('email')
    expect(changes).toContain('level')
    expect(
      familyMembers.some((member) => levelHistory(member).length > 1),
      'no fixture has held two access levels',
    ).toBe(true)
  })

  it('records an email for some and not for others', () => {
    const emails = familyMembers.map((member) => currentDetails(member).email.kind)
    expect(emails).toContain('recorded')
    expect(emails).toContain('unrecorded')
  })
})

describe('the module screen leads on permission granted and never used', () => {
  it('counts residents who agreed and named nobody, against those who agreed', async () => {
    const { container } = renderQueue()
    await waitFor(() =>
      expect(container.querySelector('[data-finding="nobody-named"]')).toBeTruthy(),
    )

    const site = residents.filter((r) => r.siteId === 'site-rosewood-court')
    const agreed = site.filter((r) => r.consents.family_portal.kind === 'given')
    const nobody = agreed.filter(
      (r) => !familyMembers.some((member) => member.residentId === r.id),
    )
    const lead = container.querySelector('[data-finding="nobody-named"]')!

    expect(lead.textContent).toContain(String(nobody.length))
    expect(lead.textContent).toContain(String(agreed.length))
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

    const resident = withdrawnResident()
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
