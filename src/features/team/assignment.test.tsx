import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { StaffMember } from '@/data/types'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import {
  resetSessionTeam,
  setResidentAssignment,
  teamMembers,
} from '@/data/access/team-store'
import { AssignmentSection } from './AssignmentSection'
import { InviteDrawer } from './InviteDrawer'

/**
 * Which residents a care worker has been given. Phase 18.
 *
 * **The constraint is the subject, not the rendering.** Assignment decides
 * nothing on this platform, so the interesting assertions are about what it
 * does *not* touch and about the states being reachable at all —
 * `check-assignment-reach.mjs` holds the import surface, and this holds the
 * two things a script cannot see: that every state renders, and that a write
 * for the wrong role is refused rather than stored quietly.
 */

afterEach(() => resetSessionTeam())

const careWorkers = () =>
  teamMembers().filter((member) => member.role === 'care_worker')

function renderSection(member: StaffMember) {
  return render(
    <SessionProvider>
      <TooltipProvider>
        <AssignmentSection member={member} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('every state of an assignment is reachable from the fixtures', () => {
  it('reaches all three without anybody having to write one first', () => {
    /*
     * The standing check about a branch nothing reaches, applied to a union: a
     * state only reachable by first performing an act is a state the reviewer
     * never sees on a fresh load.
     */
    const kinds = new Set(careWorkers().map((member) => member.residentAssignment.kind))

    for (const kind of ['never_set', 'all_residents_at_site', 'assigned'] as const) {
      expect(kinds.has(kind), `no care worker is in the ${kind} state`).toBe(true)
    }
  })

  it('hatches the state nobody has decided, and settles the two somebody did', () => {
    const never = careWorkers().find(
      (member) => member.residentAssignment.kind === 'never_set',
    )!
    const gap = renderSection(never)
    expect(gap.container.querySelector('[data-assignment="never_set"]')).toBeTruthy()
    // The hatch, and the sentence that says the two are not the same fact.
    expect(gap.container.textContent).toMatch(/not the same as covering everybody/i)
    gap.unmount()

    const whole = careWorkers().find(
      (member) => member.residentAssignment.kind === 'all_residents_at_site',
    )!
    const settled = renderSection(whole)
    expect(settled.container.textContent).toMatch(/Every resident at this home/i)
    // A decision carries a name, which is what makes it a decision.
    expect(settled.container.querySelector('[data-numeric]')).toBeTruthy()
    expect(settled.container.textContent).toMatch(/Decided by/i)
  })

  it('renders nothing at all for a role that does not take one', () => {
    /*
     * The rule that stands in for a fourth union member. `not_applicable`
     * would be derivable from the role the record already carries, so the
     * question is asked where it means something and not asked elsewhere.
     */
    const manager = teamMembers().find((member) => member.role === 'deputy_manager')!
    const { container } = renderSection(manager)
    expect(container.querySelector('[data-assignment]')).toBeNull()
  })
})

describe('no role but a care worker holds one', () => {
  it('leaves every other role at never_set in the fixtures', () => {
    const wrong = teamMembers().filter(
      (member) =>
        member.role !== 'care_worker' && member.residentAssignment.kind !== 'never_set',
    )
    expect(
      wrong.map((member) => `${member.ref.fullName} (${member.role})`),
      'a role that does not take a resident assignment is carrying one',
    ).toEqual([])
  })

  it('refuses a write for the wrong role rather than storing it quietly', () => {
    /*
     * The fixture check above cannot see a write made at runtime, which is
     * where the next one would come from: the invite drawer asks for residents
     * only when the role is a care worker, and a screen is a rule somebody can
     * change.
     */
    const manager = teamMembers().find((member) => member.role === 'deputy_manager')!
    expect(() =>
      setResidentAssignment(manager.id, {
        kind: 'all_residents_at_site',
        decidedBy: manager.ref,
        on: '2026-09-15' as never,
      }),
    ).toThrow(/care worker/i)
  })

  it('refuses an assignment with nobody in it', () => {
    const worker = careWorkers()[0]!
    expect(() =>
      setResidentAssignment(worker.id, {
        kind: 'assigned',
        residents: [],
        decidedBy: worker.ref,
        on: '2026-09-15' as never,
      }),
    ).toThrow(/never_set wearing a decision|wearing a decision/i)
  })
})

describe('the invite drawer asks for residents only where the question applies', () => {
  function renderDrawer() {
    const router = createMemoryRouter(
      [{ path: '/', element: <InviteDrawer onAdded={() => {}} /> }],
      { initialEntries: ['/'] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('offers the question for a care worker and withdraws it for a manager', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByRole('button', { name: /Invite staff member/i }))

    /*
     * Scoped to the dialog rather than to the render's container: Radix
     * portals the panel to the body, so `container` holds the trigger and
     * nothing else. Every absence assertion below would have passed on an
     * empty element.
     */
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(dialog.querySelector('[data-assignment-field]')).toBeTruthy(),
    )

    await user.click(dialog.querySelector('[data-role-option="deputy_manager"]')!)
    await waitFor(() =>
      expect(dialog.querySelector('[data-assignment-field]')).toBeNull(),
    )

    // And back, so the assertion above is about the role rather than about a
    // form that lost a field and never recovers it.
    await user.click(dialog.querySelector('[data-role-option="care_worker"]')!)
    await waitFor(() =>
      expect(dialog.querySelector('[data-assignment-field]')).toBeTruthy(),
    )
  }, 20000)

  it('does not offer a registered manager, and says why rather than omitting it', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByRole('button', { name: /Invite staff member/i }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(dialog.querySelector('[data-role-option="care_worker"]')).toBeTruthy(),
    )
    expect(dialog.querySelector('[data-role-option="registered_manager"]')).toBeNull()
    // Absence with no explanation reads as a role the product does not have.
    expect(dialog.querySelector('[data-cannot-invite-admin]')?.textContent).toMatch(
      /not an act this platform performs/i,
    )
  }, 20000)
})
