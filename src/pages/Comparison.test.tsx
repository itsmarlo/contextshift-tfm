import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperimentResult } from '../types/experiment'
import { Comparison } from './Comparison'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('model comparison', () => {
  it('summarizes measured four-model results and changes metric and context size', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    render(<Comparison results={bundle.results} />)
    expect((screen.getByLabelText('Comparison metric') as HTMLSelectElement).value).toBe('roc_auc')
    expect(screen.getByText(/Held-out positive share: 9.7%/)).toBeTruthy()
    expect(screen.getByText(/one generated insurance task/)).toBeTruthy()
    expect(screen.getByText(/31 claims among 320 held-out rows/)).toBeTruthy()
    expect(screen.getByRole('table').textContent).toContain('0.664')
    expect(screen.getByRole('table').textContent).toContain('Flagged claims / run')
    fireEvent.change(screen.getByLabelText('Context rows'), { target: { value: '1000' } })
    expect(screen.getByRole('table').textContent).toContain('0.741')
    expect(screen.getByRole('table').textContent).toContain('SAP-RPT-OSS')
    expect(screen.getByText(/TabPFN vs CatBoost at 1000 rows/).textContent).toContain('TabPFN performs better in 1, CatBoost in 2')
    expect(screen.getByText(/TabPFN vs SAP-RPT-OSS at 1000 rows/).textContent).toContain('TabPFN performs better in 2, SAP-RPT-OSS in 1')
    fireEvent.change(screen.getByLabelText('Context rows'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'f1' } })
    expect(screen.getByText(/9 of 12 runs flag no claims/)).toBeTruthy()
    expect(screen.getByRole('row', { name: /XGBoost/ }).textContent).toContain('3–9 / 320')
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'pr_auc' } })
    expect(screen.getByText(/stores scikit-learn average precision/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'accuracy' } })
    expect(screen.getByText(/Always predicting No claim would score 90.3% accuracy/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'log_loss' } })
    expect(screen.getByText(/Scores the probabilities assigned to the true outcomes/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Comparison metric'), { target: { value: 'positive_rate' } })
    expect(screen.getByText(/It is not a performance score/)).toBeTruthy()
    fireEvent.click(screen.getByText('What does each measure mean?'))
    expect(screen.getByText(/How well are precision and recall balanced/)).toBeTruthy()
    expect(screen.getByText(/not trapezoidal area under the precision/)).toBeTruthy()
  })

  it('adds RPT only when a measured RPT run is present', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    const withoutRPT = bundle.results.filter(row => row.model_name !== 'SAP-RPT-OSS')
    const rpt = bundle.results.find(row => row.model_name === 'SAP-RPT-OSS' && row.experiment_type === 'size' && row.context_size === 100 && row.seed === 7)!
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    render(<Comparison results={withoutRPT} />)
    expect(screen.getByText('RPT can be added')).toBeTruthy()
    cleanup()
    render(<Comparison results={[...withoutRPT, rpt]} />)
    expect(screen.queryByText('RPT can be added')).toBeNull()
    expect(screen.getByRole('table').textContent).toContain('SAP-RPT-OSS')
    expect(screen.getByText(/TabPFN vs SAP-RPT-OSS at 100 rows/)).toBeTruthy()
  })
})
