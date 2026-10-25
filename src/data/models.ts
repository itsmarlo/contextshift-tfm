import type { ModelName } from '../types/experiment'

export const modelNames: ModelName[] = ['TabPFN', 'XGBoost', 'CatBoost']
export const modelColors: Record<ModelName, string> = {
  TabPFN: '#0038ff',
  XGBoost: '#b87500',
  CatBoost: '#139776',
}
