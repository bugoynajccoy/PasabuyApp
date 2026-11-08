// PROTOTYPE ONLY: plaintext passwords. A real backend must hash passwords and authorize on the server.
export const seedUsers = [
  { id: 1, name: 'Pasabuy Admin', username: 'admin', email: 'admin@pasabuy.com', password: 'Admin@123', role: 'admin', status: 'active', verified: true, phone: '' },
  { id: 2, name: 'Jake B.', username: 'jake.b', email: 'jake@example.com', password: 'User@123', role: 'user', status: 'active', verified: true, phone: '09171234567', type: 'Traveler', rating: 4.8 },
  { id: 3, name: 'Jerume A.', username: 'jerume.a', email: 'jerume@example.com', password: 'User@123', role: 'user', status: 'active', verified: false, phone: '09181234567', type: 'Requester', rating: 4.8 },
  { id: 4, name: 'Bugoyna Jccoy', username: 'bugoyna.jccoy', email: 'bugoyna@example.com', password: 'User@123', role: 'user', status: 'suspended', verified: false, phone: '09191234567', type: 'Traveler', rating: 4.1 },
]
export const seedPosts = [
  { id: 1, author: 'jake.b', kind: 'Traveler offer', title: 'Dimasalang to Mandaon', status: 'active', reported: false },
  { id: 2, author: 'jerume.a', kind: 'Requester post', title: 'Birthday cake, 8-inch', status: 'active', reported: true },
  { id: 3, author: 'bugoyna.jccoy', kind: 'Requester post', title: 'Seiko Watch from Mandaon', status: 'expired', reported: false },
]
export const seedTransactions = [
  { id: 'TX-1001', item: 'Seiko Watch from Mandaon', requester: 'bugoyna.jccoy', traveler: 'jake.b', status: 'pending', hold: 'Not held' },
  { id: 'TX-1002', item: 'Birthday cake, 8-inch', requester: 'jerume.a', traveler: 'jake.b', status: 'paid', hold: 'Held (simulated)' },
  { id: 'TX-1003', item: 'Groceries', requester: 'jerume.a', traveler: 'bugoyna.jccoy', status: 'completed', hold: 'Released (simulated)' },
  { id: 'TX-1004', item: 'Phone case', requester: 'jake.b', traveler: 'jerume.a', status: 'cancelled', hold: 'Refunded (simulated)' },
  { id: 'TX-1005', item: 'School supplies', requester: 'jake.b', traveler: 'jerume.a', status: 'disputed', hold: 'Held (simulated)' },
]
export const seedReports = [
  { id: 1, type: 'Post report', target: 'Birthday cake, 8-inch', reason: 'Wrong category', status: 'open' },
  { id: 2, type: 'User report', target: 'bugoyna.jccoy', reason: 'Suspicious activity', status: 'open' },
  { id: 3, type: 'Transaction dispute', target: 'TX-1005', reason: 'Item not as described', status: 'open' },
]
