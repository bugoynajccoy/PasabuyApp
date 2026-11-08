import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { postService } from '../services/index.js'
import useActor from '../hooks/useActor.js'
import { readImage, notifyPostsChanged } from '../utils/format.js'

const ComposerContext = createContext({ openComposer: () => {} })
export const useComposer = () => useContext(ComposerContext)

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { title: '', description: '', origin: '', destination: '', budget: '', quantity: '1', neededDate: '', serviceFee: '', spaceLeft: '', travelDate: '', returnDate: '', image: '' }

function Field({ label, children }) { return <div className="mb-2"><label className="form-label mb-1">{label}</label>{children}</div> }

function Composer({ onClose }) {
  const actor = useActor()
  const [step, setStep] = useState('choose') // choose | request | trip | done
  const [f, setF] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const [posted, setPosted] = useState('request')
  const kind = step === 'trip' ? 'trip' : 'request'

  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const pickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try { setF((p) => ({ ...p, image: '' })); setError(''); const image = await readImage(file); setF((p) => ({ ...p, image })) } catch (err) { setError(err.message) }
  }
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      await postService.create(actor, { ...f, type: kind, title: kind === 'request' ? f.title : `${f.origin} to ${f.destination}` })
      notifyPostsChanged(); setPosted(kind); setStep('done')
    } catch (err) { setError(err.message || 'Could not post. Please try again.') } finally { setBusy(false) }
  }
  const choose = (t) => { setError(''); setF(EMPTY); setStep(t) }

  const photo = (
    <div className="d-flex align-items-center justify-content-center flex-column mb-2">
      <button type="button" onClick={() => fileRef.current?.click()} className="border-0 bg-secondary bg-opacity-10 rounded-4 d-flex justify-content-center align-items-center mb-1 overflow-hidden p-0" style={{ width: 100, height: 100 }}>
        {f.image ? <img src={f.image} alt="preview" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : <svg className="bi bi-lg align-middle text-secondary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-camera`} /></svg>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
      <small className="text-secondary">{f.image ? 'Tap to change photo' : 'Upload photo (optional)'}</small>
    </div>
  )

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(0,0,0,.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className="bg-white rounded-top-4 rounded-bottom-md-4 w-100 d-flex flex-column" style={{ maxWidth: 520, maxHeight: '92vh' }}>
        <div className="d-flex justify-content-between align-items-start p-3 pb-2">
          <div>
            {step === 'choose' && <><h4 className="m-0">What do you want to post?</h4><small className="text-secondary">Pick one.</small></>}
            {step === 'request' && <h5 className="m-0">Request an item</h5>}
            {step === 'trip' && <h5 className="m-0">Post a trip</h5>}
          </div>
          <button type="button" className="btn btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-3 pt-1 overflow-auto">
          {step === 'choose' && (<>
            <button type="button" onClick={() => choose('request')} className="card w-100 mb-3 text-start"><div className="d-flex p-3 gap-3">
              <div className="rounded-4 bg-primary bg-opacity-25 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}><svg className="bi bi-md align-middle text-primary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-bag`} /></svg></div>
              <div className="d-flex flex-column"><h6 className="m-0">Request an item</h6><small className="text-secondary">I need something bought and delivered</small></div></div></button>
            <button type="button" onClick={() => choose('trip')} className="card w-100 text-start"><div className="d-flex p-3 gap-3">
              <div className="rounded-4 bg-warning bg-opacity-25 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}><svg className="bi bi-md align-middle text-warning"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-geo-alt`} /></svg></div>
              <div className="d-flex flex-column"><h6 className="m-0">Post a trip</h6><small className="text-secondary">I'm going somewhere and can carry things</small></div></div></button>
          </>)}

          {(step === 'request' || step === 'trip') && (
            <form onSubmit={submit} noValidate>
              {photo}
              {step === 'request' && <Field label="Item"><input className="form-control" placeholder="e.g. Birthday cake, 8-inch" value={f.title} onChange={set('title')} maxLength={80} /></Field>}
              <Field label="Caption"><textarea className="form-control" rows={3} placeholder={step === 'request' ? 'Details, brand, size, store…' : 'What can you carry? Any rules?'} value={f.description} onChange={set('description')} maxLength={500} /></Field>
              <div className="d-flex gap-2">
                <div className="w-100"><Field label={step === 'request' ? 'Where to buy it?' : 'From'}><input className="form-control" value={f.origin} onChange={set('origin')} /></Field></div>
                <div className="w-100"><Field label={step === 'request' ? 'Deliver to' : 'To'}><input className="form-control" value={f.destination} onChange={set('destination')} /></Field></div>
              </div>
              {step === 'request' ? (
                <div className="d-flex gap-2">
                  <div className="w-100"><Field label="Budget (₱)"><input className="form-control" type="number" min="0" inputMode="decimal" value={f.budget} onChange={set('budget')} /></Field></div>
                  <div style={{ width: 90 }}><Field label="Qty"><input className="form-control" type="number" min="1" step="1" value={f.quantity} onChange={set('quantity')} /></Field></div>
                  <div className="w-100"><Field label="Needed by"><input className="form-control" type="date" min={today()} value={f.neededDate} onChange={set('neededDate')} /></Field></div>
                </div>
              ) : (<>
                <div className="d-flex gap-2">
                  <div className="w-100"><Field label="Travel date"><input className="form-control" type="date" min={today()} value={f.travelDate} onChange={set('travelDate')} /></Field></div>
                  <div className="w-100"><Field label="Return (optional)"><input className="form-control" type="date" min={f.travelDate || today()} value={f.returnDate} onChange={set('returnDate')} /></Field></div>
                </div>
                <div className="d-flex gap-2">
                  <div className="w-100"><Field label="Service fee (₱)"><input className="form-control" type="number" min="0" inputMode="decimal" value={f.serviceFee} onChange={set('serviceFee')} /></Field></div>
                  <div className="w-100"><Field label="Space left (items)"><input className="form-control" type="number" min="1" step="1" value={f.spaceLeft} onChange={set('spaceLeft')} /></Field></div>
                </div>
              </>)}
              {error && <div className="alert alert-danger py-2 my-2" role="alert">{error}</div>}
              <div className="pt-2 mt-2 d-flex flex-column" style={{ borderTop: '1px solid rgba(128,128,128,.4)' }}>
                <div className="d-flex justify-content-between mb-2">
                  <small className="text-secondary">{step === 'request' ? 'Budget + service fee (set by traveler)' : `Trip ${f.origin || '…'} to ${f.destination || '…'}`}</small>
                  <small className="text-black fw-bold">Held safely</small>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => choose('choose')} disabled={busy}>Back</button>
                  <button className="btn btn-primary flex-grow-1" type="submit" disabled={busy}>{busy ? 'Posting…' : step === 'request' ? 'Post request' : 'Post a trip'}</button>
                </div>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="d-flex flex-column justify-content-center align-items-center w-100 py-3 text-center">
              <div className="rounded-circle bg-primary bg-opacity-25 d-flex justify-content-center align-items-center mb-2" style={{ width: 48, height: 48 }}><svg className="bi bi-lg align-middle text-primary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-check-circle`} /></svg></div>
              <h3 className="mb-1">{posted === 'request' ? 'Request posted' : 'Trip posted'}</h3>
              <small className="text-secondary">{posted === 'request' ? 'Travelers heading to your destination can now see it.' : 'Requesters can now see your trip and send you messages.'}</small>
              <small className="text-secondary">It's live on the home feed.</small>
              <div className="mt-4 w-100 d-flex flex-column gap-2">
                <button className="btn btn-primary w-100" onClick={onClose}>See it in the feed</button>
                <button className="btn btn-outline-secondary w-100" onClick={() => choose('choose')}>Post another</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ComposerProvider({ children }) {
  const [open, setOpen] = useState(false)
  const openComposer = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  // Any leftover Bootstrap trigger for #post (other pages' navbars) opens the composer instead.
  useEffect(() => {
    const h = (e) => {
      const t = e.target.closest?.('[data-bs-target="#post"],a[href="#post"]'); if (!t) return
      e.preventDefault(); e.stopPropagation(); setOpen(true)
    }
    document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true)
  }, [])
  return <ComposerContext.Provider value={{ openComposer }}>{children}{open && <Composer onClose={close} />}</ComposerContext.Provider>
}
