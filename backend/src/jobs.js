// Releases held payments (simulated) when the requester has not confirmed or disputed within the window after delivery.
import { pool, q } from './db.js'; import { notify } from './notify.js'; import { payEvent } from './routes/market.js'
export async function autoReleaseDue() {
  const due = await q("SELECT p.id, p.transaction_id AS txId, p.payer_id AS payer, p.payee_id AS payee, t.item_details AS item FROM payments p JOIN transactions t ON t.id=p.transaction_id WHERE p.status='held' AND p.auto_release_at <= NOW() AND t.transaction_status='delivered'")
  for (const p of due) {
    const c = await pool.getConnection()
    try {
      await c.beginTransaction()
      const [res] = await c.execute("UPDATE payments SET status='released', released_at=NOW(), auto_release_at=NULL WHERE id=? AND status='held'", [p.id]) // guard: never release twice
      if (!res.affectedRows) { await c.rollback(); continue }
      await c.execute("UPDATE transactions SET transaction_status='completed', payment_status='released', delivery_status='received' WHERE id=?", [p.txId])
      await c.execute("INSERT INTO transaction_history (transaction_id,status,actor_id) VALUES (?,'completed','system')", [p.txId])
      await payEvent(c, p.id, 'released', 'system', 'Auto-released: no response after delivery'); await c.commit()
      for (const u of [p.payer, p.payee]) await notify(u, 'payment', `Payment for "${p.item}" was released automatically (simulated).`, p.txId, '/transactions')
    } catch (e) { await c.rollback(); console.error('auto-release failed', p.id, e.message) } finally { c.release() }
  }
}
