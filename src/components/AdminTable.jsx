import { useState } from 'react'

const cell = (r, key) => (typeof r[key] === 'boolean' ? (r[key] ? 'Yes' : 'No') : r[key])

// Reusable admin table: search, optional filter, and row actions.
// Wide screens get a table; phones get one card per row so nothing needs sideways scrolling.
export default function AdminTable({ title, rows, columns, searchKeys, filterKey, filterOptions = [], actions = () => [], note }) {
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all'); const [view, setView] = useState(null)
  const shown = rows.filter((r) => (flt === 'all' || r[filterKey] === flt) && searchKeys.some((k) => String(r[k]).toLowerCase().includes(q.toLowerCase())))
  return (
    <>
      <h4 className="fw-bold mb-3">{title}</h4>
      {note && <div className="alert alert-secondary py-2 small">{note}</div>}
      <div className="row g-2 mb-3">
        <div className={filterKey ? 'col-7 col-md-6' : 'col-12 col-md-6'}><input type="search" className="form-control" placeholder="Search" aria-label={`Search ${title}`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {filterKey && (
          <div className="col-5 col-md-3">
            <select className="form-select" aria-label="Filter" value={flt} onChange={(e) => setFlt(e.target.value)}>
              <option value="all">All</option>{filterOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="small text-secondary mb-2">{shown.length} result{shown.length === 1 ? '' : 's'}</div>

      {/* md and up: table */}
      <div className="table-responsive card d-none d-md-block"><table className="table align-middle m-0">
        <thead><tr>{columns.map((c) => <th key={c[0]}>{c[1]}</th>)}<th /></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => <td key={c[0]}>{cell(r, c[0])}</td>)}
              <td className="text-end text-nowrap">
                <button className="btn btn-sm btn-light me-1" onClick={() => setView(r)}>View</button>
                {actions(r).map((a) => <button key={a.label} className={`btn btn-sm me-1 btn-${a.cls || 'dark'}`} onClick={a.onClick}>{a.label}</button>)}
              </td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={columns.length + 1} className="text-center text-secondary">No results.</td></tr>}
        </tbody>
      </table></div>

      {/* below md: cards */}
      <div className="d-md-none d-flex flex-column gap-2">
        {shown.map((r) => (
          <div className="card p-3" key={r.id}>
            <div className="fw-bold text-black text-break">{cell(r, columns[0][0])}</div>
            <div className="mt-1 small">
              {columns.slice(1).map((c) => (
                <div className="d-flex gap-2 py-1" key={c[0]}><span className="text-secondary flex-shrink-0" style={{ width: '32%' }}>{c[1]}</span><span className="text-break">{cell(r, c[0])}</span></div>
              ))}
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              <button className="btn btn-sm btn-light px-3 py-2" onClick={() => setView(r)}>View</button>
              {actions(r).map((a) => <button key={a.label} className={`btn btn-sm px-3 py-2 btn-${a.cls || 'dark'}`} onClick={a.onClick}>{a.label}</button>)}
            </div>
          </div>
        ))}
        {!shown.length && <div className="text-center text-secondary py-4">No results.</div>}
      </div>

      {view && (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setView(null)}><div className="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div className="modal-content">
            <div className="modal-header"><h5 className="modal-title">Details</h5><button className="btn-close" aria-label="Close" onClick={() => setView(null)} /></div>
            <div className="modal-body">{Object.entries(view).filter(([k]) => k !== 'password').map(([k, v]) => <div key={k} className="text-break"><strong>{k}:</strong> {String(v)}</div>)}</div>
          </div></div></div>
          <div className="modal-backdrop show" />
        </>
      )}
    </>
  )
}
