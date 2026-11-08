// Interaction checks: can every user message, see posts, get notified and open each other's profile?
// Run:  node tools/interaction.test.mjs   (no install needed; uses a localStorage shim)
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
globalThis.sessionStorage = globalThis.localStorage
const S = await import('../src/services/index.js')
const { resolveActorId, syncActors } = await import('../src/services/actor.js')
const { postService: P, offerService: O, messageService: M, notificationService: N, userService: U, adminService: AD } = S
let pass = 0, bad = 0
const ok = (n, c) => { c ? pass++ : (bad++, console.log('FAIL', n)) }
const rejects = async (n, fn) => { try { await fn(); ok(n + ' (should throw)', false) } catch { ok(n, true) } }
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

// Seeded accounts log in the normal way.
const sess = u => ({ username: u })
const J = resolveActorId(sess('jake.b')), E = resolveActorId(sess('jerume.a')), ADM = resolveActorId(sess('admin'))
ok('seed users resolve to service ids', [J, E, ADM].every(Boolean))

// A person registers through AuthContext.register (writes pb_users only) and has NOT logged in yet.
const pb = JSON.parse(localStorage.getItem('pb_users'))
pb.push({ id: Date.now(), name: 'Maria Santos', username: 'maria.s', email: 'maria@example.com', password: 'Passw0rd1', phone: '09170000000', role: 'user', status: 'active', verified: false, avatar: 'data:image/jpeg;base64,AAAA', bio: '', createdAt: new Date().toISOString() })
localStorage.setItem('pb_users', JSON.stringify(pb))

// 1. Discoverable + profile viewable before first login
const found = await U.search(J, 'maria')
ok('never-logged-in user is found by search', found.length === 1 && found[0].username === 'maria.s')
ok('search exposes public fields only', !('password' in found[0]) && !('email' in found[0]) && !('phone' in found[0]))
const MA = found[0].id
const prof = await U.getById(MA)
ok('profile opens for anyone', prof.username === 'maria.s' && prof.name === 'Maria Santos' && !('password' in prof))
ok('profile picture + join date carried over', prof.avatar.startsWith('data:image') && !!prof.createdAt)
ok('resolveActorId matches the mirrored id (no duplicates)', resolveActorId(sess('maria.s')) === MA && (await U.getAll()).filter(u => u.username === 'maria.s').length === 1)
ok('sync is idempotent', syncActors() === 0)

// 2. Search directory rules
const everyone = await U.search(J, '')
ok('search excludes self', !everyone.some(u => u.id === J))
ok('search excludes admin', !everyone.some(u => u.id === ADM))
await AD.setSuspended(E, true, ADM); ok('search excludes suspended', !(await U.search(J, '')).some(u => u.id === E)); await AD.setSuspended(E, false, ADM)

// 3. Messaging + notifications reach the new user
await M.send(J, MA, 'Hi Maria!')
ok('recipient gets a message notification', (await N.getForUser(MA)).some(n => n.type === 'message' && n.link === `/messages/chat?with=${J}`))
ok('unread counts for badges', (await N.unreadCount(MA)) === 1 && (await M.unreadCount(MA)) === 1)
const convs = await M.getConversations(MA)
ok('conversation list shows sender', convs.length === 1 && convs[0].otherUsername === 'jake.b' && convs[0].unread === 1)
ok('thread opens + marks read', (await M.getThread(MA, convs[0].id)).length === 1 && (await M.unreadCount(MA)) === 0)
await M.send(MA, J, 'Hello Jake'); ok('reply reaches the other side', (await M.unreadCount(J)) === 1)
await rejects('cannot message yourself', () => M.send(J, J, 'x'))
await rejects('outsider cannot read the thread', () => M.getThread(E, convs[0].id))

// 4. Posts are visible to everyone with author info; offers notify the poster
const req = await P.create(J, { type: 'request', title: 'Birthday cake', origin: 'Masbate City', destination: 'Dimasalang', quantity: 1, budget: 900, neededDate: day(3) })
const feed = await P.getAll()
ok('new user sees other people\'s posts', feed.some(p => p.id === req.id && p.author.username === 'jake.b' && p.userId === J))
await O.create(MA, { postId: req.id, proposedPrice: 80, message: 'I can' })
ok('poster is notified of the offer', (await N.getForUser(J)).some(n => n.type === 'offer'))
const trip = await P.create(MA, { type: 'trip', origin: 'Dimasalang', destination: 'Masbate City', travelDate: day(2), serviceFee: 50, spaceLeft: 3 })
ok('new user\'s post is visible to others with profile target', (await P.getAll({ userId: MA })).length === 1 && (await P.getAll()).some(p => p.id === trip.id && p.author.id === MA))

// 5. Block still works both ways
await M.block(MA, J); await rejects('blocked pair cannot message', () => M.send(J, MA, 'hey')); await M.unblock(MA, J); await M.send(J, MA, 'back')
ok('unblock restores messaging', (await M.unreadCount(MA)) === 1)

console.log(`\ninteraction tests: ${pass} passed, ${bad} failed`); process.exit(bad ? 1 : 0)
