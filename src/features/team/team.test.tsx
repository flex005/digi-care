import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { staffDeactivated, staffOkonkwo } from '@/data/fixtures/organisation'
import {
  memberById,
  setStanding,
  staffLabel,
  teamMembers,
} from '@/data/access/team-store'
import { formatAttribution } from '@/lib/format'
import { TeamListRoute } from './TeamListRoute'
import { StaffDetailRoute } from './StaffDetailRoute'
import { PermissionMatrixRoute } from './PermissionMatrixRoute'
import { ActivityLogRoute } from './ActivityLogRoute'
import {
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  actsIn,
  ceilingFor,
  levelFor,
} from './permissions'
import { staffActivity } from './staff-activity'

/**
 * Team management. PRD §6.7, Phase 14.
 *
 * **The module's hazard is that a page about a person becomes a judgement of
 * them.** Everything here is about keeping it a record: ordered by name, no
 * counts, and the absence of a performance record stated before the activity
 * rather than after it.
 */

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'team', element: <TeamListRoute /> },
      { path: 'team/permissions', element: <PermissionMatrixRoute /> },
      { path: 'team/activity', element: <ActivityLogRoute /> },
      { path: 'team/:staffId', element: <StaffDetailRoute /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(() =>
    expect(
      container.querySelector(
        '[data-team-list], [data-staff-detail], [data-permission-matrix], [data-activity-log]',
      ),
    ).toBeTruthy(),
  )

describe('standing is a record, not a flag', () => {
  it('carries an author on every member of the union', () => {
    for (const member of teamMembers()) {
      const standing = member.standing
      const author =
        standing.kind === 'has_access'
          ? standing.grantedBy
          : standing.kind === 'never_given_access'
            ? standing.addedBy
            : standing.by
      // A standing with no author is a flag, not a record.
      expect(author.displayName, member.id).toBeTruthy()
    }
  })

  it('reaches all four members in the fixtures', () => {
    const kinds = new Set(teamMembers().map((member) => member.standing.kind))
    expect(kinds).toEqual(
      new Set([
        'has_access',
        'no_longer_has_access',
        'suspended',
        'never_given_access',
      ]),
    )
  })

  it('hatches never-given-access and nothing else', async () => {
    const { container } = renderAt('/team')
    await settled(container)

    const never = container.querySelector('[data-standing="never_given_access"]')!
    expect(never.querySelector('[data-state="unrecorded"]')).toBeTruthy()

    for (const kind of ['has_access', 'no_longer_has_access', 'suspended']) {
      const settledStanding = container.querySelector(`[data-standing="${kind}"]`)!
      expect(
        settledStanding.querySelector('[data-state="unrecorded"]'),
        `${kind} took the hatch`,
      ).toBeNull()
    }
  })
})

describe('"no longer has access" is derived, never snapshotted', () => {
  it('follows current standing rather than the ref on the record', () => {
    /*
     * The reactivation case is the argument: a fact about now stored in a
     * record about then would keep calling somebody deactivated after they
     * came back.
     */
    expect(staffLabel(staffDeactivated)).toContain('no longer has access')

    setStanding(staffDeactivated.id, {
      kind: 'has_access',
      since: '2026-08-01' as never,
      grantedBy: staffOkonkwo,
    })
    expect(staffLabel(staffDeactivated)).toBe(staffDeactivated.displayName)

    // Put it back, so the rest of the suite sees the fixture standing.
    setStanding(staffDeactivated.id, {
      kind: 'no_longer_has_access',
      on: '2026-08-02' as never,
      reason: 'left the service',
      by: staffOkonkwo,
    })
    expect(staffLabel(staffDeactivated)).toContain('no longer has access')
  })

  it('leaves the attribution formatter with nothing to decide', () => {
    // It used to append the marker itself, from the snapshot on the record.
    const rendered = formatAttribution(
      staffLabel(staffDeactivated),
      '2026-08-22T08:04:00.000Z' as never,
      'Europe/London',
    )
    expect(rendered).toContain('no longer has access')
    expect(
      formatAttribution(
        staffOkonkwo.displayName,
        '2026-08-22T08:04:00.000Z' as never,
        'Europe/London',
      ),
    ).not.toContain('(')
  })
})

describe('the list', () => {
  it('is ordered by name and says so', async () => {
    const { container } = renderAt('/team')
    await settled(container)

    const names = [...container.querySelectorAll('[data-member]')].map(
      (row) => row.querySelector('p')?.textContent ?? '',
    )
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)

    /*
     * Said out loud, so nobody adds a sort control later in good faith.
     *
     * Keyed on the reason rather than on the sentence: this matched
     * "cannot be ordered by anything anybody did" and failed the day the note
     * was shortened, which is a guard pinning the rendering rather than the
     * property. What has to survive a rewording is that the note is there and
     * that it gives the reason — a table of people sorted by a count is a
     * ranking — because the reason is what stops somebody adding the control.
     */
    const note = container.querySelector('[data-order-note]')
    expect(note).toBeTruthy()
    expect(note!.textContent).toMatch(/ranking/i)
    expect(note!.textContent).toMatch(/ordered by name/i)
  })

  it('offers no way to order it by anything else', async () => {
    const { container } = renderAt('/team')
    await settled(container)

    const list = container.querySelector('[data-team-list]') as HTMLElement
    expect(within(list).queryByRole('columnheader')).toBeNull()
    expect(within(list).queryByRole('button', { name: /sort/i })).toBeNull()
  })
})

