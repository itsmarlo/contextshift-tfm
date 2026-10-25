import { describe, expect, it } from 'vitest'
import { explainSimulation, initialRows, simulate, testRows } from './model'

describe('educational similarity model', () => {
  it('responds to a changed label without mutating input', () => {
    const before = simulate(initialRows, testRows[0])!
    const changed = initialRows.map(row => row.id === 105 ? { ...row, label: 1 as const } : row)
    expect(simulate(changed, testRows[0])!).toBeGreaterThan(before)
    expect(initialRows.find(row => row.id === 105)?.label).toBe(0)
  })
  it('handles empty and missing contexts', () => {
    expect(simulate([], testRows[0])).toBeNull()
    expect(simulate(initialRows.map(row => ({ ...row, age: null, premium: null, previousClaims: null, duration: null, insured: null, risk: null, geo: null, payment: null })), testRows[0])).toBeNull()
  })
  it('reports row shares that reproduce the probability', () => {
    const { probability, influences } = explainSimulation(initialRows, testRows[0])
    expect(influences.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1)
    expect(influences.reduce((total, row) => total + row.share * row.label, 0)).toBeCloseTo(probability!)
    expect(influences[0].share).toBeGreaterThanOrEqual(influences[1].share)
  })
})
