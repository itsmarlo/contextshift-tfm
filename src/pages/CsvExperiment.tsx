import { useMemo, useState, type ChangeEvent } from 'react'
import { explainCsv, featureScales, isLabeled, isPredictionCell, parseCsv, prepareDataset, type CsvTable, type LabeledRow } from '../simulation/csv'

const formatValue = (value: number | null, kind: 'binary' | 'numeric') => value === null ? '—' : kind === 'binary' ? `${Math.round(value * 100)}%` : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
const formatChange = (value: number | null, kind: 'binary' | 'numeric') => value === null ? '—' : kind === 'binary' ? `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pp` : `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)}`
const sampleUrl = `${import.meta.env.BASE_URL}samples/contextshift-predict-sample.csv`

export function CsvExperiment() {
  const [table, setTable] = useState<CsvTable | null>(null)
  const [fileName, setFileName] = useState('')
  const [target, setTarget] = useState('')
  const [queryIndex, setQueryIndex] = useState(0)
  const [size, setSize] = useState(0)
  const [edits, setEdits] = useState<Record<number, LabeledRow>>({})
  const [fileError, setFileError] = useState('')

  const prepared = useMemo(() => {
    if (!table) return { data: null, error: '' }
    try { return { data: prepareDataset(table, target), error: '' } }
    catch (error) { return { data: null, error: (error as Error).message } }
  }, [table, target])
  const data = prepared.data
  const query = data?.rows[queryIndex]
  const originalContext = useMemo(() => data?.rows.filter(isLabeled).filter(row => row.id !== data.rows[queryIndex]?.id) ?? [], [data, queryIndex])
  const context = originalContext.map(row => edits[row.id] ?? row).slice(0, size)
  const scales = useMemo(() => featureScales(originalContext, data?.features.length ?? 0), [originalContext, data])
  const baseline = query ? explainCsv(originalContext, query, scales).prediction : null
  const explanation = query ? explainCsv(context, query, scales) : { prediction: null, influences: [] }
  const shift = baseline !== null && explanation.prediction !== null ? explanation.prediction - baseline : null
  const ignored = table && data ? table.headers.filter(name => name !== target && !data.features.includes(name)) : []
  const unlabeled = data?.rows.filter(row => row.label === null) ?? []

  function selectTarget(selected: string, parsed: CsvTable) {
    const column = parsed.headers.indexOf(selected)
    const firstBlank = parsed.rows.findIndex(row => isPredictionCell(row[column]))
    const selectedQuery = firstBlank >= 0 ? firstBlank : 0
    setTarget(selected)
    setQueryIndex(selectedQuery)
    setSize(parsed.rows.filter((row, index) => index !== selectedQuery && !isPredictionCell(row[column]) && Number.isFinite(Number(row[column]))).length)
    setEdits({})
  }

  function load(text: string, name: string) {
    try {
      const parsed = parseCsv(text)
      setTable(parsed)
      setFileName(name)
      selectTarget(parsed.headers.find(header => /^(label|claim|target|y)$/i.test(header)) ?? parsed.headers.at(-1) ?? '', parsed)
      setFileError('')
    } catch (error) {
      setFileError((error as Error).message)
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1_000_000) { setFileError('Choose a CSV smaller than 1 MB.'); return }
    try { load(await file.text(), file.name) }
    catch { setFileError('The selected file could not be read.') }
    event.target.value = ''
  }

  async function loadSample() {
    try {
      const response = await fetch(sampleUrl)
      if (!response.ok) throw new Error()
      load(await response.text(), 'contextshift-predict-sample.csv')
    } catch { setFileError('The sample CSV could not be loaded.') }
  }

  function changeRow(id: number, update: (row: LabeledRow) => LabeledRow) {
    const original = data?.rows.filter(isLabeled).find(row => row.id === id)
    if (original) setEdits(current => ({ ...current, [id]: update(current[id] ?? original) }))
  }

  function flipTopLabel() {
    const top = explanation.influences.find(row => row.share > 0)
    if (top) changeRow(top.id, row => ({ ...row, label: row.label ? 0 : 1 }))
  }

  function increaseTopTarget() {
    const top = explanation.influences.find(row => row.share > 0)
    if (top) changeRow(top.id, row => ({ ...row, label: row.label + Math.max(1, Math.abs(row.label) * .1) }))
  }

  function hideTopFeature() {
    const top = explanation.influences.find(row => row.share > 0)
    const row = context.find(item => item.id === top?.id)
    const featureIndex = row?.values.findIndex(value => value !== null) ?? -1
    if (top && featureIndex >= 0) changeRow(top.id, current => ({ ...current, values: current.values.map((value, index) => index === featureIndex ? null : value) }))
  }

  return <section className="page-content csv-page" aria-labelledby="csv-title">
    <div className="page-heading"><div><span className="eyebrow">YOUR DATA / BROWSER SIMULATION</span><h1 id="csv-title">Experiment with your CSV</h1><p>Choose any numeric target column. Mark cells [PREDICT] or leave them blank, then change the known context to see how predictions respond.</p></div></div>
    <div className="notice notice-teal"><span><strong>Your file stays in this browser tab.</strong> This page does not upload it to a server. It uses a similarity-weighted teaching rule, not live TabPFN inference or the measured model results.</span></div>
    <div className="csv-upload panel">
      <div><h2>1. Choose a dataset</h2><p>Use a header row, 4–500 data rows, at most 50 feature columns, numeric features, and a numeric target column. Use 0/1 for classification or other numbers for regression. Put [PREDICT] or leave a blank in target cells you want predicted.</p></div>
      <div className="csv-upload-actions"><label htmlFor="csv-file" className="sr-only">Choose CSV file</label><input id="csv-file" type="file" accept=".csv,text/csv" onChange={upload}/><button type="button" onClick={loadSample}>Load sample</button><a href={sampleUrl} download>Download sample CSV</a></div>
      {fileError && <p className="csv-error" role="alert">{fileError}</p>}
      {table && <p className="csv-loaded" role="status">Loaded {fileName}: {table.rows.length} rows, {table.headers.length} columns.</p>}
    </div>
    {table && <div className="csv-lab">
      <div className="csv-controls panel"><h2>2. Set up the experiment</h2><label htmlFor="csv-target">Target column</label><select id="csv-target" value={target} onChange={event => selectTarget(event.target.value, table)}>{table.headers.map(header => <option key={header}>{header}</option>)}</select>
        {prepared.error && <p className="csv-error" role="alert">{prepared.error}</p>}
        {data && query && <><label htmlFor="csv-query">Prediction row</label><select id="csv-query" value={queryIndex} onChange={event => { const next = Number(event.target.value); setQueryIndex(next); setSize(data.rows.filter(row => isLabeled(row) && row.id !== data.rows[next].id).length); setEdits({}) }}>{data.rows.map((row, index) => <option key={row.id} value={index}>Row {row.id}{row.label === null ? ' · predict' : ' · hold out'}</option>)}</select>
          <label htmlFor="csv-size">Context size <strong>{size} rows</strong></label><input id="csv-size" type="range" min="1" max={originalContext.length} value={size} onChange={event => setSize(Number(event.target.value))}/>
          <p className="fineprint">Only rows with known target values form the context. The selected row is held out.</p>
          {ignored.length > 0 && <p className="fineprint">Skipped nonnumeric or empty columns: {ignored.join(', ')}.</p>}
        </>}
      </div>
      {data && query && <><div className="csv-outcome panel"><span className="eyebrow">3. CHANGE THE CONTEXT</span><h2>{data.kind === 'binary' ? 'Simulated label 1 probability' : `Simulated ${target} value`}</h2><strong className="csv-probability" aria-live="polite">{formatValue(explanation.prediction, data.kind)}</strong>{data.kind === 'binary' && <div className="probability-track"><span style={{ width: `${(explanation.prediction ?? 0) * 100}%` }}/></div>}<p>Original full context: <strong>{formatValue(baseline, data.kind)}</strong> · Change: <strong>{formatChange(shift, data.kind)}</strong></p>{query.label !== null && <p>Held-out actual: <strong>{query.label}</strong>{explanation.prediction !== null && <> · {data.kind === 'binary' ? `Predicted class: ${explanation.prediction >= .5 ? 1 : 0}` : `Absolute error: ${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(Math.abs(explanation.prediction - query.label))}`}</>}</p>}
        <div className="csv-action-row">{data.kind === 'binary' ? <button onClick={flipTopLabel} disabled={!explanation.influences.some(row => row.share > 0)}>Flip top label</button> : <button onClick={increaseTopTarget} disabled={!explanation.influences.some(row => row.share > 0)}>Increase top target</button>}<button onClick={hideTopFeature} disabled={!explanation.influences.some(row => row.share > 0)}>Hide top row feature</button><button onClick={() => { setEdits({}); setSize(originalContext.length) }}>Reset changes</button></div><p className="fineprint">These actions change context rows only. The held-out query target is never used in the calculation.</p>
      </div>{unlabeled.length > 0 && <div className="csv-predictions panel"><span className="eyebrow">ROWS MARKED FOR PREDICTION</span><h2>Predicted cells</h2><p>These simulated predictions use the current labeled context. Your CSV file is not changed.</p><div className="table-wrap"><table><thead><tr><th scope="col">CSV row</th><th scope="col">Predicted {target}</th>{data.kind === 'binary' && <th scope="col">Label 1 probability</th>}</tr></thead><tbody>{unlabeled.map(row => { const value = explainCsv(context, row, scales).prediction; return <tr key={row.id}><th scope="row">{row.id}</th><td>{value === null ? '—' : data.kind === 'binary' ? value >= .5 ? '1' : '0' : formatValue(value, 'numeric')}</td>{data.kind === 'binary' && <td>{formatValue(value, 'binary')}</td>}</tr> })}</tbody></table></div></div>}<div className="csv-context panel"><div className="panel-heading"><div><span className="eyebrow">LABELED EXAMPLES</span><h2>Context rows</h2></div><span className="count-pill">{context.length} rows</span></div><div className="table-wrap"><table><thead><tr><th scope="col">Row</th>{data.features.map(feature => <th scope="col" key={feature}>{feature}</th>)}<th scope="col">{target}</th></tr></thead><tbody>{context.slice(0, 20).map(row => <tr key={row.id}><th scope="row">{row.id}</th>{row.values.map((value, index) => <td key={data.features[index]}><input type="number" aria-label={`${data.features[index]} for row ${row.id}`} value={value ?? ''} placeholder="—" onChange={event => changeRow(row.id, current => ({ ...current, values: current.values.map((cell, position) => position === index ? event.target.value === '' ? null : Number(event.target.value) : cell) }))}/></td>)}<td>{data.kind === 'binary' ? <select aria-label={`${target} target for row ${row.id}`} value={row.label} onChange={event => changeRow(row.id, current => ({ ...current, label: Number(event.target.value) }))}><option value="0">0</option><option value="1">1</option></select> : <input type="number" aria-label={`${target} target for row ${row.id}`} value={row.label} onChange={event => { if (event.target.value !== '') changeRow(row.id, current => ({ ...current, label: Number(event.target.value) })) }}/>}</td></tr>)}</tbody></table></div>{context.length > 20 && <p className="fineprint">Showing 20 editable rows. All {context.length} context rows contribute to the prediction.</p>}</div><div className="csv-influence panel"><h2>Which rows matter most?</h2><p>Shares are normalized similarity weights from this browser calculation. They are not TabPFN attention or causal attributions.</p><ol className="influence-list">{explanation.influences.slice(0, 5).map(row => <li key={row.id}><span className="influence-id">#{row.id}</span><span className="influence-bar"><i style={{ width: `${row.share * 100}%` }}/></span><strong>{Math.round(row.share * 100)}%</strong><span className="influence-label">{data.kind === 'binary' ? `label ${row.label}` : formatValue(row.label, 'numeric')}</span></li>)}</ol></div></>}
    </div>}
  </section>
}
