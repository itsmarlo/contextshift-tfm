import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperimentResult } from '../types/experiment'
import { Experiments } from './Experiments'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('measured context experiments', () => {
  it('shows the three measured models and lets a reader inspect CatBoost', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    render(<Experiments results={bundle.results} />)
    expect(screen.getAllByText(/CatBoost/).length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Metric') as HTMLSelectElement).value).toBe('roc_auc')
    fireEvent.change(screen.getByLabelText('Detail model'), { target: { value: 'CatBoost' } })
    expect((screen.getByLabelText('Detail model') as HTMLSelectElement).value).toBe('CatBoost')
    fireEvent.click(screen.getByRole('tab', { name: 'Class imbalance' }))
    expect(screen.getByText('45')).toBeTruthy()
  })
})
