# sketch2site

Draw your website on paper, photograph it, add your handmade assets, and get a React site with animations.

1. **Upload** one sketch per page, plus your assets (logos, illustrations, photos).
2. **Detect layout**: a vision LLM finds every box on the sketch.
3. **Assign**: click a box to give it an asset, a link to another page, a scroll-in animation and a hover animation. Drag on the sketch to add boxes the model missed.
4. **Generate**: the LLM writes `App.jsx` + `styles.css` using [motion](https://motion.dev) for page transitions, scroll reveals, hover and tap.
5. **Refine** in plain English ("dark theme", "bigger hero") as many times as you like; **Undo** steps back.
6. **Preview** live, then **download** a ready-to-run Vite project.

## Run

```bash
cp .env.example .env   # add your API key
npm install
npm run dev            # http://localhost:5173
```

Production: `npm run build && npm start`.

Any OpenAI-compatible API with a vision model works: set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.

## How it works

- `server/api.js`: `/api/detect` (sketch → boxes as JSON) and `/api/generate` (sketches + your edited boxes → code). The API key stays on the server.
- `shared/options.js`: the animation vocabulary. Each name has a fixed definition that's quoted to the model, so "lift" means the same motion every time.
- `src/export.js`: the preview compiles the JSX in the browser with Babel and loads React and motion from esm.sh through an import map. The iframe is sandboxed. The zip puts assets in `public/assets/` so the `/assets/...` paths work unchanged.

## License

MIT, see [LICENSE](LICENSE).
