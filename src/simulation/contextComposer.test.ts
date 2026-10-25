import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { featureScales, parseCsv, prepareDataset } from './csv'
import { composeContext, evaluateContext, splitValidation, type ContextSettings } from './contextComposer'

const table = parseCsv(readFileSync('public/samples/contextshift-shifts-sample.csv', 'utf8'))
const data = prepareDataset(table, 'claim')
const { training, validation } = splitValidation(data.rows)
const groupValues = Object.fromEntries(table.rows.map((row, index) => [index + 1, row[4]]))
const periodValues = Object.fromEntries(table.rows.map((row, index) => [index + 1, row[5]]))
const settings: ContextSettings = {
  kind: 'none', level: 0, size: 8, seed: 7, targetKind: 'binary',
  featureScales: featureScales(training, data.features.length), groupValues,
  periodValues, recentValue: 'recent',
}

describe('context composition', () => {
  it('keeps prediction and validation rows outside the labeled context', () => {
    expect(validation.length).toBe(4)
    expect(training).toHaveLength(16)
    const query = data.rows[20]
    const context = composeContext(training, query, settings)
    expect(context).toHaveLength(8)
    expect(context.every(row => row.id !== query.id && !validation.some(heldOut => heldOut.id === row.id))).toBe(true)
  })

  it('selects requested group, recent, and class shares when available', () => {
    const query = data.rows[20]
    const group = composeContext(training, query, { ...settings, kind: 'relevance', level: 100 })
    expect(group.every(row => groupValues[row.id] === groupValues[query.id])).toBe(true)
    const recent = composeContext(training, query, { ...settings, kind: 'drift', level: 100 })
    expect(recent.every(row => periodValues[row.id] === 'recent')).toBe(true)
    const positives = composeContext(training, query, { ...settings, kind: 'imbalance', level: 50 })
    expect(positives.filter(row => row.label === 1)).toHaveLength(4)
    expect(new Set(positives.map(row => row.id)).size).toBe(8)
  })

  it('changes only selected context copies and scores the same held-out rows', () => {
    const clean = composeContext(training, data.rows[20], settings)
    const corrupted = composeContext(training, data.rows[20], { ...settings, kind: 'labels', level: 100 })
    const cleanLabels = new Map(clean.map(row => [row.id, row.label]))
    expect(corrupted.every(row => row.label === 1 - (cleanLabels.get(row.id) ?? -1))).toBe(true)
    expect(training.every(row => row.label === data.rows.find(original => original.id === row.id)?.label)).toBe(true)
    const firstScore = evaluateContext(training, validation, settings)
    const secondScore = evaluateContext(training, validation, settings)
    expect(firstScore).toBe(secondScore)
    expect(firstScore).not.toBeNull()
  })

  it('applies the three feature-quality shifts to context copies', () => {
    const query = data.rows[20]
    const clean = composeContext(training, query, settings)
    const missing = composeContext(training, query, { ...settings, kind: 'missing', level: 100 })
    expect(missing.every(row => row.values.every(value => value === null))).toBe(true)
    const noisy = composeContext(training, query, { ...settings, kind: 'noise', level: 100 })
    expect(noisy.some((row, index) => row.values.some((value, feature) => value !== clean[index].values[feature]))).toBe(true)
    const outliers = composeContext(training, query, { ...settings, kind: 'outliers', level: 100 })
    expect(outliers.every((row, index) => row.values[0] !== clean[index].values[0])).toBe(true)
    expect(training.every(row => row.values[0] === data.rows.find(original => original.id === row.id)?.values[0])).toBe(true)
  })
})
