import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExperimentResult } from '../types/experiment'
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
    fireEvent.click(screen.getByText('Add similar claim'))
    expect(screen.getAllByText('11 rows').length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Age for row 111') as HTMLInputElement).value).toBe('46')
    expect((screen.getByLabelText('Premium for row 111') as HTMLInputElement).value).toBe('1650')
    expect(modified()).not.toBe(original)
    fireEvent.click(screen.getByText('Reset example'))
    expect(modified()).toBe(original)
  })
  it('explains when sliders apply and changes only the shown rows', () => {
    render(<Playground results={[]} />)
    fireEvent.change(screen.getByLabelText(/Context size/), { target: { value: '5' } })
    fireEvent.click(screen.getByText('More context changes'))
    expect(screen.getByText(/Flip this share of shown Claim/)).toBeTruthy()
    const labels = [101, 102, 103, 104, 105].map(id => screen.getByLabelText(`Claim label for row ${id}`) as HTMLSelectElement)
    const original = labels.map(input => input.value)
    const probability = screen.getByText('Modified probability').parentElement?.textContent
    fireEvent.change(screen.getByRole('slider', { name: /Label corruption/ }), { target: { value: '60' } })
    expect(labels.map(input => input.value)).toEqual(original)
    expect(screen.getByText('Modified probability').parentElement?.textContent).toBe(probability)
    expect(screen.getByText(/Settings are pending/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected changes' }))
    expect(labels.filter((input, index) => input.value !== original[index])).toHaveLength(3)
    expect((screen.getByRole('button', { name: 'Apply selected changes' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Applied to 5 shown rows/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Context size/), { target: { value: '10' } })
    expect((screen.getByLabelText('Claim label for row 106') as HTMLSelectElement).value).toBe('1')
    fireEvent.click(screen.getByText('Reset example'))
    expect((screen.getByLabelText('Claim label for row 102') as HTMLSelectElement).value).toBe('1')
  })
  it('sets the shown claim share and describes duration shift in years', () => {
    render(<Playground results={[]} />)
    fireEvent.change(screen.getByLabelText(/Context size/), { target: { value: '5' } })
    fireEvent.click(screen.getByText('More context changes'))
    expect(screen.getByText(/currently 40% are Claim/)).toBeTruthy()
    fireEvent.change(screen.getByRole('slider', { name: /Positive share/ }), { target: { value: '20' } })
    fireEvent.change(screen.getByRole('slider', { name: /Duration shift/ }), { target: { value: '2' } })
    expect(screen.getByText('+2 yr')).toBeTruthy()
    expect((screen.getByLabelText('Duration for row 101') as HTMLInputElement).value).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected changes' }))
    expect([101, 102, 103, 104, 105].filter(id => (screen.getByLabelText(`Claim label for row ${id}`) as HTMLSelectElement).value === '1')).toHaveLength(1)
    expect((screen.getByLabelText('Duration for row 101') as HTMLInputElement).value).toBe('4')
  })
  it('shows recorded CatBoost predictions in real experiment mode', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    render(<Playground results={bundle.results} />)
    fireEvent.click(screen.getByText('Real experiments'))
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'CatBoost' } })
    expect(screen.queryByText('No measured result')).toBeNull()
    expect(screen.getByText(/CatBoost 1.2.10/)).toBeTruthy()
    expect(screen.getByText('ROC AUC')).toBeTruthy()
  })
})
