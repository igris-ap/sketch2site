import express from 'express'
import { chat } from './llm.js'
import { TYPES, ENTER, HOVER, PAGE_TRANSITIONS } from '../shared/options.js'

const api = express()
api.use(express.json({ limit: '40mb' })) // sketches arrive as base64 data URLs

const route = fn => async (req, res) => {
  try { res.json(await fn(req.body)) } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

// ---------------------------------------------------------------------------
// 1. Detect: sketch image -> list of boxes
// ---------------------------------------------------------------------------

// Boxes use [ymin, xmin, ymax, xmax] on a 0-1000 grid. That is the format
// Gemini is trained to emit for detection, so it's markedly more accurate than
// asking for percentages; other vision models follow it fine too.
const detectPrompt = (page, pages) => `You are reading a hand-drawn wireframe of ONE page of a website.
This page is "${page.name}" (id "${page.id}"). The site's pages are: ${pages.map(p => `"${p.id}" (${p.name})`).join(', ')}.

Find every UI element in the drawing. Return JSON:
{"regions":[{"type":"...","label":"...","text":"...","box_2d":[ymin,xmin,ymax,xmax],"linksTo":null,"enter":"...","hover":"..."}]}

- box_2d: integers 0-1000, relative to the image height (y) and width (x). Be tight and precise: the boxes are drawn over the sketch.
- type: one of ${TYPES.join(', ')}.
- Include containers (header, section, card, footer) AND the elements inside them.
- A box with an X or a mountain/sun doodle in it, or labelled img/photo/logo, is an image.
- label: 1-3 word name, e.g. "hero image", "signup button".
- text: handwritten words inside the element, verbatim; "" if none.
- linksTo: for nav items, links and buttons whose text names one of the pages, that page's id; else null.
- enter (scroll-in animation): one of ${Object.keys(ENTER).join(', ')}.
- hover: one of ${Object.keys(HOVER).join(', ')}.
- If the drawing has animation notes (arrows, "fades in", "slides", "on hover..."), set enter/hover from them and do NOT list the notes as elements. Otherwise choose sensible defaults: header none; hero fade; cards slide-up + lift; sections with several cards stagger-children; buttons grow.
Return only the JSON.`

function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`Model did not return JSON: ${text.slice(0, 300)}`)
  return JSON.parse(text.slice(start, end + 1))
}

const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const pct = v => Math.min(100, Math.max(0, (Number(v) || 0) / 10))

function normalize(data, pageIds) {
  return (Array.isArray(data.regions) ? data.regions : [])
    .filter(r => Array.isArray(r?.box_2d) && r.box_2d.length === 4)
    .map((r, i) => {
      const [y0, x0, y1, x1] = r.box_2d.map(pct)
      const x = Math.min(x0, x1), y = Math.min(y0, y1)
      return {
        id: `r${i + 1}`,
        type: pick(r.type, TYPES, 'other'),
        label: String(r.label || r.type || '').slice(0, 40),
        text: String(r.text || ''),
        bbox: { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) },
        linksTo: pick(r.linksTo, pageIds, null),
        enter: pick(r.enter, Object.keys(ENTER), 'fade'),
        hover: pick(r.hover, Object.keys(HOVER), 'none'),
        asset: null,
      }
    })
    .filter(r => r.bbox.w > 0.5 && r.bbox.h > 0.5)
}

api.post('/detect', route(async ({ image, page, pages }) => {
  const out = await chat([{
    role: 'user',
    content: [
      { type: 'text', text: detectPrompt(page, pages) },
      { type: 'image_url', image_url: { url: image } },
    ],
  }], { json: true })
  return { regions: normalize(parseJson(out), pages.map(p => p.id)) }
}))

// ---------------------------------------------------------------------------
// 2. Generate: sketches + edited boxes -> App.jsx + styles.css
// ---------------------------------------------------------------------------

const list = obj => Object.entries(obj).map(([k, v]) => `  - ${k}: ${v}`).join('\n')

