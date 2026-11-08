// Payment hold process (simulated): pay -> held -> deliver -> confirm/auto-release, dispute -> admin release/refund.
// Run: node tools/payment.test.mjs
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
globalThis.sessionStorage = globalThis.localStorage
const { transactionService: T, paymentService: P, notificationService: N, adminService: AD, messageService: M } = await import('../src/services/index.js')
const { resolveActorId } = await import('../src/services/actor.js')
let pass = 0, bad = 0
const ok = (n, c) => { c ? pass++ : (bad++, console.log('FAIL', n)) }
const rejects = async (n, fn, code) => { try { await fn(); ok(n + ' (should throw)', false) } catch (e) { ok(n, !code || e.code === code) } }
const A = resolveActorId({ username: 'jake.b' }), B = resolveActorId({ username: 'bugoyna.jccoy' }), C = resolveActorId({ username: 'jerume.a' }), ADM = resolveActorId({ username: 'admin' })
const when = new Date(Date.now() + 864e5).toISOString().slice(0, 16)
const form = { otherId: B, item: 'Cake', quantity: 1, price: 900, pickup: 'Goldilocks', deliver: 'Dimasalang', when }
// A is the requester (no post: the sender is the traveler, so B sends to A to make A the requester)
const mk = async () => { const t = await T.createFromForm(B, { ...form, otherId: A }); await T.act(t.id, A, 'approve'); return t }

let t = await mk(); const R = t.requesterId, V = t.travelerId
ok('requester is A', R === A && V === B)
await rejects('pay needs a method', () => T.act(t.id, R, 'pay'))
await rejects('pay rejects unknown method', () => T.act(t.id, R, 'pay', { method: 'Cash on Delivery' }))
ok('failed pay leaves no payment and status unchanged', (await P.getByTransaction(t.id, R)) === null && (await T.getById(t.id, R)).transactionStatus === 'approved')
await rejects('traveler cannot pay', () => T.act(t.id, V, 'pay', { method: 'GCash' }), 'FORBIDDEN')
t = await T.act(t.id, R, 'pay', { method: 'GCash' })
let p = await P.getByTransaction(t.id, R)
ok('pay creates a held payment for the agreed amount', p.status === 'held' && p.amount === 900 && p.method === 'GCash' && /^PB-/.test(p.reference) && p.payerId === R && p.payeeId === V)
ok('transaction shows paymentStatus held', t.paymentStatus === 'held')
ok('traveler is notified of the held payment', (await N.getForUser(V)).some(n => n.relatedId === t.id && /held/.test(n.message)))
ok('traveler can see the payment', (await P.getByTransaction(t.id, V)).id === p.id)
await rejects('outsider cannot see the payment', () => P.getByTransaction(t.id, C), 'FORBIDDEN')
await rejects('cannot pay twice', () => T.act(t.id, R, 'pay', { method: 'Maya' }), 'INVALID_TRANSITION')
await rejects("can't block while payment is held", () => M.block(A, B), 'CONFLICT')
await rejects('requester cannot confirm before delivery', () => T.act(t.id, R, 'confirm'), 'INVALID_TRANSITION')
await T.act(t.id, V, 'ship'); await T.act(t.id, V, 'deliver')
p = await P.getByTransaction(t.id, R)
ok('delivered starts the auto-release clock (48h)', p.status === 'held' && Math.abs(Date.parse(p.autoReleaseAt) - (Date.now() + 48 * 36e5)) < 60000)
t = await T.act(t.id, R, 'confirm'); p = await P.getByTransaction(t.id, R)
ok('confirm releases the payment', p.status === 'released' && !!p.releasedAt && !p.autoReleaseAt && t.paymentStatus === 'released' && t.transactionStatus === 'completed')
ok('events recorded in order', p.events.map(e => e.type).join() === 'held,delivered,released')

// auto-release
let t2 = await mk(); await T.act(t2.id, R, 'pay', { method: 'Maya' }); await T.act(t2.id, V, 'ship'); await T.act(t2.id, V, 'deliver')
const rows = JSON.parse(store.pb2_payments); rows.find(x => x.transactionId === t2.id).autoReleaseAt = new Date(Date.now() - 1000).toISOString(); store.pb2_payments = JSON.stringify(rows)
await T.getForUser(R) // reading transactions sweeps overdue holds
ok('overdue hold releases itself and completes the transaction', (await P.getByTransaction(t2.id, R)).status === 'released' && (await T.getById(t2.id, R)).transactionStatus === 'completed')
ok('both people are told about the auto-release', (await N.getForUser(R)).some(n => /automatically/.test(n.message)) && (await N.getForUser(V)).some(n => /automatically/.test(n.message)))
const before = (await N.getForUser(R)).length; await T.getForUser(R); ok('auto-release does not run twice', (await N.getForUser(R)).length === before)

// dispute stops the clock; admin decides
let t3 = await mk(); await T.act(t3.id, R, 'pay', { method: 'Bank transfer' }); await T.act(t3.id, V, 'ship'); await T.act(t3.id, V, 'deliver')
await T.act(t3.id, R, 'dispute'); p = await P.getByTransaction(t3.id, R)
ok('dispute keeps the money held and stops auto-release', p.status === 'disputed' && !p.autoReleaseAt)
const rows2 = JSON.parse(store.pb2_payments); rows2.find(x => x.transactionId === t3.id).autoReleaseAt = new Date(Date.now() - 1000).toISOString(); store.pb2_payments = JSON.stringify(rows2); await T.getForUser(R)
ok('a disputed hold is never auto-released', (await P.getByTransaction(t3.id, R)).status === 'disputed')
await rejects('only admin resolves', () => AD.resolveDispute(t3.id, 'refund', R), 'FORBIDDEN')
await AD.resolveDispute(t3.id, 'refund', ADM); p = await P.getByTransaction(t3.id, R)
ok('admin refund closes the hold as refunded', p.status === 'refunded' && !!p.refundedAt && (await T.getById(t3.id, R)).paymentStatus === 'refunded')
let t4 = await mk(); await T.act(t4.id, R, 'pay', { method: 'GCash' }); await T.act(t4.id, R, 'dispute'); await AD.resolveDispute(t4.id, 'release', ADM)
ok('admin release pays the traveler', (await P.getByTransaction(t4.id, V)).status === 'released')

// admin views
await rejects('payments list is admin only', () => P.getAll(R), 'FORBIDDEN')
const sum = await P.summary(ADM); ok('summary totals by status', sum.released === 2700 && sum.refunded === 900 && sum.held === 0 && sum.disputed === 0)
console.log(`${pass} passed, ${bad} failed`); process.exit(bad ? 1 : 0)
