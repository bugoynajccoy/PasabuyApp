import { useCallback, useState } from 'react'
import AdminTable from '../../components/AdminTable.jsx'
import StatCard from '../../components/StatCard.jsx'
import useActor from '../../hooks/useActor.js'
import useLive from '../../hooks/useLive.js'
import { adminService, paymentService, transactionService } from '../../services/index.js'
import { peso } from '../../utils/format.js'

const STATUS = { held: 'Held', disputed: 'Disputed', released: 'Released', refunded: 'Refunded' }
const dt = (v) => (v ? new Date(v).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// Admin view of every payment hold. Release/refund is only offered for disputed holds (the rest move on their own).
export default function Payments() {
  const admin = useActor(); const [rows, setRows] = useState([]); const [sum, setSum] = useState({ held: 0, disputed: 0, released: 0, refunded: 0 }); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    if (!admin) return
    try {
      const [pays, txs, users] = await Promise.all([paymentService.getAll(admin), transactionService.getAll(), adminService.getAllUsers(admin)])
      const name = (id) => users.find((u) => u.id === id)?.username || id; const item = (id) => txs.find((t) => t.id === id)?.itemDetails || ''
      setRows(pays.map((p) => ({ id: p.id, reference: p.reference, transactionId: p.transactionId, item: item(p.transactionId), requester: name(p.payerId), traveler: name(p.payeeId), amount: peso(p.amount), method: p.method, status: STATUS[p.status], rawStatus: p.status, heldAt: dt(p.heldAt), autoRelease: p.status === 'held' ? dt(p.autoReleaseAt) : '' })))
      setSum(await paymentService.summary(admin))
    } catch (e) { setErr(e.message) }
  }, [admin])
  useState(() => { load() }); useLive(load)
  const resolve = async (r, outcome) => {
    if (!window.confirm(outcome === 'release' ? `Release ${r.amount} to ${r.traveler}? (simulated)` : `Refund ${r.amount} to ${r.requester}? (simulated)`)) return
    try { await adminService.resolveDispute(r.transactionId, outcome, admin); load() } catch (e) { window.alert(e.message) }
  }
  return (
    <>
      <div className="row g-3 mb-3">
        <StatCard label="Currently held" value={peso(sum.held)} /><StatCard label="In dispute" value={peso(sum.disputed)} />
        <StatCard label="Released" value={peso(sum.released)} /><StatCard label="Refunded" value={peso(sum.refunded)} />
      </div>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <AdminTable title="Payments" rows={rows} searchKeys={['reference', 'item', 'requester', 'traveler']} note="Payment holds are simulated. No real money is held or moved. Cash on Delivery is not supported."
        columns={[['reference', 'Ref'], ['item', 'Item'], ['requester', 'Requester'], ['traveler', 'Traveler'], ['amount', 'Amount'], ['method', 'Method'], ['status', 'Status'], ['autoRelease', 'Auto-release']]}
        filterKey="status" filterOptions={Object.values(STATUS)}
        actions={(r) => (r.rawStatus === 'disputed' ? [{ label: 'Release to traveler', onClick: () => resolve(r, 'release') }, { label: 'Refund requester', cls: 'outline-dark', onClick: () => resolve(r, 'refund') }] : [])} />
    </>
  )
}
