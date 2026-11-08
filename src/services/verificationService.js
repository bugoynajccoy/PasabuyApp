// Identity verification: a user submits an ID photo + a selfie holding that ID, an administrator reviews it, and approval grants the badge.
//   status flow:  unverified -> pending -> verified | rejected -> (submit again) pending ...
// Photos are kept ONLY while a request is pending; they are erased the moment an admin decides (data minimisation).
// PROTOTYPE NOTE: in demo mode these photos live in localStorage (and the optional sync server). A real deployment must keep
// them in private, access-controlled storage, never in a shared or public store. See backend/src/routes/verification.js.
import { db, newId, now, fail, requireUser, requireActive, requireAdmin } from './db.js'
import { notificationService as notify } from './notificationService.js'
import { patchLegacyUser } from './actor.js'
import { logAction } from '../data/store.js'

export const ID_TYPES = ['PhilSys National ID', "Driver's License", 'Passport', 'UMID', 'Postal ID', 'PRC ID', "Voter's ID", 'Other government-issued ID']
export const REJECT_REASONS = ['Photo is blurry or cut off', 'Name on the ID does not match your account', 'The ID is expired', 'Selfie does not match the ID photo', 'ID type is not accepted']
const MAX_IMAGE = 700_000 // characters in the data URL (~500 KB)

export const statusOf = (u) => (u?.verified ? 'verified' : u?.verificationStatus || 'unverified')
const isImage = (s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length <= MAX_IMAGE
const stripImages = ({ idImage, selfieImage, ...v }) => ({ ...v, hasImages: Boolean(idImage || selfieImage) })
const log = (adminId, text) => { db.save('logs', [{ id: newId('l'), adminId, time: now(), text }, ...db.all('logs')]); try { logAction(text) } catch { /* UI log is best-effort */ } }

// Writes the account's verification state to both user stores.
function setUserState(userId, patch) {
  const all = db.all('users'); const u = all.find((x) => x.id === userId); if (!u) fail('User not found.', 'NOT_FOUND')
  Object.assign(u, patch); db.save('users', all); patchLegacyUser(u.username, patch); return u
}

export const verificationService = {
  idTypes: ID_TYPES,

  // The caller's own state. Never returns the photos.
  async getMine(userId) {
    const u = requireUser(userId)
    const latest = db.all('verifications').filter((v) => v.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return { status: statusOf(u), request: latest ? stripImages(latest) : null }
  },

  async submit(userId, f = {}) {
    const u = requireActive(userId)
    if (u.role === 'admin') fail('Administrator accounts do not need verification.', 'FORBIDDEN')
    if (statusOf(u) === 'verified') fail('Your account is already verified.', 'CONFLICT')
    if (statusOf(u) === 'pending' || db.all('verifications').some((v) => v.userId === userId && v.status === 'pending')) fail('Your verification is already under review.', 'CONFLICT')
    const nameOnId = String(f.nameOnId || '').trim()
    if (!ID_TYPES.includes(f.idType)) fail('Choose the type of ID you are submitting.')
    if (nameOnId.length < 2 || nameOnId.length > 100) fail('Enter your full name exactly as it appears on the ID.')
    if (!isImage(f.idImage)) fail('Upload a clear photo of the front of your ID (JPG, PNG or WebP, under 500 KB after resizing).')
    if (!isImage(f.selfieImage)) fail('Upload a selfie of you holding the same ID.')
    if (!f.consent) fail('Please agree to the identity check to continue.')
    const v = { id: newId('v'), userId, username: u.username, accountName: u.name, idType: f.idType, nameOnId, idImage: f.idImage, selfieImage: f.selfieImage,
      status: 'pending', reason: '', reviewedBy: null, reviewedAt: null, createdAt: now() }
    try { db.save('verifications', [v, ...db.all('verifications')]) } catch { fail('Could not save your request: this browser\'s storage is full. Free up space and try again.') }
    setUserState(userId, { verificationStatus: 'pending' })
    return stripImages(v)
  },

  // ---- admin ----
  async getAll(adminId) { // pending first (oldest first = the queue), then reviewed (newest first). Includes photos for pending requests.
    requireAdmin(adminId); const all = db.all('verifications')
    return [...all.filter((v) => v.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      ...all.filter((v) => v.status !== 'pending').sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))]
  },
  async pendingCount(adminId) { requireAdmin(adminId); return db.all('verifications').filter((v) => v.status === 'pending').length },

  async approve(id, adminId) {
    requireAdmin(adminId); const all = db.all('verifications'); const v = all.find((x) => x.id === id)
    if (!v) fail('Verification request not found.', 'NOT_FOUND'); if (v.status !== 'pending') fail('This request was already reviewed.', 'INVALID_TRANSITION')
    setUserState(v.userId, { verified: true, verificationStatus: 'verified', verifiedAt: now() }) // throws first if the account no longer exists
    Object.assign(v, { status: 'approved', reviewedBy: adminId, reviewedAt: now(), idImage: '', selfieImage: '' }); db.save('verifications', all)
    log(adminId, `Approved identity verification for ${v.username}`)
    await notify.create({ userId: v.userId, type: 'verification', message: 'Your identity was verified. Your account now has a verification badge.', relatedId: v.id, link: '/profile' })
    return stripImages(v)
  },

  async reject(id, adminId, reason) {
    requireAdmin(adminId); const why = String(reason || '').trim()
    if (why.length < 3) fail('Tell the user why, so they know what to fix.')
    if (why.length > 255) fail('Keep the reason under 255 characters.')
    const all = db.all('verifications'); const v = all.find((x) => x.id === id)
    if (!v) fail('Verification request not found.', 'NOT_FOUND'); if (v.status !== 'pending') fail('This request was already reviewed.', 'INVALID_TRANSITION')
    setUserState(v.userId, { verified: false, verificationStatus: 'rejected' })
    Object.assign(v, { status: 'rejected', reason: why, reviewedBy: adminId, reviewedAt: now(), idImage: '', selfieImage: '' }); db.save('verifications', all)
    log(adminId, `Rejected identity verification for ${v.username}: ${why}`)
    await notify.create({ userId: v.userId, type: 'verification', message: `We could not verify your ID: ${why}. You can submit it again from your profile.`, relatedId: v.id, link: '/profile' })
    return stripImages(v)
  },
}
