import { useMemo, useState, type ChangeEvent } from 'react'
import { explainCsv, featureScales, isLabeled, isPredictionCell, parseCsv, prepareDataset, type CsvTable, type LabeledRow } from '../simulation/csv'
import { composeContext, evaluateContext, splitValidation, type ContextSettings, type ShiftKind } from '../simulation/contextComposer'

const formatValue = (value: number | null, kind: 'binary' | 'numeric') => value === null ? '—' : kind === 'binary' ? `${Math.round(value * 100)}%` : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
const formatChange = (value: number | null, kind: 'binary' | 'numeric') => value === null ? '—' : kind === 'binary' ? `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pp` : `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)}`
const sampleUrl = `${import.meta.env.BASE_URL}samples/contextshift-shifts-sample.csv`
const shiftNames: { value: ShiftKind; label: string }[] = [
  { value: 'none', label: 'Clean context' }, { value: 'missing', label: 'Missing features' },
  { value: 'labels', label: 'Target corruption' }, { value: 'noise', label: 'Feature noise' },
  { value: 'outliers', label: 'Outliers' }, { value: 'relevance', label: 'Group relevance' },
  { value: 'imbalance', label: 'Class balance' }, { value: 'drift', label: 'Recent-data share' },
]
const shiftHelp: Record<ShiftKind, string> = {
  none: 'Use the original labeled rows.',
  missing: 'Blank this share of available numeric feature cells in selected context rows.',
  labels: 'Change this share of context targets: flip 0/1 labels or perturb numeric targets.',
  noise: 'Add numeric feature noise scaled by each feature range and this level.',
  outliers: 'Give this share of context rows one extreme numeric feature value.',
  relevance: 'Select this share of rows from the query row’s group when enough are available.',
  imbalance: 'Select this share of positive-label rows when enough are available.',
  drift: 'Select this share of rows with the chosen recent value when enough are available.',
}
type SavedContext = { kind: ShiftKind; level: number; size: number; groupColumn: string; periodColumn: string; recentValue: string; score: number }

