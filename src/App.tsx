import { useEffect, useState } from 'react'
import { Activity, BarChart3, BookOpen, FlaskConical, Menu, Moon, PanelTop, Sun, X } from 'lucide-react'
import { loadResults } from './data/results'
import type { ExperimentResult } from './types/experiment'
import { Playground } from './pages/Playground'
import { Experiments } from './pages/Experiments'
import { Comparison } from './pages/Comparison'
import { Learn } from './pages/Learn'
import { Methodology } from './pages/Methodology'

type Page = 'playground' | 'experiments' | 'comparison' | 'learn' | 'methodology'
const nav = [
  { id:'playground', label:'Playground', icon:PanelTop }, { id:'experiments', label:'Context experiments', icon:Activity },
  { id:'comparison', label:'Model comparison', icon:BarChart3 }, { id:'learn', label:'How it works', icon:BookOpen },
  { id:'methodology', label:'Methodology', icon:FlaskConical },
] as const
export default function App() {
  const [page,setPage] = useState<Page>('playground')
  const [dark,setDark] = useState(false)
  const [menu,setMenu] = useState(false)
  const [results,setResults] = useState<ExperimentResult[]>([])
  const [loadError,setLoadError] = useState(false)
  useEffect(()=>{loadResults().then(setResults).catch(()=>setLoadError(true))},[])
  useEffect(()=>{document.documentElement.dataset.theme = dark ? 'dark' : 'light'},[dark])
  const select = (id:Page) => {setPage(id);setMenu(false);window.scrollTo(0,0)}
  return <div className="app-shell"><aside className={`sidebar ${menu?'open':''}`}><div className="brand"><div className="brand-mark"><span/><span/><span/></div><div><strong>ContextShift</strong><small>THE TABULAR FOUNDATION MODEL LAB</small></div><button className="mobile-close" aria-label="Close menu" onClick={()=>setMenu(false)}><X size={19}/></button></div><div className="nav-caption">LAB WORKSPACE</div><nav aria-label="Main navigation">{nav.map(item=><button key={item.id} className={page===item.id?'active':''} onClick={()=>select(item.id)}><item.icon size={18}/><span>{item.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="sidebar-status"><span className="status-light"/><div><strong>{results.length ? `${results.length} measured runs` : 'Simulation ready'}</strong><small>{results.length ? 'Offline results loaded' : 'No real results exported'}</small></div></div><p>Same model. Different context.<br/>Different predictions.</p></div></aside><div className="main-shell"><header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={()=>setMenu(true)}><Menu size={21}/></button><div className="breadcrumb">LAB <span>/</span> {nav.find(n=>n.id===page)?.label.toUpperCase()}</div><div className="top-actions"><span className="synthetic-pill">● SYNTHETIC DATA</span><button className="theme-button" aria-label={dark?'Switch to light theme':'Switch to dark theme'} onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button></div></header>{loadError && <div className="load-error" role="alert">Experiment JSON is invalid or could not be loaded. Real results are unavailable.</div>}<main>{page==='playground'&&<Playground results={results}/>}{page==='experiments'&&<Experiments results={results}/>}{page==='comparison'&&<Comparison results={results}/>}{page==='learn'&&<Learn/>}{page==='methodology'&&<Methodology/>}</main><footer>ContextShift · Synthetic data for research education · <span>Pretrained weights are never changed in the browser.</span> · <a href="https://huggingface.co/Prior-Labs/TabPFN-v2-clf/blob/main/LICENSE.txt" target="_blank" rel="noreferrer">Built with PriorLabs-TabPFN</a></footer></div>{menu&&<button className="mobile-scrim" aria-label="Close menu" onClick={()=>setMenu(false)}/>}</div>
}
