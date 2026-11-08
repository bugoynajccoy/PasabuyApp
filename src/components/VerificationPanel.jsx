import { useCallback, useEffect, useRef, useState } from 'react'
import useLive from '../hooks/useLive.js'
import { verificationService, ID_TYPES } from '../services/index.js'
import { readImage, timeAgo } from '../utils/format.js'

const box = { border: '2px dashed rgba(128, 128, 128, 0.35)', minHeight: 120 }

// One photo slot: tap to choose (or take) a picture, shows a preview once chosen.
function PhotoField({ id, label, hint, value, onPick, capture }) {
  const ref = useRef(null)
  return (
    <div className="mb-3">
      <label className="form-label mb-1" htmlFor={id}>{label}</label>
      <input ref={ref} id={id} type="file" accept="image/*" capture={capture} hidden onChange={onPick} />
      <button type="button" onClick={() => ref.current?.click()} className="btn w-100 p-0 rounded-3 overflow-hidden d-flex align-items-center justify-content-center bg-light" style={box} aria-label={value ? `Change ${label}` : `Choose ${label}`}>
        {value ? <img src={value} alt={label} className="w-100" style={{ maxHeight: 180, objectFit: 'cover' }} /> : <span className="text-secondary small px-3 py-4">Tap to add a photo</span>}
      </button>
      <small className="text-secondary">{hint}</small>
    </div>
  )
}

function VerificationForm({ actor, accountName, onClose, onDone }) {
  const [f, setF] = useState({ idType: '', nameOnId: accountName || '', idImage: '', selfieImage: '', consent: false })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { const k = (e) => e.key === 'Escape' && !busy && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose, busy])
  const pick = (key) => async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try { setErr(''); setF((p) => ({ ...p, [key]: '' })); const img = await readImage(file, 1000); setF((p) => ({ ...p, [key]: img })) } catch (x) { setErr(x.message) }
  }
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await verificationService.submit(actor, f); onDone() } catch (x) { setErr(x.message || 'Could not send your request. Please try again.') } finally { setBusy(false) }
  }
  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(0,0,0,.45)' }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} role="dialog" aria-modal="true" aria-label="Verify your identity">
      <div className="bg-white rounded-top-4 rounded-bottom-md-4 w-100 d-flex flex-column" style={{ maxWidth: 520, maxHeight: '92vh' }}>
        <div className="d-flex justify-content-between align-items-center p-3 pb-2"><h5 className="m-0">Verify your identity</h5><button type="button" className="btn btn-close" aria-label="Close" onClick={onClose} disabled={busy} /></div>
        <form onSubmit={submit} noValidate className="p-3 pt-1 overflow-auto">
          <div className="alert alert-secondary py-2 small">An administrator checks your ID against your selfie. Your photos are seen only by Pasabuy admins and are <b>erased as soon as a decision is made</b>.</div>
          <div className="mb-2">
            <label className="form-label mb-1" htmlFor="vf-type">ID type</label>
            <select id="vf-type" className="form-select" value={f.idType} onChange={(e) => setF((p) => ({ ...p, idType: e.target.value }))}>
              <option value="">Choose an ID…</option>{ID_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="mb-3"><label className="form-label mb-1" htmlFor="vf-name">Full name on the ID</label><input id="vf-name" className="form-control" value={f.nameOnId} onChange={(e) => setF((p) => ({ ...p, nameOnId: e.target.value }))} maxLength={100} autoComplete="name" /></div>
          <PhotoField id="vf-id" label="Photo of the ID (front)" hint="Flat, well lit, all four corners visible and every word readable." value={f.idImage} onPick={pick('idImage')} />
          <PhotoField id="vf-selfie" label="Selfie holding the same ID" hint="Your face and the ID next to it, in the same photo." value={f.selfieImage} onPick={pick('selfieImage')} capture="user" />
          <div className="form-check mb-2">
            <input id="vf-consent" type="checkbox" className="form-check-input" checked={f.consent} onChange={(e) => setF((p) => ({ ...p, consent: e.target.checked }))} />
            <label className="form-check-label small" htmlFor="vf-consent">I agree that Pasabuy admins may review these photos to confirm who I am. They are my own ID and photo.</label>
          </div>
          {err && <div className="alert alert-danger py-2 my-2" role="alert">{err}</div>}
          <div className="d-flex gap-2 pt-2"><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-warning fw-bold flex-grow-1" disabled={busy}>{busy ? 'Sending…' : 'Submit for review'}</button></div>
        </form>
      </div>
    </div>
  )
}

// Shown on the user's OWN profile. Hidden once they are verified (the badge says it all).
export default function VerificationPanel({ actor, accountName, onChange }) {
  const [info, setInfo] = useState(null); const [open, setOpen] = useState(false); const prev = useRef(null)
  const refresh = useCallback(async () => {
    if (!actor) return
    try { const r = await verificationService.getMine(actor); setInfo(r); if (prev.current && prev.current !== r.status) onChange?.(); prev.current = r.status } catch { setInfo(null) }
  }, [actor, onChange])
  useEffect(() => { refresh() }, [refresh])
  useLive(refresh) // picks up the admin's decision without a reload
  if (!info || info.status === 'verified') return null
  const { status, request } = info
  return (
    <>
      <div className="bg-warning bg-opacity-10 p-3 mt-3 rounded-4" role="region" aria-label="Account verification">
        {status === 'pending' ? (
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div><small className="text-secondary fw-bold d-block">Verification</small><span className="text-dark-emphasis">We are checking your {request?.idType || 'ID'}. You will get a notification when it is done.</span>{request?.createdAt && <small className="d-block text-secondary">Submitted {timeAgo(request.createdAt)}</small>}</div>
            <span className="badge rounded-pill text-warning bg-warning bg-opacity-25 flex-shrink-0">Under review</span>
          </div>
        ) : (
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <small className="text-secondary fw-bold d-block">{status === 'rejected' ? 'Verification not approved' : 'Get verified'}</small>
              {status === 'rejected'
                ? <span className="text-danger">{request?.reason || 'Your ID could not be verified.'}</span>
                : <span className="text-dark-emphasis">Verified users get a badge and can approve transaction forms.</span>}
            </div>
            <button type="button" className="btn btn-warning fw-bold flex-shrink-0" onClick={() => setOpen(true)}>{status === 'rejected' ? 'Try again' : 'Verify'}</button>
          </div>
        )}
      </div>
      {open && <VerificationForm actor={actor} accountName={accountName} onClose={() => setOpen(false)} onDone={() => { setOpen(false); refresh() }} />}
    </>
  )
}
