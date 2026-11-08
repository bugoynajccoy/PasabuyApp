// User side of identity verification. Admin review lives in routes/admin.js (/api/admin/verifications).
// Photos are stored as data URLs only while the request is pending. PRODUCTION: move them to private object storage with
// short-lived signed URLs; never serve them from a public path and never log them.
import { Router } from 'express'; import crypto from 'crypto'
import { q, one, fail, h } from '../db.js'; import { requireAuth } from '../middleware.js'
export const ID_TYPES = ['PhilSys National ID', "Driver's License", 'Passport', 'UMID', 'Postal ID', 'PRC ID', "Voter's ID", 'Other government-issued ID']
const MAX_IMAGE = 700_000; const isImage = (s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length <= MAX_IMAGE
const r = Router(); r.use(requireAuth)

r.get('/me', h(async (req, res) => { // never returns photos
  const last = await one('SELECT id, id_type AS idType, status, reason, created_at AS createdAt FROM verification_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1', [req.user.id])
  const status = req.user.verified ? 'verified' : last?.status === 'pending' ? 'pending' : last?.status === 'rejected' ? 'rejected' : 'unverified'
  res.json({ status, request: last })
}))

r.post('/', h(async (req, res) => {
  const { idType, nameOnId = '', idImage, selfieImage, consent } = req.body || {}; const name = String(nameOnId).trim()
  if (req.user.role === 'admin') fail(403, 'Administrator accounts do not need verification.')
  if (req.user.verified) fail(409, 'Your account is already verified.')
  if (!ID_TYPES.includes(idType)) fail(400, 'Choose the type of ID you are submitting.')
  if (name.length < 2 || name.length > 100) fail(400, 'Enter your full name exactly as it appears on the ID.')
  if (!isImage(idImage)) fail(400, 'Upload a clear photo of the front of your ID.')
  if (!isImage(selfieImage)) fail(400, 'Upload a selfie of you holding the same ID.')
  if (consent !== true) fail(400, 'Please agree to the identity check to continue.')
  // One pending request per user, enforced atomically in the INSERT so two quick taps cannot create two.
  const done = await q(`INSERT INTO verification_requests (id,user_id,id_type,name_on_id,id_image,selfie_image)
    SELECT ?,?,?,?,?,? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM verification_requests WHERE user_id=? AND status='pending')`,
  [crypto.randomUUID(), req.user.id, idType, name, idImage, selfieImage, req.user.id])
  if (!done.affectedRows) fail(409, 'Your verification is already under review.')
  res.status(201).json({ status: 'pending' })
}))
export default r
