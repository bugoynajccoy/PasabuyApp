// Likes and comments on posts. Run: node tools/engage.test.mjs
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
globalThis.sessionStorage = globalThis.localStorage
const { engageService: E, postService: PS, notificationService: N, messageService: M } = await import('../src/services/index.js')
const { resolveActorId } = await import('../src/services/actor.js')
let pass = 0, bad = 0
const ok = (n, c) => { c ? pass++ : (bad++, console.log('FAIL', n)) }
const rejects = async (n, fn, code) => { try { await fn(); ok(n + ' (should throw)', false) } catch (e) { ok(n, !code || e.code === code) } }
const A = resolveActorId({ username: 'jake.b' }), B = resolveActorId({ username: 'bugoyna.jccoy' }), C = resolveActorId({ username: 'jerume.a' })
const day = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
const post = await PS.create(A, { type: 'request', title: 'Cake', quantity: 1, budget: 900, origin: 'Masbate City', destination: 'Dimasalang', neededDate: day, description: 'Birthday cake' })

// likes
let s = (await E.getStats([post.id], B))[post.id]; ok('fresh post: 0 likes, 0 comments, not liked', s.likes === 0 && s.comments === 0 && !s.liked)
let r = await E.toggleLike(B, 'post', post.id); ok('like', r.liked && r.likes === 1)
await E.toggleLike(C, 'post', post.id); s = (await E.getStats([post.id], B))[post.id]; ok('count is shared, liked is per user', s.likes === 2 && s.liked)
ok('owner notified of a like', (await N.getForUser(A)).filter(n => n.type === 'like').length === 2)
r = await E.toggleLike(B, 'post', post.id); ok('unlike', !r.liked && r.likes === 1)
const nb = (await N.getForUser(A)).length; await E.toggleLike(B, 'post', post.id); await E.toggleLike(B, 'post', post.id)
ok('unlike sends no notification; re-like does', (await N.getForUser(A)).length === nb + 1)
const nSelf = (await N.getForUser(A)).length; await E.toggleLike(A, 'post', post.id); ok('liking your own post notifies nobody', (await N.getForUser(A)).length === nSelf)
await rejects('cannot react to a missing post', () => E.toggleLike(B, 'post', 'nope'), 'NOT_FOUND')

// comments + replies
await rejects('empty comment', () => E.addComment(B, post.id, '   '))
await rejects('too long', () => E.addComment(B, post.id, 'x'.repeat(501)))
const c1 = await E.addComment(B, post.id, 'Pwede ako magdala?'); ok('comment saved with author', c1.content === 'Pwede ako magdala?' && c1.author.username === 'bugoyna.jccoy')
ok('owner notified of the comment', (await N.getForUser(A)).some(n => n.type === 'comment' && /commented/.test(n.message)))
const r1 = await E.addComment(A, post.id, 'Sige!', c1.id); ok('reply attaches to the comment', r1.parentId === c1.id)
ok('commenter notified of the reply', (await N.getForUser(B)).some(n => /replied/.test(n.message)))
const r2 = await E.addComment(C, post.id, 'ako rin', r1.id); ok('reply to a reply stays one level deep', r2.parentId === c1.id)
await rejects('reply to a missing comment', () => E.addComment(C, post.id, 'x', 'c_nope'), 'NOT_FOUND')
let list = await E.getComments(post.id, B)
ok('thread shape: 1 top-level, 2 replies in order', list.length === 1 && list[0].replies.map(x => x.content).join('|') === 'Sige!|ako rin')
ok('feed count includes replies', (await E.getStats([post.id], B))[post.id].comments === 3)

// comment likes
r = await E.toggleLike(C, 'comment', c1.id); list = await E.getComments(post.id, C)
ok('like a comment; liked is per viewer', r.likes === 1 && list[0].likes === 1 && list[0].liked && !(await E.getComments(post.id, B))[0].liked)
ok('comment author notified of the like', (await N.getForUser(B)).some(n => /liked your comment/.test(n.message)))

// deleting
await rejects('a stranger cannot delete', () => E.deleteComment(C, c1.id), 'FORBIDDEN')
await E.deleteComment(C, r2.id); ok('author deletes own reply', (await E.getComments(post.id, B))[0].replies.length === 1)
await E.deleteComment(A, c1.id) // post owner moderates
list = await E.getComments(post.id, B); ok('post owner deletes a comment: replies and its likes go too', list.length === 0 && !JSON.parse(store.pb2_reactions).some(x => x.targetType === 'comment'))
ok('stats back to 0 comments', (await E.getStats([post.id], B))[post.id].comments === 0)

// blocks
await M.block(C, B); await rejects('blocked pair cannot comment on each other\'s posts', async () => { const p2 = await PS.create(B, { type: 'request', title: 'Soap', quantity: 1, budget: 50, origin: 'a', destination: 'b', neededDate: day }); await E.addComment(C, p2.id, 'hi') }, 'FORBIDDEN')
await PS.remove(post.id, A); await rejects('removed post has no comments', () => E.getComments(post.id, B), 'NOT_FOUND')
console.log(`${pass} passed, ${bad} failed`); process.exit(bad ? 1 : 0)
