import { afterEach, describe, expect, it, vi } from 'vitest'
import { signingCodeFor } from '@/data/access/team-store'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { SignInAs } from '@/test/sign-in-as'
import { useSession } from '@/app/session/use-session'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { residentsBySite } from '@/data/fixtures/residents'
import { openHandoverFor } from '@/data/fixtures/handover'
import { boardFor, resetHandoverSession } from '@/data/access/handover-store'
import * as client from '@/data/access/client'
import { HandoverRoute } from './HandoverRoute'

/**
 * Shift handover. PRD §6.3.
 *
 * The screen exists for its fourth state. A three-status handover lets a shift
 * that ran out of time mark the last four residents All Well and go home, and
 * nothing afterwards can tell that from four people who were checked.
 */

afterEach(() => {
  resetHandoverSession()
  vi.restoreAllMocks()
})

/** Ashgrove is the thin site: four residents, and nobody urgent on it. */
function GoToAshgrove() {
  const { sites, setActiveSite } = useSession()
  return (
    <button
      type="button"
      onClick={() => setActiveSite(sites.find((s) => s.id === 'site-ashgrove-lodge')!)}
    >
      go to ashgrove
    </button>
  )
}

function renderHandover(extra?: React.ReactNode) {
  const router = createMemoryRouter(
    [{ path: '/handover', element: <HandoverRoute /> }],
    {
      initialEntries: ['/handover'],
    },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          {extra}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const ready = async (container: HTMLElement) => {
  await waitFor(() =>
    expect(container.querySelector('[data-resident]')).toBeInTheDocument(),
  )
  return container
}

/**
 * Every resident on the board, across all four status tabs.
 *
 * The four statuses were stacked sections and are now tabs, so only one
 * group's rows are in the document at a time. The rule they were written for
 * has not changed: absence from the list is the same bug as a blank cell, and
 * everybody living here is still on the handover. What changed is that a sweep
 * of the whole board has to open each tab to see it.
 */
async function everyResidentOnTheBoard(
  container: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const tab of [...container.querySelectorAll('[data-status-tab]')]) {
    await user.click(tab)
    for (const row of container.querySelectorAll('[data-resident]')) {
      ids.add(row.getAttribute('data-resident')!)
    }
  }
  return ids
}

/** Open one status tab and hand back its panel. */
async function openStatus(
  container: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
  id: string,
): Promise<HTMLElement> {
  await user.click(container.querySelector(`[data-status-tab="${id}"]`)!)
  return container.querySelector(`[data-group="${id}"]`)!.closest('div')!
}

describe('every resident is on the handover', () => {
  /**
   * The list is built from the site's residents, never from the handover
   * entries. Iterating the entries would make "nobody looked at Mrs Adeyemi"
   * indistinguishable from "Mrs Adeyemi is not here".
   */
  it('lists everybody living at the site, not everybody somebody wrote about', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const expected = residentsBySite('site-rosewood-court')
    const session = openHandoverFor('site-rosewood-court')!
    expect(session.entries.length).toBeLessThan(expected.length)

    const onTheBoard = await everyResidentOnTheBoard(container, user)
    for (const resident of expected) {
      expect(
        onTheBoard.has(resident.id),
        `${resident.fullLegalName} is missing from the handover`,
      ).toBe(true)
    }
  }, 30000)

  it('hatches the ones nobody looked at, rather than leaving them out', async () => {
    const { container } = renderHandover()
    await ready(container)

    const unreviewed = container.querySelectorAll('[data-status="not_reviewed"]')
    expect(unreviewed.length).toBeGreaterThan(0)
    for (const row of unreviewed) {
      expect(row.querySelector('[data-state="unrecorded"]')).toBeTruthy()
      // The label, and only the label. The detail line beneath it said the
      // same thing at greater length on every one of these rows; what
      // separates them is the silence measured underneath.
      expect(row.textContent).toMatch(/not reviewed/i)
    }
  })

  it('leads on the number still fixable, and it is the only lead figure', async () => {
    const { container } = renderHandover()
    await ready(container)

    // Rule 3b applied to a set of figures. "Not reviewed" is the one still
    // changeable before the signature goes on; urgent, needs-attention and
    // all-well are what it sits among. Four equal display figures would make
    // the reader do the ranking themselves.
    const glance = container.querySelector('[data-glance]')
    const leads = glance?.querySelectorAll('[data-emphasis="lead"]') ?? []
    expect(leads.length).toBe(1)
    expect(leads[0]?.textContent).toMatch(/not reviewed/i)
    expect(glance?.querySelectorAll('[data-emphasis="supporting"]').length).toBe(3)
  })

  it('says on the lead card what makes it the lead card', async () => {
    const { container } = renderHandover()
    await ready(container)

    // The ranking is an argument, and the card makes it rather than relying
    // on the reader inferring it from the type size.
    const lead = container.querySelector('[data-glance] [data-emphasis="lead"]')
    expect(lead?.textContent).toMatch(/still change before you sign/i)
  })

  it('keeps every coverage figure on its own denominator', async () => {
    const { container } = renderHandover()
    await ready(container)

    // Rule 4, and the denominators deliberately differ. "Not reviewed" is
    // measured across everybody living here; the three findings are measured
    // across the people somebody actually looked at, because counting the
    // unreviewed in that denominator would claim a coverage nobody has.
    const glance = container.querySelector('[data-glance]')
    expect(glance?.textContent).toMatch(/of 28 residents living at Rosewood Court/i)

    const supporting = glance?.querySelectorAll('[data-emphasis="supporting"]') ?? []
    expect(supporting.length).toBeGreaterThan(0)
    for (const card of supporting) {
      expect(card.textContent).toMatch(/of \d+ residents reviewed this shift/i)
    }
  })

  it('gives a hatched row the silence measured against the record', async () => {
    const { container } = renderHandover()
    await ready(container)

    // "Not reviewed" alone is flat: six of them look identical. The gap since
    // the last note is what tells a nurse which one to go to first.
    const silences = container.querySelectorAll('[data-silence]')
    expect(silences.length).toBeGreaterThan(0)
    for (const line of silences) {
      expect(line.textContent).toMatch(
        /No care note (recorded for .+|has ever been recorded)/i,
      )
    }
  })
})

