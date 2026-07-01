// =====================================================================
//  BUYURTMA DETALI — pul oqimi + amallar + to'lovlar
// =====================================================================
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtMoney, fmtDate, ORDER_STATUS, PAYOUT_STAGE, Badge, TRANSPORT, CONTAINERS } from '../lib/format'
import Modal from '../components/Modal'

const STEPS = [
  { key: 'draft', label: 'Qoralama' },
  { key: 'confirmed', label: 'Tasdiq · escrow' },
  { key: 'in_transit', label: "Yo'lda · avans" },
  { key: 'delivered', label: 'Yetkazildi · balans' },
]
const STATUS_IDX = { draft: 0, confirmed: 1, in_transit: 2, delivered: 3, closed: 3 }

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [shipping, setShipping] = useState(false)

  const q = useAsync(() => api.orders.get(id), [id])
  const order = q.data?.order
  const shipments = q.data?.shipments || []
  const payouts = q.data?.payouts || []

  const isOwner = order && user.role === 'importer' && String(order.importer_id) === String(user.id)
  const isImpAdmin = user.role === 'super_admin' || isOwner
  const isLogAdmin = user.role === 'super_admin' || user.role === 'logistics'
  const cancelled = order?.status === 'cancelled'

  async function act(name, fn) {
    setErr('')
    setBusy(name)
    try {
      await fn()
      q.reload()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  if (q.loading) return <div className="muted mono">Yuklanmoqda…</div>
  if (q.error) return <div className="inline-err">{q.error}</div>
  if (!order) return null

  const idx = STATUS_IDX[order.status] ?? 0

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/orders')}>← Buyurtmalar</button>

      <div className="toolbar">
        <div>
          <div className="row center" style={{ gap: '0.7rem' }}>
            <h1 className="mono">{order.tracking_code}</h1>
            <Badge map={ORDER_STATUS} value={order.status} />
          </div>
          <div className="meta-row">
            <div className="meta-item"><div className="ml">Mahsulot</div><div className="mv">{order.product_name || '—'}</div></div>
            <div className="meta-item"><div className="ml">Qiymat</div><div className="mv">{fmtMoney(order.total_value_usd)}</div></div>
            <div className="meta-item"><div className="ml">Avans</div><div className="mv">{Number(order.advance_pct)}%</div></div>
            <div className="meta-item"><div className="ml">Komissiya</div><div className="mv">{Number(order.commission_pct)}%</div></div>
            {order.incoterm && <div className="meta-item"><div className="ml">Incoterm</div><div className="mv" style={{ textTransform: 'uppercase' }}>{order.incoterm}</div></div>}
          </div>
        </div>
      </div>

      {err && <div className="inline-err">{err}</div>}

      <div className="card card-pad" style={{ marginBottom: '1.2rem' }}>
        {cancelled ? (
          <div className="cancel-banner">Buyurtma bekor qilindi{order.escrow_status === 'refunded' ? ' — pul importyorga qaytarildi' : ''}.</div>
        ) : (
          <div className="stepper">
            {STEPS.map((s, i) => (
              <div key={s.key} className={'step' + (i < idx ? ' done' : i === idx ? ' active' : '')}>
                <div className="step-dot">{i < idx ? '✓' : i + 1}</div>
                <div className="step-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="detail-actions" style={{ marginTop: cancelled ? 0 : '1.2rem' }}>
          {isImpAdmin && order.status === 'draft' && (
            <button className="btn btn-primary" disabled={busy === 'confirm'} onClick={() => act('confirm', () => api.orders.confirm(id))}>
              {busy === 'confirm' ? '…' : 'Tasdiqlash (escrowga pul)'}
            </button>
          )}
          {isLogAdmin && order.status === 'confirmed' && (
            <button className="btn btn-accent" onClick={() => setShipping(true)}>Jo'natish (avans chiqadi)</button>
          )}
          {isLogAdmin && order.status === 'in_transit' && (
            <button className="btn btn-primary" disabled={busy === 'deliver'} onClick={() => act('deliver', () => api.orders.deliver(id))}>
              {busy === 'deliver' ? '…' : 'Yetkazildi (balans + komissiya)'}
            </button>
          )}
          {isImpAdmin && (order.status === 'draft' || order.status === 'confirmed') && (
            <button className="btn" disabled={busy === 'cancel'} onClick={() => { if (confirm('Buyurtmani bekor qilamizmi?')) act('cancel', () => api.orders.cancel(id)) }}>
              {busy === 'cancel' ? '…' : 'Bekor qilish'}
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* To'lovlar */}
        <div className="card">
          <div className="card-head"><h3>To'lovlar</h3><span className="count-pill">{payouts.length}</span></div>
          {payouts.length === 0 ? (
            <div className="card-pad muted">Hali to'lov chiqarilmagan. Jo'natishda avans, yetkazishda balans chiqadi.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Bosqich</th><th>Oluvchi</th><th className="num">Summa</th><th>Sana</th></tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td><Badge map={PAYOUT_STAGE} value={p.stage} /></td>
                    <td>{p.company_name || <span className="faint">Operator</span>}</td>
                    <td className="num">{fmtMoney(p.amount_usd)}</td>
                    <td className="faint" style={{ fontSize: '0.82rem' }}>{fmtDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Jo'natma */}
        <div className="card">
          <div className="card-head"><h3>Jo'natma</h3></div>
          {shipments.length === 0 ? (
            <div className="card-pad muted">Hali jo'natma yo'q.</div>
          ) : (
            <div className="card-pad">
              {shipments.map((s) => (
                <div key={s.id}>
                  <div className="kv"><span className="k">Holat</span><span className="v">{s.status}</span></div>
                  {s.provider_name && <div className="kv"><span className="k">Provayder</span><span className="v">{s.provider_name}</span></div>}
                  {s.corridor_name && <div className="kv"><span className="k">Koridor</span><span className="v">{s.corridor_name}</span></div>}
                  {s.container_type && <div className="kv"><span className="k">Konteyner</span><span className="v" style={{ textTransform: 'uppercase' }}>{s.container_type}</span></div>}
                  {s.departure_date && <div className="kv"><span className="k">Jo'nash</span><span className="v">{fmtDate(s.departure_date)}</span></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {shipping && (
        <ShipForm
          onClose={() => setShipping(false)}
          onShipped={(body) => {
            setShipping(false)
            act('ship', () => api.orders.ship(id, body))
          }}
        />
      )}
    </div>
  )
}

function ShipForm({ onClose, onShipped }) {
  const [f, setF] = useState({ transport_mode: '', container_type: '', departure_date: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <Modal
      title="Jo'natishni boshlash"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor</button>
          <button className="btn btn-accent" onClick={() => onShipped({
            transport_mode: f.transport_mode || null,
            container_type: f.container_type || null,
            departure_date: f.departure_date || null,
          })}>Jo'natish</button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>Jo'natilgach avans eksportyorlarga chiqariladi.</p>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Transport</label>
          <select className="select" value={f.transport_mode} onChange={set('transport_mode')}>
            <option value="">—</option>
            {TRANSPORT.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field grow">
          <label className="label">Konteyner</label>
          <select className="select" value={f.container_type} onChange={set('container_type')}>
            <option value="">—</option>
            {CONTAINERS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">Jo'nash sanasi</label>
        <input className="input" type="date" value={f.departure_date} onChange={set('departure_date')} />
      </div>
    </Modal>
  )
}
