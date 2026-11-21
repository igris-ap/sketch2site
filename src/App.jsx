import { useEffect, useState } from 'react'
import Annotator from './Annotator.jsx'
import Inspector from './Inspector.jsx'
import Preview from './Preview.jsx'
import { readSketch, readAsset, slug, api } from './lib.js'
import { downloadZip } from './export.js'
import { loadProject, saveProject, clearProject } from './store.js'
import { PAGE_TRANSITIONS } from '../shared/options.js'

export default function App() {
  const [pages, setPages] = useState([])   // { id, name, sketch, regions }
  const [assets, setAssets] = useState([]) // { name, dataUrl, width, height }
  const [activeId, setActiveId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [transition, setTransition] = useState('fade')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { app, css }
  const [history, setHistory] = useState([]) // earlier results, for undo
  const [tab, setTab] = useState('design')
  const [loaded, setLoaded] = useState(false)

  // Restore the saved project once on startup.
  useEffect(() => {
    loadProject()
      .then(p => {
        if (!p) return
        setPages(p.pages); setAssets(p.assets); setActiveId(p.activeId)
        setTransition(p.transition); setNotes(p.notes)
        setResult(p.result); setHistory(p.history); setTab(p.result ? p.tab : 'design')
      })
      .catch(e => setError(`Could not restore your saved project: ${e.message}`))
      .finally(() => setLoaded(true))
  }, [])

  // Autosave. `loaded` gates it: otherwise the first render would save the
  // empty starting state over the saved project before loading finished.
  // Debounced because typing in a field changes state on every keystroke, and
  // each save rewrites every image.
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      saveProject({ pages, assets, activeId, transition, notes, result, history, tab })
        .catch(e => setError(`Autosave failed (browser storage may be full): ${e.message}`))
    }, 500)
    return () => clearTimeout(t)
  }, [loaded, pages, assets, activeId, transition, notes, result, history, tab])

  const newProject = async () => {
    if (!confirm('Start a new project? This deletes the saved sketches, assets and every version.')) return
    await clearProject().catch(() => {})
    setPages([]); setAssets([]); setActiveId(null); setSelectedId(null)
    setTransition('fade'); setNotes(''); setResult(null); setHistory([]); setTab('design'); setError('')
  }

  const active = pages.find(p => p.id === activeId)
  const selected = active?.regions?.find(r => r.id === selectedId)

  const task = async (label, fn) => {
    setBusy(label); setError('')
    try { await fn(); return true } catch (e) { setError(e.message); return false } finally { setBusy('') }
  }

  const addPages = files => task('Reading sketches…', async () => {
    const taken = new Set(pages.map(p => p.id))
    const added = []
    for (const file of files) {
      let id = slug(file.name), n = 2
      while (taken.has(id)) id = `${slug(file.name)}-${n++}`
      taken.add(id)
      added.push({ id, name: file.name.replace(/\.[^.]+$/, ''), sketch: await readSketch(file), regions: null })
    }
    setPages(ps => [...ps, ...added])
    if (added[0]) { setActiveId(added[0].id); setSelectedId(null) }
  })

  const addAssets = files => task('Reading assets…', async () => {
    const added = await Promise.all([...files].map(readAsset))
    const names = new Set(added.map(a => a.name))
    setAssets(as => [...as.filter(a => !names.has(a.name)), ...added]) // same name = replace
  })

  const updatePage = (id, patch) => setPages(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const setRegions = fn => updatePage(active.id, { regions: fn(active.regions || []) })

  const removePage = id => {
    setPages(ps => ps.filter(p => p.id !== id).map(p => ({
      ...p, regions: p.regions?.map(r => (r.linksTo === id ? { ...r, linksTo: null } : r)),
    })))
    if (id === activeId) { setActiveId(null); setSelectedId(null) }
  }
  const removeAsset = name => {
    setAssets(as => as.filter(a => a.name !== name))
    setPages(ps => ps.map(p => ({ ...p, regions: p.regions?.map(r => (r.asset === name ? { ...r, asset: null } : r)) })))
  }

  const detect = page => task(`Reading layout of "${page.name}"…`, async () => {
    const { regions } = await api('/api/detect', {
      image: page.sketch,
      page: { id: page.id, name: page.name },
      pages: pages.map(({ id, name }) => ({ id, name })),
    })
    updatePage(page.id, { regions })
    setSelectedId(null)
  })

  const addRegion = bbox => {
    const id = `u${Date.now()}`
    setRegions(rs => [...rs, { id, type: 'image', label: 'new box', text: '', bbox, linksTo: null, enter: 'fade', hover: 'none', asset: null }])
    setSelectedId(id)
  }

  const generate = () => task('Writing the site… (this can take a minute)', async () => {
    const res = await api('/api/generate', {
      pages: pages.map(({ id, name, sketch, regions }) => ({ id, name, sketch, regions: regions || [] })),
      assets: assets.map(({ name, width, height }) => ({ name, width, height })),
      transition,
      notes,
    })
    commit(res)
    setTab('preview')
  })

  // Every new version goes through here, so a regenerate is undoable too.
  const commit = next => {
    if (result) setHistory(h => [...h, result])
    setResult(next)
  }
  const undo = () => {
    setResult(history.at(-1))
    setHistory(h => h.slice(0, -1))
  }

  const refine = instruction => task('Applying your change…', async () => {
    commit(await api('/api/refine', {
      ...result,
      instruction,
      assets: assets.map(({ name, width, height }) => ({ name, width, height })),
    }))
  })

  return (
    <div className="app">
      <header className="topbar">
        <strong>sketch2site</strong>
        <nav className="tabs">
          <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>Design</button>
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')} disabled={!result}>Preview</button>
        </nav>
        <span className="status">{busy}</span>
        <button className="primary" onClick={generate} disabled={!pages.length || !!busy}>Generate site</button>
        <button onClick={() => downloadZip(result, assets)} disabled={!result}>Download zip</button>
        <button onClick={newProject} disabled={!!busy || !loaded}>New project</button>
      </header>
      {error && <div className="error" onClick={() => setError('')}>{error}</div>}

      {tab === 'preview' && result ? <Preview result={result} assets={assets} busy={!!busy} onRefine={refine} onUndo={history.length ? undo : null} /> : (
        <div className="design">
          <aside className="panel">
            <h3>Pages</h3>
            <p className="muted small">One sketch per page. The first page is the home page.</p>
            <input type="file" accept="image/*" multiple onChange={e => { addPages([...e.target.files]); e.target.value = '' }} />
            <ul className="pages">
              {pages.map(p => (
                <li key={p.id} className={p.id === activeId ? 'on' : ''} onClick={() => { setActiveId(p.id); setSelectedId(null) }}>
                  <img src={p.sketch} alt="" />
                  <input value={p.name} onChange={e => updatePage(p.id, { name: e.target.value })} onClick={e => e.stopPropagation()} />
                  <button className="x" title="Remove page" onClick={e => { e.stopPropagation(); removePage(p.id) }}>×</button>
                </li>
              ))}
            </ul>

            <h3>Assets</h3>
            <p className="muted small">Your handmade images, logos, icons.</p>
            <input type="file" accept="image/*" multiple onChange={e => { addAssets([...e.target.files]); e.target.value = '' }} />
            <div className="assets">
              {assets.map(a => (
                <figure key={a.name}>
                  <img src={a.dataUrl} alt={a.name} />
                  <figcaption>{a.name}</figcaption>
                  <button className="x" title="Remove asset" onClick={() => removeAsset(a.name)}>×</button>
                </figure>
              ))}
            </div>

            <h3>Site</h3>
            <label>Page transition
              <select value={transition} onChange={e => setTransition(e.target.value)}>
                {Object.keys(PAGE_TRANSITIONS).map(k => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label>Style notes (optional)
              <textarea rows={3} placeholder="e.g. warm earthy colours, playful, big serif headings" value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
          </aside>

          <main className="canvas">
            {active ? (
              <>
                <div className="toolbar">
                  <button className="primary" onClick={() => detect(active)} disabled={!!busy}>
                    {active.regions ? 'Re-detect layout' : 'Detect layout'}
                  </button>
                  <span className="muted small">
                    {active.regions ? `${active.regions.length} boxes. Click one to edit it; drag on the sketch to add one.` : 'Let the model find the boxes, or drag to draw them yourself.'}
                  </span>
                </div>
                <Annotator page={active} assets={assets} selectedId={selectedId} onSelect={setSelectedId} onAdd={addRegion} />
              </>
            ) : <p className="muted empty">Upload a sketch of your website layout to start.</p>}
          </main>

          <aside className="panel">
            <h3>Selected box</h3>
            <Inspector
              region={selected}
              pages={pages}
              assets={assets}
              onChange={patch => setRegions(rs => rs.map(r => (r.id === selectedId ? { ...r, ...patch } : r)))}
              onDelete={() => { setRegions(rs => rs.filter(r => r.id !== selectedId)); setSelectedId(null) }}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