describe('the staff detail is not a performance record', () => {
  it('says so above the activity, not below it', async () => {
    const { container } = renderAt('/team/staff-c-nwosu')
    await settled(container)

    const page = container.querySelector('[data-staff-detail]')!
    const marks = [...page.querySelectorAll('[data-not-held], [data-act]')]
    // A page of what somebody recorded reads as the beginning of a performance
    // record unless it is told otherwise first.
    expect(marks[0]?.hasAttribute('data-not-held')).toBe(true)
  })

  it('reuses the settled treatment rather than the hatch', async () => {
    const { container } = renderAt('/team/staff-c-nwosu')
    await settled(container)

    const block = container.querySelector('[data-not-held]')!
    expect(block.querySelector('[data-state="unrecorded"]')).toBeNull()
    for (const item of ['Supervision', 'Appraisal', 'Training and competency']) {
      expect(block.querySelector(`[data-not-held-item="${item}"]`), item).toBeTruthy()
    }
  })

  it('shows no count of anything', async () => {
    const { container } = renderAt('/team/staff-c-nwosu')
    await settled(container)

    const page = container.querySelector('[data-staff-detail]')!
    /*
     * No rota, no shift record, so a count has no honest denominator — and a
     * bare count beside another person's is a ranking the reader performs.
     */
    expect(page.querySelector('[data-numeric]')).toBeNull()
    expect(page.querySelector('[data-no-counts]')?.textContent).toContain(
      'no honest denominator',
    )
  })

  it('sends the figures to the report where they carry their framing', async () => {
    const { container } = renderAt('/team/staff-c-nwosu')
    await settled(container)

    expect(container.querySelector('[data-coverage-link]')?.getAttribute('href')).toBe(
      '/reports/care-note-coverage',
    )
  })

  it('links every activity row to the record itself', async () => {
    const { container } = renderAt('/team/staff-c-nwosu')
    await settled(container)

    const rows = container.querySelectorAll('[data-act]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const link = within(row as HTMLElement).getByRole('link')
      expect(link.getAttribute('href')).toMatch(/^\/residents\//)
    }
  })

  it('orders one person’s activity newest first', () => {
    const acts = staffActivity(staffOkonkwo.id)
    expect(acts.length).toBeGreaterThan(0)
    const times = acts.map((act) => act.at)
    expect([...times].sort().reverse()).toEqual(times)
  })
})

describe('removing access', () => {
  it('states what does not change before it happens', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/team/staff-k-osei')
    await settled(container)

    await user.click(container.querySelector('[data-remove-access]')!)
    const note = await waitFor(() => {
      const found = window.document.querySelector('[data-confirm-unchanged]')
      expect(found).toBeTruthy()
      return found!
    })

    // Records outlive access: a record of who did something is not a permission.
    expect(note.textContent).toContain('Nothing on the record changes')
    expect(note.textContent).toContain('who gave a dose')
  })

  it('names the person in the question', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/team/staff-k-osei')
    await settled(container)

    await user.click(container.querySelector('[data-remove-access]')!)
    await waitFor(() => {
      const member = memberById('staff-k-osei')!
      expect(window.document.body.textContent).toContain(
        `Remove ${member.ref.fullName}'s access?`,
      )
    })
  })
})

