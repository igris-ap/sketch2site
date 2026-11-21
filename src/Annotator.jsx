import { useRef, useState } from 'react'

const clamp = v => Math.min(100, Math.max(0, v))

// Sketch with the detected boxes on top. Click a box to select it; drag on
// empty paper to draw a box the model missed.
export default function Annotator({ page, assets, selectedId, onSelect, onAdd }) {
  const ref = useRef(null)
  const [draft, setDraft] = useState(null)

  const point = e => {
    const r = ref.current.getBoundingClientRect()
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) }
  }
  const draftBox = d => ({ x: Math.min(d.a.x, d.b.x), y: Math.min(d.a.y, d.b.y), w: Math.abs(d.a.x - d.b.x), h: Math.abs(d.a.y - d.b.y) })

  const down = e => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    setDraft({ a: p, b: p })
  }
  const move = e => draft && setDraft({ ...draft, b: point(e) })
  const up = () => {
    if (!draft) return
    const box = draftBox(draft)
    setDraft(null)
    if (box.w > 1.5 && box.h > 1.5) onAdd(box)
    else onSelect(null) // plain click on paper = deselect
  }

  // Biggest first, so small boxes nested inside containers sit on top and stay clickable.
  const regions = [...(page.regions || [])].sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h)

  return (
    <div className="annotator" ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <img src={page.sketch} alt={`Sketch of ${page.name}`} draggable={false} />
      {regions.map(r => {
        const asset = r.asset && assets.find(a => a.name === r.asset)
        return (
          <div
            key={r.id}
            className={`box type-${r.type}${r.id === selectedId ? ' selected' : ''}`}
            style={{ left: `${r.bbox.x}%`, top: `${r.bbox.y}%`, width: `${r.bbox.w}%`, height: `${r.bbox.h}%` }}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onSelect(r.id)}
            title={`${r.type}: ${r.label}`}
          >
            {asset && <img className="box-asset" src={asset.dataUrl} alt="" />}
            <span className="box-tag">{r.label || r.type}</span>
          </div>
        )
      })}
      {draft && (() => {
        const b = draftBox(draft)
        return <div className="box draft" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} />
      })()}
    </div>
  )
}