describe('the screen ranks its own parts', () => {
  /**
   * Four titled sections, not a stack of equal cards. The screen names one
   * fact — these residents have not been looked at, and you are about to sign
   * — and the layout has to agree with it.
   */
  it('gives each part of the screen its own heading', async () => {
    const { container } = renderHandover()
    await ready(container)

    const headings = [...container.querySelectorAll('h2')].map((node) =>
      node.textContent?.trim(),
    )
    expect(headings).toEqual([
      'This shift at a glance',
      'Earlier handovers',
      'Residents',
      'Signature',
    ])
  })

  it('keeps the outline a screen reader gets the same as the one a reader sees', async () => {
    const { container } = renderHandover()
    await ready(container)

    // The ranking is spacing and type size for a sighted reader; it has to be
    // the heading level for everybody else, or the structure is carried by
    // appearance alone (PRD §7).
    expect(container.querySelectorAll('h1').length).toBe(1)
    for (const group of container.querySelectorAll('[data-group]')) {
      expect(group.querySelector('h3')).toBeTruthy()
    }
  })
})

describe('recorded and unremarkable is quiet', () => {
  it('does not give All well a filled pill', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)
    await openStatus(container, user, 'all_well')

    // Rule 3b. A filled green pill on twenty rows is twenty things shouting
    // "nothing to do here", on the one screen whose whole job is finding the
    // residents nobody looked at.
    const rows = container.querySelectorAll('[data-status="all_well"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.querySelector('[data-emphasis="settled"]')).toBeTruthy()
      expect(row.querySelector('[data-tone="positive"]')).toBeNull()
    }
  })

  it('keeps the whole record on the quiet row, author and time included', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)
    await openStatus(container, user, 'all_well')

    // Quiet is not hidden. The attribution is on the row exactly as it was
    // when this was a pill, always visible and never hover-only.
    const settled = container.querySelector(
      '[data-status="all_well"] [data-emphasis="settled"]',
    )
    expect(settled?.textContent).toMatch(/all well/i)
    expect(settled?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}|\d{2}:\d{2}/)
  })
})

