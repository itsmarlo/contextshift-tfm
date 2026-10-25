import { explainCsv, featureScales, isLabeled, type LabeledRow, type NumericRow } from './csv'

export type ShiftKind = 'none' | 'missing' | 'labels' | 'noise' | 'outliers' | 'relevance' | 'imbalance' | 'drift'

export interface ContextSettings {
  kind: ShiftKind
  level: number
  size: number
  seed: number
  groupValues?: Record<number, string>
  periodValues?: Record<number, string>
  recentValue?: string
  targetKind: 'binary' | 'numeric'
  featureScales: number[]
}

const random = (value: number) => {
  const x = Math.sin(value * 9283.17) * 43758.5453
  return x - Math.floor(x)
}

function ordered(rows: LabeledRow[], seed: number): LabeledRow[] {
  return [...rows].sort((a, b) => random(a.id + seed * 101) - random(b.id + seed * 101))
}

function selectShare(rows: LabeledRow[], size: number, level: number, matches: (row: LabeledRow) => boolean, seed: number): LabeledRow[] {
  const matching = ordered(rows.filter(matches), seed)
  const other = ordered(rows.filter(row => !matches(row)), seed)
  const wanted = Math.round(size * level / 100)
  const selected = [...matching.slice(0, wanted), ...other.slice(0, size - Math.min(wanted, matching.length))]
  if (selected.length < size) selected.push(...matching.slice(wanted, wanted + size - selected.length))
  if (selected.length < size) selected.push(...other.slice(selected.filter(row => !matches(row)).length, selected.filter(row => !matches(row)).length + size - selected.length))
  return ordered(selected.slice(0, size), seed + 1)
}

export function composeContext(pool: LabeledRow[], query: NumericRow, settings: ContextSettings): LabeledRow[] {
  const size = Math.min(Math.max(1, settings.size), pool.length)
  if (!pool.length) return []
  const { kind, level, seed } = settings
  let selected: LabeledRow[]
  if (kind === 'relevance' && settings.groupValues) {
    const queryGroup = settings.groupValues[query.id]
    selected = selectShare(pool, size, level, row => settings.groupValues?.[row.id] === queryGroup, seed)
  } else if (kind === 'drift' && settings.periodValues && settings.recentValue !== undefined) {
    selected = selectShare(pool, size, level, row => settings.periodValues?.[row.id] === settings.recentValue, seed)
  } else if (kind === 'imbalance' && settings.targetKind === 'binary') {
    selected = selectShare(pool, size, level, row => row.label === 1, seed)
  } else selected = ordered(pool, seed).slice(0, size)

  const result = selected.map(row => ({ ...row, values: [...row.values] }))
  const count = level > 0 ? Math.max(1, Math.round(size * level / 100)) : 0
  if (kind === 'labels') {
    for (const row of ordered(result, seed + 2).slice(0, count)) {
      if (settings.targetKind === 'binary') row.label = row.label ? 0 : 1
      else {
        const labels = pool.map(item => item.label)
        const span = Math.max(...labels) - Math.min(...labels)
        row.label += (random(row.id + seed) >= .5 ? 1 : -1) * Math.max(1, span * level / 100)
      }
    }
  }
  if (kind === 'missing') {
    const cells = result.flatMap(row => row.values.map((value, index) => ({ row, index, value })).filter(cell => cell.value !== null))
    const missingCount = level > 0 ? Math.max(1, Math.round(cells.length * level / 100)) : 0
    cells.sort((a, b) => random(a.row.id * 97 + a.index + seed) - random(b.row.id * 97 + b.index + seed))
    for (const cell of cells.slice(0, missingCount)) cell.row.values[cell.index] = null
  }
  if (kind === 'noise') {
    for (const row of result) row.values = row.values.map((value, index) => value === null ? null : value + (random(row.id * 97 + index + seed) * 2 - 1) * settings.featureScales[index] * level / 100)
  }
  if (kind === 'outliers') {
    for (const row of ordered(result, seed + 3).slice(0, count)) {
      const index = row.values.findIndex(value => value !== null)
      if (index >= 0) row.values[index] = row.values[index]! + 5 * settings.featureScales[index]
    }
  }
  return result
}

export function splitValidation(rows: NumericRow[]): { training: LabeledRow[]; validation: LabeledRow[] } {
  const known = rows.filter(isLabeled)
  return { training: known.filter((_, index) => index % 5 !== 0), validation: known.filter((_, index) => index % 5 === 0) }
}

export function evaluateContext(training: LabeledRow[], validation: LabeledRow[], settings: ContextSettings): number | null {
  if (!training.length || !validation.length) return null
  const scales = featureScales(training, settings.featureScales.length)
  const predictions = validation.map(query => explainCsv(composeContext(training, query, { ...settings, featureScales: scales }), query, scales).prediction)
  if (predictions.some(value => value === null)) return null
  if (settings.targetKind === 'binary') return predictions.reduce<number>((correct, value, index) => correct + (Number(value! >= .5) === validation[index].label ? 1 : 0), 0) / validation.length
  return predictions.reduce<number>((error, value, index) => error + Math.abs(value! - validation[index].label), 0) / validation.length
}
