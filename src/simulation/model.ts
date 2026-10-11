export interface Row {
  id: number; age: number | null; premium: number | null; previousClaims: number | null;
  duration: number | null; insured: number | null; risk: number | null; geo: number | null;
  payment: number | null; label: 0 | 1
}
export type Feature = Exclude<keyof Row, 'id' | 'label'>
export const features: { key: Feature; title: string; unit?: string }[] = [
  { key: 'age', title: 'Age' }, { key: 'premium', title: 'Premium', unit: '€' },
  { key: 'previousClaims', title: 'Prior claims' }, { key: 'duration', title: 'Duration', unit: 'yr' },
  { key: 'insured', title: 'Insured', unit: '€k' }, { key: 'risk', title: 'Risk tier' },
  { key: 'geo', title: 'Geo risk' }, { key: 'payment', title: 'Late pays' },
]
export const initialRows: Row[] = [
  { id: 101, age: 28, premium: 840, previousClaims: 0, duration: 2, insured: 45, risk: 1, geo: 0, payment: 0, label: 0 },
  { id: 102, age: 46, premium: 1640, previousClaims: 2, duration: 6, insured: 90, risk: 3, geo: 1, payment: 1, label: 1 },
  { id: 103, age: 35, premium: 1120, previousClaims: 0, duration: 4, insured: 60, risk: 2, geo: 0, payment: 0, label: 0 },
  { id: 104, age: 57, premium: 2280, previousClaims: 3, duration: 9, insured: 130, risk: 3, geo: 1, payment: 2, label: 1 },
  { id: 105, age: 42, premium: 1380, previousClaims: 1, duration: 5, insured: 85, risk: 2, geo: 1, payment: 0, label: 0 },
  { id: 106, age: 39, premium: 1780, previousClaims: 2, duration: 3, insured: 105, risk: 3, geo: 1, payment: 1, label: 1 },
  { id: 107, age: 31, premium: 960, previousClaims: 0, duration: 7, insured: 55, risk: 1, geo: 0, payment: 0, label: 0 },
  { id: 108, age: 62, premium: 1920, previousClaims: 1, duration: 11, insured: 110, risk: 2, geo: 1, payment: 1, label: 1 },
  { id: 109, age: 49, premium: 1220, previousClaims: 0, duration: 8, insured: 75, risk: 1, geo: 0, payment: 0, label: 0 },
  { id: 110, age: 53, premium: 2100, previousClaims: 2, duration: 10, insured: 125, risk: 3, geo: 1, payment: 2, label: 1 },
]
export const testRows: Omit<Row, 'label'>[] = [
  { id: 901, age: 44, premium: 1530, previousClaims: 1, duration: 5, insured: 88, risk: 2, geo: 1, payment: 0 },
  { id: 902, age: 33, premium: 1050, previousClaims: 0, duration: 3, insured: 55, risk: 1, geo: 0, payment: 0 },
  { id: 903, age: 56, premium: 2050, previousClaims: 2, duration: 8, insured: 115, risk: 3, geo: 1, payment: 1 },
]
const scales: Record<Feature, number> = { age: 25, premium: 900, previousClaims: 2.5, duration: 8, insured: 80, risk: 2, geo: 1, payment: 2 }
export function simulate(rows: Row[], test: Omit<Row, 'label'>): number | null {
  if (!rows.length) return null
  const weighted = rows.map(row => {
    let distance = 0; let observed = 0
    for (const { key } of features) {
      const a = row[key], b = test[key]
      if (a === null || b === null) continue
      distance += ((a - b) / scales[key]) ** 2
      observed++
    }
    return { weight: observed ? Math.exp(-2 * distance / observed) * (observed / features.length) : 0, label: row.label }
  })
  const total = weighted.reduce((sum, x) => sum + x.weight, 0)
  return total ? weighted.reduce((sum, x) => sum + x.weight * x.label, 0) / total : null
}