describe('the shape of the shift is the tab strip', () => {
  it('offers all four statuses, in order, with Not reviewed first', async () => {
    const { container } = renderHandover()
    await ready(container)

    const tabs = [...container.querySelectorAll('[data-status-tab]')].map((node) =>
      node.getAttribute('data-status-tab'),
    )
    // Not reviewed leads urgent deliberately: it is the only group still
    // fixable before the signature goes on.
    expect(tabs).toEqual(['not_reviewed', 'urgent', 'needs_attention', 'all_well'])
    // And it is the one that opens.
    expect(
      container
        .querySelector('[data-status-tab="not_reviewed"]')!
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('measures each group against the right population', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const head = async (id: string) => {
      await user.click(container.querySelector(`[data-status-tab="${id}"]`)!)
      return container.querySelector(`[data-group="${id}"]`)?.textContent ?? ''
    }

    // Not reviewed is out of everybody living here. The other three are out of
    // the residents somebody actually looked at, because counting the
    // unreviewed in that denominator would claim a coverage nobody has.
    expect(await head('not_reviewed')).toMatch(/of 28 residents living here/i)
    expect(await head('urgent')).toMatch(/of 22 residents reviewed/i)
    expect(await head('all_well')).toMatch(/of 22 residents reviewed/i)
  })

  it('keeps an empty status on the strip and states its zero', async () => {
    /*
     * Dropping it would make "nobody is urgent" and "nobody checked whether
     * anybody is urgent" the same absence. The tab carries its count, so a
     * status with nobody in it is visible without being opened.
     */
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    for (const id of ['not_reviewed', 'urgent', 'needs_attention', 'all_well']) {
      const tab = container.querySelector(`[data-status-tab="${id}"]`)
      expect(tab, id).toBeTruthy()
      expect(tab!.querySelector('[data-numeric]')!.textContent, id).toMatch(/^\d/)
      await user.click(tab!)
      expect(container.querySelector(`[data-group="${id}"]`), id).toBeTruthy()
    }
  })
})

describe('a status has to say what it means', () => {
  it('refuses "needs attention" without saying what for', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const row = container.querySelector('[data-status="not_reviewed"]')!
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Review' }))

    const dialog = await screen.findByRole('dialog')
    // §2.4 — a write surface names its subject.
    expect(dialog.textContent).toMatch(/How is .+ for this handover\?/)

    const submit = within(dialog).getByRole('button', { name: /Record this for/ })
    // No default: "All well" is something somebody says, not something the
    // form said for them.
    expect(submit).toBeDisabled()

    await user.click(within(dialog).getByRole('radio', { name: 'Needs attention' }))
    expect(
      within(dialog).getByRole('button', { name: /Record this for/ }),
    ).toBeDisabled()

    await user.type(
      within(dialog).getByRole('textbox'),
      'Watch her fluids at supper and chart what she takes.',
    )
    expect(
      within(dialog).getByRole('button', { name: /Record this for/ }),
    ).toBeEnabled()
  }, 30000)

  it('records a status and moves the resident off the unreviewed count', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const before = container.querySelectorAll('[data-status="not_reviewed"]').length
    const row = container.querySelector('[data-status="not_reviewed"]')!
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Review' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'All well' }))
    await user.click(within(dialog).getByRole('button', { name: /Record this for/ }))

    await waitFor(() =>
      expect(container.querySelectorAll('[data-status="not_reviewed"]')).toHaveLength(
        before - 1,
      ),
    )
  }, 30000)
})

describe('a write says what it did', () => {
  /**
   * Both handover writes were silent. Recording a status moved a row from one
   * group to another and signing re-rendered a panel, and neither said
   * anything — a user could not tell a write that worked from one that did
   * not.
   *
   * The acknowledgement lives on the screen, not in the control, because the
   * control is unmounted by the very action it is confirming. That shape cost
   * the note review its confirmation until it was found.
   */
  it('names the resident and the status after recording one', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const row = container.querySelector('[data-status="not_reviewed"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Review' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: /all well/i }))
    await user.click(within(dialog).getByRole('button', { name: /save|record/i }))

    expect(await screen.findByText(/recorded as all well/i)).toBeVisible()
  }, 30000)

  it('says what the signature covered, not just that it worked', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    const outgoing = container.querySelector(
      '[data-signature="outgoing"]',
    ) as HTMLElement
    await user.click(within(outgoing).getByRole('button', { name: /sign as/i }))
    const dialog = await screen.findByRole('alertdialog')
    // The signature names a person, so the code goes in before the button.
    await user.type(
      within(dialog).getByLabelText(/signing code/i),
      signingCodeFor(staffOkonkwo.id),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Sign as handing over' }),
    )

    // A bare "Signed" leaves the user checking whether their record went in as
    // they meant it — and here what went in is the point: a signature given
    // with residents nobody looked at does not mean they are well.
    const toast = await screen.findByText(/handover signed:/i)
    expect(toast.textContent).toMatch(/\d+ of \d+ reviewed/i)
    expect(toast.textContent).toMatch(/not looked at/i)
  }, 30000)
})

