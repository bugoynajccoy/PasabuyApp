// Identity verification checks.  Run:  node tools/verification.test.mjs   (no install needed; uses a localStorage shim)
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
globalThis.sessionStorage = globalThis.localStorage
const S = await import('../src/services/index.js')
const { resolveActorId } = await import('../src/services/actor.js')
const { verificationService: V, adminService: AD, notificationService: N, transactionService: T } = S
let pass = 0, bad = 0
const ok = (n, c) => { c ? pass++ : (bad++, console.log('FAIL', n)) }
const rejects = async (n, fn, code) => { try { await fn(); ok(n + ' (should throw)', false) } catch (e) { ok(n, !code || e.code === code) } }
const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ'
const good = { idType: 'PhilSys National ID', nameOnId: 'Jerume Alcantara', idImage: img, selfieImage: img, consent: true }
const sess = u => ({ username: u })
const ADM = resolveActorId(sess('admin')), JER = resolveActorId(sess('jerume.a')), JAKE = resolveActorId(sess('jake.b'))
const legacy = u => JSON.parse(localStorage.getItem('pb_users')).find(x => x.username === u)
const mine = async id => (await V.getMine(id))

// seeds
ok('unverified seed user starts unverified', (await mine(JER)).status === 'unverified')
ok('already-verified seed user reads as verified', (await mine(JAKE)).status === 'verified')

// validation
await rejects('rejects unknown ID type', () => V.submit(JER, { ...good, idType: 'Library card' }))
await rejects('rejects missing name', () => V.submit(JER, { ...good, nameOnId: ' ' }))
await rejects('rejects missing ID photo', () => V.submit(JER, { ...good, idImage: '' }))
await rejects('rejects non-image data', () => V.submit(JER, { ...good, selfieImage: 'data:text/html;base64,PHNjcmlwdD4=' }))
await rejects('rejects oversized photo', () => V.submit(JER, { ...good, idImage: 'data:image/jpeg;base64,' + 'A'.repeat(800000) }))
await rejects('rejects missing consent', () => V.submit(JER, { ...good, consent: false }))
await rejects('verified user cannot resubmit', () => V.submit(JAKE, good), 'CONFLICT')
await rejects('admin cannot submit', () => V.submit(ADM, good), 'FORBIDDEN')
ok('failed submits saved nothing', (await V.getAll(ADM)).length === 0 && (await mine(JER)).status === 'unverified' && !localStorage.getItem('pb2_verifications')?.includes('base64'))

// submit
const sub = await V.submit(JER, good)
ok('submit creates a pending request', sub.status === 'pending' && sub.hasImages)
ok('user state is pending in both stores', (await mine(JER)).status === 'pending' && legacy('jerume.a').verificationStatus === 'pending')
ok('getMine never leaks photos', !JSON.stringify(await mine(JER)).includes('base64'))
await rejects('cannot submit twice while pending', () => V.submit(JER, good), 'CONFLICT')
ok('still not verified (no badge, cannot approve transactions yet)', (await S.userService.getById(JER)).verified === false)

// admin-only
await rejects('user cannot list requests', () => V.getAll(JAKE), 'FORBIDDEN')
await rejects('user cannot approve', () => V.approve(sub.id, JAKE), 'FORBIDDEN')
await rejects('user cannot reject', () => V.reject(sub.id, JAKE, 'nope'), 'FORBIDDEN')
const queue = await V.getAll(ADM)
ok('admin sees the pending request with photos', queue.length === 1 && queue[0].idImage === img && queue[0].selfieImage === img && queue[0].nameOnId === 'Jerume Alcantara')
ok('pending count', (await V.pendingCount(ADM)) === 1)

// reject path
await rejects('reject needs a reason', () => V.reject(sub.id, ADM, '  '))
const rej = await V.reject(sub.id, ADM, 'Photo is blurry or cut off')
ok('rejected request erased its photos', rej.status === 'rejected' && !rej.hasImages && !(await V.getAll(ADM))[0].idImage)
ok('user sees rejected + reason', (await mine(JER)).status === 'rejected' && (await mine(JER)).request.reason === 'Photo is blurry or cut off')
ok('legacy store says rejected, still unverified', legacy('jerume.a').verificationStatus === 'rejected' && !legacy('jerume.a').verified)
ok('user was notified with the reason', (await N.getForUser(JER)).some(n => n.type === 'verification' && n.message.includes('blurry')))
await rejects('cannot decide twice', () => V.approve(sub.id, ADM), 'INVALID_TRANSITION')

// resubmit + approve path
const sub2 = await V.submit(JER, good); ok('can submit again after rejection', sub2.status === 'pending' && sub2.id !== sub.id)
const appr = await V.approve(sub2.id, ADM)
ok('approve marks request approved and erases photos', appr.status === 'approved' && !appr.hasImages)
const u = await S.userService.getById(JER)
ok('badge granted in the service store', u.verified === true && (await mine(JER)).status === 'verified')
ok('badge granted in the login/admin store', legacy('jerume.a').verified === true && legacy('jerume.a').verificationStatus === 'verified')
ok('user notified of approval', (await N.getForUser(JER)).some(n => n.message.includes('verified')))
ok('actions written to the activity log', JSON.parse(localStorage.getItem('pb_logs')).some(l => l.text.includes('Approved identity verification for jerume.a')))
ok('queue is empty again', (await V.pendingCount(ADM)) === 0 && (await V.getAll(ADM)).every(v => !v.idImage && !v.selfieImage))
await rejects('verified user cannot submit again', () => V.submit(JER, good), 'CONFLICT')

// manual override keeps status consistent
await AD.setVerified(JER, false, ADM)
ok('removing the badge returns user to unverified in both stores', (await mine(JER)).status === 'unverified' && legacy('jerume.a').verificationStatus === 'unverified' && !legacy('jerume.a').verified)
await AD.setVerified(JER, true, ADM)
ok('manual badge sets verified in both stores', (await mine(JER)).status === 'verified' && legacy('jerume.a').verified === true)

// a brand-new account registered through the login layer can verify too
const pb = JSON.parse(localStorage.getItem('pb_users'))
pb.push({ id: Date.now(), name: 'Maria Santos', username: 'maria.s', email: 'maria@example.com', password: 'Passw0rd1', phone: '09170000000', role: 'user', status: 'active', verified: false, bio: '', createdAt: new Date().toISOString() })
localStorage.setItem('pb_users', JSON.stringify(pb))
const MA = resolveActorId(sess('maria.s'))
ok('new account starts unverified', (await mine(MA)).status === 'unverified')
const s3 = await V.submit(MA, { ...good, nameOnId: 'Maria Santos' }); await V.approve(s3.id, ADM)
ok('new account verified end to end', (await mine(MA)).status === 'verified' && legacy('maria.s').verified === true)

console.log(`${pass} passed, ${bad} failed`); process.exit(bad ? 1 : 0)
