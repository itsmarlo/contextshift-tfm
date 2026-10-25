import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleHelp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { explainSimulation, features, initialRows, simulate, testRows, type Feature, type Row } from '../simulation/model'
import { modelNames } from '../data/models'
import type { ExperimentResult, ExperimentType, ModelName } from '../types/experiment'

const pct = (v: number | null) => v === null ? '—' : `${Math.round(v * 100)}%`
const initial = initialRows.map(r => ({ ...r }))
export function Playground({ results }: { results: ExperimentResult[] }) {
  const [mode, setMode] = useState<'simulation' | 'precomputed'>('simulation')
  const [rows, setRows] = useState<Row[]>(initial)
  const [testIndex, setTestIndex] = useState(0)
  const [size, setSize] = useState(10)
  const [experiment, setExperiment] = useState<ExperimentType>('size')
  const [level, setLevel] = useState('10')
  const [seed, setSeed] = useState(7)
  const [model, setModel] = useState<ModelName>('XGBoost')
  const measuredModels = modelNames.filter(name => results.some(row => row.model_name === name))
  const [noise, setNoise] = useState(0)
  const [outliers, setOutliers] = useState(0)
  const [missing, setMissing] = useState(0)
  const [flips, setFlips] = useState(0)
  const [shift, setShift] = useState(0)
  const [relevance, setRelevance] = useState(50)
  const [imbalance, setImbalance] = useState(50)
  const [appliedSettings, setAppliedSettings] = useState<string | null>(null)
  const [appliedSummary, setAppliedSummary] = useState('')
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const settingsKey = [flips, noise, outliers, missing, shift, relevance, imbalance, seed].join(':')
  const hasIntervention = flips > 0 || noise > 0 || outliers > 0 || missing > 0 || shift > 0 || relevance !== 50 || imbalance !== 50
  const canApply = hasIntervention && appliedSettings !== settingsKey
  const visibleRows = rows.slice(0, size)
  const test = testRows[testIndex]
  const realTest = mode === 'precomputed' ? results.find(r => r.experiment_type === experiment && r.model_name === model && r.seed === seed && String(r.configuration.level ?? r.context_size) === level)?.test_preview?.[testIndex] : undefined
  const baseline = useMemo(() => simulate(initial, test), [test])
  const explanation = useMemo(() => explainSimulation(visibleRows, test), [visibleRows,test])
  const modified = explanation.probability
  const selectedResult = results.find(r => r.experiment_type === experiment && r.model_name === model && r.seed === seed && String(r.configuration.level ?? r.context_size) === level)
  const realPrediction = selectedResult?.predictions[testIndex]
  const value = mode === 'simulation' ? modified : realPrediction?.probability ?? null
  const baselineLevel = experiment === 'size' ? '10' : experiment === 'relevance' ? '50' : experiment === 'imbalance' ? '20' : '0'
  const baseValue = mode === 'simulation' ? baseline : results.find(r => r.experiment_type === experiment && r.model_name === model && r.seed === seed && String(r.configuration.level ?? r.context_size) === baselineLevel)?.predictions[testIndex]?.probability ?? null
  const diff = value !== null && baseValue !== null ? value - baseValue : null
  const levels: Record<ExperimentType, string[]> = { size: ['10','25','50','100','250','500','1000'], missing: ['0','5','10','20','30','40'], labels: ['0','5','10','20','30','40'], noise: ['0','5','10','20','30','40'], outliers: ['0','5','10','20','30','40'], relevance: ['0','25','50','75','100'], imbalance: ['5','10','20','35','50'], drift: ['0','50','100'] }
  const currentPositiveShare = visibleRows.length ? Math.round(visibleRows.filter(row => row.label === 1).length / visibleRows.length * 100) : 0
  const sliders = [
    { id: 'label-corruption', label: 'Label corruption', value: flips, set: setFlips, max: 100, step: 5, valueText: `${flips}%`, help: 'Flip this share of shown Claim/No claim labels, rounded to whole rows.' },
    { id: 'feature-noise', label: 'Premium noise', value: noise, set: setNoise, max: 100, step: 5, valueText: `±${noise}%`, help: 'Vary each shown premium by up to this percentage. The query stays fixed.' },
    { id: 'outliers', label: 'Premium outliers', value: outliers, set: setOutliers, max: 100, step: 5, valueText: `${outliers}%`, help: 'Multiply selected shown premiums by five to create unusual examples.' },
    { id: 'missing-premium', label: 'Missing premium', value: missing, set: setMissing, max: 100, step: 5, valueText: `${missing}%`, help: 'Blank this share of shown premium cells, rounded to whole rows.' },
    { id: 'duration-shift', label: 'Duration shift', value: shift, set: setShift, max: 4, step: 1, valueText: `+${shift} yr`, help: 'Add years to every shown policy duration. The query duration stays fixed.' },
    { id: 'risk-mix', label: 'Risk-tier mix', value: relevance, set: setRelevance, max: 100, step: 5, valueText: relevance === 50 ? 'neutral' : relevance < 50 ? 'toward 1' : 'toward 3', help: '50 keeps current tiers. Move left for more tier 1 rows, right for more tier 3 rows.' },
    { id: 'positive-share', label: 'Positive share', value: imbalance, set: setImbalance, max: 100, step: 5, valueText: `${imbalance}%`, help: `Set the Claim-label share of shown rows. 50 leaves labels unchanged; currently ${currentPositiveShare}% are Claim.` },
  ] as const
  const interventionStatus = !hasIntervention
    ? appliedSettings ? 'Applied changes remain in the table. Reset to return to the original rows.' : 'Move one slider, then apply it to the shown context rows.'
    : appliedSettings === settingsKey ? 'Applied. Changed cells are highlighted; Reset to start a clean experiment.'
      : appliedSettings ? 'New settings are pending. Applying again adds changes to the current rows; Reset first for a clean comparison.'
        : 'Settings are pending. Click Apply selected changes to update the table and prediction.'
  function updateRow(id: number, key: Feature | 'label', value: number | null) {
    setRows(current => current.map(row => row.id === id ? { ...row, [key]: key === 'label' ? (value === 1 ? 1 : 0) : value } : row))
    setEdited(current => new Set(current).add(`${id}-${key}`))
    setAppliedSummary('')
  }
  function flipMostInfluential() {
    const closest = explanation.influences.find(row => row.share > 0)
    const match = rows.find(row => row.id === closest?.id)
    if (match) updateRow(match.id, 'label', match.label ? 0 : 1)
  }
  function addSimilarExample() {
    const id = Math.max(100, ...rows.map(row => row.id)) + 1
    const example: Row = {
      ...test,
      id,
      age: test.age === null ? null : test.age + 2,
      premium: test.premium === null ? null : test.premium + 120,
      duration: test.duration === null ? null : test.duration + 1,
      label: 1,
    }
    setRows(current => [...current.slice(0, size), example, ...current.slice(size)])
    setSize(size + 1)
    setEdited(current => new Set(current).add(`${id}-label`))
    setAppliedSummary('')
  }
  function hideClosestPremium() {
    const closest = explanation.influences.find(row => row.share > 0)
    if (closest) updateRow(closest.id, 'premium', null)
  }
  function reset() { setRows(initial.map(r=>({...r}))); setEdited(new Set()); setSize(10); setNoise(0); setOutliers(0); setMissing(0); setFlips(0); setShift(0); setRelevance(50); setImbalance(50); setAppliedSettings(null); setAppliedSummary(''); setSeed(7); setExperiment('size'); setLevel('10'); setModel('XGBoost'); setTestIndex(0) }
  function seeded(n: number) { const x = Math.sin(n * 9283 + seed * 719) * 43758.5453; return x - Math.floor(x) }
  function applyInterventions() {
    if (!canApply) return
    const shown = rows.slice(0, size)
    const positions = shown.map((_, index) => index)
    const choose = (eligible: number[], percent: number, salt: number) => new Set(
      [...eligible].sort((a, b) => seeded(a + salt) - seeded(b + salt)).slice(0, Math.round(eligible.length * percent / 100))
    )
    const flipped = choose(positions, flips, 1)
    const premiums = positions.filter(index => shown[index].premium !== null)
    const hidden = choose(premiums, missing, 311)
    const extreme = choose(premiums, outliers, 411)
    const riskChanged = choose(positions, Math.abs(relevance - 50) * 2, 88)
    const changed = shown.map((row, index) => {
      const result = { ...row }
      if (flipped.has(index)) result.label = result.label ? 0 : 1
      if (hidden.has(index)) result.premium = null
      if (extreme.has(index) && result.premium !== null) result.premium *= 5
      if (noise > 0 && result.premium !== null) result.premium = Math.max(0, Math.round(result.premium * (1 + (seeded(index+23)-.5) * noise / 50)))
      if (shift > 0 && result.duration !== null) result.duration += shift
      if (riskChanged.has(index) && result.risk !== null) result.risk = relevance > 50 ? 3 : 1
      return result
    })
    if (imbalance !== 50) {
      const target = Math.round(changed.length * imbalance / 100)
      const positive = changed.filter(row => row.label === 1).length
      const candidates = positions.filter(index => changed[index].label === (positive < target ? 0 : 1))
        .sort((a, b) => seeded(a + 182) - seeded(b + 182))
      for (const index of candidates.slice(0, Math.abs(target - positive))) changed[index].label = positive < target ? 1 : 0
    }
    const nextEdited = new Set(edited)
    let changedCells = 0
    for (let index = 0; index < changed.length; index++) {
      for (const key of [...features.map(feature => feature.key), 'label'] as const) {
        if (changed[index][key] !== shown[index][key]) {
          changedCells++
          nextEdited.add(`${shown[index].id}-${key}`)
        }
      }
    }
    setRows([...changed, ...rows.slice(size)])
    setEdited(nextEdited)
    setAppliedSettings(settingsKey)
    setAppliedSummary(`Applied to ${shown.length} shown rows; ${changedCells} cells changed. The query did not change.`)
  }
  return <section className="page-content" aria-labelledby="playground-title">
    <div className="page-heading"><div><span className="eyebrow">01 / INTERACTIVE WORKSPACE</span><h1 id="playground-title">The Playground</h1><p>Change labeled examples and watch the prediction respond. The synthetic dataset keeps the mechanics visible.</p></div><div className="mode-switch" role="group" aria-label="Inference mode"><button className={mode === 'simulation' ? 'active' : ''} onClick={()=>setMode('simulation')}>Simulation</button><button className={mode === 'precomputed' ? 'active' : ''} onClick={()=>setMode('precomputed')}>Real experiments</button></div></div>
    <div className={`notice ${mode === 'simulation' ? 'notice-teal' : 'notice-amber'}`}><CircleHelp size={16}/><span>{mode === 'simulation' ? <><strong>Simulation Mode — Educational simulation, not actual TFM inference.</strong> Labeled context rows and one unlabeled query produce a prediction. Try a change below to see the effect. The browser uses a transparent similarity rule, not TabPFN or RPT.</> : <><strong>Measured results only.</strong> Select an available configuration. Missing combinations have no displayed metric or prediction.</>}</span></div>
    {mode === 'simulation' && <div className="scenario-panel" aria-label="Quick context experiments"><div><span className="eyebrow">START HERE</span><h2>Change the context. Watch the prediction.</h2><p>Quick actions, context size, and table edits update immediately. For the other sliders, press Apply selected changes. Compare the result with the original 10-row probability, then Reset before trying another change. The added claim is a hypothetical example, not the hidden query label.</p></div><div className="scenario-actions"><button onClick={flipMostInfluential} disabled={!explanation.influences.some(row => row.share > 0)}>Flip closest label</button><button onClick={addSimilarExample}>Add similar claim</button><button onClick={hideClosestPremium} disabled={!explanation.influences.some(row => row.share > 0)}>Hide closest premium</button><button onClick={reset}>Reset example</button></div><div className="scenario-result" role="status" aria-live="polite"><span>Simulated claim probability</span><strong>{pct(value)}</strong><small>{diff === null ? 'No comparison' : `${diff >= 0 ? ' +' : ''}${Math.round(diff * 100)} pp from original`}</small></div></div>}
    <div className="workspace"><aside className="panel controls"><div className="panel-heading"><div><span className="eyebrow">CONFIGURE</span><h2>Context controls</h2></div><button className="icon-button" onClick={reset} aria-label="Reset controls and context" title="Reset"><RotateCcw size={16}/></button></div>
      {mode === 'simulation' ? <>
        <label className="control-label" htmlFor="context-size">Context size <strong>{size} rows</strong></label>
        <p className="control-help" id="context-size-help">Show the first {size} labeled examples. This slider updates the prediction immediately.</p>
        <input id="context-size" type="range" min={rows.length ? 1 : 0} max={Math.max(1, rows.length)} value={Math.min(size, rows.length)} aria-describedby="context-size-help" onChange={event => setSize(Number(event.target.value))}/>
        <div className="range-ends"><span>1</span><span>{rows.length}</span></div>
        <div className="control-divider"/>
        <details className="advanced-controls">
          <summary>More context changes</summary>
          <p className="fineprint">Choose a setting, apply it, then read the prediction shift. Reset before testing a different factor.</p>
          <p className="intervention-status" role="status">{interventionStatus}</p>
          {sliders.map(control => <div className="slider-control" key={control.id}>
            <label htmlFor={control.id}>{control.label}<strong>{control.valueText}</strong></label>
            <p className="control-help" id={`${control.id}-help`}>{control.help}</p>
            <input id={control.id} type="range" min="0" max={control.max} step={control.step} value={control.value} aria-describedby={`${control.id}-help`} onChange={event => control.set(Number(event.target.value))}/>
          </div>)}
          <label className="control-label" htmlFor="sim-seed">Random seed</label>
          <p className="control-help" id="sim-seed-help">Controls which rows receive edits. The same seed and settings give the same selection.</p>
          <input className="number-field" id="sim-seed" type="number" value={seed} aria-describedby="sim-seed-help" onChange={event => setSeed(Number(event.target.value) || 0)}/>
          <div className="advanced-apply"><button className="primary-button full" onClick={applyInterventions} disabled={!canApply}>Apply selected changes</button></div>
        </details>
        <p className="fineprint">You can also edit table cells directly. Those edits update the prediction immediately; blank features count as missing.</p>
      </> : <>
        <label className="control-label" htmlFor="model">Model</label>
        <p className="control-help" id="model-help">Choose one of the models with recorded predictions. No model runs in this browser.</p>
        <select id="model" value={measuredModels.includes(model) ? model : measuredModels[0] ?? ''} aria-describedby="model-help" onChange={event => setModel(event.target.value as ModelName)}>{measuredModels.map(name => <option key={name}>{name}</option>)}</select>
        <label className="control-label" htmlFor="experiment">Experiment</label>
        <p className="control-help" id="experiment-help">Choose what was changed in the offline study.</p>
        <select id="experiment" value={experiment} aria-describedby="experiment-help" onChange={event => { const next = event.target.value as ExperimentType; setExperiment(next); setLevel(levels[next][0]) }}>{Object.entries({size:'Context size',missing:'Missing values',labels:'Label corruption',noise:'Feature noise',outliers:'Outliers',relevance:'Context relevance',imbalance:'Class imbalance',drift:'Concept drift'}).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label className="control-label" htmlFor="level">{experiment === 'size' ? 'Context rows' : 'Intervention level (%)'}</label>
        <p className="control-help" id="level-help">Choose a recorded context size or change level; the center table is read-only.</p>
        <select id="level" value={level} aria-describedby="level-help" onChange={event => setLevel(event.target.value)}>{levels[experiment].map(value => <option key={value}>{value}</option>)}</select>
        <label className="control-label" htmlFor="real-seed">Seed</label>
        <p className="control-help" id="real-seed-help">Pick one of three repeatable context samples from the study.</p>
        <select id="real-seed" value={seed} aria-describedby="real-seed-help" onChange={event => setSeed(Number(event.target.value))}>{[7, 17, 27].map(value => <option key={value}>{value}</option>)}</select>
        <p className="fineprint">Only exported model, seed, and intervention combinations have measured predictions.</p>
      </>}

    </aside><div className="panel dataset"><div className="panel-heading"><div><span className="eyebrow">INPUT / X_train + y_train</span><h2>Context dataset</h2></div><span className="count-pill">{mode === 'simulation' ? visibleRows.length : selectedResult?.context_size ?? 0} rows</span></div><p className="fineprint">Synthetic insurance customers · Claim within the next policy period</p><div className="table-wrap"><table><thead><tr><th scope="col">ID</th>{features.map(f=><th key={f.key} scope="col">{f.title}<small>{f.unit ?? ''}</small></th>)}<th scope="col" className="target-heading">Claim <small>y_train</small></th>{mode === 'simulation' && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{mode === 'simulation' ? visibleRows.map(row=><tr key={row.id}><th scope="row">{row.id}</th>{features.map(f=><td key={f.key}><input aria-label={`${f.title} for row ${row.id}`} className={edited.has(`${row.id}-${f.key}`) ? 'edited-cell' : ''} type="number" value={row[f.key] ?? ''} placeholder="—" onChange={e=>updateRow(row.id,f.key,e.target.value === '' ? null : Number(e.target.value))}/></td>)}<td className="target-cell"><select aria-label={`Claim label for row ${row.id}`} className={edited.has(`${row.id}-label`) ? 'edited-cell' : ''} value={row.label} onChange={e=>updateRow(row.id,'label',Number(e.target.value))}><option value="0">No</option><option value="1">Yes</option></select></td><td><button className="table-action" aria-label={`Remove row ${row.id}`} onClick={()=>{setRows(rows.filter(r=>r.id!==row.id));setSize(Math.min(size,rows.length-1))}}><Trash2 size={14}/></button></td></tr>) : selectedResult?.context_preview.map((row,i)=><tr key={i}><th scope="row">{i+1}</th>{features.map(f=><td key={f.key}>{row[f.key] ?? '—'}</td>)}<td className="target-cell">{row.label === 1 ? 'Yes' : 'No'}</td></tr>)}{mode === 'precomputed' && !selectedResult && <tr><td colSpan={10} className="empty-table">No real result for this configuration.</td></tr>}</tbody></table></div>{mode === 'simulation' && <div className="table-footer"><button className="text-button" onClick={()=>{const id=Math.max(100,...rows.map(r=>r.id))+1;setRows([...rows,{...initial[0],id}]);setSize(size+1)}}><Plus size={15}/> Add example</button><span><i className="cell-key"/> Modified cell · blank = missing</span></div>}<div className="test-strip"><div><span className="eyebrow">QUERY / X_test</span><strong>Unseen observation</strong><span>True label y_test is hidden during inference</span></div><select aria-label="Select test observation" value={testIndex} onChange={e=>setTestIndex(Number(e.target.value))}>{(mode === 'simulation' ? testRows : (selectedResult?.test_preview ?? []).slice(0,10)).map((_,i)=><option key={i} value={i}>Customer {mode === 'simulation' ? testRows[i].id : selectedResult?.predictions[i]?.id ?? i+1}</option>)}</select></div>{mode === 'simulation' && <div className="query-features" aria-label="Query features">{features.map(f=><span key={f.key}>{f.title}<strong>{test[f.key] ?? '—'}</strong></span>)}</div>}</div><aside className="panel prediction"><div className="panel-heading"><div><span className="eyebrow">OUTPUT / y_pred</span><h2>Prediction</h2></div><span className="pulse-dot"/></div>{mode === 'precomputed' && !selectedResult ? <div className="unavailable"><AlertTriangle size={22}/><h3>No measured result</h3><p>Run the offline pipeline and choose one of its exported model, seed, and intervention combinations.</p></div> : <><div className="prediction-main"><span className="eyebrow">CUSTOMER {mode === 'simulation' ? test.id : realPrediction?.id ?? '—'} · CLAIM PROBABILITY</span><div className="large-value">{pct(value)}</div><span className={`class-badge ${value !== null && value >= .5 ? 'positive' : ''}`}>{value === null ? 'Insufficient context' : value >= .5 ? 'Claim predicted' : 'No claim predicted'}</span></div>{mode === 'precomputed' && realTest && <div className="test-features">{features.slice(0,4).map(f=><span key={f.key}>{f.title} <strong>{realTest[f.key] ?? '—'}</strong></span>)}</div>}<div className="probability-track"><span style={{width:`${(value ?? 0)*100}%`}}/></div><div className="result-row"><span>{mode === 'simulation' ? 'Original 10-row probability' : 'Reference run probability'}</span><strong>{pct(baseValue)}</strong></div><div className="result-row"><span>Modified probability</span><strong>{pct(value)}</strong></div><div className="result-row emphasis"><span>Prediction shift</span><strong>{diff === null ? '—' : <>{diff >= 0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>} {diff >= 0 ? '+' : ''}{Math.round(diff*100)} pp</>}</strong></div>{diff !== null && baseValue !== null && value !== null && (baseValue >= .5) !== (value >= .5) && <p className="class-change">The predicted class changed.</p>}<div className="context-note"><strong>{mode === 'simulation' ? 'What changed?' : 'Recorded run'}</strong><p>{mode === 'simulation' ? edited.size || size !== initial.length || rows.length !== initial.length ? `${appliedSummary ? `${appliedSummary} ` : ''}Comparing ${visibleRows.length} current rows with the original 10-row context. The simulator recomputes similarity weights; no pretrained weights are used.` : 'Edit a context cell, change context size, or apply an intervention to compare probabilities.' : `${selectedResult?.experiment_type} · seed ${seed} · ${selectedResult?.model_name} ${selectedResult?.model_version}`}</p></div>{mode === 'simulation' && <div className="influence-panel"><div className="influence-heading"><h3>How context rows vote</h3></div><p>Each share is a row's portion of the total similarity weight. Claim labels push the weighted average up; no-claim labels pull it down.</p>{explanation.influences.length ? <ol className="influence-list">{explanation.influences.slice(0, 5).map(row => <li key={row.id}><span className="influence-id">#{row.id}</span><span className="influence-bar"><i style={{width:`${row.share * 100}%`}} /></span><strong>{Math.round(row.share * 100)}%</strong><span className="influence-label">{row.label ? 'Claim' : 'No claim'}</span></li>)}</ol> : <p>Add a context example to see its influence.</p>}{explanation.influences.length > 5 && <small>Showing the five largest shares of {explanation.influences.length} rows.</small>}</div>}{mode === 'precomputed' && selectedResult && <div className="metrics-mini"><span>Accuracy <strong>{pct(selectedResult.metrics.accuracy)}</strong></span><span>F1 <strong>{selectedResult.metrics.f1.toFixed(3)}</strong></span><span>ROC AUC <strong>{selectedResult.metrics.roc_auc?.toFixed(3) ?? '—'}</strong></span></div>}</> }</aside></div>
    <div className="below-note"><span className="numbered-dot">01</span><div><strong>One variable at a time</strong><p>For a controlled experiment, reset before applying a different intervention. The browser demonstration is a transparent similarity model; measured TabPFN, SAP-RPT-OSS, XGBoost, and CatBoost runs live in Real experiments.</p></div></div>
  </section>
}