describe('the dual signature', () => {
  it('renders unsigned as a state, not as a blank', async () => {
    const { container } = renderHandover()
    await ready(container)

    const outgoing = container.querySelector('[data-signature="outgoing"]')
    const incoming = container.querySelector('[data-signature="incoming"]')
    expect(outgoing?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(incoming?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(outgoing?.textContent).toMatch(/nobody has handed this shift over/i)
    expect(incoming?.textContent).toMatch(/nobody has accepted this handover/i)
  })

  it('warns that signing does not mean the unreviewed are well', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    await user.click(screen.getByRole('button', { name: 'Sign as handing over' }))
    const dialog = await screen.findByRole('alertdialog')
    // Names the site, and states what the signature will and will not mean.
    expect(dialog.textContent).toMatch(/at Rosewood Court on \d{2}\/\d{2}\/\d{4}\?/)
    expect(dialog.textContent).toMatch(/have not been looked at at all/i)
    expect(dialog.textContent).toMatch(/does not mean they are well/i)
  }, 30000)

  it('records what the signature covered, never a bare "signed"', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover()
    await ready(container)

    await user.click(screen.getByRole('button', { name: 'Sign as handing over' }))
    const dialog = await screen.findByRole('alertdialog')
    /*
     * The signature names a person now. The button is held until the code
     * belongs to whoever is signing, because a sign-off that only records that
     * somebody clicked is not an audit trail.
     */
    await user.type(
      within(dialog).getByLabelText(/signing code/i),
      signingCodeFor(staffOkonkwo.id),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Sign as handing over' }),
    )

    await waitFor(() =>
      expect(
        container.querySelector('[data-signature="outgoing"][data-signed="true"]'),
      ).toBeTruthy(),
    )
    const outgoing = container.querySelector('[data-signature="outgoing"]')
    expect(outgoing?.textContent).toMatch(/residents reviewed when this was signed/i)
    expect(outgoing?.textContent).toMatch(/had not been looked at/i)
  }, 30000)
})

describe('the stale state', () => {
  it('names an earlier handover nobody signed', async () => {
    const { container } = renderHandover()
    await ready(container)
    const unsigned = container.querySelectorAll('[data-unsigned]')
    expect(unsigned.length).toBeGreaterThan(0)
    for (const row of unsigned) {
      expect(row.textContent).toMatch(
        /never countersigned|never handed over|neither shift signed/i,
      )
    }
  })

  it('hatches it, because a missing signature is an omission', async () => {
    const { container } = renderHandover()
    await ready(container)

    // It read as amber prose before, which is the treatment for something
    // recorded that needs attention. Nothing was recorded. Rule 2: an
    // omission is carried by the pattern, and never by a RAG hue.
    const row = container.querySelector('[data-unsigned]')
    expect(row?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  /**
   * The other side of the Stale state, and **no fixture reaches it.**
   *
   * `handover.ts` builds exactly two sessions per site and the earlier one is
   * always the never-countersigned gap PRD §6.3 specifies, at both sites. So
   * "every earlier handover has both signatures" cannot render in this build,
   * and it is constructed here rather than left as code nothing runs.
   *
   * Neither the fixture nor the branch is wrong, which is why this is a test
   * rather than an edit: the Stale state is a deliberate gap and must stay,
   * and an empty section that renders nothing is the blank-cell bug one level
   * up — "no unsigned handovers" and "nobody built this section" would look
   * identical. Flagged in PROGRESS.md for a decision about a third fixture.
   */
  it('states the settled case, which no fixture currently reaches', async () => {
    const board = boardFor('site-rosewood-court')!
    vi.spyOn(client, 'getHandoverBoard').mockResolvedValueOnce({
      ...board,
      unsigned: [],
    })
    const { container } = renderHandover()
    await ready(container)

    expect(container.querySelectorAll('[data-unsigned]').length).toBe(0)
    expect(container.textContent).toMatch(
      /every earlier handover at this site has both signatures/i,
    )
    // Rule 3b: stated, not celebrated — and still carrying what it was
    // measured over, because "all signed" over an unstated population is the
    // reassuring half of a claim with no denominator.
    expect(container.textContent).toMatch(/measured across every handover recorded/i)
  }, 20000)

  it('says which half of the signature is missing', async () => {
    const { container } = renderHandover()
    await ready(container)

    // "Unsigned" across all three cases would lose the worst of them inside
    // the mildest. A gap that does not say which end is absent sends somebody
    // to ask both shifts.
    const row = container.querySelector('[data-unsigned]')
    expect(row?.textContent).toMatch(
      /never accepted by|never signed to say what they were handing over|shift nor the/i,
    )
  })
})

describe('read-only', () => {
  it('offers an auditor no way to review or sign', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover(<SignInAs as="auditor" />)
    await ready(container)

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Sign as handing over' }),
      ).not.toBeInTheDocument(),
    )
    // And no way to set a status either. Reading the handover is the whole of
    // an auditor's business with it.
    expect(screen.queryAllByRole('button', { name: 'Review' })).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: 'Change' })).toHaveLength(0)
    // The record itself is still fully readable, across all four tabs.
    expect((await everyResidentOnTheBoard(container, user)).size).toBe(28)
  }, 30000)

  /**
   * The other direction, and the reason the test above is evidence.
   *
   * A control that is absent for every role is a missing button rather than a
   * permission, and nothing in the assertion above can tell the two apart. The
   * senior carer is the case that matters: signing the handover is the act PRD
   * §1 gives the role, and the matrix withheld it until Phase 17.
   */
  it('offers a senior carer the signature the auditor cannot have', async () => {
    const { container } = renderHandover(<SignInAs as="senior_carer" />)
    await ready(container)

    expect(
      await screen.findByRole('button', { name: 'Sign as handing over' }),
    ).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Review' }).length).toBeGreaterThan(0)
  }, 30000)
})

