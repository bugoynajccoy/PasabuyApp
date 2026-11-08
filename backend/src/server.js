import 'dotenv/config'; import http from 'http'; import { Server } from 'socket.io'; import cookie from 'cookie'
import { app } from './app.js'; import { userFromToken } from './middleware.js'; import { setIo } from './notify.js'
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) { console.error('Set a long JWT_SECRET in backend/.env'); process.exit(1) }
const server = http.createServer(app); const io = new Server(server, { cors: { origin: process.env.CLIENT_URL, credentials: true } })
io.use(async (socket, next) => { const u = await userFromToken(cookie.parse(socket.handshake.headers.cookie || '').token); if (!u || u.account_status === 'suspended') return next(new Error('unauthorized')); socket.data.user = u; next() })
io.on('connection', (socket) => socket.join(`user:${socket.data.user.id}`)) // each user only ever joins their own room
app.set('io', io); setIo(io)
import('./jobs.js').then(({ autoReleaseDue }) => setInterval(() => autoReleaseDue().catch((e) => console.error(e.message)), 5 * 60 * 1000))
server.listen(process.env.PORT || 4000, () => console.log(`API + Socket.IO on :${process.env.PORT || 4000}`))
