import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Learn } from './Learn'

afterEach(cleanup)

describe('worked in-context learning guide', () => {
  it('keeps the query label hidden until evaluation and updates the simulated context edit', () => {
    render(<Learn />)
    expect(within(screen.getByRole('row', { name: /#105/ })).getByText('Hidden')).toBeTruthy()
    expect(screen.getByText(/numbers are not their outputs/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /07 Reveal and evaluate/ }))
    expect(screen.getByText('55% claim chance')).toBeTruthy()
    expect(screen.getByText(/This one simulated decision is wrong/)).toBeTruthy()
    expect(screen.getByText(/Its outcome is/).textContent).toContain('No claim')

    fireEvent.click(screen.getByRole('button', { name: /08 Change the context/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Hypothetically change row #102/ }))
    expect(screen.getByText('41%')).toBeTruthy()
    expect(screen.getByText(/crosses the 50% threshold/)).toBeTruthy()
  })
})
