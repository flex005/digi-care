import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pager, usePaged } from './Pager'

/**
 * The pager, tested once rather than at each of its consumers.
 *
 * The slice line lives inside this component precisely so it cannot be
 * forgotten on the sixth screen, and that decision is only worth anything if
 * something checks it. A pager that hid rows without saying how many exist
 * would tell a reader the home holds twenty-five.
 */
function Harness({ count }: { count: number }) {
  const items = Array.from({ length: count }, (_, i) => `row-${i}`)
  const paged = usePaged(items)
  return (
    <>
      <ul>
        {paged.shown.map((row) => (
          <li key={row} data-row={row}>
            {row}
          </li>
        ))}
      </ul>
      <Pager paged={paged} total={items.length} noun="reviews" />
    </>
  )
}

describe('paging says what it hides', () => {
  it('states the slice and the whole', () => {
    const { container } = render(<Harness count={419} />)
    expect(container.querySelectorAll('[data-row]')).toHaveLength(25)
    // Both figures: what is on screen, and what it is a slice of.
    expect(container.querySelector('[data-pager-slice]')?.textContent).toBe(
      'Showing 1 to 25 of 419 reviews',
    )
  })

  it('moves, and the slice follows', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness count={419} />)
    await user.click(container.querySelector('[data-pager-next]')!)
    expect(container.querySelector('[data-pager-slice]')?.textContent).toBe(
      'Showing 26 to 50 of 419 reviews',
    )
    expect(container.querySelector('[data-row]')?.getAttribute('data-row')).toBe(
      'row-25',
    )
  })

  it('does not appear when there is nothing to hide', () => {
    // A control that pages a single page is chrome asserting a bound that is
    // not there, and a slice line saying "1 to 4 of 4" is noise.
    const { container } = render(<Harness count={4} />)
    expect(container.querySelectorAll('[data-row]')).toHaveLength(4)
    expect(container.querySelector('[data-pager]')).toBeNull()
  })

  it('clamps rather than stranding the reader on a page that has gone', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(<Harness count={419} />)
    await user.click(container.querySelector('[data-pager-next]')!)
    await user.click(container.querySelector('[data-pager-next]')!)

    // A narrower filter arrives and there are now two pages, not seventeen.
    rerender(<Harness count={30} />)
    expect(container.querySelector('[data-pager-slice]')?.textContent).toBe(
      'Showing 26 to 30 of 30 reviews',
    )
    expect(container.querySelectorAll('[data-row]').length).toBeGreaterThan(0)
  })
})
