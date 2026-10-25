export type ExperimentType = 'size' | 'missing' | 'labels' | 'noise' | 'outliers' | 'relevance' | 'imbalance' | 'drift'
export type ModelName = 'TabPFN' | 'XGBoost' | 'CatBoost'
export interface Metrics {
  accuracy: number; precision: number; recall: number; f1: number; roc_auc: number | null;
  pr_auc: number | null; log_loss: number; brier: number; positive_rate: number;
  confusion: [[number, number], [number, number]]
}
export interface Prediction { id: number; truth: 0 | 1; probability: number; predicted: 0 | 1 }
export interface ExperimentResult {
  experiment_id: string; experiment_type: ExperimentType; dataset_version: string;
  model_name: ModelName; model_version: string; seed: number; context_size: number;
  configuration: Record<string, string | number>; metrics: Metrics; predictions: Prediction[];
  fit_seconds: number; predict_seconds: number; executed_at: string; hardware: string;
  calibration?: { confidence: number; observed: number; count: number }[];
  context_preview: Record<string, number | null>[]; test_preview?: Record<string, number | null>[];
  context_summary?: { premium_mean: number; positive_rate: number; population_b_share: number };
  test_summary?: { premium_mean: number; positive_rate: number; population_b_share: number }
}
export interface ResultBundle { schema_version: '1.0'; results: ExperimentResult[] }
export interface InferenceAdapter {
  mode: 'precomputed' | 'simulation' | 'remote'
  predict: (testId: number) => Promise<number | null>
}
export function isResultBundle(value: unknown): value is ResultBundle {
  if (!value || typeof value !== 'object') return false
  const bundle = value as Partial<ResultBundle>
  return bundle.schema_version === '1.0' && Array.isArray(bundle.results) && bundle.results.every(r =>
    typeof r.experiment_id === 'string' && typeof r.metrics?.accuracy === 'number' && Array.isArray(r.predictions))
}
