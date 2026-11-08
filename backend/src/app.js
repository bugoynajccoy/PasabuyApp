import express from 'express'; import cors from 'cors'; import cookieParser from 'cookie-parser'
import auth from './routes/auth.js'; import market from './routes/market.js'; import social from './routes/social.js'; import engage from './routes/engage.js'; import admin from './routes/admin.js'; import verification from './routes/verification.js'; import { errorHandler } from './middleware.js'
export const app = express()
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true })); app.use('/api/verification', express.json({ limit: '2mb' })) // ID + selfie photos need more room than the 1 MB default; body-parser skips already-parsed requests
app.use(express.json({ limit: '1mb' })); app.use(cookieParser())
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', auth); app.use('/api/verification', verification); app.use('/api/admin', admin); app.use('/api', market); app.use('/api', social); app.use('/api', engage)
app.use((_req, res) => res.status(404).json({ error: 'Not found.' })); app.use(errorHandler)
