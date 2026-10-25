import { CartesianGrid, ErrorBar, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { modelColors, modelNames } from '../data/models'
import type { ExperimentResult, ExperimentType, Metrics } from '../types/experiment'

type Metric = keyof Pick<Metrics, 'accuracy' | 'precision' | 'recall' | 'f1' | 'roc_auc' | 'pr_auc' | 'log_loss' | 'brier' | 'positive_rate'>
export const metricLabels: Record<Metric, string> = { accuracy: 'Accuracy', precision: 'Precision', recall: 'Recall', f1: 'F1 score', roc_auc: 'ROC AUC', pr_auc: 'PR AUC', log_loss: 'Log loss', brier: 'Brier score', positive_rate: 'Predicted positive rate' }
export const metricDefinitions: Record<Metric, string> = {
  accuracy: 'Share of correct class predictions at threshold 0.5.', precision: 'Among predicted positives, the share truly positive.',
  recall: 'Among true positives, the share identified.', f1: 'Harmonic mean of precision and recall.',
  roc_auc: 'Area under the receiver operating characteristic curve.', pr_auc: 'Area under the precision–recall curve.',
  log_loss: 'Mean negative log likelihood; lower is better.', brier: 'Mean squared probability error; lower is better.',
  positive_rate: 'Share of test observations predicted positive at threshold 0.5.',
}
export type { Metric }
export function MetricChart({ results, type, metric, factor }: { results: ExperimentResult[]; type: ExperimentType; metric: Metric; factor: string }) {
  const subset = results.filter(r => r.experiment_type === type)
  const values = [...new Set(subset.map(r => Number(r.configuration[factor] ?? r.context_size)))].sort((a,b)=>a-b)
  const data = values.map(x => {
    const point: Record<string, number | string | [number, number]> = { x }
    for (const model of modelNames) {
      const numbers = subset.filter(r => r.model_name === model && Number(r.configuration[factor] ?? r.context_size) === x).map(r => r.metrics[metric]).filter((n): n is number => n !== null)
      if (numbers.length) {
        const mean = numbers.reduce((a,b)=>a+b,0)/numbers.length
        const sd = Math.sqrt(numbers.reduce((a,b)=>a+(b-mean)**2,0)/numbers.length)
        point[model] = mean
        point[`${model}Error`] = [sd, sd]
      }
    }
    return point
  })
  if (!data.length) return <div className="empty-chart">No measured results available. Run the Python pipeline to populate this chart.</div>
  return <div className="chart" role="img" aria-label={`${metricLabels[metric]} by ${factor} for available model results`}><ResponsiveContainer width="100%" height={270}><LineChart data={data} margin={{ top: 12, right: 22, left: -15, bottom: 0 }}><CartesianGrid stroke="#dce3f4" vertical={false}/><XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis domain={metric === 'log_loss' ? ['auto','auto'] : [0,1]} tick={{ fontSize: 11 }}/><Tooltip formatter={(value: number, name: string) => [value.toFixed(3), name]} />{modelNames.filter(model => subset.some(row => row.model_name === model)).map(model => <Line key={model} type="monotone" dataKey={model} name={model} stroke={modelColors[model]} strokeWidth={2.5} dot={{ r: 4 }}>{data.some(d => d[`${model}Error`]) && <ErrorBar dataKey={`${model}Error`} width={4} stroke={modelColors[model]}/>}</Line>)}</LineChart></ResponsiveContainer><div className="chart-legend">{modelNames.filter(model => subset.some(row => row.model_name === model)).map(model => <span key={model}><i className="swatch" style={{ background: modelColors[model] }}/> {model}</span>)}<span>Mean ± SD across seeds</span></div></div>
}
