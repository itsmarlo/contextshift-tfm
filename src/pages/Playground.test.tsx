import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Playground } from './Playground'

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
})