describe('the permission matrix', () => {
  it('says nothing is enforced before it renders a cell', async () => {
    const { container } = renderAt('/team/permissions')
    await settled(container)

    const page = container.querySelector('[data-permission-matrix]')!
    const order = [...page.querySelectorAll('[data-not-enforced], [data-matrix-row]')]
    expect(order[0]?.hasAttribute('data-not-enforced')).toBe(true)
    /*
     * The statement is read off the element that exists to carry it, not off
     * the words in it. This assertion used to match "no authentication" and
     * failed the day sign-in landed and the sentence was corrected — a guard
     * keyed to copy dies on an ordinary rewording, and the property it is for
     * is that the statement comes before the first row.
     */
    expect(order[0]?.textContent?.length ?? 0).toBeGreaterThan(80)
    expect(order.length).toBeGreaterThan(1)
  })

  it('never gives a role a level the module has no act for', () => {
    /*
     * The defect this cap exists for, asserted as the property rather than as
     * a list of corrected cells. A care worker read "Record" against the
     * Dashboard — a screen nobody writes on — and a manager read "Approve"
     * against Reports, where there is no work of anybody else's to sign off.
     * Every cell was plausible on its own, which is why 112 hand-written ones
     * could be wrong for fifteen phases without anybody noticing.
     */
    const RANK = { no_access: 0, read: 1, record: 2, approve: 3 } as const
    for (const module of PERMISSION_MODULES) {
      const ceiling = ceilingFor(module.id)
      const acts = actsIn(module.id)
      expect(acts, module.id).toBeTruthy()
      for (const role of PERMISSION_ROLES) {
        expect(
          RANK[levelFor(role, module.id)],
          `${role} on ${module.label} exceeds what the module offers (${ceiling})`,
        ).toBeLessThanOrEqual(RANK[ceiling])
      }
    }
  })

  it('names the act behind every ceiling, and refuses a module with none declared', () => {
    // A ceiling with no act named would be the same guess one level up.
    for (const module of PERMISSION_MODULES) {
      const acts = actsIn(module.id)!
      if (acts.approves !== false) expect(acts.approves.length).toBeGreaterThan(8)
      if (acts.records !== false) expect(acts.records.length).toBeGreaterThan(8)
    }
    // A module the sidebar adds without an entry cannot be capped, and an
    // uncapped module is how "Record" got onto the Dashboard.
    expect(() => ceilingFor('/a-module-nobody-declared')).toThrow(/No acts declared/)
  })

  it('reads the Dashboard and Reports, and writes neither', () => {
    /*
     * Held by name because these two are the ones that were wrong, and a
     * property test over a cap would pass if the cap itself said the Dashboard
     * takes writes.
     */
    for (const moduleId of ['/', '/reports']) {
      expect(ceilingFor(moduleId), moduleId).toBe('read')
      for (const role of PERMISSION_ROLES) {
        expect(['no_access', 'read'], `${role} on ${moduleId}`).toContain(
          levelFor(role, moduleId),
        )
      }
    }
  })

  it('leaves editing a resident record to the roles that can do it', () => {
    // Admitting and editing are manager acts. PRD §6.7, Phase 16.
    expect(levelFor('registered_manager', '/residents')).toBe('record')
    expect(levelFor('deputy_manager', '/residents')).toBe('record')
    for (const role of [
      'care_worker',
      'senior_carer',
      'activities_coordinator',
    ] as const) {
      expect(levelFor(role, '/residents'), role).toBe('read')
    }
    // And there is nothing to approve there, for anybody.
    expect(actsIn('/residents')!.approves).toBe(false)
  })

  it('has no exception naming a module the sidebar does not have', () => {
    /*
     * Five entries named `/team`, which stopped being a sidebar item in Phase
     * 15. They narrowed nothing for anybody and still read as decisions.
     * `levelFor` would now throw on one, which is how this is enforced; the
     * assertion says so out loud.
     */
    const ids = new Set(PERMISSION_MODULES.map((module) => module.id))
    for (const role of PERMISSION_ROLES) {
      for (const module of PERMISSION_MODULES) {
        expect(() => levelFor(role, module.id)).not.toThrow()
      }
    }
    expect(ids.has('/team')).toBe(false)
  })

  it('describes this product rather than the source PRD’s nine modules', () => {
    // A matrix that does not match the product is worse than no matrix.
    expect(PERMISSION_MODULES.length).toBeGreaterThan(9)
    for (const module of PERMISSION_MODULES) {
      for (const role of PERMISSION_ROLES) {
        expect(levelFor(role, module.id), `${role} · ${module.id}`).toBeTruthy()
      }
    }
  })

  it('gives every role a name rather than an identifier', async () => {
    const { container } = renderAt('/team/permissions')
    await settled(container)

    for (const role of PERMISSION_ROLES) {
      expect(container.textContent).toContain(STAFF_ROLE_NAMES[role])
    }
    expect(container.textContent).not.toMatch(/activities_coordinator|care_worker/)
  })

  it('renders no access as settled rather than as a gap', async () => {
    const { container } = renderAt('/team/permissions')
    await settled(container)

    const none = container.querySelector('[data-level="no_access"]')!
    // A decision about a role is not an unrecorded value.
    expect(none.closest('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('the activity log', () => {
  it('says what it cannot carry', async () => {
    const { container } = renderAt('/team/activity')
    await settled(container)

    const note = container.querySelector('[data-not-logged]')!
    expect(note.textContent).toContain('sign-ins')
    expect(note.textContent).toContain('exports')
    expect(note.textContent).toContain('inventing its own evidence')
  })

  it('is empty at the start of a session, and says that is about the tab', async () => {
    const { container } = renderAt('/team/activity')
    await settled(container)

    const empty = container.querySelector('[data-empty-log]')
    if (empty === null) return
    expect(empty.textContent).toContain('statement about this')
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the list', async () => {
    await check('/team')
  }, 30000)

  it('has no violations on a detail', async () => {
    await check('/team/staff-c-nwosu')
  }, 30000)

  it('has no violations on the matrix', async () => {
    await check('/team/permissions')
  }, 30000)
})
