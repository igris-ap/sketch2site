import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import api from './server/api.js'

try { process.loadEnvFile() } catch { /* no .env: api reports what's missing */ }

export default defineConfig({
  plugins: [
    react(),
    // Run the API inside the Vite dev server so `npm run dev` is one process.
    { name: 'api', configureServer(server) { server.middlewares.use('/api', api) } },
  ],
})
