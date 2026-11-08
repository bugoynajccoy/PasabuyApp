// Demo seed data (first run only). Passwords are plaintext for the prototype ONLY: a real backend must hash them.
const d = (days) => new Date(Date.now() + days * 864e5).toISOString()
const day = (days) => d(days).slice(0, 10)
export const seed = {
  users: [
    { id: 'u_admin', name: 'Pasabuy Admin', username: 'admin', email: 'admin@pasabuy.com', phone: '', password: 'Admin@123', role: 'admin', accountStatus: 'active', verified: true, bio: '', createdAt: d(-120) },
    { id: 'u_jake', name: 'Jake B.', username: 'jake.b', email: 'jake@example.com', phone: '09171234567', password: 'User@123', role: 'user', accountStatus: 'active', verified: true, bio: 'Requester in Dimasalang', createdAt: d(-90) },
    { id: 'u_jerume', name: 'Jerume A.', username: 'jerume.a', email: 'jerume@example.com', phone: '09181234567', password: 'User@123', role: 'user', accountStatus: 'active', verified: false, bio: 'Weekly sa City every Saturday', createdAt: d(-60) },
    { id: 'u_bugoyna', name: 'Bugoyna Jccoy', username: 'bugoyna.jccoy', email: 'bugoyna@example.com', phone: '09191234567', password: 'User@123', role: 'user', accountStatus: 'active', verified: true, bio: 'Verified Traveler & Requester', createdAt: d(-30) },
  ],
  posts: [],
  offers: [],
  transactions: [], payments: [], reactions: [], comments: [], messages: [], reviews: [], reports: [], verifications: [],
  notifications: [], logs: [],
}
