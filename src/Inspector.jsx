import { TYPES, ENTER, HOVER } from '../shared/options.js'

export default function Inspector({ region, pages, assets, onChange, onDelete }) {
  if (!region) {
    return <p className="muted">Click a box on the sketch to assign an asset and animations, or drag on the sketch to add a box.</p>
  }
  const asset = region.asset && assets.find(a => a.name === region.asset)
  const field = (key, value) => onChange({ [key]: value })

  return (
    <div className="inspector">
      <label>Type
        <select value={region.type} onChange={e => field('type', e.target.value)}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Label
        <input value={region.label} onChange={e => field('label', e.target.value)} />
      </label>
      <label>Text
        <textarea rows={3} value={region.text} onChange={e => field('text', e.target.value)} />
      </label>

      <label>Asset
        <select value={region.asset || ''} onChange={e => field('asset', e.target.value || null)}>
          <option value="">none</option>
          {assets.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>
      </label>
      {asset && <img className="inspector-asset" src={asset.dataUrl} alt={asset.name} />}
      {!assets.length && <p className="muted small">Upload assets on the left to assign them.</p>}

      <label>Links to page
        <select value={region.linksTo || ''} onChange={e => field('linksTo', e.target.value || null)}>
          <option value="">nothing</option>
          {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Scroll-in animation
        <select value={region.enter} onChange={e => field('enter', e.target.value)}>
          {Object.keys(ENTER).map(k => <option key={k}>{k}</option>)}
        </select>
      </label>
      <label>Hover animation
        <select value={region.hover} onChange={e => field('hover', e.target.value)}>
          {Object.keys(HOVER).map(k => <option key={k}>{k}</option>)}
        </select>
      </label>
      <button className="danger" onClick={onDelete}>Delete box</button>
    </div>
  )
}
