import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { explainCsv, featureScales, isLabeled, parseCsv, prepareDataset } from './csv'

const sample = readFileSync('public/samples/contextshift-sample.csv', 'utf8')

describe('CSV experiments', () => {
  it('parses the downloadable sample and holds the query out of context', () => {
    const dataset = prepareDataset(parseCsv(sample), 'claim')
    expect(dataset.features).toEqual(['age', 'premium', 'previous_claims', 'risk_tier'])
    expect(dataset.rows).toHaveLength(22)
    const query = dataset.rows[20]
    expect(query.label).toBeNull()
    expect(dataset.rows[21].label).toBeNull()
    const context = dataset.rows.filter(isLabeled)
    const scales = featureScales(context, dataset.features.length)
    const initial = explainCsv(context, query, scales)
    expect(initial.influences).toHaveLength(20)
    expect(initial.influences.every(row => row.id !== query.id)).toBe(true)
    expect(initial.influences.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1)
    const top = initial.influences[0]
    const flipped = context.map(row => row.id === top.id ? { ...row, label: (row.label ? 0 : 1) as 0 | 1 } : row)
    expect(explainCsv(flipped, query, scales).probability).not.toBeCloseTo(initial.probability!)
  })

  it('accepts quoted CSV cells and rejects invalid labels or structure', () => {
    expect(parseCsv('feature,label\n"1,000",0\n2,1\n3,0\n4,1').rows[0][0]).toBe('1,000')
    expect(prepareDataset(parseCsv('value,label\n1,0\n2,1\n3,\n4,[PREDICT]'), 'label').rows.map(row => row.label)).toEqual([0, 1, null, null])
    expect(() => prepareDataset(parseCsv('value,label\n1,yes\n2,no\n3,yes\n4,no'), 'label')).toThrow(/0, 1, blank/)
    expect(() => parseCsv('x,label\n1,0\n2,1\n3,0\n4')).toThrow(/same number/)
    expect(() => parseCsv('x,label\n"1,0\n2,1\n3,0\n4,1')).toThrow(/unclosed/)
  })
})
