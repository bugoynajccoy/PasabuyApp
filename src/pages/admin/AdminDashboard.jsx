import { load } from '../../data/store.js'
import { seedUsers, seedPosts, seedTransactions } from '../../data/mockData.js'
import StatCard from '../../components/StatCard.jsx'
import BarChart from '../../components/BarChart.jsx'

export default function AdminDashboard() {
  const users = load('pb_users', seedUsers).filter((u) => u.role === 'user')
  const posts = load('pb_posts', seedPosts); const tx = load('pb_tx', seedTransactions)
  const n = (s) => tx.filter((t) => t.status === s).length
  return (
    <>
      <h4 className="fw-bold mb-3">Dashboard</h4>
      <div className="row g-3 mb-3">
        <StatCard label="Registered users" value={users.length} />
        <StatCard label="Travelers" value={users.filter((u) => u.type === 'Traveler').length} />
        <StatCard label="Requesters" value={users.filter((u) => u.type === 'Requester').length} />
        <StatCard label="Active posts" value={posts.filter((p) => p.status === 'active').length} />
        <StatCard label="Transactions" value={tx.length} />
        <StatCard label="Pending" value={n('pending')} />
        <StatCard label="Completed" value={n('completed')} />
        <StatCard label="Cancelled" value={n('cancelled')} />
      </div>
      <p className="small text-secondary">Charts below use sample data until a backend is connected.</p>
      <div className="row g-3">
        <div className="col-lg-6"><BarChart title="User registrations (sample)" data={[['Jul', 8], ['Aug', 14], ['Sep', 21], ['Oct', 27]]} /></div>
        <div className="col-lg-6"><BarChart title="Transactions by status" data={['pending', 'paid', 'completed', 'cancelled', 'disputed'].map((s) => [s, n(s)])} /></div>
        <div className="col-lg-6"><BarChart title="Marketplace activity (sample)" data={[['Traveler offers', 31], ['Requester posts', 44]]} /></div>
        <div className="col-lg-6"><BarChart title="Monthly platform usage (sample)" data={[['Jul', 120], ['Aug', 210], ['Sep', 340], ['Oct', 410]]} /></div>
      </div>
    </>
  )
}
