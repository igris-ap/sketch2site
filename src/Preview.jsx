import { useMemo, useState } from 'react'
import { previewHtml } from './export.js'

export default function Preview({ result, assets, busy, onRefine, onUndo }) {
  const html = useMemo(() => previewHtml(result, assets), [result, assets])
  const [run, setRun] = useState(0) // bump to remount the iframe and replay animations
  const [instruction, setInstruction] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (await onRefine(instruction)) setInstruction('') // keep the text if it failed, so it can be retried
  }

  return (
    <div className="preview">
      <form className="refine" onSubmit={submit}>
        <textarea
          rows={2}
          placeholder="Describe a change, e.g. make the hero image bigger, use a dark theme, slide the cards in from the left"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }}
        />
        <button className="primary" disabled={busy || !instruction.trim()}>Refine</button>
        <button type="button" onClick={onUndo} disabled={busy || !onUndo}>Undo</button>
      </form>
      <div className="toolbar">
        <button onClick={() => setRun(run + 1)}>Replay</button>
        <span className="muted small">Needs internet: the preview loads React, motion and Babel from CDNs.</span>
      </div>
      {/* allow-scripts without allow-same-origin: generated code can't touch this app. */}
      <iframe key={run} title="Generated site" sandbox="allow-scripts" srcDoc={html} />
      <details><summary>src/App.jsx</summary><pre>{result.app}</pre></details>
      <details><summary>src/styles.css</summary><pre>{result.css}</pre></details>
    </div>
  )
}
