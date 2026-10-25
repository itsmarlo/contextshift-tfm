import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperimentResult } from '../types/experiment'
import { Comparison } from './Comparison'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('model comparison', () => {
  it('summarizes measured three-model results and changes metric and context size', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    render(<Comparison results={bundle.results} />)
    expect((screen.getByLabelText('Comparison metric') as HTMLSelectElement).value).toBe('roc_auc')
    expect(screen.getByText(/Held-out positive share: 9.7%/)).toBeTruthy()
    expect(screen.getByText(/has the highest observed mean roc auc/).textContent).toContain('CatBoost')
    expect(screen.getByRole('table').textContent).toContain('0.664')
    fireEvent.change(screen.getByLabelText('Context rows'), { target: { value: '1000' } })
    expect(screen.getByRole('table').textContent).toContain('0.741')
    expect(screen.getByText(/TabPFN vs CatBoost at 1000 rows/).textContent).toContain('TabPFN performs better in 1, CatBoost in 2')
    fireEvent.change(screen.getByLabelText('Context rows'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'f1' } })
    expect(screen.getByText(/has the highest observed mean f1 score/).textContent).toContain('XGBoost')
  })
})
