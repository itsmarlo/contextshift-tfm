import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { initialRows, simulate } from '../simulation/model'

const heldOut = initialRows.find(row => row.id === 105)!
const { label: actualClaim, ...query } = heldOut
const context = initialRows.filter(row => row.id !== heldOut.id)
const changedContext = context.map(row => row.id === 102 ? { ...row, label: 0 as const } : row)
const preview = [102, 103, 106].map(id => context.find(row => row.id === id)!)

const steps = [
  { title: 'Read the table', body: 'Each customer is one row. Age, premium, and prior claims are features. “Claim” is the outcome we want to predict.', takeaway: 'Features describe a row; the target is the answer.' },
  { title: 'Hold out a query', body: 'We keep customer 105 out of the examples. Its features are visible, but its claim outcome stays hidden while making the prediction.', takeaway: 'The answer is kept separate from the model input.' },
  { title: 'Supply labeled context', body: 'The model receives nine other customers with their known outcomes, plus customer 105’s features. This is the task it must solve.', takeaway: 'Context means examples from this task, with labels.' },
  { title: 'Represent the values', body: 'A pretrained model turns feature values into internal representations. TabPFN and SAP-RPT-OSS encode tables differently; this diagram shows the shared idea.', takeaway: 'These are internal representations, not hand-written rules.' },
  { title: 'Use the context', body: 'The model uses patterns in the labeled rows to interpret the query. The arrows show information flow conceptually, not measured attention or row importance.', takeaway: 'The query can use context without seeing its own label.' },
  { title: 'Predict a probability', body: 'The model returns a probability of a claim for the query. Its pretrained weights stay fixed while the supplied context can change.', takeaway: 'A probability needs a threshold before it becomes a Yes/No decision.' },
  { title: 'Reveal and evaluate', body: 'Only after predicting do we reveal customer 105’s known outcome. One row shows a mistake or a correct decision; metrics need many held-out rows.', takeaway: 'A single example cannot establish model quality.' },
  { title: 'Change the context', body: 'Try a hypothetical edit to a labeled example. Watch how the teaching calculation responds for the same query.', takeaway: 'A context edit changes the input; it does not retrain pretrained weights.' },
] as const

function Outcome({ value, hidden = false }: { value?: 0 | 1; hidden?: boolean }) {
  return <span className={`learn-outcome ${hidden ? 'hidden' : value ? 'claim' : 'no-claim'}`}>{hidden ? 'Hidden' : value ? 'Claim' : 'No claim'}</span>
}

function ExampleTable({ showContext = false }: { showContext?: boolean }) {
  const rows = showContext ? preview : [...preview, heldOut]
  return <div className="learn-table-wrap"><table className="learn-example-table"><caption>{showContext ? 'Three of nine labeled context rows' : 'A few rows from the example table'}</caption><thead><tr><th scope="col">Customer</th><th scope="col">Age</th><th scope="col" className="learn-premium-col">Premium</th><th scope="col">Prior claims</th><th scope="col">Claim outcome</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={row.id === heldOut.id ? 'query-row' : ''}><th scope="row">#{row.id}{row.id === heldOut.id && <small> query</small>}</th><td>{row.age}</td><td className="learn-premium-col">€{row.premium?.toLocaleString()}</td><td>{row.previousClaims}</td><td>{row.id === heldOut.id ? <Outcome hidden /> : <Outcome value={row.label} />}</td></tr>)}</tbody></table></div>
}

