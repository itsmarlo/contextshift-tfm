import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ExperimentResult } from '../types/experiment'

describe('bundled measured results', () => {
  it('includes three models on matching context and test data for every configuration', () => {
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
      expect(new Set(runs.map(run => run.model_name))).toEqual(new Set(['TabPFN', 'XGBoost', 'CatBoost']))
      for (const run of runs.slice(1)) {
        expect(run.context_preview).toEqual(runs[0].context_preview)
        expect(run.test_preview).toEqual(runs[0].test_preview)
        expect(run.context_summary).toEqual(runs[0].context_summary)
        expect(run.test_summary).toEqual(runs[0].test_summary)
      }
    }
  })
})
