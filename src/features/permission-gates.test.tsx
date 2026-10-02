import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { levelFor } from '@/features/team/permissions'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { AssessmentFormRoute } from '@/features/risk/AssessmentFormRoute'
import { WholePlanReviewRoute } from '@/features/reviews/WholePlanReviewRoute'
import { DomainEditorRoute } from '@/features/care-plan/DomainEditorRoute'
import { CarePlanTab } from '@/features/care-plan/CarePlanTab'
import { AdmissionRoute } from '@/features/residents/AdmissionRoute'
import { GeneralInformationTab } from '@/features/residents/GeneralInformationTab'
import { UploadDrawer } from '@/features/documents/UploadDrawer'
import { StatusDialog } from '@/features/handover/StatusDialog'
import { handovers } from '@/data/fixtures/handover'

/**
 * Write gates on the clinical record modules.
 *
 * One describe per module, so mutating one module's gate fails that module's
 * tests and nothing else — a single shared assertion would let one passing
 * module cover another's missing check.
 *
 * Which level each asks comes from `MODULE_ACTS`, not from a guess:
 * `/risk-assessments` and `/reviews` declare `approves: false`, so completing
 * is the only act and `canRecordIn` is the whole question; `/care-plans`
 * declares both, so drafting and signing ask different things.
 */

/*
 * **Derived from the table, never hand-copied.** A list written out here is a
 * second copy of the permission matrix, and two copies drift — §8's proxy
 * entry. It also gets the answer wrong immediately: `senior_carer` and
 * `care_worker` are `read` on `/care-plans` by a per-role override, so a
 * hand-written "these roles may draft" was wrong on the first run.
 *
 * Only roles a staff fixture actually holds, because `SignInAs` refuses to
 * render as one nobody has.
 */
const TESTABLE: StaffRole[] = [
  'registered_manager',
  'deputy_manager',
  'senior_carer',
  'care_worker',
  'auditor',
]
const mayRecordIn = (moduleId: string) =>
  TESTABLE.filter((role) => {
    const level = levelFor(role, moduleId)
    return level === 'record' || level === 'approve'
  })
const mayNotRecordIn = (moduleId: string) =>
  TESTABLE.filter((role) => !mayRecordIn(moduleId).includes(role))
const mayApproveIn = (moduleId: string) =>
  TESTABLE.filter((role) => levelFor(role, moduleId) === 'approve')

/* Rosewood Court, the home every signed-in role here is appointed to. */
const resident = residents.find((one) => one.siteId === 'site-rosewood-court')!

