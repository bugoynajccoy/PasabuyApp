// Every control on the prototype's conversation page: send, transaction form (create/approve/decline/pay), mute, pin, report, block, delete.
// Run: node tools/conversation.test.mjs
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
globalThis.sessionStorage = globalThis.localStorage
const { messageService: M, transactionService: T, notificationService: N, reportService: RP, conversationId } = await import('../src/services/index.js')
const { resolveActorId } = await import('../src/services/actor.js')
let pass = 0, bad = 0
const ok = (n, c) => { c ? pass++ : (bad++, console.log('FAIL', n)) }
const rejects = async (n, fn, code) => { try { await fn(); ok(n + ' (should throw)', false) } catch (e) { ok(n, !code || e.code === code) } }
const A = resolveActorId({ username: 'jake.b' }), B = resolveActorId({ username: 'bugoyna.jccoy' }), C = resolveActorId({ username: 'jerume.a' }) // A,B verified; C not
const cid = conversationId(A, B)
const when = new Date(Date.now() + 864e5).toISOString().slice(0, 16)
const form = { otherId: B, item: 'Chocolate cake, 8 inch', quantity: 1, price: 900, pickup: 'Goldilocks, Masbate City', deliver: 'Dimasalang', when, notes: 'Write Happy Birthday' }

// plain chat
await M.send(A, B, 'Pwede ako makapasabay?'); await M.send(B, A, 'sige')
ok('both sides see the thread, in order', (await M.getThread(A, cid)).map(m => m.content).join('|') === 'Pwede ako makapasabay?|sige')

// transaction form (the "+" button)
await rejects('form needs item', () => T.createFromForm(A, { ...form, item: ' ' }))
await rejects('form needs quantity >= 1', () => T.createFromForm(A, { ...form, quantity: 0 }))
await rejects('form needs a price', () => T.createFromForm(A, { ...form, price: '' }))
await rejects('form needs pickup + deliver', () => T.createFromForm(A, { ...form, pickup: '' }))
await rejects('form date cannot be past', () => T.createFromForm(A, { ...form, when: '2020-01-01T10:00' }))
const tx = await T.createFromForm(A, form)
ok('form saved with notes, status awaiting approval', tx.transactionStatus === 'pending' && tx.notes === 'Write Happy Birthday' && tx.agreedPrice === 900)
ok('other person is notified of the form', (await N.getForUser(B)).some(n => n.type === 'transaction' && n.relatedId === tx.id))
await rejects('creator cannot approve own form', () => T.act(tx.id, A, 'approve'), 'FORBIDDEN')
await rejects('unverified user cannot approve ("Only verified users can approve")', async () => { const t2 = await T.createFromForm(A, { ...form, otherId: C }); await T.act(t2.id, C, 'approve') }, 'FORBIDDEN')
await T.act(tx.id, B, 'approve'); ok('verified counterparty approves', (await T.getById(tx.id, A)).transactionStatus === 'approved')
const tx2 = await T.createFromForm(B, { ...form, otherId: A, item: 'Soap' }); await T.act(tx2.id, A, 'cancel'); ok('Decline cancels the form', (await T.getById(tx2.id, A)).transactionStatus === 'cancelled')

// block is refused while a payment is held
const requester = tx.requesterId, traveler = tx.travelerId
await T.act(tx.id, requester, 'pay', { method: 'GCash' }); await rejects("can't block while payment is held", () => M.block(A, B), 'CONFLICT')
await T.act(tx.id, traveler, 'ship'); await T.act(tx.id, traveler, 'deliver'); await T.act(tx.id, requester, 'confirm')

// mute / pin
await M.setPref(B, cid, { muted: true }); const before = (await N.getForUser(B)).length; await M.send(A, B, 'quiet')
ok('mute stops notifications from this chat', (await N.getForUser(B)).length === before)
await M.setPref(B, cid, { muted: false }); await M.send(A, B, 'loud'); ok('unmute restores them', (await N.getForUser(B)).length === before + 1)
await new Promise(r => setTimeout(r, 5)) // timestamps are millisecond-precise; avoid a same-ms tie
await M.send(C, B, 'newer chat from someone else')
ok('newest chat is first', (await M.getConversations(B))[0].otherId === C)
await M.setPref(B, cid, { pinned: true }); ok('pinned chat moves to the top', (await M.getConversations(B))[0].id === cid)

// report (user)
await rejects('report needs a reason', () => RP.create(A, { targetId: B, targetType: 'user', reason: ' ' }))
const rep = await RP.create(A, { targetId: B, targetType: 'user', reason: 'Rude or harassing messages: test' }); ok('report recorded as open', rep.status === 'open' && rep.targetId === B)

// block / unblock
await M.block(A, B); await rejects('blocked user cannot message', () => M.send(B, A, 'hi'), 'FORBIDDEN'); await rejects('blocker cannot message either', () => M.send(A, B, 'hi'), 'FORBIDDEN')
ok('prefs report blockedByMe', (await M.getPrefs(A, cid)).blockedByMe === true && (await M.getPrefs(B, cid)).blockedByMe === false)
await M.unblock(A, B); await M.send(B, A, 'back'); ok('unblock restores messaging', (await M.getThread(A, cid)).at(-1).content === 'back')

// delete conversation: hides it for me only
await M.clear(A, cid)
ok('delete removes the chat from my list', !(await M.getConversations(A)).some(c => c.id === cid))
ok("...but not from the other person's", (await M.getConversations(B)).some(c => c.id === cid))
await new Promise(r => setTimeout(r, 5)); await M.send(B, A, 'hello again'); ok('new message brings the chat back, history stays hidden', (await M.getThread(A, cid)).map(m => m.content).join() === 'hello again')
ok('the transaction form survives deleting the chat ("stays in Activity")', (await T.getBetween(A, B)).some(t => t.id === tx.id))

console.log(`\nconversation tests: ${pass} passed, ${bad} failed`); process.exit(bad ? 1 : 0)
