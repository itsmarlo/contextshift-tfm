import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { metricDefinitions, metricLabels, type Metric } from '../components/MetricChart'
import { modelColors, modelNames } from '../data/models'
import type { ExperimentResult, ModelName } from '../types/experiment'

const lowerIsBetter = (metric: Metric) => metric === 'log_loss' || metric === 'brier'

export function Comparison({ results }: { results: ExperimentResult[] }) {
  const [metric, setMetric] = useState<Metric>('roc_auc')
  const [contextSize, setContextSize] = useState(100)
  const [testIndex, setTestIndex] = useState(0)
  const sizes = [...new Set(results.filter(row => row.experiment_type === 'size').map(row => row.context_size))].sort((a, b) => a - b)
  const size = sizes.includes(contextSize) ? contextSize : sizes[0]
  const matching = results.filter(row => row.experiment_type === 'size' && row.context_size === size)
  const availableModels = modelNames.filter(model => matching.some(row => row.model_name === model))
  const chartData = availableModels.map(model => {
    const runs = matching.filter(row => row.model_name === model)
    const values = runs.map(row => row.metrics[metric]).filter((value): value is number => value !== null)
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    const sd = mean === null ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
    return { name: model, value: mean, error: sd === null ? undefined : [sd, sd], n: values.length, fit: runs.reduce((sum, row) => sum + row.fit_seconds, 0) / runs.length, predict: runs.reduce((sum, row) => sum + row.predict_seconds, 0) / runs.length, version: runs[0].model_version, hardware: runs[0].hardware }
  })
  const ranked = chartData.filter(row => row.value !== null).sort((a, b) => lowerIsBetter(metric) ? a.value! - b.value! : b.value! - a.value!)
  const best = metric === 'positive_rate' ? null : ranked[0]
  const tabMean = chartData.find(row => row.name === 'TabPFN')?.value
  const catMean = chartData.find(row => row.name === 'CatBoost')?.value
  const pairedSeeds = [...new Set(matching.map(row => row.seed))].map(seed => {
    const tab = matching.find(row => row.seed === seed && row.model_name === 'TabPFN')?.metrics[metric]
    const cat = matching.find(row => row.seed === seed && row.model_name === 'CatBoost')?.metrics[metric]
    return typeof tab === 'number' && typeof cat === 'number' ? { tab, cat } : null
  }).filter((pair): pair is { tab: number; cat: number } => pair !== null)
  const tabAhead = pairedSeeds.filter(pair => lowerIsBetter(metric) ? pair.tab < pair.cat : pair.tab > pair.cat).length
  const catAhead = pairedSeeds.filter(pair => lowerIsBetter(metric) ? pair.cat < pair.tab : pair.cat > pair.tab).length
  const seedRuns = matching.filter(row => row.seed === 7)
  const byModel = Object.fromEntries(seedRuns.map(row => [row.model_name, row])) as Partial<Record<ModelName, ExperimentResult>>
  const example = seedRuns[0]?.predictions[testIndex]
  const testPositiveRate = seedRuns[0]?.test_summary?.positive_rate

  return <section className="page-content">
    <div className="page-heading"><div><span className="eyebrow">03 / MODEL BENCHMARK</span><h1>Model comparison</h1><p>Measured TabPFN, XGBoost, and CatBoost runs on the same synthetic insurance task.</p></div></div>
    <div className="notice notice-teal"><strong>Matched experiment</strong><span>Each model receives the same context features and labels and is evaluated on the same held-out observations. The chart averages three context seeds. Tree models fit 100 trees per run; TabPFN uses pretrained weights. These are fixed configurations, not tuned model searches.</span></div>
    <div className="study-grid">
      <div className="panel study-main">
        <div className="chart-toolbar"><div><span className="eyebrow">CLEAN CONTEXT · THREE SEEDS</span><h2>Predictive performance</h2></div><div className="comparison-selectors"><label>Context rows <select aria-label="Context rows" value={size} onChange={event => setContextSize(Number(event.target.value))}>{sizes.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Metric <select aria-label="Comparison metric" value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div></div>
        {chartData.length ? <><div className="chart" role="img" aria-label={`${metricLabels[metric]} for measured TabPFN, XGBoost, and CatBoost runs at ${size} context rows`}><ResponsiveContainer width="100%" height={280}><BarChart data={chartData} margin={{ left: -12, right: 12, top: 12 }}><CartesianGrid vertical={false} stroke="#dce3f4"/><XAxis dataKey="name"/><YAxis domain={metric === 'log_loss' ? ['auto', 'auto'] : [0, 1]}/><Tooltip formatter={(value: number) => value.toFixed(3)}/><Bar name={metricLabels[metric]} dataKey="value" maxBarSize={88}>{chartData.map(row => <Cell key={row.name} fill={modelColors[row.name]}/>) }<ErrorBar dataKey="error" width={4} stroke="#16213f"/></Bar></BarChart></ResponsiveContainer></div><div className="table-wrap"><table className="comparison-summary"><thead><tr><th scope="col">Model</th><th scope="col">Mean ± SD</th><th scope="col">Runs</th></tr></thead><tbody>{chartData.map(row => <tr key={row.name}><th scope="row"><i className="swatch" style={{ background: modelColors[row.name] }}/>{row.name}</th><td>{row.value === null ? '—' : `${row.value.toFixed(3)} ± ${row.error?.[0].toFixed(3) ?? '0.000'}`}</td><td>{row.n}</td></tr>)}</tbody></table></div><p className="fineprint">{metricDefinitions[metric]} {metric === 'positive_rate' ? 'This is descriptive, not a performance ranking.' : `${lowerIsBetter(metric) ? 'Lower' : 'Higher'} is better.`} SD describes variation across three context seeds on one synthetic dataset.</p>{best && <p className="comparison-finding"><strong>{best.name}</strong> has the {lowerIsBetter(metric) ? 'lowest' : 'highest'} observed mean {metricLabels[metric].toLowerCase()} here ({best.value?.toFixed(3)}). This does not establish statistical superiority or a general winner.</p>}{metric !== 'positive_rate' && tabMean !== null && tabMean !== undefined && catMean !== null && catMean !== undefined && pairedSeeds.length > 0 && <p className="comparison-pair-note">TabPFN vs CatBoost at {size} rows: {tabMean.toFixed(3)} vs {catMean.toFixed(3)} mean {metricLabels[metric]} (gap {Math.abs(tabMean - catMean).toFixed(4)}). Across the {pairedSeeds.length} shared context seeds, TabPFN performs better in {tabAhead}, CatBoost in {catAhead}{pairedSeeds.length - tabAhead - catAhead > 0 ? `, and they tie in ${pairedSeeds.length - tabAhead - catAhead}` : ''}. These seeds use one synthetic test set, so they do not measure uncertainty across datasets.</p>}</> : <div className="empty-chart">No matched measured runs yet. Export results from the Python pipeline.</div>}
      </div>
      <aside className="panel study-side"><span className="eyebrow">TIMING / RECORDED HARDWARE</span><h2>Execution cost</h2>{chartData.map(row => <div className="model-timing" key={row.name}><strong>{row.name} {row.version}</strong><span>Mean fit call {row.fit.toFixed(3)} s</span><span>Mean predict call {row.predict.toFixed(3)} s</span><small>{row.hardware}</small></div>)}<p className="fineprint">TabPFN’s fit call prepares task context; the tree fit calls train task-specific models. Timings describe different work and include implementation and hardware effects.</p>{testPositiveRate !== undefined && <p className="fineprint">Held-out positive share: {(testPositiveRate * 100).toFixed(1)}%. Accuracy near the majority-class rate can hide poor claim detection; inspect PR AUC, recall, and F1 too.</p>}</aside>
    </div>
    {example && <div className="panel probability-panel"><div><span className="eyebrow">INDIVIDUAL PREDICTIONS · SEED 7</span><h2>One held-out observation, three models</h2></div><label>Observation <select aria-label="Comparison observation" value={testIndex} onChange={event => setTestIndex(Number(event.target.value))}>{seedRuns[0].predictions.map((prediction, index) => <option key={prediction.id} value={index}>Customer {prediction.id}</option>)}</select></label><div className="comparison-probs">{availableModels.map(model => <div key={model}><strong>{model}</strong><span>{byModel[model]?.predictions[testIndex] ? `${Math.round(byModel[model]!.predictions[testIndex].probability * 100)}%` : '—'}</span><small>Claim probability</small></div>)}</div><p className="fineprint">Actual claim label: {example.truth}. Probabilities are stored measurements; they are not computed by the browser.</p></div>}
    <div className="panel research-note"><span className="eyebrow">RESEARCH CONTEXT</span><h2>What broader benchmarks show</h2><p>The <a href="https://www.nature.com/articles/s41586-024-08328-6" target="_blank" rel="noreferrer">TabPFN study in Nature</a> found strong average performance on small and medium tabular datasets, including comparisons with XGBoost and CatBoost. Its reported scores are normalized across datasets, so they should not be read as raw AUC values for this app.</p><p>The <a href="https://papers.neurips.cc/paper_files/paper/2025/file/1697e3fb412da11dc9488249f9e7bbc9-Paper-Datasets_and_Benchmarks_Track.pdf" target="_blank" rel="noreferrer">TabArena benchmark</a> finds foundation models strong on compatible small datasets while boosted trees remain strong practical baselines. Tuning, validation design, and ensembling change rankings. The chart above reports only this project’s synthetic experiment.</p></div>
  </section>
}