function generatePrompt({ pages, assets, transition, notes }) {
  const spec = pages.map(p => ({
    id: p.id,
    name: p.name,
    // Rounded: decimals add tokens and no layout signal.
    elements: p.regions.map(({ id, bbox, asset, ...r }) => ({
      ...r,
      box: { x: Math.round(bbox.x), y: Math.round(bbox.y), w: Math.round(bbox.w), h: Math.round(bbox.h) },
      ...(asset && { src: `/assets/${asset}` }),
    })),
  }))
  return `Build a website in React from hand-drawn wireframes. One sketch image per page follows this message.

SPEC (the user has reviewed this; it wins over your reading of the sketches):
${JSON.stringify(spec)}
- box = position as % of the sketch (x, y, width, height). Use it to work out order, nesting, rows and columns. Build a responsive flex/grid layout; never position elements absolutely from these numbers.
- text = use verbatim. Where an element has no text, write short, realistic copy that fits its label.
- src = the user's own drawn asset: use exactly this path in <img src> (or CSS url()). Keep its aspect ratio. Never replace it with anything else.
- image elements with no src: a tasteful CSS placeholder (gradient block), no external URLs.
- linksTo = clicking it navigates to that page.

ASSETS (filename: intrinsic width x height):
${assets.length ? assets.map(a => `  - ${a.name}: ${a.width}x${a.height}`).join('\n') : '  (none)'}

ANIMATION, using the motion library (import { motion, AnimatePresence, useReducedMotion } from "motion/react"):
- Page transition between pages: "${transition}" = ${PAGE_TRANSITIONS[transition] || PAGE_TRANSITIONS.fade}.
  Keep the current page id in useState (start at "${pages[0]?.id}"). Render pages inside <AnimatePresence mode="wait"> with a motion element keyed by page id, using initial/animate/exit. Scroll to top on page change. The header/nav can stay outside AnimatePresence.
- Each element's "enter" is its scroll-reveal: whileInView with viewport={{ once: true, amount: 0.2 }}, duration ~0.6s, ease "easeOut". Meanings:
${list(ENTER)}
- Each element's "hover" is whileHover with a spring transition. Meanings:
${list(HOVER)}
- Every button and link also gets whileTap={{ scale: 0.96 }}.
- If useReducedMotion() is true, skip transforms and use opacity only.

STYLE: ${notes?.trim() || 'Clean, modern, confident. Pick a cohesive palette and type scale that suit the content; generous whitespace; rounded corners; system font stack.'}
Use CSS custom properties for colours. Mobile-first and responsive. No external fonts, images, CDNs or npm packages beyond react and motion.

${OUTPUT_RULES}`
}

// Shared by generate and refine: the preview and zip depend on this exact shape.
const OUTPUT_RULES = `OUTPUT, exactly two fenced code blocks and nothing else:
1. \`\`\`jsx — the complete src/App.jsx. Only imports: "react" and "motion/react". It must contain \`export default function App()\`. Do not import CSS.
2. \`\`\`css — the complete src/styles.css.`

function codeBlock(text, langs) {
  const m = text.match(new RegExp('```(?:' + langs + ')[^\\n]*\\n([\\s\\S]*?)```', 'i'))
  return m?.[1].trim()
}

function parseCode(out) {
  const app = codeBlock(out, 'jsx|javascript|js|tsx'), css = codeBlock(out, 'css')
  if (!app || !css) throw new Error(`Model output was missing the jsx or css block. It began: ${out.slice(0, 300)}`)
  return { app, css }
}

api.post('/generate', route(async body => {
  const content = [{ type: 'text', text: generatePrompt(body) }]
  for (const p of body.pages) {
    content.push({ type: 'text', text: `Sketch of page "${p.id}":` }, { type: 'image_url', image_url: { url: p.sketch } })
  }
  return parseCode(await chat([{ role: 'user', content }]))
}))

// ---------------------------------------------------------------------------
// 3. Refine: current code + a plain-English request -> updated code
// ---------------------------------------------------------------------------

// No sketches here: the code is now the source of truth, and resending the
// images would cost tokens while tempting the model to "re-fix" the layout.
const refinePrompt = ({ app, css, instruction, assets }) => `You are editing a React website. Apply the user's change and keep everything else exactly as it is: layout, copy, colours, animations and asset paths you weren't asked to touch.

CHANGE REQUESTED: ${instruction.trim()}

Available assets (use as "/assets/<name>"): ${assets.length ? assets.map(a => `${a.name} (${a.width}x${a.height})`).join(', ') : 'none'}
Animations use the motion library ("motion/react"). No new npm packages, external fonts, images or CDNs.

CURRENT src/App.jsx:
\`\`\`jsx
${app}
\`\`\`

CURRENT src/styles.css:
\`\`\`css
${css}
\`\`\`

${OUTPUT_RULES}`

api.post('/refine', route(async body => {
  if (!body.instruction?.trim()) throw new Error('Describe the change you want.')
  return parseCode(await chat([{ role: 'user', content: refinePrompt(body) }]))
}))

export default api