describe('the states around the record', () => {
  /**
   * Loading and Error were the two states on this screen with no test behind
   * them. Both are written, both are reachable, and neither was checked —
   * which is how a state goes dead without anybody noticing.
   */
  it('says it is loading rather than showing an empty handover', () => {
    // Before the fixture promise resolves. An empty list rendered during a
    // load is a handover somebody could read as "nobody is here".
    renderHandover()
    expect(screen.getByRole('status')).toHaveTextContent(/loading the handover/i)
  })

  it('shows nothing rather than a partial handover when the read fails', async () => {
    vi.spyOn(client, 'getHandoverBoard').mockRejectedValueOnce(new Error('nope'))
    renderHandover()

    // The reasoning is on the screen, not just in the code: a handover list
    // missing an unknown number of residents is one somebody would sign.
    expect(await screen.findByText(/this handover could not be loaded/i)).toBeVisible()
    expect(screen.queryByTestId('resident')).toBeNull()
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  it('recovers when the retry succeeds', async () => {
    const user = userEvent.setup()
    vi.spyOn(client, 'getHandoverBoard').mockRejectedValueOnce(new Error('nope'))
    const { container } = renderHandover()
    await screen.findByText(/this handover could not be loaded/i)

    // Retry has to actually retry. A button that re-renders the same error is
    // worse than no button.
    await user.click(screen.getByRole('button', { name: /try again/i }))
    await ready(container)
    expect(screen.queryByText(/this handover could not be loaded/i)).toBeNull()
  }, 20000)
})

describe('the thin site', () => {
  /**
   * Ashgrove has four residents and nobody urgent. It is the fixture that
   * reaches the empty-group and zero-figure branches — without it they are
   * code nothing renders, which is the first standing check in CLAUDE.md §8.
   */
  it('states a zero rather than dropping the group', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover(<GoToAshgrove />)
    await ready(container)
    await user.click(screen.getByRole('button', { name: 'go to ashgrove' }))

    /*
     * Waits on the board's own denominator rather than on a row count: with
     * the statuses tabbed only one group's rows are in the document, so a
     * count of four would never arrive and the wait would time out on a
     * screen that had switched correctly.
     */
    await waitFor(() =>
      expect(
        container.querySelector('[data-group="not_reviewed"]')?.textContent,
      ).toMatch(/of 4 residents living here/i),
    )
    // "Nobody is urgent" and "nobody has checked whether anybody is urgent"
    // must not be the same absence.
    await user.click(container.querySelector('[data-status-tab="urgent"]')!)
    const panel = container.querySelector('[data-handover-groups]') as HTMLElement
    expect(panel.textContent).toMatch(/0 of 3 residents reviewed/i)
    expect(panel.textContent).toMatch(/nobody who was reviewed is urgent/i)
  }, 20000)

  it('keeps the lead figure leading even when it is small', async () => {
    const user = userEvent.setup()
    const { container } = renderHandover(<GoToAshgrove />)
    await ready(container)
    await user.click(screen.getByRole('button', { name: 'go to ashgrove' }))

    /*
     * Waits on the board's own denominator rather than on a row count: with
     * the statuses tabbed only one group's rows are in the document, so a
     * count of four would never arrive and the wait would time out on a
     * screen that had switched correctly.
     */
    await waitFor(() =>
      expect(
        container.querySelector('[data-group="not_reviewed"]')?.textContent,
      ).toMatch(/of 4 residents living here/i),
    )
    const glance = container.querySelector('[data-glance]')
    expect(glance?.querySelectorAll('[data-emphasis="lead"]').length).toBe(1)
    expect(glance?.textContent).toMatch(/of 4 residents living at Ashgrove Lodge/i)
  }, 20000)
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderHandover()
    await ready(container)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)
})
