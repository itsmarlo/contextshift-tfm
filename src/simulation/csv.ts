export interface CsvTable { headers: string[]; rows: string[][] }
export interface NumericRow { id: number; values: (number | null)[]; label: 0 | 1 | null }
export interface LabeledRow extends NumericRow { label: 0 | 1 }
export interface NumericDataset { features: string[]; rows: NumericRow[] }
export interface CsvInfluence { id: number; label: 0 | 1; share: number }
export const isLabeled = (row: NumericRow): row is LabeledRow => row.label !== null
export const isPredictionCell = (value: string) => value === '' || value.toUpperCase() === '[PREDICT]'

export function parseCsv(text: string): CsvTable {
  if (text.length > 1_000_000) throw new Error('Choose a CSV smaller than 1 MB.')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { quoted = false; closedQuote = true }
      else field += char
    } else if (char === '"') {
      if (field !== '' || closedQuote) throw new Error('The CSV has an invalid quoted field.')
      quoted = true
    } else if (char === ',') {
      record.push(field.trim()); field = ''; closedQuote = false
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      record.push(field.trim())
      if (record.some(value => value !== '')) records.push(record)
      record = []; field = ''; closedQuote = false
    } else {
      if (closedQuote && char.trim()) throw new Error('The CSV has text after a closing quote.')
      field += char
    }
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.')
  record.push(field.trim())
  if (record.some(value => value !== '')) records.push(record)
  if (records.length < 5) throw new Error('Use a header and at least four data rows.')
  if (records.length > 501) throw new Error('Use at most 500 data rows.')
  const headers = records[0]
  if (headers.length < 2 || headers.some(name => !name)) throw new Error('The CSV needs named feature and label columns.')
  if (headers.length > 51) throw new Error('Use at most 50 feature columns and one label column.')
  if (new Set(headers.map(name => name.toLowerCase())).size !== headers.length) throw new Error('Column names must be unique.')
  if (records.some(row => row.length !== headers.length)) throw new Error('Every CSV row must have the same number of columns.')
  return { headers, rows: records.slice(1) }
}

export function prepareDataset(table: CsvTable, target: string): NumericDataset {
  const targetIndex = table.headers.indexOf(target)
  if (targetIndex < 0) throw new Error('Choose a label column.')
  const labels = table.rows.map(row => row[targetIndex])
  if (labels.some(value => !isPredictionCell(value) && value !== '0' && value !== '1')) throw new Error('The label column must contain 0, 1, blank, or [PREDICT].')
  if (!labels.includes('0') || !labels.includes('1')) throw new Error('The label column needs both 0 and 1 examples.')
  const featureIndices = table.headers.map((_, i) => i).filter(i => i !== targetIndex && table.rows.some(row => row[i] !== '') && table.rows.every(row => row[i] === '' || (Number.isFinite(Number(row[i])) && row[i].trim() !== '')))
  if (!featureIndices.length) throw new Error('Add at least one numeric feature column. Blank feature cells are allowed.')
  return {
    features: featureIndices.map(i => table.headers[i]),
    rows: table.rows.map((row, i) => ({ id: i + 1, values: featureIndices.map(index => row[index] === '' ? null : Number(row[index])), label: isPredictionCell(labels[i]) ? null : Number(labels[i]) as 0 | 1 })),
  }
}

export function featureScales(rows: NumericRow[], count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const values = rows.map(row => row.values[index]).filter((value): value is number => value !== null)
    if (values.length < 2) return 1
    return Math.max(1, Math.max(...values) - Math.min(...values))
  })
}

export function explainCsv(rows: LabeledRow[], query: NumericRow, scales: number[]): { probability: number | null; influences: CsvInfluence[] } {
  const weighted = rows.map(row => {
    let distance = 0
    let observed = 0
    for (let i = 0; i < scales.length; i++) {
      const a = row.values[i], b = query.values[i]
      if (a === null || b === null) continue
      distance += ((a - b) / scales[i]) ** 2
      observed++
    }
    return { id: row.id, label: row.label, weight: observed ? Math.exp(-2 * distance / observed) * observed / scales.length : 0 }
  })
  const total = weighted.reduce((sum, row) => sum + row.weight, 0)
  return {
    probability: total ? weighted.reduce((sum, row) => sum + row.weight * row.label, 0) / total : null,
    influences: weighted.map(row => ({ id: row.id, label: row.label, share: total ? row.weight / total : 0 })).sort((a, b) => b.share - a.share),
  }
}
