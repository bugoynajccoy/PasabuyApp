import { useCallback, useEffect, useState } from 'react'
import useActor from '../../hooks/useActor.js'
import useLive from '../../hooks/useLive.js'
import { verificationService, REJECT_REASONS } from '../../services/index.js'
import { timeAgo } from '../../utils/format.js'

const STATUS = { pending: ['warning', 'Pending'], approved: ['success', 'Approved'], rejected: ['danger', 'Rejected'] }
const Pill = ({ s }) => { const [c, l] = STATUS[s] || ['secondary', s]; return <span className={`badge rounded-pill bg-${c} bg-opacity-25 text-${c}`}>{l}</span> }
const Row = ({ k, v }) => <div className="d-flex gap-2 py-1"><span className="text-secondary flex-shrink-0" style={{ width: '38%' }}>{k}</span><span className="text-break fw-bold">{v || '—'}</span></div>

// Photos open full-size on tap instead of in a new tab (data URLs are often blocked there).
function Photo({ src, label }) {
  const [big, setBig] = useState(false)
  return (
    <div className={big ? 'col-12' : 'col-6'}>
      <div className="small text-secondary mb-1">{label}</div>
      <button type="button" onClick={() => setBig(!big)} className="btn p-0 border rounded-3 overflow-hidden w-100" aria-label={`${big ? 'Shrink' : 'Enlarge'} ${label}`}>
        <img src={src} alt={label} className="w-100" style={{ objectFit: big ? 'contain' : 'cover', maxHeight: big ? '70vh' : 200 }} />
      </button>
    </div>
  )
}

function Review({ v, admin, onClose, onDecide }) {
  const [reason, setReason] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { const k = (e) => e.key === 'Escape' && !busy && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose, busy])
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); onDecide() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const pending = v.status === 'pending'
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-label="Review verification" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"><div className="modal-content">
          <div className="modal-header"><h5 className="modal-title">Review @{v.username} <Pill s={v.status} /></h5><button className="btn-close" aria-label="Close" onClick={onClose} disabled={busy} /></div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-5">
                <Row k="Account name" v={v.accountName} /><Row k="Name on ID" v={v.nameOnId} /><Row k="ID type" v={v.idType} /><Row k="Submitted" v={timeAgo(v.createdAt)} />
                {!pending && <><Row k="Decision" v={STATUS[v.status]?.[1]} />{v.reason && <Row k="Reason" v={v.reason} />}</>}
                {pending && <ul className="small text-secondary ps-3 mt-2 mb-0"><li>Name on the ID matches the account</li><li>Face in the selfie matches the ID photo</li><li>ID is not expired and every word is readable</li></ul>}
              </div>
              <div className="col-md-7">
                {pending && v.idImage && v.selfieImage
                  ? <div className="row g-2"><Photo src={v.idImage} label="ID (front)" /><Photo src={v.selfieImage} label="Selfie with ID" /></div>
                  : <div className="text-secondary small">The photos were erased when this request was decided.</div>}
              </div>
            </div>
            {pending && (
              <div className="mt-3">
                <label className="form-label mb-1" htmlFor="rv-reason">If you reject, tell the user what to fix</label>
                <div className="d-flex flex-wrap gap-1 mb-2">{REJECT_REASONS.map((r) => <button key={r} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReason(r)}>{r}</button>)}</div>
                <textarea id="rv-reason" className="form-control" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to reject)" />
              </div>
            )}
            {err && <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{err}</div>}
          </div>
          {pending && (
            <div className="modal-footer">
              <button className="btn btn-outline-danger" disabled={busy} onClick={() => run(() => verificationService.reject(v.id, admin, reason))}>Reject</button>
              <button className="btn btn-success fw-bold" disabled={busy} onClick={() => window.confirm(`Approve ${v.username} and give them the verified badge?`) && run(() => verificationService.approve(v.id, admin))}>Approve</button>
            </div>
          )}
        </div></div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}

export default function Verifications() {
  const admin = useActor(); const [rows, setRows] = useState(null); const [tab, setTab] = useState('pending'); const [open, setOpen] = useState(null); const [err, setErr] = useState('')
  const refresh = useCallback(async () => { if (!admin) return; try { setRows(await verificationService.getAll(admin)); setErr('') } catch (x) { setErr(x.message) } }, [admin])
  useEffect(() => { refresh() }, [refresh]); useLive(refresh)
  const list = (rows || []).filter((v) => (tab === 'pending' ? v.status === 'pending' : v.status !== 'pending'))
  const pendingN = (rows || []).filter((v) => v.status === 'pending').length
  const current = open && rows?.find((v) => v.id === open)
  return (
    <>
      <h4 className="fw-bold mb-3">ID Verifications</h4>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <ul className="nav nav-tabs mb-3">{[['pending', `Pending (${pendingN})`], ['reviewed', 'Reviewed']].map(([k, l]) => <li className="nav-item" key={k}><button className={`nav-link ${tab === k ? 'active fw-bold' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}</ul>
      {!rows ? <div className="text-secondary">Loading…</div> : !list.length ? <div className="text-center text-secondary py-4">{tab === 'pending' ? 'Nothing waiting for review.' : 'No reviewed requests yet.'}</div> : (
        <div className="d-flex flex-column gap-2">
          {list.map((v) => (
            <div className="card p-3" key={v.id}>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="min-w-0"><div className="fw-bold text-black text-truncate">@{v.username} <Pill s={v.status} /></div><div className="small text-secondary">{v.idType} · {v.status === 'pending' ? `submitted ${timeAgo(v.createdAt)}` : `decided ${timeAgo(v.reviewedAt)}`}</div>{v.reason && <div className="small text-danger text-break">{v.reason}</div>}</div>
                <button className={`btn btn-sm flex-shrink-0 ${v.status === 'pending' ? 'btn-dark' : 'btn-light'}`} onClick={() => setOpen(v.id)}>{v.status === 'pending' ? 'Review' : 'View'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {current && <Review v={current} admin={admin} onClose={() => setOpen(null)} onDecide={() => { setOpen(null); refresh() }} />}
    </>
  )
}
