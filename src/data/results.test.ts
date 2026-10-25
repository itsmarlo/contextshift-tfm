import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ExperimentResult } from '../types/experiment'

describe('bundled measured results', () => {
  it('includes four models on matching context and test data for every configuration', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    const byConfiguration = new Map<string, ExperimentResult[]>()

    for (const result of bundle.results) {
      const key = `${result.experiment_type}:${result.configuration.level}:${result.seed}`
      const runs = byConfiguration.get(key) ?? []
      runs.push(result)
      byConfiguration.set(key, runs)
    }

    expect(byConfiguration.size).toBe(132)
    for (const runs of byConfiguration.values()) {
      expect(new Set(runs.map(run => run.model_name))).toEqual(new Set(['TabPFN', 'XGBoost', 'CatBoost', 'SAP-RPT-OSS']))
      for (const run of runs.slice(1)) {
        expect(run.context_preview).toEqual(runs[0].context_preview)
        expect(run.test_preview).toEqual(runs[0].test_preview)
        expect(run.context_summary).toEqual(runs[0].context_summary)
        expect(run.test_summary).toEqual(runs[0].test_summary)
      }
    }
  })
  it('keeps thresholded metrics consistent with each saved confusion matrix', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    for (const run of bundle.results) {
      const [[tn, fp], [fn, tp]] = run.metrics.confusion
      const count = tn + fp + fn + tp
      const precision = tp + fp ? tp / (tp + fp) : 0
      const recall = tp + fn ? tp / (tp + fn) : 0
      const f1 = 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0
      expect(run.metrics.accuracy).toBeCloseTo((tn + tp) / count)
      expect(run.metrics.precision).toBeCloseTo(precision)
      expect(run.metrics.recall).toBeCloseTo(recall)
      expect(run.metrics.f1).toBeCloseTo(f1)
      expect(run.metrics.positive_rate).toBeCloseTo((tp + fp) / count)
      expect(run.test_summary?.positive_rate).toBeCloseTo((tp + fn) / count)
      for (const prediction of run.predictions) {
        expect(prediction.predicted).toBe(Number(prediction.probability >= 0.5))
      }
    }
  })
})
