import { isResultBundle, type ExperimentResult } from '../types/experiment'
export async function loadResults(): Promise<ExperimentResult[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}experiments/results.json`)
  if (!response.ok) return []
  const data: unknown = await response.json()
  if (!isResultBundle(data)) throw new Error('Experiment JSON failed schema validation')
  return data.results
}