function StepVisual({ step, probability, changedProbability, flip, setFlip }: {
  step: number; probability: number; changedProbability: number; flip: boolean; setFlip: (value: boolean) => void
}) {
  if (step === 0) return <ExampleTable />
  if (step === 1) return <div className="learn-flow"><div className="learn-flow-card"><span>KNOWN EXAMPLES</span><strong>9 labeled rows</strong><small>Features + claim outcomes</small></div><ArrowRight aria-hidden="true"/><div className="learn-flow-card query"><span>HELD-OUT QUERY</span><strong>Customer #105</strong><small>Features visible · outcome hidden</small></div></div>
  if (step === 2) return <div className="learn-context-view"><ExampleTable showContext /><div className="learn-query-card"><span>QUERY · CUSTOMER #105</span><strong>Age 42 · €1,380 premium · 1 prior claim</strong><small>Claim outcome: hidden from inference</small></div></div>
  if (step === 3) return <div className="learn-encoding"><div className="learn-feature-chips"><span>Age <b>42</b></span><span>Premium <b>€1,380</b></span><span>Prior claims <b>1</b></span><span>+ five more features</span></div><ArrowRight aria-hidden="true"/><div className="learn-flow-card query"><span>MODEL INTERIOR</span><strong>Representations</strong><small>Architecture-specific encoding</small></div></div>
  if (step === 4) return <div className="learn-context-flow"><div className="learn-context-sources"><span>#102 · Claim</span><span>#103 · No claim</span><span>#106 · Claim</span><small>+ six more labeled rows</small></div><div className="learn-flow-arrow" aria-hidden="true">→</div><div className="learn-flow-card query"><span>QUERY</span><strong>#105 · ?</strong><small>Use patterns in context</small></div></div>
  if (step === 5) return <div className="learn-probability"><span>MODEL OUTPUT</span><strong>P(claim for #105 | labeled context)</strong><small>A pretrained model calculates its own probability.</small><div className="learn-sim-value">Teaching simulation for these rows: <b>{Math.round(probability * 100)}%</b></div></div>
  if (step === 6) return <div className="learn-evaluation"><div><span>TEACHING SIMULATION</span><strong>{Math.round(probability * 100)}% claim chance</strong><small>At a 50% threshold: predict Claim</small></div><div><span>REVEALED OUTCOME</span><strong>{actualClaim ? 'Claim' : 'No claim'}</strong><small>Customer #105 was held out</small></div><p>This one simulated decision is wrong. Measure performance over many held-out rows before comparing models.</p></div>
  return <div className="learn-change"><label><input type="checkbox" checked={flip} onChange={event => setFlip(event.target.checked)}/> Hypothetically change row #102 from Claim to No claim</label><div className="learn-change-values"><div><span>ORIGINAL CONTEXT</span><strong>{Math.round(probability * 100)}%</strong><small>Simulated claim chance</small></div><ArrowRight aria-hidden="true"/><div><span>EDITED CONTEXT</span><strong>{Math.round((flip ? changedProbability : probability) * 100)}%</strong><small>Simulated claim chance</small></div></div><p>{flip ? 'The predicted class crosses the 50% threshold in this teaching simulation.' : 'Select the edit to see how the same query responds.'} This hypothetical label change is for explanation, not a recommended way to improve data.</p></div>
}

export function Learn() {
  const [step, setStep] = useState(0)
  const [flip, setFlip] = useState(false)
  const stepList = useRef<HTMLElement>(null)
  const probability = simulate(context, query)!
  const changedProbability = simulate(changedContext, query)!

  useEffect(() => {
    const list = stepList.current
    const active = list?.querySelector<HTMLElement>('[aria-current="step"]')
    if (list && active && list.scrollWidth > list.clientWidth && typeof list.scrollTo === 'function') {
      list.scrollTo({ left: active.offsetLeft - list.offsetLeft - (list.clientWidth - active.clientWidth) / 2 })
    }
  }, [step])

  return <section className="page-content" aria-labelledby="learn-title">
    <div className="page-heading"><div><span className="eyebrow">04 / FIELD GUIDE</span><h1 id="learn-title">How in-context learning works</h1><p>Follow one held-out customer from labeled examples to a checked prediction.</p></div></div>
    <div className="notice notice-teal learn-notice"><strong>Worked example</strong><span>The rows and numerical probabilities here use the browser’s educational similarity calculation. The guide explains how TabPFN and SAP-RPT-OSS use context conceptually; the numbers are not their outputs.</span></div>
    <div className="learn-layout">
      <nav ref={stepList} className="step-list" aria-label="Learning steps">{steps.map((item, index) => <button key={item.title} aria-current={step === index ? 'step' : undefined} className={step === index ? 'active' : ''} onClick={() => setStep(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}</nav>
      <div className="panel learn-card"><span className="eyebrow">STEP {String(step + 1).padStart(2, '0')} / 08</span><h2>{steps[step].title}</h2><p>{steps[step].body}</p><div className="learn-visual" aria-live="polite"><StepVisual step={step} probability={probability} changedProbability={changedProbability} flip={flip} setFlip={setFlip}/></div><div className="learn-takeaway"><strong>Key idea</strong><span>{steps[step].takeaway}</span></div><div className="step-actions"><button className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button><button className="primary-button" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>Next step <ArrowRight size={15}/></button></div></div>
      <aside className="panel learn-aside"><LockKeyhole size={20}/><h3>Customer #105 stays held out</h3><p>Age 42 · €1,380 premium · 1 prior claim. Its outcome is {step < 6 ? <strong>hidden until evaluation</strong> : <strong>No claim</strong>}.</p><div className="thin-rule"/><strong>Two different operations</strong><p><b>TabPFN and SAP-RPT-OSS:</b> use pretrained weights and supplied context.</p><p><b>XGBoost and CatBoost:</b> fit task-specific trees to the labeled rows.</p><div className="thin-rule"/><p>Giving the query’s true outcome to any model during prediction would leak the answer.</p></aside>
    </div>
  </section>
}
