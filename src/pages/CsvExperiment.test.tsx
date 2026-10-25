import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CsvExperiment } from './CsvExperiment'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('CSV experiment page', () => {
  it('loads the sample, changes context, and resets the prediction', async () => {
    const sample = readFileSync('public/samples/contextshift-sample.csv', 'utf8')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => sample }))
    render(<CsvExperiment />)
    fireEvent.click(screen.getByText('Load sample'))
    expect(await screen.findByText(/Loaded contextshift-sample.csv/)).toBeTruthy()
    expect((screen.getByLabelText('Label column') as HTMLSelectElement).value).toBe('claim')
    const output = () => screen.getByText('Simulated label 1 probability').parentElement?.querySelector('.csv-probability')?.textContent
    const original = output()
    fireEvent.click(screen.getByText('Flip top label'))
    expect(output()).not.toBe(original)
    fireEvent.click(screen.getByText('Reset changes'))
    expect(output()).toBe(original)
  })
})
