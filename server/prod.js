import express from 'express'
import api from './api.js'

try { process.loadEnvFile() } catch { /* env may come from the host */ }

const app = express()
app.use('/api', api)
app.use(express.static('dist'))
const port = process.env.PORT || 3000
app.listen(port, () => console.log(`sketch2site on http://localhost:${port}`))
