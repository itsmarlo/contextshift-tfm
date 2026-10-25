import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CsvExperiment } from './CsvExperiment'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('CSV experiment page', () => {
  it('loads the sample, changes context, and resets the prediction', async () => {
    const sample = readFileSync('public/samples/contextshift-shifts-sample.csv', 'utf8')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => sample }))
    render(<CsvExperiment />)
    fireEvent.click(screen.getByText('Load sample'))
    expect(await screen.findByText(/Loaded contextshift-shifts-sample.csv/)).toBeTruthy()
    expect((screen.getByLabelText('Target column') as HTMLSelectElement).value).toBe('claim')
    expect((screen.getByLabelText('Prediction row') as HTMLSelectElement).value).toBe('20')
    expect(screen.getByText('Predicted cells')).toBeTruthy()
    expect(screen.getByText(/Validation accuracy/)).toBeTruthy()
    fireEvent.click(screen.getByText('Save current setting'))
    expect(screen.getByText('Best saved')).toBeTruthy()
    const output = () => screen.getByText('Simulated label 1 probability').parentElement?.querySelector('.csv-probability')?.textContent
    const predictedCells = () => screen.getByText('Predicted cells').parentElement?.textContent
    const original = output()
    const originalCells = predictedCells()
    fireEvent.click(screen.getByText('Flip top label'))
    expect(output()).not.toBe(original)
    expect(predictedCells()).not.toBe(originalCells)
    fireEvent.click(screen.getByText('Reset changes'))
    expect(output()).toBe(original)
    expect(predictedCells()).toBe(originalCells)
    fireEvent.change(screen.getByLabelText('Context shift'), { target: { value: 'relevance' } })
    expect((screen.getByLabelText('Group column') as HTMLSelectElement).value).toBe('population')
    fireEvent.change(screen.getByLabelText(/Intervention level/), { target: { value: '100' } })
    expect(screen.getByText(/Actual selected share:/).textContent).toContain('100%')
    fireEvent.click(screen.getByText('Save current setting'))
    expect(screen.getAllByText('Apply')).toHaveLength(2)
    const validation = screen.getByText(/Validation accuracy/).parentElement?.textContent
    fireEvent.change(screen.getByLabelText('Prediction row'), { target: { value: '0' } })
    expect(screen.getByText(/Validation accuracy/).parentElement?.textContent).toBe(validation)
    fireEvent.change(screen.getByLabelText('Context shift'), { target: { value: 'drift' } })
    expect((screen.getByLabelText('Period column') as HTMLSelectElement).value).toBe('period')
    expect((screen.getByLabelText('Recent value') as HTMLSelectElement).value).toBe('recent')
    fireEvent.change(screen.getByLabelText('Target column'), { target: { value: 'premium' } })
    expect(screen.getByText('Simulated premium value')).toBeTruthy()
    expect(screen.getByText(/Held-out actual:/)).toBeTruthy()
    expect(screen.getByText(/Absolute error:/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    const numericOutput = screen.getByText('Simulated premium value').parentElement?.querySelector('.csv-probability')?.textContent
    fireEvent.click(screen.getByText('Increase top target'))
    expect(screen.getByText('Simulated premium value').parentElement?.querySelector('.csv-probability')?.textContent).not.toBe(numericOutput)
  })
})
