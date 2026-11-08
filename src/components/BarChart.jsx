// Dependency-free bar chart built from Bootstrap utilities.
export default function BarChart({ title, data }) {
  const max = Math.max(...data.map((d) => d[1]), 1)
  return (
    <div className="card h-100"><div className="card-body">
      <h6 className="fw-bold">{title}</h6>
      {data.map(([label, n]) => (
        <div className="mb-2" key={label}>
          <div className="d-flex justify-content-between small"><span>{label}</span><span>{n}</span></div>
          <div className="admin-bar" style={{ width: `${(n / max) * 100}%` }} />
        </div>
      ))}
    </div></div>
  )
}