function renderAt(
  role: StaffRole,
  children: { path: string; element: React.ReactElement }[],
  entry: string,
) {
  const router = createMemoryRouter(
    [{ path: 'residents/:residentId', element: <ResidentProfileRoute />, children }],
    { initialEntries: [entry] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={role} />
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const refusedFor = async (container: HTMLElement, phrase: string) => {
  await waitFor(
    () => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    },
    { timeout: 5000 },
  )
  expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
    phrase,
  )
}

/* Waits for the control, never for the refusal's absence — the refusal is
   absent before anything has rendered, so that would pass on a blank screen. */
const offered = async (container: HTMLElement, selector: string) => {
  await waitFor(
    () => {
      expect(container.querySelector(selector)).toBeTruthy()
    },
    { timeout: 5000 },
  )
  expect(container.querySelector('[data-read-only-here]')).toBeNull()
}

describe('completing a risk assessment', () => {
  const at = (role: StaffRole) =>
    renderAt(
      role,
      [{ path: 'risk-assessments/:templateId', element: <AssessmentFormRoute /> }],
      `/residents/${resident.id}/risk-assessments/falls`,
    )

  it.each(mayNotRecordIn('/risk-assessments'))(
    'refuses %s, and says why',
    async (role) => {
      await refusedFor(at(role).container, 'complete one')
    },
  )

  it.each(mayRecordIn('/risk-assessments'))('offers %s the form', async (role) => {
    await offered(at(role).container, '[data-record-assessment]')
  })
})

describe('completing a whole-plan review', () => {
  const at = (role: StaffRole) =>
    renderAt(
      role,
      [{ path: 'care-plan/review', element: <WholePlanReviewRoute /> }],
      `/residents/${resident.id}/care-plan/review`,
    )

  it.each(mayNotRecordIn('/reviews'))('refuses %s, and says why', async (role) => {
    await refusedFor(at(role).container, 'complete one')
  })

  it.each(mayRecordIn('/reviews'))('offers %s the review', async (role) => {
    await offered(at(role).container, '[data-complete]')
  })
})

describe('drafting and signing a care plan domain', () => {
  const editor = (role: StaffRole) =>
    renderAt(
      role,
      [{ path: 'care-plan/:domainId', element: <DomainEditorRoute /> }],
      `/residents/${resident.id}/care-plan/personal_care`,
    )
  const tab = (role: StaffRole) =>
    renderAt(
      role,
      [{ path: 'care-plan', element: <CarePlanTab /> }],
      `/residents/${resident.id}/care-plan`,
    )

  it.each(mayNotRecordIn('/care-plans'))(
    'refuses %s both acts, and says why',
    async (role) => {
      const { container } = editor(role)
      await refusedFor(container, 'save a draft')
      expect(container.querySelector('[data-save-draft]')).toBeNull()
      expect(container.querySelector('[data-finalise]')).toBeNull()
    },
  )

  /*
   * **The distinction the module declaration exists to make.** A role that
   * may draft and not sign keeps Save draft and loses Finalise. Asserting
   * only that the auditor is refused would pass on a gate that refused the
   * signing act to everybody.
   */
  /*
   * **Nobody in this build holds exactly `record` on `/care-plans`.** The
   * module declares both acts, and the per-role overrides give every role
   * either `approve` or `read`, so the draft-but-not-sign state is declared
   * and unreachable — the same shape as a branch no fixture renders. Derived
   * rather than asserted, so this list is empty today and fills itself in if
   * a role ever lands between the two.
   */
  it.each(
    mayRecordIn('/care-plans').filter(
      (role) => !mayApproveIn('/care-plans').includes(role),
    ),
  )('lets %s draft but not sign', async (role) => {
    const { container } = editor(role)
    await offered(container, '[data-save-draft]')
    expect(container.querySelector('[data-finalise]')).toBeNull()
  })

  it.each(mayApproveIn('/care-plans'))('lets %s draft and sign', async (role) => {
    const { container } = editor(role)
    await offered(container, '[data-save-draft]')
    expect(container.querySelector('[data-finalise]')).toBeTruthy()
  })

  it.each(mayNotRecordIn('/care-plans'))(
    'offers %s no way to add a domain',
    async (role) => {
      const { container } = tab(role)
      await refusedFor(container, 'add a domain')
      expect(container.querySelector('[data-add-custom-domain]')).toBeNull()
    },
  )

  it.each(mayRecordIn('/care-plans'))(
    'offers %s the add-domain control',
    async (role) => {
      await offered(tab(role).container, '[data-add-custom-domain]')
    },
  )
})

describe('admitting a resident', () => {
  const at = (role: StaffRole) => {
    const router = createMemoryRouter([{ path: '/', element: <AdmissionRoute /> }], {
      initialEntries: ['/'],
    })
    return render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <SignInAs as={role} />
            <RouterProvider router={router} />
            <ToastViewport />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it.each(mayNotRecordIn('/residents'))('refuses %s, and says why', async (role) => {
    const { container } = at(role)
    await refusedFor(container, 'admit one')
    expect(container.querySelector('[data-admission]')).toBeNull()
    expect(container.querySelector('[data-steps]')).toBeNull()
  })

  it.each(mayRecordIn('/residents'))('offers %s the form', async (role) => {
    await offered(at(role).container, '[data-admission]')
  })
})

describe("editing a resident's record", () => {
  const at = (role: StaffRole) =>
    renderAt(
      role,
      [{ path: '', element: <GeneralInformationTab /> }],
      `/residents/${resident.id}`,
    )

  /*
   * The record stays on screen either way — this tab IS the record. What goes
   * is the one control that writes to it, and `AllergyPanel` drops its action
   * when the callback is undefined rather than rendering a dead button.
   */
  it.each(mayNotRecordIn('/residents'))('refuses %s, and says why', async (role) => {
    const { container } = at(role)
    await refusedFor(container, 'edit it')
    expect(container.textContent).toContain('Clinical')
  })

  it.each(mayRecordIn('/residents'))('does not refuse %s', async (role) => {
    const { container } = at(role)
    await waitFor(
      () => {
        expect(container.textContent).toContain('Clinical')
      },
      { timeout: 5000 },
    )
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})

describe('filing a document', () => {
  const at = (role: StaffRole) =>
    render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as={role} />
          <UploadDrawer
            owner={{ kind: 'resident', residentId: resident.id }}
            subjectName={resident.preferredName}
            onFiled={() => undefined}
          />
        </TooltipProvider>
      </SessionProvider>,
    )

  it.each(mayNotRecordIn('/documents'))('refuses %s, and says why', async (role) => {
    const { container } = at(role)
    await refusedFor(container, 'file one')
    expect(container.querySelector('[data-add-document]')).toBeNull()
  })

  it.each(mayRecordIn('/documents'))('offers %s the control', async (role) => {
    await offered(at(role).container, '[data-add-document]')
  })
})

describe('marking a resident on the handover board', () => {
  const handover = handovers.find((one) => one.siteId === 'site-rosewood-court')!

  const at = (role: StaffRole) =>
    render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as={role} />
          <StatusDialog
            handoverId={handover.id}
            resident={resident}
            current={{ kind: 'not_reviewed' }}
            onRecorded={() => undefined}
          />
        </TooltipProvider>
      </SessionProvider>,
    )

  it.each(mayNotRecordIn('/handover'))('refuses %s, and says why', async (role) => {
    const { container } = at(role)
    await refusedFor(container, 'mark a resident on it')
    expect(container.querySelector('button')).toBeNull()
  })

  it.each(mayRecordIn('/handover'))('offers %s the control', async (role) => {
    const { container } = at(role)
    await waitFor(
      () => {
        expect(container.querySelector('button')).toBeTruthy()
      },
      { timeout: 5000 },
    )
    expect(container.textContent).toContain('Review')
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})
