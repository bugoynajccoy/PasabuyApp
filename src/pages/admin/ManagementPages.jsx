import { useState } from 'react'
import AdminTable from '../../components/AdminTable.jsx'
import { load, save, logAction } from '../../data/store.js'
import { seedUsers, seedPosts, seedTransactions, seedReports } from '../../data/mockData.js'
import useActor from '../../hooks/useActor.js'
import { resolveActorId } from '../../services/actor.js'
import { adminService } from '../../services/index.js'

// Keeps a collection in state + localStorage and records each change in the activity log.
function useCollection(key, seed) {
  const [rows, setRows] = useState(() => load(key, seed))
  const change = (id, patch, logText) => { const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r)); setRows(next); save(key, next); logAction(logText) }
  const remove = (id, logText) => { const next = rows.filter((r) => r.id !== id); setRows(next); save(key, next); logAction(logText) }
  return [rows, change, remove]
}

export function UserManagement() {
  const [rows, change] = useCollection('pb_users', seedUsers); const admin = useActor()
  const ok = (m) => window.confirm(m)
  const shown = rows.filter((r) => r.role === 'user').map((r) => ({ ...r, verificationStatus: r.verified ? 'verified' : r.verificationStatus || 'unverified' }))
  // Manual badge changes go through the service so the feed (pb2_users) and this table (pb_users) never disagree.
  const toggleBadge = async (u) => {
    if (!ok(`${u.verified ? 'Remove badge from' : 'Give the verified badge to'} ${u.username}? To verify by ID, use ID Verifications.`)) return
    try { await adminService.setVerified(resolveActorId({ username: u.username }), !u.verified, admin) } catch (e) { window.alert(e.message); return }
    change(u.id, { verified: !u.verified, verificationStatus: u.verified ? 'unverified' : 'verified' }, `${u.verified ? 'Removed badge from' : 'Gave badge to'} ${u.username}`)
  }
  return (
    <AdminTable title="User Management" rows={shown} searchKeys={['name', 'username']}
      columns={[['name', 'Name'], ['username', 'Username'], ['type', 'Role'], ['status', 'Status'], ['verificationStatus', 'Verification'], ['rating', 'Rating']]}
      filterKey="type" filterOptions={['Traveler', 'Requester']}
      actions={(u) => [
        { label: u.verified ? 'Remove badge' : 'Give badge', cls: 'outline-dark', onClick: () => toggleBadge(u) },
        { label: u.status === 'active' ? 'Suspend' : 'Reactivate', cls: u.status === 'active' ? 'danger' : 'success', onClick: () => ok(`${u.status === 'active' ? 'Suspend' : 'Reactivate'} ${u.username}?`) && change(u.id, { status: u.status === 'active' ? 'suspended' : 'active' }, `${u.status === 'active' ? 'Suspended' : 'Reactivated'} ${u.username}`) },
      ]} />
  )
}

export function PostManagement() {
  const [rows, , remove] = useCollection('pb_posts', seedPosts)
  return (
    <AdminTable title="Post Management" rows={rows} searchKeys={['title', 'author']} columns={[['title', 'Title'], ['kind', 'Type'], ['author', 'Author'], ['status', 'Status'], ['reported', 'Reported']]}
      filterKey="status" filterOptions={['active', 'expired']}
      actions={(p) => [{ label: 'Remove', cls: 'danger', onClick: () => window.confirm(`Remove "${p.title}"?`) && remove(p.id, `Removed post "${p.title}"`) }]} />
  )
}

export function TransactionManagement() {
  const [rows, change] = useCollection('pb_tx', seedTransactions)
  return (
    <AdminTable title="Transaction Management" rows={rows} searchKeys={['id', 'item', 'requester', 'traveler']} note="Payment holding and release are simulated. No real money is held. Cash on Delivery is not supported."
      columns={[['id', 'ID'], ['item', 'Item'], ['requester', 'Requester'], ['traveler', 'Traveler'], ['status', 'Status'], ['hold', 'Payment holding']]}
      filterKey="status" filterOptions={['pending', 'approved', 'paid', 'completed', 'cancelled', 'disputed']}
      actions={(t) => (t.status === 'disputed' ? [{ label: 'Resolve dispute', onClick: () => window.confirm(`Mark ${t.id} as completed?`) && change(t.id, { status: 'completed', hold: 'Released (simulated)' }, `Resolved dispute ${t.id}`) }] : [])} />
  )
}

export function Reports() {
  const [rows, change] = useCollection('pb_reports', seedReports)
  return (
    <AdminTable title="Reports and Disputes" rows={rows} searchKeys={['type', 'target', 'reason']} columns={[['type', 'Type'], ['target', 'Target'], ['reason', 'Reason'], ['status', 'Status']]}
      filterKey="status" filterOptions={['open', 'resolved', 'dismissed']}
      actions={(r) => (r.status === 'open' ? [
        { label: 'Resolve', onClick: () => change(r.id, { status: 'resolved' }, `Resolved report on ${r.target}`) },
        { label: 'Dismiss', cls: 'outline-dark', onClick: () => change(r.id, { status: 'dismissed' }, `Dismissed report on ${r.target}`) },
      ] : [])} />
  )
}

export function ActivityLogs() {
  const [rows] = useCollection('pb_logs', [])
  return <AdminTable title="Activity Logs" rows={rows} searchKeys={['text', 'actor']} columns={[['time', 'Time'], ['actor', 'Actor'], ['text', 'Action']]} />
}
