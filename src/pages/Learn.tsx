import { useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { initialRows, simulate, testRows } from '../simulation/model'
const steps = [
  { title:'Tabular data', body:'Each row is an observation. Columns describe features; the target is the value to predict.', visual:'Age · Premium · Prior claims → Claim' },
  { title:'Train / test split', body:'X_train contains labeled example features and y_train their known outcomes. X_test contains new features. y_test is held out for evaluation.', visual:'X_train + y_train  |  X_test + ?' },
  { title:'Build the context', body:'Labeled rows and test features enter the model together. The unknown test target never enters inference.', visual:'[ examples + labels ]  →  [ test features + ? ]' },
  { title:'Encode values', body:'The model transforms table values into internal representations. Exact feature encoding depends on its architecture.', visual:'table values → vectors' },
  { title:'Exchange information', body:'Attention lets representations exchange information across rows and features. This is a conceptual diagram, not extracted attention weights or a causal explanation.', visual:'row ↔ row    column ↔ column' },
  { title:'Decode probability', body:'The pretrained model returns a class probability for the unseen observation. Its pretrained weights stay fixed.', visual:'representation → P(claim)' },
  { title:'Evaluate', body:'Compare predictions with held-out y_test only after inference. Metrics summarize performance over the fixed test set.', visual:'y_pred ↔ y_test' },
  { title:'Change context', body:'Replacing labeled examples can change the prediction without updating pretrained weights. Traditional XGBoost needs a new task-specific fit.', visual:'new context → new prediction' },
]
export function Learn() {
  const [step,setStep] = useState(0)
  const [flip,setFlip] = useState(false)
  const original = simulate(initialRows,testRows[0])!
  const changed = simulate(initialRows.map((r,i)=>i===4?{...r,label:flip?1 as const:0 as const}:r),testRows[0])!
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">04 / FIELD GUIDE</span><h1>How in-context learning works</h1><p>Eight steps from a table of known examples to a prediction on an unseen row.</p></div></div><div className="learn-layout"><nav className="step-list" aria-label="Learning steps">{steps.map((item,i)=><button key={item.title} className={step===i?'active':''} onClick={()=>setStep(i)}><span>{String(i+1).padStart(2,'0')}</span>{item.title}</button>)}</nav><div className="panel learn-card"><span className="eyebrow">STEP {String(step+1).padStart(2,'0')} / 08</span><h2>{steps[step].title}</h2><p>{steps[step].body}</p><div className="concept-visual" aria-label={steps[step].visual}><span>{steps[step].visual}</span></div>{step===7 && <div className="mini-interaction"><label><input type="checkbox" checked={flip} onChange={e=>setFlip(e.target.checked)}/> Change customer 105 label to claim</label><div>Similarity simulation: {Math.round(original*100)}% <ArrowRight size={16}/> {Math.round(changed*100)}%</div><small>Pretrained model weights unchanged. Educational simulation, not actual TFM inference.</small></div>}<div className="step-actions"><button className="secondary-button" disabled={step===0} onClick={()=>setStep(step-1)}>Previous</button><button className="primary-button" disabled={step===steps.length-1} onClick={()=>setStep(step+1)}>Next step <ArrowRight size={15}/></button></div></div><aside className="panel learn-aside"><LockKeyhole size={20}/><h3>Target boundary</h3><p>Training labels are available as context. Test labels stay hidden until evaluation. Feeding y_test into context would leak the answer.</p><div className="thin-rule"/><strong>Two different operations</strong><p><b>TabPFN:</b> uses pretrained weights and supplied context.</p><p><b>XGBoost:</b> learns task-specific trees by fitting training data.</p></aside></div></section>
}
