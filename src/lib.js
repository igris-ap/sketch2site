const readDataUrl = file => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(r.error)
  r.readAsDataURL(file)
})

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('Not a readable image'))
  img.src = src
})

// Sketches go to the LLM, so shrink them: 1600px is plenty to read
// handwriting, and a phone photo would otherwise be ~5MB of base64 per call.
export async function readSketch(file, maxSide = 1600) {
  const img = await loadImage(await readDataUrl(file))
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // transparent PNG -> white, not black, in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Assets are kept byte-for-byte (transparency, SVG, GIF all survive).
export async function readAsset(file) {
  const dataUrl = await readDataUrl(file)
  const img = await loadImage(dataUrl)
  return { name: safeName(file.name), dataUrl, width: img.naturalWidth, height: img.naturalHeight }
}

export const safeName = s => s.replace(/[^\w.-]+/g, '-')
export const slug = s => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'

export async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}