export function CsvExperiment() {
  const [table, setTable] = useState<CsvTable | null>(null)
  const [fileName, setFileName] = useState('')
  const [target, setTarget] = useState('')
  const [queryIndex, setQueryIndex] = useState(0)
  const [size, setSize] = useState(0)
  const [edits, setEdits] = useState<Record<number, LabeledRow>>({})
  const [fileError, setFileError] = useState('')
  const [shiftKind, setShiftKind] = useState<ShiftKind>('none')
  const [level, setLevel] = useState(20)
  const [groupColumn, setGroupColumn] = useState('')
  const [periodColumn, setPeriodColumn] = useState('')
  const [recentValue, setRecentValue] = useState('')
  const [savedContexts, setSavedContexts] = useState<SavedContext[]>([])

  const prepared = useMemo(() => {
    if (!table) return { data: null, error: '' }
    try { return { data: prepareDataset(table, target), error: '' } }
    catch (error) { return { data: null, error: (error as Error).message } }
  }, [table, target])
  const data = prepared.data
  const query = data?.rows[queryIndex]
  const split = useMemo(() => splitValidation(data?.rows ?? []), [data])
  const training = split.training
  const editedTraining = useMemo(() => training.map(row => edits[row.id] ?? row), [training, edits])
  const predictionPool = useMemo(() => editedTraining.filter(row => row.id !== query?.id), [editedTraining, query])
  const scales = useMemo(() => featureScales(training, data?.features.length ?? 0), [training, data])
  const groupValues = useMemo(() => {
    if (!table || !groupColumn) return undefined
    const index = table.headers.indexOf(groupColumn)
    return index < 0 ? undefined : Object.fromEntries(table.rows.map((row, i) => [i + 1, row[index]]))
  }, [table, groupColumn])
  const periodValues = useMemo(() => {
    if (!table || !periodColumn) return undefined
    const index = table.headers.indexOf(periodColumn)
    return index < 0 ? undefined : Object.fromEntries(table.rows.map((row, i) => [i + 1, row[index]]))
  }, [table, periodColumn])
  const periodOptions = periodColumn && table ? [...new Set(table.rows.map(row => row[table.headers.indexOf(periodColumn)]))].filter(Boolean) : []
  const selectedRecentValue = recentValue || periodOptions.find(value => /recent|new|current|^b$/i.test(value)) || periodOptions.at(-1) || ''
  const effectiveSize = Math.min(size, predictionPool.length)
  const settings: ContextSettings = { kind: shiftKind, level, size: Math.min(size, training.length), seed: 7, groupValues, periodValues, recentValue: selectedRecentValue, targetKind: data?.kind ?? 'binary', featureScales: scales }
  const context = query ? composeContext(predictionPool, query, settings) : []
  const referenceSettings: ContextSettings = { ...settings, kind: 'none', level: 0 }
  const baseline = query ? explainCsv(composeContext(training.filter(row => row.id !== query.id), query, referenceSettings), query, scales).prediction : null
  const explanation = query ? explainCsv(context, query, scales) : { prediction: null, influences: [] }
  const shift = baseline !== null && explanation.prediction !== null ? explanation.prediction - baseline : null
  const ignored = table && data ? table.headers.filter(name => name !== target && !data.features.includes(name)) : []
  const unlabeled = data?.rows.filter(row => row.label === null) ?? []
  const score = data ? evaluateContext(editedTraining, split.validation, settings) : null
  const referenceScore = data ? evaluateContext(training, split.validation, referenceSettings) : null
  const improved = score !== null && referenceScore !== null && (data?.kind === 'binary' ? score > referenceScore : score < referenceScore)
  const bestSavedScore = savedContexts.length ? (data?.kind === 'binary' ? Math.max(...savedContexts.map(item => item.score)) : Math.min(...savedContexts.map(item => item.score))) : null
  const actualShare = context.length ? shiftKind === 'imbalance' ? context.filter(row => row.label === 1).length / context.length : shiftKind === 'relevance' ? context.filter(row => groupValues?.[row.id] === groupValues?.[query?.id ?? -1]).length / context.length : shiftKind === 'drift' ? context.filter(row => periodValues?.[row.id] === selectedRecentValue).length / context.length : null : null

  function selectTarget(selected: string, parsed: CsvTable) {
    const column = parsed.headers.indexOf(selected)
    const firstBlank = parsed.rows.findIndex(row => isPredictionCell(row[column]))
    const selectedQuery = firstBlank >= 0 ? firstBlank : 0
    const known = parsed.rows.map((row, index) => ({ row, index })).filter(item => !isPredictionCell(item.row[column]) && Number.isFinite(Number(item.row[column])))
    const trainingCount = known.filter((item, position) => position % 5 !== 0 && item.index !== selectedQuery).length
    setTarget(selected)
    setQueryIndex(selectedQuery)
    setSize(Math.min(8, Math.max(1, trainingCount)))
    setEdits({})
    setSavedContexts([])
    setShiftKind('none')
    setGroupColumn(current => current === selected ? '' : current)
    setPeriodColumn(current => current === selected ? '' : current)
  }

  function load(text: string, name: string) {
    try {
      const parsed = parseCsv(text)
      setTable(parsed)
      setFileName(name)
      setGroupColumn(parsed.headers.find(header => /population|segment|group/i.test(header)) ?? '')
      setPeriodColumn(parsed.headers.find(header => /period|time|date/i.test(header)) ?? '')
      setRecentValue('')
      setLevel(20)
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
      load(await response.text(), 'contextshift-shifts-sample.csv')
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

  function saveContext() {
    if (score === null || Object.keys(edits).length) return
    const item: SavedContext = { kind: shiftKind, level, size: settings.size, groupColumn, periodColumn, recentValue: selectedRecentValue, score }
    setSavedContexts(current => [...current.filter(saved => !(saved.kind === item.kind && saved.level === item.level && saved.size === item.size && saved.groupColumn === item.groupColumn && saved.periodColumn === item.periodColumn && saved.recentValue === item.recentValue)), item].slice(-8))
  }

  function applyContext(item: SavedContext) {
    setShiftKind(item.kind)
    setLevel(item.level)
    setSize(item.size)
    setGroupColumn(item.groupColumn)
    setPeriodColumn(item.periodColumn)
    setRecentValue(item.recentValue)
    setEdits({})
  }

  return <section className="page-content csv-page" aria-labelledby="csv-title">
    <div className="page-heading"><div><span className="eyebrow">YOUR DATA / BROWSER SIMULATION</span><h1 id="csv-title">Experiment with your CSV</h1><p>Choose any numeric target column. Mark cells [PREDICT] or leave them blank, then change the known context to see how predictions respond.</p></div></div>
    <div className="notice notice-teal"><span><strong>Your file stays in this browser tab.</strong> This page does not upload it to a server. It uses a similarity-weighted teaching rule, not live TabPFN or RPT inference or the measured model results.</span></div>
    <div className="csv-upload panel">
      <div><h2>1. Choose a dataset</h2><p>Use a header row, 4–500 data rows, at most 50 feature columns, numeric features, and a numeric target column. Use 0/1 for classification or other numbers for regression. Put [PREDICT] or leave a blank in target cells you want predicted.</p></div>
      <div className="csv-upload-actions"><label htmlFor="csv-file" className="sr-only">Choose CSV file</label><input id="csv-file" type="file" accept=".csv,text/csv" onChange={upload}/><button type="button" onClick={loadSample}>Load sample</button><a href={sampleUrl} download>Download sample CSV</a></div>
      {fileError && <p className="csv-error" role="alert">{fileError}</p>}
      {table && <p className="csv-loaded" role="status">Loaded {fileName}: {table.rows.length} rows, {table.headers.length} columns.</p>}
    </div>
    {table && <div className="csv-lab">
      <div className="csv-controls panel"><h2>2. Set up the experiment</h2><label htmlFor="csv-target">Target column</label><select id="csv-target" value={target} onChange={event => selectTarget(event.target.value, table)}>{table.headers.map(header => <option key={header}>{header}</option>)}</select>
        {prepared.error && <p className="csv-error" role="alert">{prepared.error}</p>}
        {data && query && <><label htmlFor="csv-query">Prediction row</label><select id="csv-query" value={queryIndex} onChange={event => setQueryIndex(Number(event.target.value))}>{data.rows.map((row, index) => <option key={row.id} value={index}>Row {row.id}{row.label === null ? ' · predict' : ' · hold out'}</option>)}</select>
          <p className="fineprint">{predictionPool.length} known rows are available for this prediction; {split.validation.length} known rows are held out for validation.</p>
          <label htmlFor="csv-size">Context size <strong>{effectiveSize} rows</strong></label><input id="csv-size" type="range" min={predictionPool.length ? 1 : 0} max={predictionPool.length} value={effectiveSize} disabled={!predictionPool.length} onChange={event => setSize(Number(event.target.value))}/>
          <label htmlFor="csv-shift">Context shift</label><select id="csv-shift" value={shiftKind} onChange={event => { const next = event.target.value as ShiftKind; setShiftKind(next); setLevel(['relevance', 'imbalance', 'drift'].includes(next) ? 50 : 20); setEdits({}) }}>{shiftNames.filter(item => item.value !== 'imbalance' || data.kind === 'binary').map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          {shiftKind === 'relevance' && <><label htmlFor="csv-group">Group column</label><select id="csv-group" value={groupColumn} onChange={event => setGroupColumn(event.target.value)}><option value="">Choose a column</option>{table.headers.filter(header => header !== target).map(header => <option key={header}>{header}</option>)}</select><p className="fineprint">The level is the requested share from the selected query row's group. {groupColumn ? '' : 'Choose a group column to apply this shift.'}</p></>}
          {shiftKind === 'drift' && <><label htmlFor="csv-period">Period column</label><select id="csv-period" value={periodColumn} onChange={event => { setPeriodColumn(event.target.value); setRecentValue('') }}><option value="">Choose a column</option>{table.headers.filter(header => header !== target).map(header => <option key={header}>{header}</option>)}</select>{periodColumn && <><label htmlFor="csv-recent">Recent value</label><select id="csv-recent" value={selectedRecentValue} onChange={event => setRecentValue(event.target.value)}>{periodOptions.map(value => <option key={value}>{value}</option>)}</select></>}<p className="fineprint">The level is the requested share of rows with the chosen recent value. {periodColumn ? '' : 'Choose a period column to apply this shift.'}</p></>}
          {shiftKind !== 'none' && <><label htmlFor="csv-level">Intervention level <strong>{level}%</strong></label><input id="csv-level" type="range" min="0" max="100" step="10" value={level} onChange={event => setLevel(Number(event.target.value))}/><p className="fineprint">{shiftHelp[shiftKind]}</p></>}
          {ignored.length > 0 && <p className="fineprint">Not used as numeric features: {ignored.join(', ')}. Group and period columns can still guide context selection.</p>}
        </>}
      </div>
      {data && query && <><div className="csv-outcome panel"><span className="eyebrow">3. COMPARE CONTEXTS</span><h2>{data.kind === 'binary' ? 'Simulated label 1 probability' : `Simulated ${target} value`}</h2><strong className="csv-probability" aria-live="polite">{formatValue(explanation.prediction, data.kind)}</strong>{data.kind === 'binary' && <div className="probability-track"><span style={{ width: `${(explanation.prediction ?? 0) * 100}%` }}/></div>}<p>Clean context at this size: <strong>{formatValue(baseline, data.kind)}</strong> · Change: <strong>{formatChange(shift, data.kind)}</strong></p><div className="csv-validation" role="status"><span>{data.kind === 'binary' ? 'Validation accuracy · higher is better' : 'Validation mean absolute error · lower is better'}</span><strong>{formatValue(score, data.kind)}</strong><small>Clean context at this size: {formatValue(referenceScore, data.kind)} · {score === null || referenceScore === null ? 'score unavailable' : score === referenceScore ? 'same as reference' : improved ? 'better on held-out rows' : 'worse on held-out rows'}</small></div>{actualShare !== null && <p>Actual selected share: <strong>{Math.round(actualShare * 100)}%</strong> of {shiftKind === 'imbalance' ? 'positive labels' : shiftKind === 'relevance' ? 'query-matching group rows' : 'recent rows'}.</p>}{query.label !== null && <p>Held-out actual: <strong>{query.label}</strong>{explanation.prediction !== null && <> · {data.kind === 'binary' ? `Predicted class: ${explanation.prediction >= .5 ? 1 : 0}` : `Absolute error: ${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(Math.abs(explanation.prediction - query.label))}`}</>}</p>}
        <div className="csv-action-row">{data.kind === 'binary' ? <button onClick={flipTopLabel} disabled={shiftKind !== 'none' || !explanation.influences.some(row => row.share > 0)}>Flip top label</button> : <button onClick={increaseTopTarget} disabled={shiftKind !== 'none' || !explanation.influences.some(row => row.share > 0)}>Increase top target</button>}<button onClick={hideTopFeature} disabled={shiftKind !== 'none' || !explanation.influences.some(row => row.share > 0)}>Hide top row feature</button><button onClick={() => { setEdits({}); setShiftKind('none'); setLevel(20); setSize(Math.min(8, training.length)) }}>Reset changes</button></div><p className="fineprint">Use one shift at a time. Manual row edits and quick actions are available in Clean context. The held-out query target is never used in prediction.</p>
      </div><div className="csv-comparison panel"><span className="eyebrow">FIND A BETTER CONTEXT</span><h2>Compare settings</h2><p>Save up to eight settings and compare their scores on the same {split.validation.length} held-out rows. A higher accuracy or lower error is better for this browser simulation. Small validation sets can give unstable rankings.</p><button type="button" onClick={saveContext} disabled={score === null || Object.keys(edits).length > 0}>Save current setting</button>{Object.keys(edits).length > 0 && <p className="fineprint">Reset manual row edits before saving a setting.</p>}{savedContexts.length > 0 && <div className="table-wrap"><table><thead><tr><th scope="col">Setting</th><th scope="col">Rows</th><th scope="col">Level</th><th scope="col">{data.kind === 'binary' ? 'Accuracy' : 'MAE'}</th><th scope="col">Action</th></tr></thead><tbody>{savedContexts.map((item, index) => <tr key={`${item.kind}-${item.level}-${item.size}-${item.groupColumn}-${item.periodColumn}-${item.recentValue}`}><th scope="row">{shiftNames.find(shiftItem => shiftItem.value === item.kind)?.label}{item.score === bestSavedScore && <span className="csv-best">Best saved</span>}</th><td>{item.size}</td><td>{item.kind === 'none' ? '—' : `${item.level}%`}</td><td>{formatValue(item.score, data.kind)}</td><td><button type="button" onClick={() => applyContext(item)} aria-label={`Apply saved setting ${index + 1}`}>Apply</button></td></tr>)}</tbody></table></div>}</div>{unlabeled.length > 0 && <div className="csv-predictions panel"><span className="eyebrow">ROWS MARKED FOR PREDICTION</span><h2>Predicted cells</h2><p>These simulated predictions use the current labeled context. Your CSV file is not changed.</p><div className="table-wrap"><table><thead><tr><th scope="col">CSV row</th><th scope="col">Predicted {target}</th>{data.kind === 'binary' && <th scope="col">Label 1 probability</th>}</tr></thead><tbody>{unlabeled.map(row => { const value = explainCsv(composeContext(editedTraining, row, settings), row, scales).prediction; return <tr key={row.id}><th scope="row">{row.id}</th><td>{value === null ? '—' : data.kind === 'binary' ? value >= .5 ? '1' : '0' : formatValue(value, 'numeric')}</td>{data.kind === 'binary' && <td>{formatValue(value, 'binary')}</td>}</tr> })}</tbody></table></div></div>}<div className="csv-context panel"><div className="panel-heading"><div><span className="eyebrow">LABELED EXAMPLES</span><h2>Context rows</h2></div><span className="count-pill">{context.length} rows</span></div><div className="table-wrap"><table><thead><tr><th scope="col">Row</th>{data.features.map(feature => <th scope="col" key={feature}>{feature}</th>)}<th scope="col">{target}</th></tr></thead><tbody>{context.slice(0, 20).map(row => <tr key={row.id}><th scope="row">{row.id}</th>{row.values.map((value, index) => <td key={data.features[index]}><input type="number" disabled={shiftKind !== 'none'} aria-label={`${data.features[index]} for row ${row.id}`} value={value ?? ''} placeholder="—" onChange={event => changeRow(row.id, current => ({ ...current, values: current.values.map((cell, position) => position === index ? event.target.value === '' ? null : Number(event.target.value) : cell) }))}/></td>)}<td>{data.kind === 'binary' ? <select disabled={shiftKind !== 'none'} aria-label={`${target} target for row ${row.id}`} value={row.label} onChange={event => changeRow(row.id, current => ({ ...current, label: Number(event.target.value) }))}><option value="0">0</option><option value="1">1</option></select> : <input type="number" disabled={shiftKind !== 'none'} aria-label={`${target} target for row ${row.id}`} value={row.label} onChange={event => { if (event.target.value !== '') changeRow(row.id, current => ({ ...current, label: Number(event.target.value) })) }}/>}</td></tr>)}</tbody></table></div>{context.length > 20 && <p className="fineprint">Showing 20 editable rows. All {context.length} context rows contribute to the prediction.</p>}</div><div className="csv-influence panel"><h2>Which rows matter most?</h2><p>Shares are normalized similarity weights from this browser calculation. They are not pretrained-model attention or causal attributions.</p><ol className="influence-list">{explanation.influences.slice(0, 5).map(row => <li key={row.id}><span className="influence-id">#{row.id}</span><span className="influence-bar"><i style={{ width: `${row.share * 100}%` }}/></span><strong>{Math.round(row.share * 100)}%</strong><span className="influence-label">{data.kind === 'binary' ? `label ${row.label}` : formatValue(row.label, 'numeric')}</span></li>)}</ol></div></>}
    </div>}
  </section>
}
