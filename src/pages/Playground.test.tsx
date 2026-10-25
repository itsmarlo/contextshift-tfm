import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Playground } from './Playground'

afterEach(cleanup)

describe('Playground', () => {
  it('updates simulated prediction and keeps measured mode distinct', () => {
    render(<Playground results={[]} />)
    expect(screen.getByText(/Educational simulation, not actual TFM inference/)).toBeTruthy()
    const initial = screen.getByText('Modified probability').parentElement?.textContent
    fireEvent.change(screen.getByLabelText('Claim label for row 105'), { target: { value: '1' } })
    expect(screen.getByText('Modified probability').parentElement?.textContent).not.toBe(initial)
    fireEvent.click(screen.getByText('Real experiments'))
    expect(screen.getByText('No measured result')).toBeTruthy()
  })
  it('compares context size with the original context and explains the closest row', () => {
    render(<Playground results={[]} />)
    const original = screen.getByText('Original 10-row probability').parentElement?.textContent
    fireEvent.change(screen.getByLabelText(/Context size/), { target: { value: '1' } })
    expect(screen.getByText('Original 10-row probability').parentElement?.textContent).toBe(original)
    expect(screen.getByText('Modified probability').parentElement?.textContent).not.toBe(original?.replace('Original 10-row', 'Modified'))
    expect(screen.getByText('How context rows vote')).toBeTruthy()
    fireEvent.click(screen.getByText('Flip closest label'))
    expect((screen.getByLabelText('Claim label for row 101') as HTMLSelectElement).value).toBe('1')
  })
  it('offers quick changes that can be reset to the original prediction', () => {
    render(<Playground results={[]} />)
    const modified = () => screen.getByText('Modified probability').parentElement?.textContent
    const original = modified()
    fireEvent.click(screen.getByText('Add matching claim'))
    expect(screen.getAllByText('11 rows').length).toBeGreaterThan(0)
    expect(modified()).not.toBe(original)
    fireEvent.click(screen.getByText('Reset example'))
    expect(modified()).toBe(original)
  })
})
