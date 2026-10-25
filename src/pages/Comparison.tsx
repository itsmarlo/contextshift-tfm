import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { metricDefinitions, metricLabels, type Metric } from '../components/MetricChart'
import { modelColors, modelNames } from '../data/models'
import type { ExperimentResult, ModelName } from '../types/experiment'

const lowerIsBetter = (metric: Metric) => metric === 'log_loss' || metric === 'brier'
const countRange = (values: number[]) => {
  const low = Math.min(...values)
  const high = Math.max(...values)
  return low === high ? String(low) : `${low}–${high}`
}

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
    return { name: model, value: mean, error: sd === null ? undefined : [sd, sd], n: values.length, fit: runs.reduce((sum, row) => sum + row.fit_seconds, 0) / runs.length, predict: runs.reduce((sum, row) => sum + row.predict_seconds, 0) / runs.length, version: runs[0].model_version, hardware: runs[0].hardware, predictedCounts: runs.map(row => row.metrics.confusion[0][1] + row.metrics.confusion[1][1]), foundCounts: runs.map(row => row.metrics.confusion[1][1]) }
  })
  const tabMean = chartData.find(row => row.name === 'TabPFN')?.value
  const catMean = chartData.find(row => row.name === 'CatBoost')?.value
  const rptMean = chartData.find(row => row.name === 'SAP-RPT-OSS')?.value
  const pairedSeeds = [...new Set(matching.map(row => row.seed))].map(seed => {
    const tab = matching.find(row => row.seed === seed && row.model_name === 'TabPFN')?.metrics[metric]
    const cat = matching.find(row => row.seed === seed && row.model_name === 'CatBoost')?.metrics[metric]
    return typeof tab === 'number' && typeof cat === 'number' ? { tab, cat } : null
  }).filter((pair): pair is { tab: number; cat: number } => pair !== null)
  const tabAhead = pairedSeeds.filter(pair => lowerIsBetter(metric) ? pair.tab < pair.cat : pair.tab > pair.cat).length
  const catAhead = pairedSeeds.filter(pair => lowerIsBetter(metric) ? pair.cat < pair.tab : pair.cat > pair.tab).length
  const rptPairs = [...new Set(matching.map(row => row.seed))].map(seed => {
    const tab = matching.find(row => row.seed === seed && row.model_name === 'TabPFN')?.metrics[metric]
    const rpt = matching.find(row => row.seed === seed && row.model_name === 'SAP-RPT-OSS')?.metrics[metric]
    return typeof tab === 'number' && typeof rpt === 'number' ? { tab, rpt } : null
  }).filter((pair): pair is { tab: number; rpt: number } => pair !== null)
  const tabAheadRPT = rptPairs.filter(pair => lowerIsBetter(metric) ? pair.tab < pair.rpt : pair.tab > pair.rpt).length
  const rptAhead = rptPairs.filter(pair => lowerIsBetter(metric) ? pair.rpt < pair.tab : pair.rpt > pair.tab).length
  const seedRuns = matching.filter(row => row.seed === 7)
  const byModel = Object.fromEntries(seedRuns.map(row => [row.model_name, row])) as Partial<Record<ModelName, ExperimentResult>>
  const example = seedRuns[0]?.predictions[testIndex]
  const testPositiveRate = seedRuns[0]?.test_summary?.positive_rate
  const firstConfusion = matching[0]?.metrics.confusion
  const testCount = firstConfusion?.flat().reduce((sum, count) => sum + count, 0) ?? 0
  const actualClaims = firstConfusion ? firstConfusion[1][0] + firstConfusion[1][1] : 0
  const zeroCallRuns = matching.filter(row => row.metrics.confusion[0][1] + row.metrics.confusion[1][1] === 0).length
  const prevalence = testCount ? actualClaims / testCount : 0
  const metricContext: Record<Metric, string> = {
    accuracy: `Always predicting No claim would score ${((1 - prevalence) * 100).toFixed(1)}% accuracy here. Compare accuracy with the claims found column before treating a higher score as useful.`,
    precision: `Uses a 0.5 cutoff. When a run flags no claims, this export records precision as 0. ${zeroCallRuns} of ${matching.length} runs flag none at this context size.`,
    recall: `Uses a 0.5 cutoff. ${zeroCallRuns} of ${matching.length} runs flag no claims, so their recall is 0 even if their probability rankings contain useful signal.`,
    f1: `Uses a 0.5 cutoff. ${zeroCallRuns} of ${matching.length} runs flag no claims, giving F1 = 0. This does not mean every probability is identical.`,
    roc_auc: 'Measures ranking across probability cutoffs; 0.5 is the no-skill reference. A useful ranking can still produce no positive classifications at the chosen 0.5 cutoff.',
    pr_auc: `This export stores scikit-learn average precision, not trapezoidal PR area. The positive share (${(prevalence * 100).toFixed(1)}%) is the random-ranking reference for this rare-claim test set.`,
    log_loss: 'Scores the probabilities assigned to the true outcomes; lower is better. A model can have low log loss while flagging no claims at the 0.5 cutoff.',
    brier: 'Scores squared probability error; lower is better. On rare events, predicting low risk often looks good overall, so inspect claim detection too.',
    positive_rate: 'Describes how often the model flags a claim at the 0.5 cutoff. It is not a performance score; higher is not automatically better.',
  }

  return <section className="page-content">
    <div className="page-heading"><div><span className="eyebrow">03 / SINGLE-DATASET STUDY</span><h1>Model comparison</h1><p>Recorded model predictions on one generated insurance task. These scores are not a real-world benchmark.</p></div></div>
    <div className="notice notice-amber"><strong>Scope of this comparison</strong><span>The four models received matched numeric context and test rows. The chart averages three context samples from one synthetic dataset and one held-out test set. Trees used fixed 100-tree settings; RPT used the lighter 2,048-row, one-bag setting. All runs used CPU. No model was tuned here, and the error bars are not uncertainty across independent datasets.</span></div>
    {!results.some(row => row.model_name === 'SAP-RPT-OSS') && <div className="notice notice-amber"><strong>RPT can be added</strong><span>There are no measured SAP-RPT-OSS runs in this export yet. The offline runner supports the research checkpoint; once actual runs are exported, RPT appears beside TabPFN, XGBoost, and CatBoost. This is distinct from SAP’s commercial RPT service.</span></div>}
    <div className="study-grid">
      <div className="panel study-main">
        <div className="chart-toolbar"><div><span className="eyebrow">CLEAN CONTEXT · THREE SEEDS · ONE TEST SET</span><h2>Recorded score on this synthetic task</h2></div><div className="comparison-selectors"><label>Context rows <select aria-label="Context rows" value={size} onChange={event => setContextSize(Number(event.target.value))}>{sizes.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Metric <select aria-label="Comparison metric" value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div></div>
        {chartData.length ? <><div className="comparison-metric-guide"><strong>{actualClaims} claims among {testCount} held-out rows ({(prevalence * 100).toFixed(1)}%)</strong><p>{metricContext[metric]}</p></div><div className="chart" role="img" aria-label={`${metricLabels[metric]} for measured ${availableModels.join(', ')} runs at ${size} context rows`}><ResponsiveContainer width="100%" height={280}><BarChart data={chartData} margin={{ left: -12, right: 12, top: 12 }}><CartesianGrid vertical={false} stroke="#dce3f4"/><XAxis dataKey="name"/><YAxis domain={[0, metric === 'log_loss' ? 'auto' : 1]}/><Tooltip formatter={(value: number) => value.toFixed(3)}/><Bar name={metricLabels[metric]} dataKey="value" maxBarSize={88} isAnimationActive={false}>{chartData.map(row => <Cell key={row.name} fill={modelColors[row.name]}/>) }<ErrorBar dataKey="error" width={4} stroke="#16213f"/></Bar></BarChart></ResponsiveContainer></div><div className="table-wrap"><table className="comparison-summary"><thead><tr><th scope="col">Model</th><th scope="col">Mean ± SD</th><th scope="col">Runs</th><th scope="col">Flagged claims / run</th><th scope="col">True claims found / run</th></tr></thead><tbody>{chartData.map(row => <tr key={row.name}><th scope="row"><i className="swatch" style={{ background: modelColors[row.name] }}/>{row.name}</th><td>{row.value === null ? '—' : `${row.value.toFixed(3)} ± ${row.error?.[0].toFixed(3) ?? '0.000'}`}</td><td>{row.n}</td><td>{countRange(row.predictedCounts)} / {testCount}</td><td>{countRange(row.foundCounts)} / {actualClaims}</td></tr>)}</tbody></table></div><p className="fineprint">{metricDefinitions[metric]} {metric === 'positive_rate' ? 'This is descriptive, not a performance ranking.' : `${lowerIsBetter(metric) ? 'Lower' : 'Higher'} is better.`} Count ranges show the minimum and maximum across available runs. SD describes variation across context seeds on one synthetic dataset, not a confidence interval across datasets.</p>{metric !== 'positive_rate' && tabMean !== null && tabMean !== undefined && catMean !== null && catMean !== undefined && pairedSeeds.length > 0 && <p className="comparison-pair-note">TabPFN vs CatBoost at {size} rows: {tabMean.toFixed(3)} vs {catMean.toFixed(3)} mean {metricLabels[metric]} (gap {Math.abs(tabMean - catMean).toFixed(4)}). Across the {pairedSeeds.length} shared context seeds, TabPFN performs better in {tabAhead}, CatBoost in {catAhead}{pairedSeeds.length - tabAhead - catAhead > 0 ? `, and they tie in ${pairedSeeds.length - tabAhead - catAhead}` : ''}. These seeds use one synthetic test set, so they do not measure uncertainty across datasets.</p>}{metric !== 'positive_rate' && tabMean !== null && tabMean !== undefined && rptMean !== null && rptMean !== undefined && rptPairs.length > 0 && <p className="comparison-pair-note">TabPFN vs SAP-RPT-OSS at {size} rows: {tabMean.toFixed(3)} vs {rptMean.toFixed(3)} mean {metricLabels[metric]} (gap {Math.abs(tabMean - rptMean).toFixed(4)}). Across the {rptPairs.length} shared context seeds, TabPFN performs better in {tabAheadRPT}, SAP-RPT-OSS in {rptAhead}{rptPairs.length - tabAheadRPT - rptAhead > 0 ? `, and they tie in ${rptPairs.length - tabAheadRPT - rptAhead}` : ''}. These seeds use one synthetic test set.</p>}</> : <div className="empty-chart">No matched measured runs yet. Export results from the Python pipeline.</div>}
      </div>
      <aside className="panel study-side"><span className="eyebrow">TIMING / RECORDED HARDWARE</span><h2>Execution cost</h2>{chartData.map(row => <div className="model-timing" key={row.name}><strong>{row.name} {row.version}</strong><span>Mean fit call {row.fit.toFixed(3)} s</span><span>Mean predict call {row.predict.toFixed(3)} s</span><small>{row.hardware}</small></div>)}<p className="fineprint">TabPFN’s fit call prepares task context; the tree fit calls train task-specific models. Timings describe different work and include implementation and hardware effects.</p>{testPositiveRate !== undefined && <p className="fineprint">Held-out positive share: {(testPositiveRate * 100).toFixed(1)}%. Accuracy near the majority-class rate can hide poor claim detection; inspect average precision, recall, and F1 too.</p>}</aside>
    </div>
    {example && <div className="panel probability-panel"><div><span className="eyebrow">INDIVIDUAL PREDICTIONS · SEED 7</span><h2>One held-out observation, {availableModels.length} models</h2></div><label>Observation <select aria-label="Comparison observation" value={testIndex} onChange={event => setTestIndex(Number(event.target.value))}>{seedRuns[0].predictions.map((prediction, index) => <option key={prediction.id} value={index}>Customer {prediction.id}</option>)}</select></label><div className="comparison-probs">{availableModels.map(model => <div key={model}><strong>{model}</strong><span>{byModel[model]?.predictions[testIndex] ? `${Math.round(byModel[model]!.predictions[testIndex].probability * 100)}%` : '—'}</span><small>Claim probability</small></div>)}</div><p className="fineprint">Actual claim label: {example.truth}. Probabilities are stored measurements; they are not computed by the browser.</p></div>}
    <div className="panel research-note"><span className="eyebrow">RESEARCH CONTEXT</span><h2>What broader benchmarks show</h2><p>The <a href="https://www.nature.com/articles/s41586-024-08328-6" target="_blank" rel="noreferrer">TabPFN study in Nature</a> found strong average performance on small and medium tabular datasets, including comparisons with XGBoost and CatBoost. Its reported scores are normalized across datasets, so they should not be read as raw AUC values for this app.</p><p>SAP's <a href="https://arxiv.org/abs/2506.10707" target="_blank" rel="noreferrer">ConTextTab paper</a> describes the research model linked from the SAP-RPT-OSS model card and reports competitive results, especially on semantically rich tables. That benchmark does not establish its performance on this numeric synthetic task.</p><p>The <a href="https://proceedings.neurips.cc/paper_files/paper/2025/hash/1697e3fb412da11dc9488249f9e7bbc9-Abstract-Datasets_and_Benchmarks_Track.html" target="_blank" rel="noreferrer">TabArena benchmark</a> finds foundation models strong on compatible small datasets while boosted trees remain strong practical baselines. Tuning, validation design, and ensembling change rankings. <a href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0118432" target="_blank" rel="noreferrer">Saito and Rehmsmeier</a> explain why precision–recall measures help interpret rare-event classifiers. The chart above reports only this project’s synthetic experiment.</p></div>
  </section>
}
