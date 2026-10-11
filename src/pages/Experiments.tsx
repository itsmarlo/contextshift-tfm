import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { StudyDetails } from '../components/StudyDetails'
import { MetricChart, metricDefinitions, metricLabels, type Metric } from '../components/MetricChart'
import type { ExperimentResult, ExperimentType } from '../types/experiment'

const experiments: { id: ExperimentType; title: string; question: string; factor: string; axis: string; note: string }[] = [
  { id:'size', title:'Context size', question:'How do additional labeled examples affect held-out predictions?', factor:'context_size', axis:'Number of context rows', note:'Nested context subsets are compared on an unchanged test set.' },
  { id:'missing', title:'Missing values', question:'How does removing training features affect performance?', factor:'level', axis:'Missing cells (%)', note:'Only training features are masked; test labels remain untouched.' },
  { id:'labels', title:'Label corruption', question:'How resilient are predictions to incorrect context targets?', factor:'level', axis:'Flipped training labels (%)', note:'Labels are flipped only in the context.' },
  { id:'noise', title:'Feature noise', question:'What happens when numerical context features are noisy?', factor:'level', axis:'Noise level (%)', note:'Selected training features receive seeded Gaussian noise.' },
  { id:'outliers', title:'Outlier contamination', question:'How do extreme context values change performance?', factor:'level', axis:'Contaminated rows (%)', note:'Extreme values appear only in sampled context rows.' },
  { id:'relevance', title:'Context relevance', question:'Does a closer population mix help on the fixed test population?', factor:'level', axis:'Population B share (%)', note:'Feature similarity alone does not guarantee predictive relevance.' },
  { id:'imbalance', title:'Class imbalance', question:'How does the context positive share affect minority-class detection?', factor:'level', axis:'Context positives (%)', note:'Accuracy can conceal weak minority-class recall.' },
  { id:'drift', title:'Concept drift', question:'Can recent labels help on a newer target relationship?', factor:'level', axis:'Recent context share (%)', note:'The test set always comes from Period B.' },
]
export function Experiments({ results }: { results: ExperimentResult[] }) {
  const [selected, setSelected] = useState<ExperimentType>('size')
  const [metric, setMetric] = useState<Metric>('accuracy')
  const current = experiments.find(e=>e.id===selected)!
  const subset = results.filter(r=>r.experiment_type === selected)
  const examples = subset[0]?.predictions ?? []
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">02 / CONTROLLED STUDIES</span><h1>Context experiments</h1><p>Change one primary factor, hold the test set fixed, and compare measured runs across seeds.</p></div><button className="secondary-button" onClick={()=>{setSelected('size');setMetric('accuracy')}}><RotateCcw size={15}/> Reset view</button></div><div className="experiment-tabs" role="tablist" aria-label="Experiment">{experiments.map(e=><button role="tab" aria-selected={selected===e.id} className={selected===e.id ? 'active' : ''} key={e.id} onClick={()=>setSelected(e.id)}>{e.title}</button>)}</div><div className="study-grid"><div className="panel study-main"><span className="eyebrow">RESEARCH QUESTION</span><h2>{current.question}</h2><p>{current.note}</p><div className="chart-toolbar"><div><span className="eyebrow">MEASURED PERFORMANCE</span><h3>{metricLabels[metric]} vs. {current.axis.toLowerCase()}</h3></div><label>Metric <select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{Object.entries(metricLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div><MetricChart results={results} type={selected} metric={metric} factor={current.factor}/><p className="fineprint">{metricDefinitions[metric]} Points show mean and standard deviation when repeated seeds exist. No estimates are filled in for missing runs.</p></div><aside className="panel study-side"><span className="eyebrow">STUDY STATUS</span><div className="large-count">{subset.length}</div><p>measured model runs in the current export</p><div className="thin-rule"/><h3>Controlled variables</h3><ul><li>Fixed held-out test observations</li><li>Independent intervention per run</li><li>Seeded context sampling</li><li>Matching data for both models</li></ul><div className="thin-rule"/><h3>Selected test example</h3>{examples.length ? <p>Customer {examples[0].id}: predicted probabilities are stored for each model and configuration.</p> : <p>No individual prediction is available until real experiments are run.</p>}</aside></div><StudyDetails results={results} type={selected}/></section>
}
