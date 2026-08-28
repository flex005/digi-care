import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { BODY_REGIONS } from '@/data/types'
import {
  BACK_REGIONS,
  FRONT_REGIONS,
  regionLabel,
  viewsFor,
} from '@/assets/body-map/regions'
import { ReportIncidentRoute, outstanding } from './ReportIncidentRoute'

/**
 * Report an incident. PRD §6.5.
 *
 * Three things must survive translation from the reference, and each has a
 * test that fails on the real defect:
 *
 *   1. the list beside the map is the record and the map is only the input;
 *   2. left and right are the resident's, not the viewer's;
 *   3. injury is three states, and "found" with nothing marked is incomplete.
 */

function renderForm() {
  const router = createMemoryRouter(
    [{ path: '/incidents/new', element: <ReportIncidentRoute /> }],
    { initialEntries: ['/incidents/new'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const chooseInjury = async (
  user: ReturnType<typeof userEvent.setup>,
  choice: string,
) => {
  await user.click(document.querySelector(`[data-injury-choice="${choice}"]`)!)
}

describe('the map is the input, the list is the record', () => {
  it('gives every region a real button with an accessible name', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')

    const regions = container.querySelectorAll('[data-region]')
    expect(regions.length).toBe(FRONT_REGIONS.length + BACK_REGIONS.length)

    for (const region of regions) {
      // A diagram alone is unreadable to a screen reader, so nothing here is
      // shape-only: a name, a pressed state and a tab stop on every one.
      expect(region.getAttribute('role')).toBe('button')
      expect(region.getAttribute('aria-label')?.length).toBeGreaterThan(0)
      expect(region.getAttribute('aria-pressed')).toBe('false')
      expect(region.getAttribute('tabindex')).toBe('0')
    }
  })

  it('puts a marked site into the list as text', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')

    await user.click(container.querySelector('[data-region="knee_left"]')!)

    const listed = container.querySelector('[data-marked-site="knee_left"]')
    expect(listed, 'a marked site did not reach the list').toBeTruthy()
    expect(listed!.textContent).toContain('Left knee')
  })

  it('marks from the keyboard, not only the pointer', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')

    const region = container.querySelector<HTMLElement>('[data-region="sacrum"]')!
    region.focus()
    await user.keyboard('{Enter}')
    expect(container.querySelector('[data-marked-site="sacrum"]')).toBeTruthy()

    // And unmarks again with Space.
    region.focus()
    await user.keyboard(' ')
    expect(container.querySelector('[data-marked-site="sacrum"]')).toBeNull()
  })

  it('removes a site from the list without touching the map', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')
    await user.click(container.querySelector('[data-region="hip_right"]')!)

    const row = container.querySelector('[data-marked-site="hip_right"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: /Remove Right hip/ }))

    expect(container.querySelector('[data-marked-site="hip_right"]')).toBeNull()
    expect(
      container
        .querySelector('[data-region="hip_right"]')!
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('carries the marked state on more than colour', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')
    await user.click(container.querySelector('[data-region="chest"]')!)

    // Colour is never the sole carrier (§7): the region reports pressed, and
    // the site is in the list as words.
    const region = container.querySelector('[data-region="chest"]')!
    expect(region.getAttribute('aria-pressed')).toBe('true')
    expect(region.getAttribute('data-marked')).toBe('true')
    expect(container.querySelector('[data-marked-site="chest"]')).toBeTruthy()
  })
})

describe("left and right are the resident's", () => {
  it('draws the resident’s left on the right of the front view', () => {
    const leftShoulder = FRONT_REGIONS.find((r) => r.id === 'shoulder_left')!
    const rightShoulder = FRONT_REGIONS.find((r) => r.id === 'shoulder_right')!

    // Facing them: their left is on the viewer's right, so it has the larger x.
    const x = (shape: typeof leftShoulder.shape) =>
      shape.kind === 'ellipse' ? shape.cx : shape.x
    expect(x(leftShoulder.shape)).toBeGreaterThan(x(rightShoulder.shape))
  })

  it('mirrors it on the back view', () => {
    const leftShoulder = BACK_REGIONS.find((r) => r.id === 'shoulder_left')!
    const rightShoulder = BACK_REGIONS.find((r) => r.id === 'shoulder_right')!

    // Standing behind them: their left is now on the viewer's left. Getting
    // this wrong sends somebody to look at the wrong limb, which is a clinical
    // error rather than a labelling one.
    const x = (shape: typeof leftShoulder.shape) =>
      shape.kind === 'ellipse' ? shape.cx : shape.x
    expect(x(leftShoulder.shape)).toBeLessThan(x(rightShoulder.shape))
  })

  it('mirrors every paired region, not only the shoulders', () => {
    const paired = FRONT_REGIONS.filter(
      (region) => region.id.endsWith('_left') || region.id.endsWith('_right'),
    )
    expect(paired.length).toBeGreaterThan(8)

    const x = (region: (typeof FRONT_REGIONS)[number]) =>
      region.shape.kind === 'ellipse' ? region.shape.cx : region.shape.x

    for (const front of paired) {
      const back = BACK_REGIONS.find((region) => region.id === front.id)
      if (!back) continue
      const backX = back.shape.kind === 'ellipse' ? back.shape.cx : back.shape.x
      // Same site, opposite sides of the midline between the two views.
      expect(
        Math.sign(x(front) - 100),
        `${front.id} is on the same side in both views`,
      ).toBe(-Math.sign(backX - 100))
    }
  })

  it('says which side in every label that has one', () => {
    for (const region of [...FRONT_REGIONS, ...BACK_REGIONS]) {
      if (!region.id.endsWith('_left') && !region.id.endsWith('_right')) continue
      const side = region.id.endsWith('_left') ? 'Left' : 'Right'
      expect(region.label, `${region.id} does not name its side`).toContain(side)
    }
  })

  it('is the same site whichever view it was marked from', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')

    // An upper arm is markable from the front and the back and is one arm.
    expect(viewsFor('upper_arm_left')).toEqual(['front', 'back'])

    const front = container.querySelector('[data-body-map="front"]')!
    const back = container.querySelector('[data-body-map="back"]')!
    await user.click(front.querySelector('[data-region="upper_arm_left"]')!)

    expect(
      back
        .querySelector('[data-region="upper_arm_left"]')!
        .getAttribute('aria-pressed'),
      'the same arm did not read as marked on the other view',
    ).toBe('true')
    expect(container.querySelectorAll('[data-marked-site]').length).toBe(1)
  })

  it('names a site once, however many views draw it', () => {
    // The front calls it "Head" and the back "Back of head"; the record says
    // "Head" either way, because it is one site.
    expect(regionLabel('head')).toBe('Head')
    expect(regionLabel('sacrum')).toBe('Sacrum')
    expect(regionLabel('heel_left')).toBe('Left heel')
  })

  it('draws every region the closed list names', () => {
    // Absence from a list is the same bug as a blank cell: a region in the
    // union that no view draws could never be marked.
    const drawn = new Set([...FRONT_REGIONS, ...BACK_REGIONS].map((r) => r.id))
    const missing = BODY_REGIONS.map((region) => region.id).filter(
      (id) => !drawn.has(id),
    )
    expect(missing, `regions no view draws: ${missing.join(', ')}`).toEqual([])
  })
})

describe('injury is three states, not a checkbox', () => {
  it('offers all three, and none of them selected', async () => {
    const { container } = renderForm()

    for (const choice of ['not_checked', 'none_found', 'found']) {
      const option = container.querySelector(`[data-injury-choice="${choice}"]`)!
      expect(option, choice).toBeTruthy()
      // No default: a pre-selected answer is an answer nobody gave.
      expect(option.getAttribute('aria-checked')).toBe('false')
    }
  })

  it('shows the map only for injuries found', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()

    expect(container.querySelector('[data-body-map-area]')).toBeNull()
    await chooseInjury(user, 'none_found')
    expect(container.querySelector('[data-body-map-area]')).toBeNull()
    await chooseInjury(user, 'found')
    expect(container.querySelector('[data-body-map-area]')).toBeTruthy()
  })

  it('hatches the list until a site is marked', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')

    // "Injuries found" with nothing marked is an incomplete record, not an
    // empty one — so it renders as a gap rather than as blank space.
    const empty = container.querySelector('[data-marked-empty]')!
    expect(empty).toBeTruthy()
    expect(empty.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(empty.textContent).toMatch(/incomplete record/)

    await user.click(container.querySelector('[data-region="knee_right"]')!)
    expect(container.querySelector('[data-marked-empty]')).toBeNull()
  })
})

describe('what the form is waiting on', () => {
  const complete = {
    subject: 'resident' as const,
    resident: { id: 'res-okafor' } as never,
    type: 'fall_witnessed' as const,
    occurredAt: '2026-08-23T09:00',
    description: 'Went down beside the chair.',
    severity: 'low_harm' as const,
    injury: 'none_found' as const,
    marked: [],
    witnessChoice: 'nobody' as const,
    witnessNames: '',
    immediateAction: 'Stayed with them and called the senior.',
    gp: 'contacted' as const,
    family: 'contacted' as const,
    emergency: 'not_called' as const,
    notRequiredReason: '',
  }

  it('is satisfied by a complete answer', () => {
    expect(outstanding(complete)).toEqual([])
  })

  it('names each missing answer rather than counting them', () => {
    expect(outstanding({ ...complete, type: '' })).toEqual(['a type'])
    expect(outstanding({ ...complete, subject: undefined })).toEqual([
      'who this happened to',
    ])
    expect(outstanding({ ...complete, severity: '' })).toEqual(['how much harm'])
    expect(outstanding({ ...complete, injury: undefined })).toEqual([
      'whether they were checked for injury',
    ])
  })

  it('holds injuries-found until a site is marked', () => {
    expect(outstanding({ ...complete, injury: 'found', marked: [] })).toEqual([
      'at least one injury site',
    ])
    expect(
      outstanding({ ...complete, injury: 'found', marked: ['knee_left'] }),
    ).toEqual([])
  })

  it('asks whether anybody saw it, and never accepts a blank', () => {
    // The reference's hint said "leave blank if nobody saw it", which would
    // have made an empty field mean either "nobody saw it" or "nobody recorded
    // who" — on an unwitnessed fall, the difference the record turns on.
    expect(outstanding({ ...complete, witnessChoice: '' })).toEqual([
      'whether anybody saw it',
    ])
    expect(
      outstanding({ ...complete, witnessChoice: 'witnessed', witnessNames: '' }),
    ).toEqual(['who saw it'])
    expect(
      outstanding({ ...complete, witnessChoice: 'witnessed', witnessNames: 'K. Osei' }),
    ).toEqual([])
  })

  it('requires what you did, so there is no blank to interpret', () => {
    expect(outstanding({ ...complete, immediateAction: '   ' })).toEqual([
      'what you did about it',
    ])
  })

  it('asks for a reason wherever contact was not required', () => {
    // A decision without a reason reads the same as a call nobody made, which
    // is the distinction `ContactState` exists to hold.
    expect(outstanding({ ...complete, gp: 'not_required' })).toEqual([
      'why contact was not required',
    ])
    expect(
      outstanding({
        ...complete,
        family: 'not_required',
        notRequiredReason: 'Family have asked not to be contacted out of hours.',
      }),
    ).toEqual([])
    // "Not yet" is unfinished rather than decided, so it needs no reason.
    expect(outstanding({ ...complete, gp: 'not_yet' })).toEqual([])
  })

  it('treats not-checked as an answer, because it is one', () => {
    // A gap somebody recorded is a record. It will show as a gap on the
    // detail screen; what it is not is a missing answer on this form.
    expect(outstanding({ ...complete, injury: 'not_checked' })).toEqual([])
  })
})

describe('the subject is chosen, so the choice is closed', () => {
  it('offers no resident only for the two types that can have none', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()

    const option = container.querySelector('[data-subject-choice="no_resident"]')!
    expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(option.textContent).toMatch(/equipment failure or a near miss/)

    // Shown disabled rather than hidden: an option that appears and disappears
    // as the type changes is one nobody can plan around.
    await user.click(option)
    expect(option.getAttribute('aria-checked')).toBe('false')
  })

  it('names the person and their allergy once one is chosen', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()

    await user.click(container.querySelector('[data-subject-choice="resident"]')!)
    await user.click(screen.getByRole('combobox', { name: 'Resident' }))
    await user.click(screen.getAllByRole('option')[0]!)

    const card = await waitFor(() => {
      const found = container.querySelector('[data-subject]')
      expect(found).toBeTruthy()
      return found!
    })

    expect(card.textContent).toMatch(/Room \d+|Room not recorded/)
    expect(card.textContent).toMatch(/Born/)
    // An allergy is an attribute of the person, not an alert on a task — so it
    // renders in all three states. Shown only where one exists, its absence
    // would read as "no allergy".
    expect(card.textContent).toMatch(
      /Allerg|No known allergies|not recorded|Not recorded/i,
    )
  })
})

describe('accessibility', () => {
  it('has no axe violations with the map open', async () => {
    const { container } = renderForm()
    const user = userEvent.setup()
    await chooseInjury(user, 'found')
    await user.click(container.querySelector('[data-region="knee_left"]')!)

    expect((await axe(container)).violations).toEqual([])
  }, 60000)
})
