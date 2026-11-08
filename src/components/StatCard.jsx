export default function StatCard({ label, value }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card h-100"><div className="card-body"><div className="text-secondary small">{label}</div><h3 className="fw-bold m-0">{value}</h3></div></div>
    </div>
  )
}
