import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ExperimentResult } from '../types/experiment'

describe('bundled measured results', () => {
  it('includes both models for every recorded configuration', () => {
    const bundle = JSON.parse(readFileSync('public/experiments/results.json', 'utf8')) as { results: ExperimentResult[] }
    const byConfiguration = new Map<string, Set<string>>()

    for (const result of bundle.results) {
      const key = `${result.experiment_type}:${result.configuration.level}:${result.seed}`
      const models = byConfiguration.get(key) ?? new Set<string>()
      models.add(result.model_name)
      byConfiguration.set(key, models)
    }

    expect(byConfiguration.size).toBe(132)
    for (const models of byConfiguration.values()) {
      expect(models).toEqual(new Set(['TabPFN', 'XGBoost']))
    }
  })
})
