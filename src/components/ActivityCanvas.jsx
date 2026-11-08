import { useCallback, useState } from 'react'
import { transactionService, userService, postService } from '../services/index.js'
import useActor from '../hooks/useActor.js'
import useLive from '../hooks/useLive.js'

const DONE = { approved: 1, paid: 2, in_transit: 3, delivered: 4, completed: 4, disputed: 2 }
const LABEL = { pending: 'Awaiting approval', approved: 'Approved', paid: 'Payment held', in_transit: 'In transit', delivered: 'Delivered', disputed: 'Disputed' }
const STEPS = [
  { label: 'Approved', bar: 'bg-success', text: 'text-dark-emphasis' }, { label: 'Paid', bar: 'bg-success', text: 'text-dark-emphasis' },
  { label: 'Purchased', bar: 'bg-warning', text: 'text-warning' }, { label: 'Delivered', bar: 'bg-dark', text: 'text-dark-emphasis' },
]

// The "Activity" bottom sheet: the user's latest unfinished transaction. Same markup as the original #CartCanvas.
export default function ActivityCanvas() {
  const actor = useActor(); const [info, setInfo] = useState(null)
  const load = useCallback(async () => {
    if (!actor) return
    const tx = (await transactionService.getForUser(actor)).filter((t) => !['completed', 'cancelled'].includes(t.transactionStatus)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (!tx) return setInfo(null)
    let other = null; try { other = await userService.getById(tx.requesterId === actor ? tx.travelerId : tx.requesterId) } catch { /* gone */ }
    let post = null; if (tx.postId) { try { post = await postService.getById(tx.postId) } catch { /* gone */ } }
    setInfo({ tx, other, post })
  }, [actor])
  useLive(load); useState(() => { load() })
  const n = info ? DONE[info.tx.transactionStatus] || 0 : 0
  const route = info ? `${info.tx.pickup || info.post?.origin || ''} to ${info.tx.deliverTo || info.post?.destination || ''}` : ''
  return (
    <div className="p-3 offcanvas offcanvas-bottom d-lg-none bg-white rounded-top-4" tabIndex="-1" id="CartCanvas" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="d-flex flex-column">
        <div className="d-flex justify-content-between">
          <h5 className="text-black">Active transaction{info && <> <span className="badge rounded-pill text-warning bg-warning bg-opacity-25 align-middle">{LABEL[info.tx.transactionStatus] || info.tx.transactionStatus}</span></>}</h5>
          <button className="btn btn-close" type="button" data-bs-dismiss="offcanvas"></button>
        </div>
        {info ? (<><h5 className="text-black">{info.tx.itemDetails}</h5><p className="text-dark-emphasis">with {info.other?.name || 'another user'}. {route}</p></>) : <p className="text-dark-emphasis">No active transaction right now.</p>}
      </div>
      {info && (
        <div className="offcanvas-body">
          <div className="row g-1 text-center">
            {STEPS.map((s, i) => (
              <div className="col-3" key={s.label}>
                <div className="progress" style={{ height: '5px' }}><div className={`progress-bar ${s.bar}`} style={{ width: i < n ? '100%' : '0%' }}></div></div>
                <small className={i < n ? s.text : 'text-secondary'}>{s.label}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
