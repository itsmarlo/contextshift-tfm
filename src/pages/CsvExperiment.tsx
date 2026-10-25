import { useMemo, useState, type ChangeEvent } from 'react'
import { explainCsv, featureScales, parseCsv, prepareDataset, type CsvTable, type NumericRow } from '../simulation/csv'

const percent = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`
const sampleUrl = `${import.meta.env.BASE_URL}samples/contextshift-sample.csv`

export function CsvExperiment() {
  const [table, setTable] = useState<CsvTable | null>(null)
  const [fileName, setFileName] = useState('')
  const [target, setTarget] = useState('')
  const [queryIndex, setQueryIndex] = useState(0)
  const [size, setSize] = useState(0)
  const [edits, setEdits] = useState<Record<number, NumericRow>>({})
  const [fileError, setFileError] = useState('')

  const prepared = useMemo(() => {
    if (!table) return { data: null, error: '' }
    try { return { data: prepareDataset(table, target), error: '' } }
    catch (error) { return { data: null, error: (error as Error).message } }
  }, [table, target])
  const data = prepared.data
  const query = data?.rows[queryIndex]
  const originalContext = useMemo(() => data?.rows.filter(row => row.id !== data.rows[queryIndex]?.id) ?? [], [data, queryIndex])
  const context = originalContext.map(row => edits[row.id] ?? row).slice(0, size)
  const scales = useMemo(() => featureScales(originalContext, data?.features.length ?? 0), [originalContext, data])
  const baseline = query ? explainCsv(originalContext, query, scales).probability : null
  const explanation = query ? explainCsv(context, query, scales) : { probability: null, influences: [] }
  const shift = baseline !== null && explanation.probability !== null ? Math.round((explanation.probability - baseline) * 100) : null
  const ignored = table && data ? table.headers.filter(name => name !== target && !data.features.includes(name)) : []

  function load(text: string, name: string) {
    try {
      const parsed = parseCsv(text)
      setTable(parsed)
      setFileName(name)
      setTarget(parsed.headers.find(header => /^(label|claim|target|y)$/i.test(header)) ?? parsed.headers.at(-1) ?? '')
      setQueryIndex(0)
      setSize(parsed.rows.length - 1)
      setEdits({})
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
      load(await response.text(), 'contextshift-sample.csv')
    } catch { setFileError('The sample CSV could not be loaded.') }
  }

  function changeRow(id: number, update: (row: NumericRow) => NumericRow) {
    const original = data?.rows.find(row => row.id === id)
    if (original) setEdits(current => ({ ...current, [id]: update(current[id] ?? original) }))
  }

  function flipTopLabel() {
    const top = explanation.influences.find(row => row.share > 0)
    if (top) changeRow(top.id, row => ({ ...row, label: row.label ? 0 : 1 }))
  }

  function hideTopFeature() {
    const top = explanation.influences.find(row => row.share > 0)
    const row = context.find(item => item.id === top?.id)
    const featureIndex = row?.values.findIndex(value => value !== null) ?? -1
    if (top && featureIndex >= 0) changeRow(top.id, current => ({ ...current, values: current.values.map((value, index) => index === featureIndex ? null : value) }))
  }

  return <section className="page-content csv-page" aria-labelledby="csv-title">
    <div className="page-heading"><div><span className="eyebrow">YOUR DATA / BROWSER SIMULATION</span><h1 id="csv-title">Experiment with your CSV</h1><p>Choose a labeled row as the hidden query, change its context, and see how the simulated prediction responds.</p></div></div>
    <div className="notice notice-teal"><span><strong>Your file stays in this browser tab.</strong> This page does not upload it to a server. It uses a similarity-weighted teaching rule, not live TabPFN inference or the measured model results.</span></div>
    <div className="csv-upload panel">
      <div><h2>1. Choose a dataset</h2><p>Use a header row, 4–500 data rows, at most 50 feature columns, numeric features, and a binary 0/1 label column. Blank numeric feature cells are allowed.</p></div>
      <div className="csv-upload-actions"><label htmlFor="csv-file" className="sr-only">Choose CSV file</label><input id="csv-file" type="file" accept=".csv,text/csv" onChange={upload}/><button type="button" onClick={loadSample}>Load sample</button><a href={sampleUrl} download>Download sample CSV</a></div>
      {fileError && <p className="csv-error" role="alert">{fileError}</p>}
      {table && <p className="csv-loaded" role="status">Loaded {fileName}: {table.rows.length} rows, {table.headers.length} columns.</p>}
    </div>
    {table && <div className="csv-lab">
      <div className="csv-controls panel"><h2>2. Set up the experiment</h2><label htmlFor="csv-target">Label column</label><select id="csv-target" value={target} onChange={event => { setTarget(event.target.value); setEdits({}) }}>{table.headers.map(header => <option key={header}>{header}</option>)}</select>
        {prepared.error && <p className="csv-error" role="alert">{prepared.error}</p>}
        {data && query && <><label htmlFor="csv-query">Query row (label hidden)</label><select id="csv-query" value={queryIndex} onChange={event => { setQueryIndex(Number(event.target.value)); setEdits({}) }}>{data.rows.map((row, index) => <option key={row.id} value={index}>Row {row.id}</option>)}</select>
          <label htmlFor="csv-size">Context size <strong>{size} rows</strong></label><input id="csv-size" type="range" min="1" max={data.rows.length - 1} value={size} onChange={event => setSize(Number(event.target.value))}/>
          <p className="fineprint">The query row is held out. The first {size} other rows form the context.</p>
          {ignored.length > 0 && <p className="fineprint">Skipped nonnumeric or empty columns: {ignored.join(', ')}.</p>}
        </>}
      </div>
      {data && query && <><div className="csv-outcome panel"><span className="eyebrow">3. CHANGE THE CONTEXT</span><h2>Simulated label 1 probability</h2><strong className="csv-probability" aria-live="polite">{percent(explanation.probability)}</strong><div className="probability-track"><span style={{ width: `${(explanation.probability ?? 0) * 100}%` }}/></div><p>Original full context: <strong>{percent(baseline)}</strong> · Change: <strong>{shift === null ? '—' : `${shift >= 0 ? '+' : ''}${shift} pp`}</strong></p>
        <div className="csv-action-row"><button onClick={flipTopLabel} disabled={!explanation.influences.some(row => row.share > 0)}>Flip top label</button><button onClick={hideTopFeature} disabled={!explanation.influences.some(row => row.share > 0)}>Hide top row feature</button><button onClick={() => { setEdits({}); setSize(data.rows.length - 1) }}>Reset changes</button></div><p className="fineprint">These actions change context rows only. The held-out query label is never used in the calculation.</p>
      </div><div className="csv-context panel"><div className="panel-heading"><div><span className="eyebrow">LABELED EXAMPLES</span><h2>Context rows</h2></div><span className="count-pill">{context.length} rows</span></div><div className="table-wrap"><table><thead><tr><th scope="col">Row</th>{data.features.map(feature => <th scope="col" key={feature}>{feature}</th>)}<th scope="col">{target}</th></tr></thead><tbody>{context.slice(0, 20).map(row => <tr key={row.id}><th scope="row">{row.id}</th>{row.values.map((value, index) => <td key={data.features[index]}><input type="number" aria-label={`${data.features[index]} for row ${row.id}`} value={value ?? ''} placeholder="—" onChange={event => changeRow(row.id, current => ({ ...current, values: current.values.map((cell, position) => position === index ? event.target.value === '' ? null : Number(event.target.value) : cell) }))}/></td>)}<td><select aria-label={`${target} label for row ${row.id}`} value={row.label} onChange={event => changeRow(row.id, current => ({ ...current, label: Number(event.target.value) as 0 | 1 }))}><option value="0">0</option><option value="1">1</option></select></td></tr>)}</tbody></table></div>{context.length > 20 && <p className="fineprint">Showing 20 editable rows. All {context.length} context rows contribute to the prediction.</p>}</div><div className="csv-influence panel"><h2>Which rows matter most?</h2><p>Shares are normalized similarity weights from this browser calculation. They are not TabPFN attention or causal attributions.</p><ol className="influence-list">{explanation.influences.slice(0, 5).map(row => <li key={row.id}><span className="influence-id">#{row.id}</span><span className="influence-bar"><i style={{ width: `${row.share * 100}%` }}/></span><strong>{Math.round(row.share * 100)}%</strong><span className="influence-label">label {row.label}</span></li>)}</ol></div></>}
    </div>}
  </section>
}
